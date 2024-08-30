import { error, expBackoff, info, timeout } from '@npc/core';
import OrcaPositionDAO from '@npc/orca/data/orca-position/orca-position.dao';
import { genCollectFeesRewardsIxData, genCollectFeesRewardsTxSummary, type CollectFeesRewardsIxData } from '@npc/orca/services/fees-rewards/collect/collect-fees-rewards';
import { genDecreaseLiquidityIxData, genDecreaseLiquidityTxSummary } from '@npc/orca/services/liquidity/decrease/decrease-liquidity';
import { DecreaseLiquidityIxData } from '@npc/orca/services/liquidity/decrease/decrease-liquidity.interfaces';
import { getPositions } from '@npc/orca/services/position/query/query-position';
import { formatWhirlpool } from '@npc/orca/util/whirlpool/whirlpool';
import { getProgramErrorInfo, getTxSummary, TransactionContext } from '@npc/solana';
import { type Address } from '@orca-so/common-sdk';
import { IGNORE_CACHE, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import type { EmptyAllPositionsSummary, EmptyPositionIxData, EmptyPositionTxSummary, EmptyPositionTxSummaryArgs } from './empty-position.interfaces';

/**
 * Empties all {@link Position}s in a {@link Whirlpool}.
 * This involves withdrawing all liquidity and collecting all fees and rewards.
 *
 * @param whirlpoolAddress The {@link Address} of the {@link Whirlpool} to empty all positions in.
 * @returns A {@link Promise} that resolves once all positions are emptied.
 */
export async function emptyAllPositions(whirlpoolAddress: Address): Promise<EmptyAllPositionsSummary> {
  info('\n-- Empty All Positions --');

  const bundledPositions = await getPositions({ whirlpoolAddress, ...IGNORE_CACHE });

  const allResults: EmptyAllPositionsSummary = {
    failures: [],
    skips: [],
    successes: [],
  };

  bundledPositions.length
    ? info(`Emptying ${bundledPositions.length} positions in whirlpool:`, whirlpoolAddress)
    : info('No positions to empty in whirlpool:', whirlpoolAddress);
  info(bundledPositions.map((bundledPosition) =>
    bundledPosition.position.getAddress().toBase58()
  ));

  const promises = bundledPositions.map(async (bundledPosition, idx) => {
    const { position } = bundledPosition;
    await timeout(250 * idx); // Stagger requests to avoid rate limiting

    try {
      const result = await emptyPosition(position);
      result
        ? allResults.successes.push(result)
        : allResults.skips.push({ position });
    } catch (err) {
      allResults.failures.push({ position, err });
      error(err);
    }
  });
  await Promise.all(promises);

  info('Empty All Positions Complete:', {
    successCnt: allResults.successes.length,
    successes: allResults.successes.map((success) =>
      success.position.getAddress().toBase58()
    ),
    skipCnt: allResults.skips.length,
    skipPositions: allResults.skips.map((skip) =>
      skip.position.getAddress().toBase58()
    ),
    failureCnt: allResults.failures.length,
    failures: allResults.failures.map((failure) => ({
      position: failure.position.getAddress().toBase58(),
      err: failure.err,
    })),
  });

  return allResults;
}

/**
 * Empties a {@link Position} in a {@link Whirlpool}.
 *
 * @param position The {@link Position} to empty.
 * @returns A {@link Promise} that resolves to the {@link EmptyPositionTxSummary} once the position is emptied.
 */
export async function emptyPosition(position: Position): Promise<EmptyPositionTxSummary | undefined> {
  const transactionCtx = new TransactionContext();
  const opMetadata = {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  };

  try {
    return expBackoff(async (retry) => {
      info('\n-- Empty Position --\n', {
        ...opMetadata,
        retry,
      });

      // Must refresh data if retrying, or may generate error due to stale data.
      if (retry) {
        await position.refreshData();
      }

      const ixData = await genEmptyPositionIxData(position);

      // If no instructions to execute, then skip emptying position
      if (!ixData.decreaseLiquidityIxData && !ixData.collectFeesRewardsIxData) {
        info('No liquidity to decrease or fees / rewards to collect, skipping empty position:', opMetadata);
        return undefined;
      }

      const sendResult = await transactionCtx.resetInstructionData(
        ixData.decreaseLiquidityIxData,
        ixData.collectFeesRewardsIxData,
      ).send();

      const txSummary = await genEmptyPositionTxSummary({
        position,
        emptyPositionIxData: ixData,
        sendResult,
      });

      await OrcaPositionDAO.updateEmptied(txSummary, { catchErrors: true });
      return txSummary;
    }, {
      retryFilter: (result, err) => {
        const errInfo = getProgramErrorInfo(err);
        return ['InvalidTimestamp', 'LiquidityUnderflow', 'TokenMinSubceeded'].includes(errInfo?.name ?? '');
      },
    });
  } catch (err) {
    error('Empty Position Failed:', opMetadata);
    throw err;
  }
}

/**
 * Creates a transaction to empty a {@link Position} in a {@link Whirlpool}.
 *
 * @param position The {@link Position} to empty.
 * @returns A {@link Promise} that resolves to the {@link EmptyPositionIxData}.
 */
export async function genEmptyPositionIxData(position: Position): Promise<EmptyPositionIxData> {
  info('Creating empty instruction data for position:', position.getAddress());

  const decreaseLiquidityIxData = await genEmptyLiquidityIxData(position);
  const collectFeesRewardsIxData = await genEmptyFeesRewardsIxData(position);

  return {
    instructions: [],
    collectFeesRewardsIxData,
    decreaseLiquidityIxData,
    debugData: {
      name: 'Empty Position',
      whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
      position: position.getAddress().toBase58(),
    }
  };
}

/**
 * Generates a {@link DecreaseLiquidityIx} for emptying the liquidity in the given {@link Position} to zero.
 *
 * @param position The {@link Position} to decrease the liquidity of.
 * @returns A {@link Promise} that resolves to the {@link DecreaseLiquidityIx}.
 * If the position has no liquidity, returns `undefined`.
 */
export async function genEmptyLiquidityIxData(position: Position): Promise<DecreaseLiquidityIxData | undefined> {
  const { liquidity } = position.getData();

  if (!liquidity.isZero()) {
    return await genDecreaseLiquidityIxData({ liquidity, position });
  }

  info('No liquidity to decrease:', {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  });
  return undefined;
}

/**
 * Generates a {@link CollectFeesRewardsIxData} for emptying all fees and rewards from the given {@link Position}.
 *
 * @param position The {@link Position} to collect fees and rewards from.
 * @returns A {@link Promise} that resolves to the {@link CollectFeesRewardsIxData}.
 * If there are no fees or rewards to collect, returns `undefined`.
 */
export async function genEmptyFeesRewardsIxData(position: Position): Promise<CollectFeesRewardsIxData | undefined> {
  const collectFeesRewardsIxData = await genCollectFeesRewardsIxData(position, false);

  if (collectFeesRewardsIxData.instructions.length) {
    return collectFeesRewardsIxData;
  }

  info('No fees or rewards to collect:', {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  });
  return undefined;
}

/**
 * Generates an {@link EmptyPositionTxSummary} for a empty position transaction.
 *
 * @param args The arguments for generating the empty position transaction summary.
 * @returns A {@link Promise} that resolves to the {@link EmptyPositionTxSummary}.
 */
export async function genEmptyPositionTxSummary({
  position,
  emptyPositionIxData,
  sendResult
}: EmptyPositionTxSummaryArgs): Promise<EmptyPositionTxSummary> {
  const { collectFeesRewardsIxData, decreaseLiquidityIxData } = emptyPositionIxData;

  const txSummary = await getTxSummary(sendResult);

  const emptyPositionTxSummary: EmptyPositionTxSummary = {
    position,
    collectFeesRewardsTxSummary: collectFeesRewardsIxData
      ? await genCollectFeesRewardsTxSummary(position, sendResult)
      : undefined,
    decreaseLiquidityTxSummary: decreaseLiquidityIxData
      ? await genDecreaseLiquidityTxSummary(position, decreaseLiquidityIxData, sendResult)
      : undefined,
    ...txSummary,
  };

  info('Empty position tx summary:', {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
    fee: emptyPositionTxSummary.fee,
    signature: emptyPositionTxSummary.signature,
  });

  return emptyPositionTxSummary;
}

export type * from './empty-position.interfaces';
