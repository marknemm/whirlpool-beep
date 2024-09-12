import { BN } from '@coral-xyz/anchor';
import { type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import type { LiquidityUnit } from '@npc/core';
import { debug, error, expBackoff, info, numericToString, toBN, toDecimal } from '@npc/core';
import OrcaLiquidityDAO from '@npc/orca/data/orca-liquidity/orca-liquidity.dao';
import env from '@npc/orca/util/env/env';
import { getPositions } from '@npc/orca/util/position/position';
import { toTickRangeKeys } from '@npc/orca/util/tick-range/tick-range';
import whirlpoolClient, { formatWhirlpool, getWhirlpool, getWhirlpoolPrice, getWhirlpoolTokenPair, resolveWhirlpool } from '@npc/orca/util/whirlpool/whirlpool';
import { getProgramErrorInfo, getTokenAmountsForPool, rpc, toPubKey, toPubKeyStr, TransactionBuilder, TransactionContext, wallet } from '@npc/solana';
import { Percentage, resolveOrCreateATAs, type Address } from '@orca-so/common-sdk';
import { IGNORE_CACHE, increaseLiquidityQuoteByInputTokenWithParams, increaseLiquidityQuoteByLiquidityWithParams, TokenExtensionUtil, WhirlpoolIx, type IncreaseLiquidityParams, type IncreaseLiquidityQuote, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import type Decimal from 'decimal.js';
import type { IncreaseLiquidityArgs, IncreaseLiquidityIxSet, IncreaseLiquiditySummary } from './increase-liquidity.interfaces';

/**
 * Increases liquidity of all {@link Position}s in a {@link Whirlpool}.
 *
 * @param whirlpoolAddress The {@link Address} of the {@link Whirlpool} to increase liquidity in.
 * @param amount The amount of liquidity to deposit in the {@link Whirlpool}. Divided evenly among open positions.
 * @param unit The {@link LiquidityUnit} to use for the amount. Defaults to `usd`.
 * @returns A {@link Promise} that resolves to a {@link Map} of {@link Position} addresses to {@link IncreaseLiquiditySummary}s.
 */
export async function increaseAllLiquidity(
  whirlpoolAddress: Address,
  amount: BN | Decimal.Value,
  unit: LiquidityUnit = 'usd'
): Promise<Map<string, IncreaseLiquiditySummary>> {
  info('\n-- Increasing All liquidity --');

  const txSummaries = new Map<string, IncreaseLiquiditySummary>();

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
 * @returns A {@link Promise} that resolves to the {@link IncreaseLiquiditySummary}.
 * @throws An {@link Error} if the transaction fails to complete.
 */
export async function increaseLiquidity(
  position: Position,
  amount: BN | Decimal.Value,
  unit: LiquidityUnit = 'usd'
): Promise<IncreaseLiquiditySummary> {
  const whirlpool = await getWhirlpool({ whirlpoolAddress: position.getData().whirlpool });
  const txCtx = new TransactionContext();

  const opMetadata = {
    whirlpool: await formatWhirlpool(whirlpool),
    position: position.getAddress().toBase58(),
    amount: `${amount.toString()} ${unit}`,
  };

  try {
    const summary = await expBackoff(async (retry) => {
      info('\n-- Increasing liquidity --\n', {
        ...opMetadata,
        retry,
      });

      // Must refresh data if retrying, or may generate error due to stale data
      if (retry) {
        await position.refreshData();
      }

      // Generate instruction data to increase liquidity
      const ixSet = await genIncreaseLiquidityIxSet({
        liquidity: amount,
        positionAddress: position.getAddress(),
        positionMint: position.getData().positionMint,
        tickRange: [position.getData().tickLowerIndex, position.getData().tickUpperIndex],
        whirlpool,
        liquidityUnit: unit,
      });
      txCtx.setInstructionSet(ixSet);

      // Send transaction
      const txSummary = await txCtx.send({
        debugData: {
          name: 'Increase Liquidity',
          ...ixSet.data,
        }
      });

      return { ...txSummary, data: ixSet.data };
    }, {
      retryFilter: (result, err) => {
        const errInfo = getProgramErrorInfo(err);
        return ['InvalidTimestamp', 'TokenMaxExceeded'].includes(errInfo?.name ?? '');
      }
    });

    // Insert the liquidity transaction summary into the database
    await OrcaLiquidityDAO.insert(summary, { catchErrors: true });
    return summary;
  } catch (err) {
    error('Failed to increase liquidity:', opMetadata);
    throw err;
  }
}

/**
 * Generates an {@link IncreaseLiquidityIxSet} to increase liquidity in a given {@link Position}.
 *
 * @param args The {@link IncreaseLiquidityArgs} for generating the instruction data
 * to increase liquidity in a {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link IncreaseLiquidityIxSet}.
 * @throws An {@link Error} if there's an insufficient wallet balance for token A or B.
 */
export async function genIncreaseLiquidityIxSet(args: IncreaseLiquidityArgs): Promise<IncreaseLiquidityIxSet> {
  const { positionAddress, positionMint, liquidity, liquidityUnit = 'usd', tickRange } = args;
  const whirlpool = await resolveWhirlpool(args.whirlpool);

  const liquidityDecimals = _getLiquidityDecimals(liquidityUnit, await getWhirlpoolTokenPair(whirlpool));
  const opMetadata = {
    whirlpool: await formatWhirlpool(whirlpool),
    position: toPubKeyStr(positionAddress),
    liquidity: `${numericToString(liquidity, liquidityDecimals)} ${liquidityUnit}`,
  };
  debug('Creating instruction set to increase liquidity:', opMetadata);

  // Convert to token amount if liquidity is in USD
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(whirlpool);

  // Get quote either using raw liquidity as unit or token A/B as unit
  const quote = (liquidityUnit === 'liquidity')
    ? await _genQuoteViaLiquidity(whirlpool, tickRange, liquidity)
    : (liquidityUnit === 'usd')
      ? await _genQuoteViaUSD(whirlpool, tickRange, liquidity)
      : await _genQuoteViaInputToken(whirlpool, tickRange, liquidity, liquidityUnit);

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

  const txBuilder = new TransactionBuilder()
    .addInstructionSet(tokenOwnerAccountAIx)
    .addInstructionSet(tokenOwnerAccountBIx)
    .addInstructionSet(increaseIx);

  return {
    ...txBuilder.instructionSet,
    data: {
      ...quote,
      positionAddress,
      tokenMintPair: [tokenA.mint.publicKey, tokenB.mint.publicKey],
      whirlpoolAddress: whirlpool.getAddress(),
    },
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

async function _genQuoteViaLiquidity(
  whirlpool: Whirlpool,
  tickRange: [number, number],
  amount: BN | Decimal.Value,
): Promise<IncreaseLiquidityQuote> {
  const { sqrtPrice, tickCurrentIndex } = whirlpool.getData();

  debug('Getting increase liquidity quote:', amount.toString());

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

/**
 * Generates a quote for increasing liquidity in a {@link Whirlpool} using USD.
 *
 * @param whirlpool The {@link Whirlpool} to get the increase liquidity quote for.
 * @param tickRange The tick range to get the quote for.
 * @param amount The amount of USD to increase liquidity with.
 * @returns A {@link Promise} that resolves to the {@link IncreaseLiquidityQuote}.
 */
async function _genQuoteViaUSD(
  whirlpool: Whirlpool,
  tickRange: [number, number],
  amount: BN | Decimal.Value,
): Promise<IncreaseLiquidityQuote> {
  debug('Getting increase liquidity quote:', amount.toString(), 'USD');

  const [tokenA, tokenB] = await getWhirlpoolTokenPair(whirlpool);
  const whirlpoolPrice = await getWhirlpoolPrice(whirlpool);

  const [amountA] = await getTokenAmountsForPool([tokenA, tokenB], amount, whirlpoolPrice);

  return _genQuoteViaInputToken(whirlpool, tickRange, amountA, 'tokenA');
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
