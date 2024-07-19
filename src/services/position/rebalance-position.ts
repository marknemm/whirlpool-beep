import RebalanceTxDAO from '@/data/rebalance-tx-dao';
import type { BundledPosition } from '@/interfaces/position';
import type { RebalanceAllPositionsOptions, RebalancePositionOptions, RebalanceTxSummary } from '@/interfaces/rebalance';
import { closePosition } from '@/services/position/close-position';
import { getPositions } from '@/services/position/get-position';
import { increaseLiquidity } from '@/services/position/increase-liquidity';
import { openPosition } from '@/services/position/open-position';
import { error, info } from '@/util/log';
import { toPriceRange } from '@/util/number-conversion';
import whirlpoolClient, { getWhirlpoolPrice, getWhirlpoolTokenPair } from '@/util/whirlpool';
import { Percentage } from '@orca-so/common-sdk';
import { IGNORE_CACHE, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';

// TODO: Improve efficiency by consolidating collect, decrease liquidity, close, and open transactions.

/**
 * Rebalances all {@link Position}s based on given {@link options}.
 *
 * @param options The {@link RebalanceAllPositionsOptions}.
 * @returns A {@link Promise} that resolves to all rebalanced {@link BundledPosition}s
 * once all rebalancing completes.
 */
export async function rebalanceAllPositions(
  options: RebalanceAllPositionsOptions
): Promise<BundledPosition[]> {
  info('\n-- Rebalance All Positions --');

  const { whirlpoolAddress } = options;
  const bundledPositions = await getPositions({ whirlpoolAddress, ...IGNORE_CACHE });

  whirlpoolAddress
    ? info(`Rebalancing ${bundledPositions.length} positions in whirlpool:`, whirlpoolAddress)
    : info(`Rebalancing ${bundledPositions.length} positions...`);

  const promises = bundledPositions.map((bundledPosition) =>
    rebalancePosition(bundledPosition, options)
      .catch((err) => { error(err); })
  );

  return (await Promise.all(promises)).filter(
    (bundledPosition) => !!bundledPosition
  );
}

/**
 * Rebalances a {@link BundledPosition} based on given {@link options}.
 *
 * @param bundledPosition The {@link BundledPosition} to rebalance.
 * @param options The {@link RebalanceAllPositionsOptions}.
 * @returns A {@link Promise} that resolves to the rebalanced {@link BundledPosition}.
 * Will be the same as the input {@link BundledPosition} if no rebalancing is required.
 */
export async function rebalancePosition(
  bundledPosition: BundledPosition,
  options: RebalancePositionOptions
): Promise<BundledPosition> {
  info('\n-- Rebalance Position --');

  const { liquidity, liquidityUnit, priceMargin } = options;
  const positionOld = bundledPosition.position;

  // TODO: Condense into less transactions
  if (await options.filter(positionOld)) {
    info('Rebalancing position:', positionOld.getAddress());

    await closePosition(bundledPosition);

    const whirlpool = await whirlpoolClient().getPool(positionOld.getData().whirlpool);
    const newBundledPosition = await openPosition(whirlpool, priceMargin);
    const positionNew = newBundledPosition.position;
    await increaseLiquidity(positionNew, liquidity, liquidityUnit);

    const txSummary: RebalanceTxSummary = { positionOld, positionNew };
    await RebalanceTxDAO.insert(txSummary, { catchErrors: true });

    return newBundledPosition;
  }

  info('Position does not require rebalancing:', positionOld.getAddress());
  return bundledPosition;
}

/**
 * Generates a filter function for rebalancing {@link Position}s based on a given {@link priceRangeMargin}.
 * If the current price of a {@link Position}'s containing {@link Whirlpool} is outside of the price range margin, the position will be rebalanced.
 *
 * @param priceRangeMargin The price range margin {@link Percentage} to use for rebalancing criteria.
 * Defaults to `1/5` (20%).
 * @returns A filter function that resolves to `true` if the position should be rebalanced, `false` otherwise.
 */
export function genPriceRangeRebalanceFilter(
  priceRangeMargin = Percentage.fromFraction(1, 5)
): (position: Position) => Promise<boolean> {
  return async (position: Position): Promise<boolean> => {
    info('Price range filter - checking if position should be rebalanced:', position.getAddress());

    // Derive necessary high level data for getting price data
    const { tickLowerIndex, tickUpperIndex } = position.getData();
    const whirlpoolData = position.getWhirlpoolData();
    const [tokenA, tokenB] = await getWhirlpoolTokenPair(whirlpoolData);

    // Get whirlpool price and position price range
    const whirlpoolPrice = await getWhirlpoolPrice(whirlpoolData);
    const priceRange = toPriceRange(
      [tickLowerIndex, tickUpperIndex],
      [tokenA.mint.decimals, tokenB.mint.decimals]
    );
    const [priceLower, priceUpper] = priceRange;

    // Calculate buffered price range based on configured price range margin
    const priceRangeSize = priceUpper.minus(priceLower);
    const priceRangeMarginSize = priceRangeSize.mul(priceRangeMargin.toDecimal());
    const bufferedPriceLower = priceLower.plus(priceRangeMarginSize);
    const bufferedPriceUpper = priceUpper.minus(priceRangeMarginSize);

    // Log price data
    const priceRangeStrs = priceRange.map((price) => price.toFixed(tokenB.mint.decimals));
    info('Whirlpool price:', whirlpoolPrice.toString());
    info('Price range:', priceRangeStrs);

    // Return filter result
    return whirlpoolPrice.lt(bufferedPriceLower) || whirlpoolPrice.gt(bufferedPriceUpper);
  };
}
