import { BN } from '@coral-xyz/anchor';
import { type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { debug, error, expBackoff, info, numericToBN, numericToDecimal, numericToString, usdToTokenAmount } from '@npc/core';
import OrcaLiquidityDAO from '@npc/orca/data/orca-liquidity/orca-liquidity.dao';
import type { LiquidityUnit } from '@npc/orca/interfaces/liquidity.interfaces';
import type { LiquidityTxSummary } from '@npc/orca/services/liquidity/interfaces/liquidity-tx.interfaces';
import { getPositions } from '@npc/orca/services/position/query/query-position';
import { getWhirlpool } from '@npc/orca/services/whirlpool/query/query-whirlpool';
import env from '@npc/orca/util/env/env';
import { toTickRangeKeys } from '@npc/orca/util/tick-range/tick-range';
import whirlpoolClient, { formatWhirlpool, getWhirlpoolTokenPair } from '@npc/orca/util/whirlpool/whirlpool';
import { getProgramErrorInfo, getTokenPrice, getTransferTotalsFromIxs, getTxSummary, rpc, SendTransactionResult, STABLECOIN_SYMBOL_REGEX, toPubKey, toPubKeyStr, TransactionContext, wallet } from '@npc/solana';
import { Percentage, resolveOrCreateATAs, TransactionBuilder, type Address } from '@orca-so/common-sdk';
import { IGNORE_CACHE, increaseLiquidityQuoteByInputTokenWithParams, increaseLiquidityQuoteByLiquidityWithParams, TokenExtensionUtil, WhirlpoolIx, type IncreaseLiquidityParams, type IncreaseLiquidityQuote, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import type Decimal from 'decimal.js';
import type { IncreaseLiquidityIxArgs, IncreaseLiquidityIxData } from './increase-liquidity.interfaces';

/**
 * Increases liquidity of all {@link Position}s in a {@link Whirlpool}.
 *
 * @param whirlpoolAddress The {@link Address} of the {@link Whirlpool} to increase liquidity in.
 * @param amount The amount of liquidity to deposit in the {@link Whirlpool}. Divided evenly among open positions.
 * @param unit The {@link LiquidityUnit} to use for the amount. Defaults to `usd`.
 * @returns A {@link Promise} that resolves to a {@link Map} of {@link Position} addresses to {@link LiquidityTxSummary}s.
 */
export async function increaseAllLiquidity(
  whirlpoolAddress: Address,
  amount: BN | Decimal.Value,
  unit: LiquidityUnit = 'usd'
): Promise<Map<string, LiquidityTxSummary>> {
  info('\n-- Increasing All liquidity --');

  const txSummaries = new Map<string, LiquidityTxSummary>();

  // Get Whirlpool and Bundled Positions
  const whirlpool = await whirlpoolClient().getPool(whirlpoolAddress);
  const bundledPositions = await getPositions({ whirlpoolAddress });

  // Get amount to increase per position (divide amount evenly among positions in whirlpool)
  const decimals = (unit === 'tokenA')
    ? whirlpool.getTokenAInfo().decimals
    : (unit === 'tokenB')
      ? whirlpool.getTokenBInfo().decimals
      : undefined;
  const divAmount = numericToDecimal(amount, decimals).div(bundledPositions.length);

  const whirlpoolLogStr = await formatWhirlpool(whirlpool);
  bundledPositions.length
    ? info(`Increasing liquidity of ${bundledPositions.length} positions in pool:`, whirlpoolLogStr)
    : info('No positions to increase liquidity of in pool:', whirlpoolLogStr);

  // Increase liquidity of each position in parallel
  const promises = bundledPositions.map(async ({ position }) => {
    const txSummary = await increaseLiquidity(position, divAmount, unit)
      .catch((err) => { error(err); });

    if (txSummary) {
      txSummaries.set(position.getAddress().toBase58(), txSummary);
    }
  });

  await Promise.all(promises);
  return txSummaries;
}

/**
 * Increases liquidity in a given {@link position}.
 *
 * @param position The {@link Position} to increase the liquidity of.
 * @param amount The amount of liquidity to deposit in the {@link Position}.
 * @param unit The {@link LiquidityUnit} to use for the amount. Defaults to `usd`.
 * @returns A {@link Promise} that resolves to the {@link LiquidityTxSummary} delta info.
 * @throws An {@link Error} if the transaction fails to complete.
 */
export async function increaseLiquidity(
  position: Position,
  amount: BN | Decimal.Value,
  unit: LiquidityUnit = 'usd'
): Promise<LiquidityTxSummary> {
  const transactionCtx = new TransactionContext();
  const whirlpool = await getWhirlpool({ whirlpoolAddress: position.getData().whirlpool });

  const opMetadata = {
    whirlpool: await formatWhirlpool(whirlpool),
    position: position.getAddress().toBase58(),
    amount: `${amount.toString()} ${unit}`,
  };

  try {
    return expBackoff(async (retry) => {
      info('\n-- Increasing liquidity --\n', {
        ...opMetadata,
        retry,
      });

      // Must refresh data if retrying, or may generate error due to stale data
      if (retry) {
        await position.refreshData();
      }

      // Generate instruction data to increase liquidity
      const ixData = await genIncreaseLiquidityIxData({
        liquidity: amount,
        positionAddress: position.getAddress(),
        positionMint: position.getData().positionMint,
        tickRange: [position.getData().tickLowerIndex, position.getData().tickUpperIndex],
        whirlpool,
        liquidityUnit: unit,
      });

      // Send transaction
      const sendResult = await transactionCtx
        .resetInstructionData(ixData)
        .send();

      // Get Liquidity tx summary and insert into DB
      const txSummary = await genIncreaseLiquidityTxSummary(position, ixData, sendResult);
      await OrcaLiquidityDAO.insert(txSummary, { catchErrors: true });

      return txSummary;
    }, {
      retryFilter: (result, err) => {
        const errInfo = getProgramErrorInfo(err);
        return ['InvalidTimestamp', 'TokenMaxExceeded'].includes(errInfo?.name ?? '');
      }
    });
  } catch (err) {
    error('Failed to increase liquidity:', opMetadata);
    throw err;
  }
}

/**
 * Generates {@link IncreaseLiquidityIxData} to increase liquidity in a given {@link Position}.
 *
 * @param ixArgs The {@link IncreaseLiquidityIxArgs} for generating the instruction data
 * to increase liquidity in a {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link IncreaseLiquidityIxData}.
 * @throws An {@link Error} if there's an insufficient wallet balance for token A or B.
 */
export async function genIncreaseLiquidityIxData(ixArgs: IncreaseLiquidityIxArgs): Promise<IncreaseLiquidityIxData> {
  const { positionAddress, positionMint, liquidity, liquidityUnit = 'usd', tickRange, whirlpool } = ixArgs;

  const liquidityDecimals = _getLiquidityDecimals(liquidityUnit, await getWhirlpoolTokenPair(whirlpool));
  const opMetadata = {
    whirlpool: await formatWhirlpool(whirlpool),
    position: toPubKeyStr(positionAddress),
    liquidity: `${numericToString(liquidity, liquidityDecimals)} ${liquidityUnit}`,
  };
  info('Creating Tx to increase liquidity:', opMetadata);

  // Convert to token amount if liquidity is in USD
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(whirlpool);
  const { tokenAmount, tokenUnit } = (liquidityUnit === 'usd')
    ? await _toTokenAmount([tokenA, tokenB], liquidity)
    : { tokenAmount: liquidity, tokenUnit: undefined };

  // Get quote either using raw liquidity as unit or token A/B as unit
  const quote = (liquidityUnit === 'liquidity')
    ? await _genQuoteViaLiquidity(whirlpool, tickRange, liquidity)
    : await _genQuoteViaInputToken(whirlpool, tickRange, tokenAmount, tokenUnit!);

  info('Generated increase liquidity quote:', {
    whirlpool: await formatWhirlpool(whirlpool),
    position: toPubKeyStr(positionAddress),
    [`${tokenA.metadata.symbol} Max`]: numericToString(quote.tokenMaxA, tokenA.mint.decimals),
    [`${tokenB.metadata.symbol} Max`]: numericToString(quote.tokenMaxB, tokenB.mint.decimals),
  });

  const walletBalanceA = await wallet().getBalance(tokenA.mint.publicKey);
  if (walletBalanceA.lt(quote.tokenMaxA)) {
    const walletBalanceAStr = numericToString(walletBalanceA, tokenA.mint.decimals);
    throw new Error(`Insufficient ${tokenA.metadata.symbol} balance: ${walletBalanceAStr}`);
  }

  const walletBalanceB = await wallet().getBalance(tokenB.mint.publicKey);
  if (walletBalanceB.lt(quote.tokenMaxB)) {
    const walletBalanceBStr = numericToString(walletBalanceB, tokenB.mint.decimals);
    throw new Error(`Insufficient ${tokenB.metadata.symbol} balance: ${walletBalanceBStr}`);
  }

  // Resolve token accounts for the position and wallet token A/B
  const {
    positionTokenAccount,
    tokenOwnerAccountA,
    tokenOwnerAccountAIx,
    tokenOwnerAccountB,
    tokenOwnerAccountBIx,
  } = await _resolveTokenAccounts(positionMint, whirlpool, quote);

  // Get bounding tick array keys for the position
  const [tickArrayLower, tickArrayUpper] = toTickRangeKeys(
    whirlpool.getAddress(),
    tickRange,
    whirlpool.getData().tickSpacing
  );

  const tokenExtensionCtx = await TokenExtensionUtil.buildTokenExtensionContext(
    whirlpoolClient().getFetcher(),
    whirlpool.getData(),
    IGNORE_CACHE
  );

  // Generate increase liquidity instruction
  const baseParams: IncreaseLiquidityParams = {
    ...quote,
    whirlpool: whirlpool.getAddress(),
    position: toPubKey(positionAddress),
    positionTokenAccount,
    tokenOwnerAccountA,
    tokenOwnerAccountB,
    tokenVaultA: whirlpool.getData().tokenVaultA,
    tokenVaultB: whirlpool.getData().tokenVaultB,
    tickArrayLower,
    tickArrayUpper,
    positionAuthority: wallet().publicKey,
  };
  // V2 can handle TokenProgram/TokenProgram pool, but it increases the size of transaction, so V1 is prefer if possible.
  const increaseIx = !TokenExtensionUtil.isV2IxRequiredPool(tokenExtensionCtx)
    ? WhirlpoolIx.increaseLiquidityIx(whirlpoolClient().getContext().program, baseParams)
    : WhirlpoolIx.increaseLiquidityV2Ix(whirlpoolClient().getContext().program, {
      ...baseParams,
      tokenMintA: new PublicKey(tokenA.mint.publicKey),
      tokenMintB: new PublicKey(tokenB.mint.publicKey),
      tokenProgramA: tokenExtensionCtx.tokenMintWithProgramA.tokenProgram,
      tokenProgramB: tokenExtensionCtx.tokenMintWithProgramB.tokenProgram,
      ...await TokenExtensionUtil.getExtraAccountMetasForTransferHookForPool(
        rpc(),
        tokenExtensionCtx,
        baseParams.tokenOwnerAccountA,
        baseParams.tokenVaultA,
        baseParams.positionAuthority,
        baseParams.tokenOwnerAccountB,
        baseParams.tokenVaultB,
        baseParams.positionAuthority,
      ),
    });

  const txBuilder = new TransactionBuilder(rpc(), wallet())
    .addInstruction(tokenOwnerAccountAIx)
    .addInstruction(tokenOwnerAccountBIx)
    .addInstruction(increaseIx);

  return {
    ...txBuilder.compressIx(false),
    positionAddress,
    ixArgs,
    quote,
    whirlpool,
    debugData: {
      name: 'Increase Liquidity',
      whirlpool: await formatWhirlpool(whirlpool),
      position: toPubKeyStr(positionAddress),
      liquidity: `${numericToString(liquidity, liquidityDecimals)} ${liquidityUnit}`,
      [`${tokenA.metadata.symbol} Max`]: numericToString(quote.tokenMaxA, tokenA.mint.decimals),
      [`${tokenB.metadata.symbol} Max`]: numericToString(quote.tokenMaxB, tokenB.mint.decimals),
    }
  };
}

/**
 * Resolves (gets or creates) token accounts for the given {@link positionMint}.
 *
 * @param positionMint The mint of the {@link Position} to resolve token accounts for.
 * @param whirlpool The {@link Whirlpool} containing the {@link Position}.
 * @param quote The {@link IncreaseLiquidityQuote} for the transaction.
 * @returns A {@link Promise} that resolves to an object containing the resolved token accounts
 * and any {@link Instruction}s for creating the token accounts.
 */
async function _resolveTokenAccounts(positionMint: Address, whirlpool: Whirlpool, quote: IncreaseLiquidityQuote) {
  const { accountResolverOpts, fetcher } = whirlpoolClient().getContext();
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(whirlpool);
  const [tokenMintA, tokenMintB] = [new PublicKey(tokenA.mint.publicKey), new PublicKey(tokenB.mint.publicKey)];

  // Resolve token accounts for the wallet token A/B
  const [ataA, ataB] = await resolveOrCreateATAs(
    rpc(),
    wallet().publicKey,
    [
      { tokenMint: tokenMintA, wrappedSolAmountIn: quote.tokenMaxA },
      { tokenMint: tokenMintB, wrappedSolAmountIn: quote.tokenMaxB },
    ],
    () => fetcher.getAccountRentExempt(),
    wallet().publicKey,
    undefined, // use default
    accountResolverOpts.allowPDAOwnerAddress,
    accountResolverOpts.createWrappedSolAccountMethod
  );
  const { address: ataAddrA, ...tokenOwnerAccountAIx } = ataA!;
  const { address: ataAddrB, ...tokenOwnerAccountBIx } = ataB!;
  const tokenOwnerAccountA = ataAddrA;
  const tokenOwnerAccountB = ataAddrB;

  // Resolve position token account
  const positionTokenAccount = getAssociatedTokenAddressSync(
    toPubKey(positionMint),
    wallet().publicKey,
    accountResolverOpts.allowPDAOwnerAddress
  );

  return {
    positionTokenAccount,
    tokenOwnerAccountA,
    tokenOwnerAccountAIx,
    tokenOwnerAccountB,
    tokenOwnerAccountBIx,
  };
}

/**
 * Converts a given {@link usd} amount to a token amount of either token
 * in the given {@link tokenPair} with priority for a stablecoin.
 *
 * @param tokenPair The token pair containing the tokens that the {@link usd} amount may be converted to.
 * @param usd The amount of `USD` to convert.
 * @returns A {@link Promise} that resolves to the token amount and the {@link LiquidityUnit} of the token.
 */
async function _toTokenAmount(
  tokenPair: [DigitalAsset, DigitalAsset],
  usd: BN | Decimal.Value,
): Promise<{ tokenAmount: Decimal, tokenUnit: 'tokenA' | 'tokenB' }> {
  const [tokenA, tokenB] = tokenPair;

  debug(`Converting USD (${usd.toString()}) to either token:`, tokenPair.map((token) => token.metadata.symbol));

  // If either token is a stablecoin, prioritize that token
  if (STABLECOIN_SYMBOL_REGEX.test(tokenA.metadata.symbol)) {
    return {
      tokenAmount: usdToTokenAmount(usd, 1),
      tokenUnit: 'tokenA'
    };
  }
  if (STABLECOIN_SYMBOL_REGEX.test(tokenB.metadata.symbol)) {
    return {
      tokenAmount: usdToTokenAmount(usd, 1),
      tokenUnit: 'tokenB'
    };
  }

  // Otherwise, query the USD price of both tokens via API
  const usdTokenA = await getTokenPrice(tokenA);
  if (usdTokenA) {
    return {
      tokenAmount: usdToTokenAmount(usd, usdTokenA),
      tokenUnit: 'tokenA',
    };
  }
  const usdTokenB = await getTokenPrice(tokenB);
  if (usdTokenB) {
    return {
      tokenAmount: usdToTokenAmount(usd, usdTokenB),
      tokenUnit: 'tokenB',
    };
  }

  throw new Error(`USD price not found for '${tokenA.metadata.symbol}' or '${tokenB.metadata.symbol}'`);
}

async function _genQuoteViaLiquidity(
  whirlpool: Whirlpool,
  tickRange: [number, number],
  amount: BN | Decimal.Value,
): Promise<IncreaseLiquidityQuote> {
  const { sqrtPrice, tickCurrentIndex } = whirlpool.getData();

  debug('Getting increase liquidity quote:', amount.toString());

  return increaseLiquidityQuoteByLiquidityWithParams({
    liquidity: numericToBN(amount),
    // Pool state
    tickCurrentIndex,
    sqrtPrice,
    // Position tick (price) range
    tickLowerIndex: tickRange[0],
    tickUpperIndex: tickRange[1],
    // Acceptable slippage
    slippageTolerance: Percentage.fromFraction(env.SLIPPAGE_DEFAULT, 100),
    // Token ext
    tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(
      whirlpoolClient().getFetcher(),
      whirlpool.getData(),
      IGNORE_CACHE
    ),
  });
}

async function _genQuoteViaInputToken(
  whirlpool: Whirlpool,
  tickRange: [number, number],
  amount: BN | Decimal.Value,
  unit: 'tokenA' | 'tokenB'
): Promise<IncreaseLiquidityQuote> {
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(whirlpool);
  if (!tokenA || !tokenB) throw new Error('Token not found');

  const inputToken = (unit === 'tokenA')
    ? tokenA
    : tokenB;

  debug('Getting increase liquidity quote:',
    numericToString(amount, inputToken.mint.decimals),
    inputToken.metadata.symbol);

  const tokenMintA = new PublicKey(tokenA.mint.publicKey);
  const tokenMintB = new PublicKey(tokenB.mint.publicKey);

  return increaseLiquidityQuoteByInputTokenWithParams({
    // Pool definition and state
    tokenMintA,
    tokenMintB,
    sqrtPrice: whirlpool.getData().sqrtPrice,
    tickCurrentIndex: whirlpool.getData().tickCurrentIndex,
    // Position tick (price) range
    tickLowerIndex: tickRange[0],
    tickUpperIndex: tickRange[1],
    // Input token and amount
    inputTokenMint: new PublicKey(inputToken.mint.publicKey),
    inputTokenAmount: numericToBN(amount, inputToken.mint.decimals),
    // Acceptable slippage
    slippageTolerance: Percentage.fromFraction(env.SLIPPAGE_DEFAULT, 100),
    // Token ext
    tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(
      whirlpoolClient().getFetcher(),
      whirlpool.getData(),
      IGNORE_CACHE
    ),
  });
}

/**
 * Generates a {@link LiquidityTxSummary}.
 *
 * @param position The {@link Position} to get the {@link LiquidityTxSummary} for.
 * @param ixData The {@link IncreaseLiquidityIxData} for the transaction that changed the liquidity.
 * @param sendResult The {@link SendTransactionResult} of the transaction that changed the liquidity.
 * @returns A {@link Promise} that resolves to the {@link LiquidityTxSummary}.
 */
export async function genIncreaseLiquidityTxSummary(
  position: Position,
  ixData: IncreaseLiquidityIxData,
  sendResult: SendTransactionResult,
): Promise<LiquidityTxSummary> {
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());
  const txSummary = await getTxSummary(sendResult);

  const liquidityIx = txSummary.decodedIxs.find(
    (ix) => /increase\s*liquidity/i.test(ix.name)
  );
  if (!liquidityIx) throw new Error('No increase liquidity instruction found in transaction');
  const { tokenTotals, usd } = await getTransferTotalsFromIxs([liquidityIx]);

  const liquidityUnit = ixData.ixArgs.liquidityUnit ?? 'usd';
  const liquidityDecimals = _getLiquidityDecimals(liquidityUnit, [tokenA, tokenB]);
  const liquidity = numericToBN(ixData.ixArgs.liquidity, liquidityDecimals);

  const liquidityTxSummary: LiquidityTxSummary = {
    liquidity,
    liquidityUnit,
    position,
    slippage: Percentage.fromFraction(
      ixData.quote.tokenMaxA,
      ixData.quote.tokenEstA
    ).toDecimal().toNumber() - 1,
    tokenAmountA: tokenTotals.get(tokenA.mint.publicKey)?.neg() ?? new BN(0),
    tokenAmountB: tokenTotals.get(tokenB.mint.publicKey)?.neg() ?? new BN(0),
    ...txSummary,
    usd: usd * -1, // Tx data is in relationship to wallet, so negate to get flow in/out of pool
  };

  info('Increase liquidity tx summary:', {
    whirlpool: await formatWhirlpool(liquidityTxSummary.position.getWhirlpoolData()),
    position: liquidityTxSummary.position.getAddress().toBase58(),
    liquidity: `${numericToString(liquidityTxSummary.liquidity, liquidityDecimals)} ${liquidityUnit}`,
    [tokenA.metadata.symbol]: numericToString(liquidityTxSummary.tokenAmountA, tokenA.mint.decimals),
    [tokenB.metadata.symbol]: numericToString(liquidityTxSummary.tokenAmountB, tokenB.mint.decimals),
    usd: `$${liquidityTxSummary.usd}`,
    fee: `${liquidityTxSummary.fee}`,
    signature: liquidityTxSummary.signature,
  });

  return liquidityTxSummary;
}

function _getLiquidityDecimals(
  liquidityUnit: LiquidityUnit,
  tokenPair: [DigitalAsset, DigitalAsset]
): number | undefined {
  return (liquidityUnit === 'tokenA')
    ? tokenPair[0].mint.decimals
    : (liquidityUnit === 'tokenB')
      ? tokenPair[1].mint.decimals
      : undefined;
}

export type * from './increase-liquidity.interfaces';
