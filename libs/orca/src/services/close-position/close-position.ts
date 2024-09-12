import { debug, error, expBackoff, info, timeout } from '@npc/core';
import OrcaPositionDAO from '@npc/orca/data/orca-position/orca-position.dao';
import { genEmptyFeesRewardsIxSet, genEmptyLiquidityIxSet } from '@npc/orca/services/empty-position/empty-position';
import { getPositions } from '@npc/orca/util/position/position';
import whirlpoolClient, { formatWhirlpool } from '@npc/orca/util/whirlpool/whirlpool';
import { getProgramErrorInfo, TransactionBuilder, TransactionContext, wallet } from '@npc/solana';
import { type Address } from '@orca-so/common-sdk';
import { IGNORE_CACHE, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, WhirlpoolIx, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import type { CloseAllPositionsSummary, ClosePositionArgs, ClosePositionIxSet, ClosePositionSummary } from './close-position.interfaces';

/**
 * Closes all {@link Position}s in a {@link Whirlpool}.
 *
 * @param whirlpoolAddress The {@link Address} of the {@link Whirlpool} to close all positions in.
 * @returns A {@link Promise} that resolves once all positions are closed.
 */
export async function closeAllPositions(whirlpoolAddress: Address): Promise<CloseAllPositionsSummary> {
  info('\n-- Close All Positions --');

  const bundledPositions = await getPositions({ whirlpoolAddress, ...IGNORE_CACHE });

  const allResults: CloseAllPositionsSummary = {
    failures: [],
    successes: [],
  };

  bundledPositions.length
    ? info(`Closing ${bundledPositions.length} positions in whirlpool:`, whirlpoolAddress)
    : info('No positions to close in whirlpool:', whirlpoolAddress);
  info(bundledPositions.map((bundledPosition) =>
    bundledPosition.position.getAddress().toBase58()
  ));

  const promises = bundledPositions.map(async (bundledPosition, idx) => {
    await timeout(250 * idx); // Stagger requests to avoid rate limiting

    try {
      const result = await closePosition({ bundledPosition });
      allResults.successes.push(result);
    } catch (err) {
      allResults.failures.push({ bundledPosition, err });
      error(err);
    }
  });
  await Promise.all(promises);

  info('Close All Positions Complete:', {
    successCnt: allResults.successes.length,
    successes: allResults.successes.map((success) =>
      success.data.positionAddress
    ),
    failureCnt: allResults.failures.length,
    failures: allResults.failures.map((failure) => ({
      position: failure.bundledPosition.position.getAddress().toBase58(),
      err: failure.err,
    })),
  });

  return allResults;
}

/**
 * Closes a {@link Position} in a {@link Whirlpool}.
 *
 * @param args The {@link ClosePositionArgs} for closing the position.
 * @returns A {@link Promise} that resolves to the {@link ClosePositionSummary} once the position is closed.
 */
export async function closePosition(args: ClosePositionArgs): Promise<ClosePositionSummary> {
  const { bundledPosition } = args;
  const { position } = bundledPosition;

  const txCtx = new TransactionContext();
  const opMetadata = {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  };

  try {
    const summary = await expBackoff(async (retry) => {
      info('\n-- Close Position --\n', {
        ...opMetadata,
        retry,
      });

      // Must refresh data if retrying, or may generate error due to stale data.
      if (retry) {
        await position.refreshData();
      }

      const ixSet = await genClosePositionIxSet(args);
      const txSummary = await txCtx.setInstructionSet(ixSet).send({
        debugData: {
          name: 'Close Position',
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

    await OrcaPositionDAO.updateClosed(summary, { catchErrors: true });
    return summary;
  } catch (err) {
    error('Close Position Failed:', opMetadata);
    throw err;
  }
}

/**
 * Creates a {@link ClosePositionIxSet} to close a {@link Position} in a {@link Whirlpool}.
 *
 * @param args The {@link ClosePositionArgs} for closing the position.
 * @returns A {@link Promise} that resolves to the {@link ClosePositionIxSet}.
 */
export async function genClosePositionIxSet(args: ClosePositionArgs): Promise<ClosePositionIxSet> {
  const {
    bundledPosition,
    excludeCollectFeesRewards = false,
    excludeDecreaseLiquidity = false
  } = args;
  const { bundleIndex, position, positionBundle } = bundledPosition;

  info('Creating close instruction data for position:', position.getAddress());

  const positionBundleATA = await wallet().getNFTAccount(positionBundle.positionBundleMint);
  if (!positionBundleATA) throw new Error('Position bundle token account (ATA) cannot be found');

  const positionBundlePda = PDAUtil.getPositionBundle(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    positionBundle.positionBundleMint
  );

  debug('Tx details for close position:', {
    bundledPosition: position.getAddress().toBase58(),
    positionBundleAuthority: wallet().publicKey.toBase58(),
    positionBundleTokenAccount: positionBundleATA.address.toBase58(),
    positionBundle: positionBundlePda.publicKey.toBase58(),
    bundleIndex,
    receiver: wallet().publicKey.toBase58(),
  });

  const ixSet = WhirlpoolIx.closeBundledPositionIx(
    whirlpoolClient().getContext().program,
    {
      bundledPosition: position.getAddress(),
      positionBundleAuthority: wallet().publicKey,
      positionBundleTokenAccount: positionBundleATA.address,
      positionBundle: positionBundlePda.publicKey,
      bundleIndex,
      receiver: wallet().publicKey,
    }
  );

  const emptyLiquidityTxCtx = !excludeDecreaseLiquidity
    ? await genEmptyLiquidityIxSet(position)
    : undefined;

  const collectFeesRewardsIxData = !excludeCollectFeesRewards
    ? await genEmptyFeesRewardsIxSet(position)
    : undefined;

  const txBuilder = new TransactionBuilder()
    .addInstructionSet(emptyLiquidityTxCtx)
    .addInstructionSet(collectFeesRewardsIxData)
    .addInstructionSet(ixSet);

  return {
    ...txBuilder.instructionSet,
    data: {
      positionAddress: position.getAddress(),
      decreaseLiquidity: emptyLiquidityTxCtx?.data,
      collectFeesRewards: collectFeesRewardsIxData?.data,
    },
  };
}

export type * from './close-position.interfaces';
