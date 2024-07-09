import type { LiquidityUnit } from '@/interfaces/position';
import { toBN, toStr } from '@/util/currency';
import { debug, info } from '@/util/log';
import { verifyTransaction } from '@/util/rpc';
import whirlpoolClient, { getWhirlpoolTokenPair } from '@/util/whirlpool';
import { BN } from '@coral-xyz/anchor';
import { Percentage, type TransactionBuilder } from '@orca-so/common-sdk';
import { IGNORE_CACHE, type IncreaseLiquidityQuote, increaseLiquidityQuoteByInputTokenWithParams, increaseLiquidityQuoteByLiquidityWithParams, type Position, TokenExtensionUtil } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import type Decimal from 'decimal.js';

/**
 * Increases liquidity in a given {@link position}.
 *
 * @param position The {@link Position} to increase the liquidity of.
 * @param amount The amount of liquidity to deposit in the {@link Position}.
 * @param unit The {@link LiquidityUnit} to use for the amount. Defaults to `tokenB`.
 * @returns A {@link Promise} that resolves to the {@link IncreaseLiquidityQuote}.
 * @throws An {@link Error} if the deposit transaction fails to complete.
 */
export async function increaseLiquidity(
  position: Position,
  amount: BN | Decimal | number,
  unit: LiquidityUnit = 'tokenB'
): Promise<IncreaseLiquidityQuote> {
  info('\n-- Increasing liquidity --');

  const { quote, tx } = await genIncreaseLiquidityTx(position, amount, unit);

  // Execute and verify the transaction
  info('Executing increase liquidity transaction...');
  const signature = await tx.buildAndExecute();
  await verifyTransaction(signature);

  // Refresh position data and log the actual increase in liquidity
  const initLiquidity = position.getData().liquidity;
  await position.refreshData();
  const deltaLiquidity = position.getData().liquidity.sub(initLiquidity);
  info('Increased liquidity by:', toStr(deltaLiquidity));

  return quote;
}

/**
 * Creates a transaction to increase liquidity in a given {@link position}.
 *
 * @param position The {@link Position} to increase liquidity of.
 * @param amount The amount of liquidity to deposit in the {@link Position} in terms of `token B`.
 * @param unit The {@link LiquidityUnit} to use for the amount. Defaults to `tokenB`.
 * @returns A {@link Promise} that resolves to the {@link TransactionBuilder}.
 */
export async function genIncreaseLiquidityTx(
  position: Position,
  amount: BN | Decimal | number,
  unit: LiquidityUnit = 'tokenB'
): Promise<{ quote: IncreaseLiquidityQuote, tx: TransactionBuilder }> {
  info('Creating tx to increase liquidity in position:', position.getAddress().toBase58());

  // Get quote either using raw liquidity as unit or token A/B as unit
  const quote = (unit === 'liquidity')
    ? await _genQuoteViaLiquidity(position, amount)
    : await _genQuoteViaInputToken(position, amount, unit);

  const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());
  if (!tokenA || !tokenB) throw new Error('Token not found');

  debug('Increase liquidity quote:', quote);
  info(`${tokenA.metadata.symbol} max input:`, toStr(quote.tokenMaxA, tokenA.mint.decimals));
  info(`${tokenB.metadata.symbol} max input:`, toStr(quote.tokenMaxB, tokenB.mint.decimals));

  const tx = await position.increaseLiquidity(quote);
  return { quote, tx };
}

async function _genQuoteViaLiquidity(
  position: Position,
  amount: BN | Decimal | number,
): Promise<IncreaseLiquidityQuote> {
  const { sqrtPrice, tickCurrentIndex } = position.getWhirlpoolData();
  const { tickLowerIndex, tickUpperIndex } = position.getData();

  return increaseLiquidityQuoteByLiquidityWithParams({
    liquidity: toBN(amount),
    // Pool state
    tickCurrentIndex,
    sqrtPrice,
    // Position tick (price) range
    tickLowerIndex,
    tickUpperIndex,
    // Acceptable slippage
    slippageTolerance: Percentage.fromFraction(1, 100), // 1%
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

  info('Getting increase liquidity quote:', toStr(amount, inputToken.mint.decimals), inputToken.metadata.symbol);

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
    slippageTolerance: Percentage.fromFraction(1, 100), // 1%
    // Token ext
    tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(
      whirlpoolClient().getFetcher(),
      position.getWhirlpoolData(),
      IGNORE_CACHE
    ),
  });
}
