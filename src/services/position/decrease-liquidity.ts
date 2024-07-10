import { getPositions } from '@/services/position/get-position';
import { toBN, toStr } from '@/util/currency';
import { debug, error, info } from '@/util/log';
import { verifyTransaction } from '@/util/rpc';
import whirlpoolClient, { getWhirlpoolTokenPair } from '@/util/whirlpool';
import { BN } from '@coral-xyz/anchor';
import { type Address, Percentage, type TransactionBuilder } from '@orca-so/common-sdk';
import { type DecreaseLiquidityQuote, decreaseLiquidityQuoteByLiquidityWithParams, IGNORE_CACHE, type Position, TokenExtensionUtil } from '@orca-so/whirlpools-sdk';

/**
 * Decreases liquidity of all {@link Position}s in a {@link Whirlpool}.
 *
 * @param whirlpoolAddress The {@link Address} of the {@link Whirlpool} to decrease liquidity in.
 * @param amount The amount of liquidity to withdraw from the {@link Whirlpool}. Divided evenly among open positions.
 * @returns A {@link Promise} that resolves to the {@link IncreaseLiquidityQuote}.
 */
export async function decreaseAllLiquidity(
  whirlpoolAddress: Address,
  amount: BN | number
): Promise<Map<string, DecreaseLiquidityQuote>> {
  info('\n-- Decrease All liquidity --');

  const quotes = new Map<string, DecreaseLiquidityQuote>();

  const bundledPositions = await getPositions(whirlpoolAddress);
  const divAmount = toBN(amount).div(toBN(bundledPositions.length));

  bundledPositions.length
    ? info(`Decreasing liquidity of ${bundledPositions.length} positions in whirlpool:`, whirlpoolAddress)
    : info('No positions to decrease liquidity of in whirlpool:', whirlpoolAddress);

  const promises = bundledPositions.map(async ({ position }) => {
    const quote = await decreaseLiquidity(position, divAmount)
      .catch((err) => { error(err); });

    if (quote) {
      quotes.set(position.getAddress().toBase58(), quote);
    }
  });

  await Promise.all(promises);
  return quotes;
}

/**
 * Decreases liquidity in a given {@link position}.
 *
 * @param position The {@link Position} to decrease the liquidity of.
 * @param amount The amount of liquidity to withdraw from the {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link DecreaseLiquidityQuote}.
 * @throws An {@link Error} if the deposit transaction fails to complete.
 */
export async function decreaseLiquidity(
  position: Position,
  amount: BN | number
): Promise<DecreaseLiquidityQuote> {
  info('\n-- Decreasing liquidity --');

  const { quote, tx } = await genDecreaseLiquidityTx(position, amount);

  // Execute and verify the transaction
  info('Executing decrease liquidity transaction...');
  const signature = await tx.buildAndExecute();
  await verifyTransaction(signature);

  // Refresh position data and log the actual decrease in liquidity
  const initLiquidity = position.getData().liquidity;
  await position.refreshData();
  const deltaLiquidity = initLiquidity.sub(position.getData().liquidity);
  info('Decreased liquidity by:', toStr(deltaLiquidity));

  return quote;
}

/**
 * Creates a transaction to decrease liquidity in a given {@link position}.
 *
 * @param position The {@link Position} to decrease the liquidity of.
 * @param amount The amount of liquidity to withdraw from the {@link Position}.
 * @returns A {@link Promise} that resolves to the {@link TransactionBuilder}.
 */
export async function genDecreaseLiquidityTx(
  position: Position,
  amount: BN | number
): Promise<{ quote: DecreaseLiquidityQuote, tx: TransactionBuilder }> {
  info('Creating Tx to decrease liquidity by:', toStr(amount));

  const quote = decreaseLiquidityQuoteByLiquidityWithParams({
    tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(
      whirlpoolClient().getFetcher(),
      position.getWhirlpoolData(),
      IGNORE_CACHE
    ),
    // Whirlpool state
    sqrtPrice: position.getWhirlpoolData().sqrtPrice,
    tickCurrentIndex: position.getWhirlpoolData().tickCurrentIndex,
    // Position tick (price) range
    tickLowerIndex: position.getData().tickLowerIndex,
    tickUpperIndex: position.getData().tickUpperIndex,
    // Withdraw amount
    liquidity: toBN(amount),
    // Acceptable slippage
    slippageTolerance: Percentage.fromFraction(1, 100), // 1%
  });

  const [tokenA, tokenB] = await getWhirlpoolTokenPair(position.getWhirlpoolData());
  if (!tokenA || !tokenB) throw new Error('Token not found');

  debug('Decrease liquidity quote:', quote);
  info(`${tokenA?.metadata.symbol} min output:`, toStr(quote.tokenMinA, tokenA?.mint.decimals));
  info(`${tokenB?.metadata.symbol} min output:`, toStr(quote.tokenMinB, tokenB?.mint.decimals));

  const tx = await position.decreaseLiquidity(quote);
  return { quote, tx };
}
