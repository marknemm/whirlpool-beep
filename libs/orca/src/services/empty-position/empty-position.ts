import { error, expBackoff, info, timeout } from '@npc/core';
import OrcaPositionDAO from '@npc/orca/data/orca-position/orca-position.dao';
import { CollectFeesRewardsIxSet, genCollectFeesRewardsIxSet } from '@npc/orca/services/collect-fees-rewards/collect-fees-rewards';
import { genDecreaseLiquidityIxSet } from '@npc/orca/services/decrease-liquidity/decrease-liquidity';
import { DecreaseLiquidityIxSet } from '@npc/orca/services/decrease-liquidity/decrease-liquidity.interfaces';
import { getPositions, resolvePosition } from '@npc/orca/util/position/position';
import { formatWhirlpool } from '@npc/orca/util/whirlpool/whirlpool';
import { getProgramErrorInfo, TransactionBuilder, TransactionContext } from '@npc/solana';
import { type Address } from '@orca-so/common-sdk';
import { IGNORE_CACHE, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import type { EmptyAllPositionsSummary, EmptyPositionIxSet, EmptyPositionSummary } from './empty-position.interfaces';

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
      success.data.positionAddress
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
 * @param position The {@link Address} of the {@link Position} or the {@link Position} to empty.
 * @returns A {@link Promise} that resolves to the {@link EmptyPositionSummary} once the position is emptied.
 */
export async function emptyPosition(position: Address | Position): Promise<EmptyPositionSummary | undefined> {
  position = await resolvePosition(position);

  const txCtx = new TransactionContext();
  const opMetadata = {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  };

  try {
    const summary = await expBackoff(async (retry) => {
      info('\n-- Empty Position --\n', {
        ...opMetadata,
        retry,
      });

      // Must refresh data if retrying, or may generate error due to stale data.
      if (retry) {
        await position.refreshData();
      }

      // If no instructions to execute, then skip emptying position
      const ixSet = await genEmptyPositionIxSet(position);
      if (!ixSet.instructions.length) {
        info('No liquidity to decrease or fees / rewards to collect, skipping empty position:', opMetadata);
        return undefined;
      }

      // Send transaction to empty position
      const txSummary = await txCtx.setInstructionSet(ixSet).send({
        debugData: {
          name: 'Empty Position',
          ...ixSet.data,
        }
      });

      return { ...txSummary, data: ixSet.data };
    }, {
      retryFilter: (result, err) => {
        const errInfo = getProgramErrorInfo(err);
        return ['InvalidTimestamp', 'LiquidityUnderflow', 'TokenMinSubceeded'].includes(errInfo?.name ?? '');
      },
    });

    if (summary) {
      info('Empty Position Complete:', opMetadata);
      await OrcaPositionDAO.updateEmptied(summary, { catchErrors: true });
    }
    return summary;
  } catch (err) {
    error('Empty Position Failed:', opMetadata);
    throw err;
  }
}

/**
 * Creates a transaction to empty a {@link Position} in a {@link Whirlpool}.
 *
 * @param position The {@link Address} of the {@link Position} or the {@link Position} to empty.
 * @returns A {@link Promise} that resolves to the {@link EmptyPositionIxSet}.
 */
export async function genEmptyPositionIxSet(position: Address | Position): Promise<EmptyPositionIxSet> {
  position = await resolvePosition(position);
  info('Creating empty instruction data for position:', position.getAddress());

  const emptyLiquidityIxSet = await genEmptyLiquidityIxSet(position);
  const collectFeesRewardsIxSet = await genEmptyFeesRewardsIxSet(position);

  const txBuilder = new TransactionBuilder()
    .addInstructionSet(emptyLiquidityIxSet)
    .addInstructionSet(collectFeesRewardsIxSet);

  return {
    ...txBuilder.instructionSet,
    data: {
      positionAddress: position.getAddress(),
      collectFeesRewards: collectFeesRewardsIxSet?.data,
      decreaseLiquidity: emptyLiquidityIxSet?.data,
    }
  };
}

/**
 * Generates a {@link DecreaseLiquidityIxSet} for emptying the liquidity in the given {@link Position} to zero.
 *
 * @param position The {@link Position} to decrease the liquidity of.
 * @returns A {@link Promise} that resolves to the {@link DecreaseLiquidityIxSet}.
 * If the position has no liquidity, returns `undefined`.
 */
export async function genEmptyLiquidityIxSet(position: Position): Promise<DecreaseLiquidityIxSet | undefined> {
  const { liquidity } = position.getData();

  if (!liquidity.isZero()) {
    return await genDecreaseLiquidityIxSet({ liquidity, position });
  }

  info('No liquidity to decrease:', {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  });
  return undefined;
}

/**
 * Generates a {@link CollectFeesRewardsIxSet} for emptying all fees and rewards from the given {@link Position}.
 *
 * @param position The {@link Position} to collect fees and rewards from.
 * @returns A {@link Promise} that resolves to the {@link CollectFeesRewardsIxSet}.
 * If there are no fees or rewards to collect, returns `undefined`.
 */
export async function genEmptyFeesRewardsIxSet(position: Position): Promise<CollectFeesRewardsIxSet | undefined> {
  const collectFeesRewardsTxCtx = await genCollectFeesRewardsIxSet({ position, updateFeesAndRewards: false });

  if (collectFeesRewardsTxCtx.instructions.length) {
    return collectFeesRewardsTxCtx;
  }

  info('No fees or rewards to collect:', {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  });
  return undefined;
}

export type * from './empty-position.interfaces';
