import { STABLECOIN_SYMBOL_REGEX } from '@/constants/regex';
import LiquidityTxDAO from '@/data/liquidity-tx/liquidity-tx.dao';
import type { LiquidityUnit } from '@/interfaces/liquidity.interfaces';
import type { LiquidityTxSummary } from '@/services/liquidity/interfaces/liquidity-tx.interfaces';
import { genLiquidityTxSummary } from '@/services/liquidity/util/liquidity';
import { getPositions } from '@/services/position/query/query-position';
import { getWhirlpool } from '@/services/whirlpool/query/query-whirlpool';
import { expBackoff } from '@/util/async/async';
import env from '@/util/env/env';
import { debug, error, info } from '@/util/log/log';
import { toBN, toDecimal, toStr, toTokenAmount } from '@/util/number-conversion/number-conversion';
import { getProgramErrorInfo } from '@/util/program/program';
import rpc from '@/util/rpc/rpc';
import { toTickRangeKeys } from '@/util/tick-range/tick-range';
import { getTokenPrice } from '@/util/token/token';
import { executeTransaction } from '@/util/transaction/transaction';
import wallet from '@/util/wallet/wallet';
import whirlpoolClient, { formatWhirlpool, getWhirlpoolTokenPair } from '@/util/whirlpool/whirlpool';
import { BN } from '@coral-xyz/anchor';
import { DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { AddressUtil, Percentage, resolveOrCreateATAs, TransactionBuilder, type Address } from '@orca-so/common-sdk';
import { IGNORE_CACHE, increaseLiquidityQuoteByInputTokenWithParams, increaseLiquidityQuoteByLiquidityWithParams, TokenExtensionUtil, Whirlpool, type IncreaseLiquidityQuote, type Position } from '@orca-so/whirlpools-sdk';
import { increaseLiquidityIx, IncreaseLiquidityParams, increaseLiquidityV2Ix } from '@orca-so/whirlpools-sdk/dist/instructions';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import type Decimal from 'decimal.js';
import type { IncreaseLiquidityIx, IncreaseLiquidityTx, IncreaseLiquidityTxArgs } from './increase-liquidity.interfaces';

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
  const divAmount = toDecimal(amount, decimals).div(bundledPositions.length);

  bundledPositions.length
    ? info(`Increasing liquidity of ${bundledPositions.length} positions in pool:`, await formatWhirlpool(whirlpool))
    : info('No positions to increase liquidity of in pool:', await formatWhirlpool(whirlpool));

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
  const whirlpool = await getWhirlpool({ whirlpoolAddress: position.getData().whirlpool });

  const opMetadata = {
    whirlpool: await formatWhirlpool(whirlpool),
    position: position.getAddress().toBase58(),
    amount: `${toStr(amount)} ${unit}`,
  };

  try {
    return expBackoff(async (retry) => {
      info('\n-- Increasing liquidity --\n', {
        ...opMetadata,
        retry,
      });

      // Must refresh data if retrying, or may generate error due to stale data.
      if (retry) {
        await position.refreshData();
      }

      // Get token pair and generate increase liquidity transaction
      const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());
      const { quote, tx } = await genIncreaseLiquidityTx({
        amount,
        positionAddress: position.getAddress(),
        positionMint: position.getData().positionMint,
        tickRange: [position.getData().tickLowerIndex, position.getData().tickUpperIndex],
        whirlpool,
        unit,
      });

      // Execute Tx and get signature
      const signature = await executeTransaction(tx, {
        name: 'Increase Liquidity',
        whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
        position: position.getAddress().toBase58(),
        [`${tokenA.metadata.symbol} Max`]: toStr(quote.tokenMaxA, tokenA.mint.decimals),
        [`${tokenB.metadata.symbol} Max`]: toStr(quote.tokenMaxB, tokenB.mint.decimals),
      });

      // Get Liquidity tx summary and insert into DB
      const liquidityDelta = await genLiquidityTxSummary(position, signature, quote);
      await LiquidityTxDAO.insert(liquidityDelta, { catchErrors: true });

      return liquidityDelta;
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
 * Creates an {@link Instruction} to increase liquidity in a given {@link position}.
 *
 * @param args The arguments for generating an {@link Instruction} to increase liquidity in a {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link Instruction}.
 * @throws An {@link Error} if there's an insufficient wallet balance for token A or B.
 */
export async function genIncreaseLiquidityIx(args: IncreaseLiquidityTxArgs): Promise<IncreaseLiquidityIx> {
  const { tx, ...rest } = await genIncreaseLiquidityTx(args);

  return {
    ix: tx.compressIx(true),
    ...rest,
  };
}

/**
 * Creates a transaction to increase liquidity in a given {@link Position}.
 *
 * @param args The arguments for generating a transaction to increase liquidity in a {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link IncreaseLiquidityTx} object.
 * @throws An {@link Error} if there's an insufficient wallet balance for token A or B.
 */
export async function genIncreaseLiquidityTx({
  amount,
  positionAddress,
  positionMint,
  tickRange,
  whirlpool,
  unit = 'usd'
}: IncreaseLiquidityTxArgs): Promise<IncreaseLiquidityTx> {
  info('Creating Tx to increase liquidity:', {
    whirlpool: await formatWhirlpool(whirlpool),
    position: AddressUtil.toString(positionAddress),
    amount: `${toStr(amount)} ${unit}`
  });

  const [tokenA, tokenB] = await getWhirlpoolTokenPair(whirlpool);
  const [tokenMintA, tokenMintB] = [new PublicKey(tokenA.mint.publicKey), new PublicKey(tokenB.mint.publicKey)];

  // If unit is USD, convert to token amount
  if (unit === 'usd') {
    ({ amount, unit } = await _toTokenAmount([tokenA, tokenB], amount));
  }

  // Get quote either using raw liquidity as unit or token A/B as unit
  const quote = (unit === 'liquidity')
    ? await _genQuoteViaLiquidity(whirlpool, tickRange, amount)
    : await _genQuoteViaInputToken(whirlpool, tickRange, amount, unit);

  info('Generated increase liquidity quote:', {
    whirlpool: await formatWhirlpool(whirlpool),
    position: AddressUtil.toString(positionAddress),
    [`${tokenA.metadata.symbol} Max`]: toStr(quote.tokenMaxA, tokenA.mint.decimals),
    [`${tokenB.metadata.symbol} Max`]: toStr(quote.tokenMaxB, tokenB.mint.decimals),
  });

  const walletBalanceA = await wallet().getBalance(tokenA.mint.publicKey);
  if (walletBalanceA.lt(quote.tokenMaxA)) {
    throw new Error(`Insufficient ${tokenA.metadata.symbol} balance: ${toStr(walletBalanceA, tokenA.mint.decimals)}`);
  }

  const walletBalanceB = await wallet().getBalance(tokenB.mint.publicKey);
  if (walletBalanceB.lt(quote.tokenMaxB)) {
    throw new Error(`Insufficient ${tokenB.metadata.symbol} balance: ${toStr(walletBalanceB, tokenB.mint.decimals)}`);
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
    position: AddressUtil.toPubKey(positionAddress),
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
    ? increaseLiquidityIx(whirlpoolClient().getContext().program, baseParams)
    : increaseLiquidityV2Ix(whirlpoolClient().getContext().program, {
      ...baseParams,
      tokenMintA,
      tokenMintB,
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

  const tx = new TransactionBuilder(rpc(), wallet());
  tx.addInstruction(tokenOwnerAccountAIx);
  tx.addInstruction(tokenOwnerAccountBIx);
  tx.addInstruction(increaseIx);

  return { quote, tx };
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
    AddressUtil.toPubKey(positionMint),
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
): Promise<{ amount: Decimal, unit: 'tokenA' | 'tokenB' }> {
  const [tokenA, tokenB] = tokenPair;

  debug(`Converting USD (${toStr(usd)}) to either token:`, tokenPair.map((token) => token.metadata.symbol));

  // If either token is a stablecoin, prioritize that token
  if (STABLECOIN_SYMBOL_REGEX.test(tokenA.metadata.symbol)) {
    return {
      amount: toTokenAmount(usd, 1),
      unit: 'tokenA'
    };
  }
  if (STABLECOIN_SYMBOL_REGEX.test(tokenB.metadata.symbol)) {
    return {
      amount: toTokenAmount(usd, 1),
      unit: 'tokenB'
    };
  }

  // Otherwise, query the USD price of both tokens via API
  const usdTokenA = await getTokenPrice(tokenA);
  if (usdTokenA) {
    return {
      amount: toTokenAmount(usd, usdTokenA),
      unit: 'tokenA',
    };
  }
  const usdTokenB = await getTokenPrice(tokenB);
  if (usdTokenB) {
    return {
      amount: toTokenAmount(usd, usdTokenB),
      unit: 'tokenB',
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

  debug('Getting increase liquidity quote:', toStr(amount));

  return increaseLiquidityQuoteByLiquidityWithParams({
    liquidity: toBN(amount),
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
  unit: LiquidityUnit
): Promise<IncreaseLiquidityQuote> {
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(whirlpool);
  if (!tokenA || !tokenB) throw new Error('Token not found');

  const inputToken = (unit === 'tokenA')
    ? tokenA
    : tokenB;

  debug('Getting increase liquidity quote:', toStr(amount, inputToken.mint.decimals), inputToken.metadata.symbol);

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
    inputTokenAmount: toBN(amount, inputToken.mint.decimals),
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

export type * from './increase-liquidity.interfaces';
