import RebalanceTxDAO from '@/data/rebalance-tx/rebalance-tx.dao';
import type { BundledPosition } from '@/interfaces/position.interfaces';
import { genClosePositionIx, genClosePositionTxSummary } from '@/services/position/close/close-position';
import { genOpenPositionIx, genOpenPositionTxSummary } from '@/services/position/open/open-position';
import { getPositions } from '@/services/position/query/query-position';
import { timeout } from '@/util/async/async';
import { error, info } from '@/util/log/log';
import { toStr } from '@/util/number-conversion/number-conversion';
import rpc from '@/util/rpc/rpc';
import { calcPriceMargin, toPriceRange } from '@/util/tick-range/tick-range';
import { executeTransaction } from '@/util/transaction/transaction';
import wallet from '@/util/wallet/wallet';
import whirlpoolClient, { formatWhirlpool, getWhirlpoolPrice, getWhirlpoolTokenPair } from '@/util/whirlpool/whirlpool';
import { Percentage, TransactionBuilder } from '@orca-so/common-sdk';
import { IGNORE_CACHE, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import type { RebalanceAllPositionsOptions, RebalanceAllPositionsSummary, RebalancePositionOptions, RebalancePositionTx, RebalancePositionTxSummary, RebalancePositionTxSummaryArgs } from './rebalance-position.interfaces';

/**
 * Rebalances all {@link Position}s based on given {@link options}.
 *
 * @param options The {@link RebalanceAllPositionsOptions}.
 * @returns A {@link Promise} that resolves to all rebalanced {@link BundledPosition}s
 * once all rebalancing completes.
 */
export async function rebalanceAllPositions(
  options: RebalanceAllPositionsOptions
): Promise<RebalanceAllPositionsSummary> {
  info('\n-- Rebalance All Positions --\n');

  const { whirlpoolAddress } = options;
  const bundledPositions = await getPositions({ whirlpoolAddress, ...IGNORE_CACHE });

  const allResults: RebalanceAllPositionsSummary = {
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
    await timeout(250 * idx); // Stagger requests to avoid rate limiting

    try {
      const txSummary = await rebalancePosition(bundledPosition, options);
      txSummary
        ? allResults.successes.push(txSummary)
        : allResults.skips.push(bundledPosition);
    } catch (err) {
      allResults.failures.push({ bundledPosition, err });
      error(err);
    }
  });
  await Promise.all(promises);

  info('Rebalance All Positions Complete:', {
    successCnt: allResults.successes.length,
    successes: allResults.successes.map((success) =>
      success.openPositionTxSummary!.bundledPosition.position.getAddress().toBase58()
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
): Promise<RebalancePositionTxSummary | undefined> {
  const { liquidity, liquidityUnit } = options;
  const bundledPositionOld = bundledPosition;
  const positionOld = bundledPositionOld.position;

  const opMetadata = {
    whirlpool: await formatWhirlpool(positionOld.getWhirlpoolData()),
    position: positionOld.getAddress().toBase58(),
    liquidity: toStr(liquidity),
    liquidityUnit: liquidityUnit ?? 'usd',
  };

  if (await options.filter(positionOld)) {
    try {
      info('\n-- Rebalance Position --\n', opMetadata);

      const rebalancePositionTx = await genRebalancePositionTx(bundledPosition, options);

      // Execute and verify the transaction
      const signature = await executeTransaction(rebalancePositionTx.tx, {
        name: 'Rebalance Position',
        ...opMetadata,
      });

      const txSummary = await genRebalancePositionTxSummary({
        bundledPosition,
        rebalancePositionIxTx: rebalancePositionTx,
        signature,
      });

      const bundledPositionNew = txSummary.openPositionTxSummary.bundledPosition;
      const positionNew = bundledPositionNew.position;

      await RebalanceTxDAO.insert(txSummary, { catchErrors: true });

      info('Rebalance Position Succeeded:', {
        ...opMetadata,
        positionNew: positionNew.getAddress().toBase58(),
      });

      return txSummary;
    } catch (err) {
      error('Rebalance Position Failed:', opMetadata);
      throw err;
    }
  }

  info('\n-- Rebalance Position Not Required: Skipping --\n', opMetadata);
  return undefined;
}

/**
 * Generates a rebalance transaction for a given {@link bundledPosition} based on given {@link options}.
 *
 * @param bundledPosition The {@link BundledPosition} to rebalance.
 * @param options The {@link RebalancePositionOptions}.
 * @returns A {@link Promise} that resolves to the {@link RebalancePositionTx}.
 */
export async function genRebalancePositionTx(
  bundledPosition: BundledPosition,
  options: RebalancePositionOptions
): Promise<RebalancePositionTx> {
  const { liquidity, liquidityUnit } = options;
  const bundledPositionOld = bundledPosition;
  const positionOld = bundledPositionOld.position;

  const closePositionIx = await genClosePositionIx({ bundledPosition });

  const whirlpool = await whirlpoolClient().getPool(positionOld.getData().whirlpool);
  const priceMargin = options.priceMargin ?? await calcPriceMargin(positionOld);
  const openPositionIx = await genOpenPositionIx({
    whirlpool,
    liquidity,
    liquidityUnit,
    priceMargin,
    bundleIndex: bundledPosition.bundleIndex // Use same bundle index to maintain position address
  });

  const tx = new TransactionBuilder(rpc(), wallet())
    .addInstruction(closePositionIx.ix)
    .addInstruction(openPositionIx.ix);

  return {
    closePositionIx,
    openPositionIx,
    tx,
  };
}

/**
 * Generates a {@link RebalancePositionTxSummary} for a rebalance position transaction.
 *
 * @param args The {@link RebalancePositionTxSummaryArgs}.
 * @returns A {@link Promise} that resolves to the {@link RebalancePositionTxSummary}.
 */
export async function genRebalancePositionTxSummary({
  bundledPosition,
  rebalancePositionIxTx,
  signature,
}: RebalancePositionTxSummaryArgs): Promise<RebalancePositionTxSummary> {
  const {
    closePositionIx,
    openPositionIx,
  } = rebalancePositionIxTx;

  const closePositionTxSummary = await genClosePositionTxSummary({
    bundledPosition,
    closePositionIxTx: closePositionIx,
    signature,
  });

  const openPositionTxSummary = await genOpenPositionTxSummary(
    bundledPosition,
    openPositionIx.increaseLiquidityQuote,
    signature
  );

  const { fee } = closePositionTxSummary;
  closePositionTxSummary.fee = 0;
  openPositionTxSummary.fee = 0;

  return {
    fee,
    closePositionTxSummary,
    openPositionTxSummary,
    signature,
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
