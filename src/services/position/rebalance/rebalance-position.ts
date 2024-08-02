import RebalanceTxDAO from '@/data/rebalance-tx/rebalance-tx.dao';
import type { BundledPosition } from '@/interfaces/position.interfaces';
import { increaseLiquidity } from '@/services/liquidity/increase/increase-liquidity';
import { closePosition } from '@/services/position/close/close-position';
import { openPosition } from '@/services/position/open/open-position';
import { getPositions } from '@/services/position/query/query-position';
import { error, info } from '@/util/log/log';
import { toStr } from '@/util/number-conversion/number-conversion';
import { calcPriceMargin, toPriceRange } from '@/util/tick-range/tick-range';
import whirlpoolClient, { formatWhirlpool, getWhirlpoolPrice, getWhirlpoolTokenPair } from '@/util/whirlpool/whirlpool';
import { Percentage } from '@orca-so/common-sdk';
import { IGNORE_CACHE, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import type { RebalanceAllPositionsOptions, RebalanceAllPositionsResult, RebalancePositionOptions, RebalancePositionResult, RebalanceTxSummary } from './rebalance-position.interfaces';
import { timeout } from '@/util/async/async';

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
): Promise<RebalanceAllPositionsResult> {
  info('\n-- Rebalance All Positions --\n');

  const { whirlpoolAddress } = options;
  const bundledPositions = await getPositions({ whirlpoolAddress, ...IGNORE_CACHE });

  const allResults: RebalanceAllPositionsResult = {
    successes: [],
    skips: [],
    failures: [],
    errs: [],
  };

  whirlpoolAddress
    ? info(`Rebalancing ${bundledPositions.length} positions in whirlpool:`, whirlpoolAddress)
    : info(`Rebalancing ${bundledPositions.length} positions...`);

  const promises = bundledPositions.map(async (bundledPosition, idx) => {
    await timeout(250 * idx); // Stagger rebalance requests to avoid rate limiting

    return rebalancePosition(bundledPosition, options)
      .then((result) => {
        (result.status === 'succeeded')
          ? allResults.successes.push(result.bundledPosition)
          : allResults.skips.push(result.bundledPosition);
      })
      .catch((err) => {
        allResults.failures.push(bundledPosition);
        allResults.errs.push(err);
        error(err);
      });
  });

  await Promise.all(promises);

  info('\n-- Rebalance All Positions Complete --', {
    successCnt: allResults.successes.length,
    successes: allResults.successes.map((bundledPosition) => bundledPosition.position.getAddress().toBase58()),
    skipCnt: allResults.skips.length,
    skips: allResults.skips.map((bundledPosition) => bundledPosition.position.getAddress().toBase58()),
    failureCnt: allResults.failures.length,
    failures: allResults.failures.map((bundledPosition) => bundledPosition.position.getAddress().toBase58()),
    errs: allResults.errs,
  });

  return allResults;
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
): Promise<RebalancePositionResult> {
  const { liquidity, liquidityUnit } = options;
  const positionOld = bundledPosition.position;

  const opMetadata = {
    whirlpool: await formatWhirlpool(bundledPosition.position.getWhirlpoolData()),
    position: bundledPosition.position.getAddress().toBase58(),
    liquidity: toStr(liquidity),
    liquidityUnit: liquidityUnit ?? 'usd',
  };

  // TODO: Condense into less transactions
  if (await options.filter(positionOld)) {
    try {
      info('\n-- Rebalance Position --\n', opMetadata);

      await closePosition({ bundledPosition });

      const whirlpool = await whirlpoolClient().getPool(positionOld.getData().whirlpool);
      const priceMargin = options.priceMargin ?? await calcPriceMargin(positionOld);
      const newBundledPosition = await openPosition({
        whirlpool,
        priceMargin,
        bundleIndex: bundledPosition.bundleIndex // Use same bundle index to maintain position address
      });
      const positionNew = newBundledPosition.position;
      await increaseLiquidity(positionNew, liquidity, liquidityUnit);

      const txSummary: RebalanceTxSummary = { positionOld, positionNew };
      await RebalanceTxDAO.insert(txSummary, { catchErrors: true });

      info('Rebalance Position Succeeded:', {
        ...opMetadata,
        positionNew: positionNew.getAddress().toBase58(),
      });

      return {
        bundledPosition: newBundledPosition,
        status: 'succeeded',
        txSummary
      };
    } catch (err) {
      error('Rebalance Position Failed:', opMetadata);
      throw err;
    }
  }

  info('\n-- Rebalance Position Not Required: Skipping --\n', opMetadata);
  return {
    bundledPosition,
    status: 'skipped'
  };
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

export type * from './rebalance-position.interfaces';
