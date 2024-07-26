import { STABLECOIN_SYMBOL_REGEX } from '@/constants/regex';
import LiquidityTxDAO from '@/data/liquidity-tx-dao';
import type { LiquidityTxSummary, LiquidityUnit } from '@/interfaces/liquidity';
import { getPositions } from '@/services/position/get-position';
import { expBackoff } from '@/util/async';
import env from '@/util/env';
import { getTxProgramErrorInfo } from '@/util/error';
import { genLiquidityTxSummary } from '@/util/liquidity';
import { debug, error, info } from '@/util/log';
import { toBN, toDecimal, toStr, toTokenAmount } from '@/util/number-conversion';
import { getTokenPrice } from '@/util/token';
import { executeTransaction } from '@/util/transaction';
import wallet from '@/util/wallet';
import whirlpoolClient, { formatWhirlpool, getWhirlpoolTokenPair } from '@/util/whirlpool';
import { BN } from '@coral-xyz/anchor';
import { DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { type Address, Percentage, type TransactionBuilder } from '@orca-so/common-sdk';
import { IGNORE_CACHE, type IncreaseLiquidityQuote, increaseLiquidityQuoteByInputTokenWithParams, increaseLiquidityQuoteByLiquidityWithParams, type Position, TokenExtensionUtil } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import type Decimal from 'decimal.js';

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
  amount: BN | Decimal | number,
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
  amount: BN | Decimal | number,
  unit: LiquidityUnit = 'usd'
): Promise<LiquidityTxSummary> {
  return expBackoff(async (retry) => {
    info('\n-- Increasing liquidity --\n', {
      whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
      position: position.getAddress().toBase58(),
      amount: `${toStr(amount)} ${unit}`,
      retry,
    });

    // Must refresh data if retrying, or may generate error due to stale data.
    if (retry) {
      await position.refreshData();
    }

    // Get token pair and generate increase liquidity transaction
    const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());
    const { quote, tx } = await genIncreaseLiquidityTx(position, amount, unit);

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
      const errInfo = getTxProgramErrorInfo(err);
      return ['InvalidTimestamp', 'TokenMaxExceeded'].includes(errInfo?.name ?? '');
    }
  });
}

/**
 * Creates a transaction to increase liquidity in a given {@link position}.
 *
 * @param position The {@link Position} to increase liquidity of.
 * @param amount The amount of liquidity to deposit in the {@link Position}.
 * @param unit The {@link LiquidityUnit} to use for the amount. Defaults to `usd`.
 * @returns A {@link Promise} that resolves to the {@link TransactionBuilder}.
 * @throws An {@link Error} if there's an insufficient wallet balance for token A or B.
 */
export async function genIncreaseLiquidityTx(
  position: Position,
  amount: BN | Decimal | number,
  unit: LiquidityUnit = 'usd'
): Promise<{ quote: IncreaseLiquidityQuote, tx: TransactionBuilder }> {
  info('Creating Tx to increase liquidity:', {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
    amount: `${toStr(amount)} ${unit}`
  });

  const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());

  // If unit is USD, convert to token amount
  if (unit === 'usd') {
    ({ amount, unit } = await _toTokenAmount([tokenA, tokenB], amount));
  }

  // Get quote either using raw liquidity as unit or token A/B as unit
  const quote = (unit === 'liquidity')
    ? await _genQuoteViaLiquidity(position, amount)
    : await _genQuoteViaInputToken(position, amount, unit);

  info('Generated increase liquidity quote:', {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
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

  const tx = await position.increaseLiquidity(quote);
  return { quote, tx };
}

/**
 * Converts a given {@link usd} amount to a token amount of either token
 * in the given {@link tokenPair} with priority for a stablecoin.
 *
 * @param tokenPair The token pair containing the tokens that the {@link usd} amount may be converted to.
 * @param usd The amount of `USD` to convert.
 * @returns A {@link Promise} that resolves to the token amount and the {@link LiquidityUnit} of the token.
 */
export async function _toTokenAmount(
  tokenPair: [DigitalAsset, DigitalAsset],
  usd: BN | Decimal | number,
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
  position: Position,
  amount: BN | Decimal | number,
): Promise<IncreaseLiquidityQuote> {
  const { sqrtPrice, tickCurrentIndex } = position.getWhirlpoolData();
  const { tickLowerIndex, tickUpperIndex } = position.getData();

  debug('Getting increase liquidity quote:', toStr(amount));

  return increaseLiquidityQuoteByLiquidityWithParams({
    liquidity: toBN(amount),
    // Pool state
    tickCurrentIndex,
    sqrtPrice,
    // Position tick (price) range
    tickLowerIndex,
    tickUpperIndex,
    // Acceptable slippage
    slippageTolerance: Percentage.fromFraction(env.SLIPPAGE_DEFAULT, 100),
    // Token ext
    tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(
      whirlpoolClient().getFetcher(),
      position.getWhirlpoolData(),
      IGNORE_CACHE
    ),
  });
}

async function _genQuoteViaInputToken(
  position: Position,
  amount: BN | Decimal | number,
  unit: LiquidityUnit
): Promise<IncreaseLiquidityQuote> {
  const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());
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
    sqrtPrice: position.getWhirlpoolData().sqrtPrice,
    tickCurrentIndex: position.getWhirlpoolData().tickCurrentIndex,
    // Position tick (price) range
    tickLowerIndex: position.getData().tickLowerIndex,
    tickUpperIndex: position.getData().tickUpperIndex,
    // Input token and amount
    inputTokenMint: new PublicKey(inputToken.mint.publicKey),
    inputTokenAmount: toBN(amount, inputToken.mint.decimals),
    // Acceptable slippage
    slippageTolerance: Percentage.fromFraction(env.SLIPPAGE_DEFAULT, 100),
    // Token ext
    tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(
      whirlpoolClient().getFetcher(),
      position.getWhirlpoolData(),
      IGNORE_CACHE
    ),
  });
}
