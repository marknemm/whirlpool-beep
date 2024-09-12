import { error, info, timeout } from '@npc/core';
import OrcaPositionDAO from '@npc/orca/data/orca-position/orca-position.dao';
import OrcaRebalanceDAO from '@npc/orca/data/orca-rebalance/orca-rebalance.dao';
import { closePosition } from '@npc/orca/services/close-position/close-position';
import { openPosition } from '@npc/orca/services/open-position/open-position';
import env from '@npc/orca/util/env/env';
import { getPosition, getPositions, type BundledPosition } from '@npc/orca/util/position/position';
import { calcPriceMargin, toPriceRange } from '@npc/orca/util/tick-range/tick-range';
import whirlpoolClient, { formatWhirlpool, getWhirlpoolPrice, getWhirlpoolTokenPair } from '@npc/orca/util/whirlpool/whirlpool';
import { Percentage } from '@orca-so/common-sdk';
import { IGNORE_CACHE, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import type { RebalanceAllPositionsOptions, RebalanceAllPositionsResult, RebalancePositionOptions, RebalancePositionResult, RebalanceTxSummary } from './rebalance-position.interfaces';

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
    failures: [],
    skips: [],
    successes: [],
  };

  whirlpoolAddress
    ? info(`Rebalancing ${bundledPositions.length} positions in whirlpool:`, whirlpoolAddress)
    : info(`Rebalancing ${bundledPositions.length} positions:`);
  info(bundledPositions.map((bundledPosition) =>
    bundledPosition.position.getAddress().toBase58()
  ));

  const promises = bundledPositions.map(async (bundledPosition, idx) => {
    await timeout(1000 * idx); // Stagger requests to avoid rate limiting

    try {
      const result = await rebalancePosition(bundledPosition, options);
      result.txSummary
        ? allResults.successes.push(result.txSummary)
        : allResults.skips.push(result.bundledPosition);
    } catch (err) {
      allResults.failures.push({ bundledPosition, err });
      error(err);
    }
  });
  await Promise.all(promises);

  info('Rebalance All Positions Complete:', {
    successCnt: allResults.successes.length,
    successes: allResults.successes.map((success) =>
      success.bundledPositionNew.position.getAddress().toBase58()
    ),
    skipCnt: allResults.skips.length,
    skips: allResults.skips.map((bundledPosition) =>
      bundledPosition.position.getAddress().toBase58()
    ),
    failureCnt: allResults.failures.length,
    failures: allResults.failures.map((failure) => ({
      position: failure.bundledPosition.position.getAddress().toBase58(),
      err: failure.err
    })),
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
  const { liquidityUnit } = options;
  const bundledPositionOld = bundledPosition;
  const positionOld = bundledPositionOld.position;

  const opMetadata = {
    whirlpool: await formatWhirlpool(bundledPosition.position.getWhirlpoolData()),
    position: bundledPosition.position.getAddress().toBase58(),
  };

  if (await options.filter(positionOld)) {
    try {
      info('\n-- Rebalance Position --\n', opMetadata);

      // Close old position
      await closePosition({ bundledPosition });

      // Derive necessary data for opening new position
      const whirlpool = await whirlpoolClient().getPool(positionOld.getData().whirlpool);
      const priceMargin = options.priceMargin
        ?? await OrcaPositionDAO.getPriceMargin(positionOld.getAddress(), { catchErrors: true })
        ?? await calcPriceMargin(positionOld);
      const liquidity = options.liquidity
        ?? env.INCREASE_LIQUIDITY;

      // Open new position
      const openPositionSummary = await openPosition({
        whirlpool,
        liquidity,
        liquidityUnit,
        priceMargin,
        bundleIndex: bundledPosition.bundleIndex // Use same bundle index to maintain position address
      });
      const { positionAddress, priceRange, tickRange } = openPositionSummary.data;
      const bundledPositionNew = await getPosition(positionAddress);
      const positionNew = bundledPositionNew.position;

      // Record rebalance transaction summary
      const txSummary: RebalanceTxSummary = { bundledPositionOld, bundledPositionNew };
      await OrcaRebalanceDAO.insert(txSummary, { catchErrors: true });

      info('Rebalance Position Succeeded:', {
        ...opMetadata,
        positionNew: positionNew.getAddress().toBase58(),
        priceMargin: priceMargin.toString(),
        priceRange,
        tickRange,
        liquidity: `${liquidity.toString()} ${liquidityUnit ?? 'usd'}`,
      });

      return {
        bundledPosition: bundledPositionNew,
        txSummary
      };
    } catch (err) {
      error('Rebalance Position Failed:', opMetadata);
      throw err;
    }
  }

  info('\n-- Rebalance Position Not Required: Skipping --\n', opMetadata);
  return { bundledPosition };
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
