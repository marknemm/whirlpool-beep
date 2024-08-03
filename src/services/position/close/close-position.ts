import PositionDAO from '@/data/position/position.dao';
import type { BundledPosition } from '@/interfaces/position.interfaces';
import { collectFeesRewards, genCollectFeesRewardsTx, genFeesRewardsTxSummary } from '@/services/fees-rewards/collect/collect-fees-rewards';
import { decreaseLiquidity, genDecreaseLiquidityTx } from '@/services/liquidity/decrease/decrease-liquidity';
import { genLiquidityTxSummary } from '@/services/liquidity/util/liquidity';
import { getPositions } from '@/services/position/query/query-position';
import { expBackoff, timeout } from '@/util/async/async';
import { debug, error, info } from '@/util/log/log';
import { getProgramErrorInfo } from '@/util/program/program';
import rpc from '@/util/rpc/rpc';
import { executeTransaction, getTransactionSummary } from '@/util/transaction/transaction';
import wallet from '@/util/wallet/wallet';
import whirlpoolClient, { formatWhirlpool } from '@/util/whirlpool/whirlpool';
import { TransactionBuilder, type Address } from '@orca-so/common-sdk';
import { IGNORE_CACHE, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, WhirlpoolIx, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import type { CloseAllPositionsResult, ClosePositionOptions, ClosePositionTxSummary, GenClosePositionTxResult, GenClosePositionTxSummaryArgs } from './close-position.interfaces';

/**
 * Closes all {@link Position}s in a {@link Whirlpool}.
 *
 * @param whirlpoolAddress The {@link Address} of the {@link Whirlpool} to close all positions in.
 * @returns A {@link Promise} that resolves once all positions are closed.
 */
export async function closeAllPositions(whirlpoolAddress: Address): Promise<CloseAllPositionsResult> {
  info('\n-- Close All Positions --');

  const bundledPositions = await getPositions({ whirlpoolAddress, ...IGNORE_CACHE });

  const allResults: CloseAllPositionsResult = {
    failures: [],
    successes: [],
  };

  bundledPositions.length
    ? info(`Closing ${bundledPositions.length} positions in whirlpool:`, whirlpoolAddress)
    : info('No positions to close in whirlpool:', whirlpoolAddress);

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
      success.bundledPosition.position.getAddress().toBase58()
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
 * @param bundledPosition The {@link BundledPosition} to close.
 * @returns A {@link Promise} that resolves to the {@link ClosePositionTxSummary} once the position is closed.
 */
export async function closePosition({
  bundledPosition,
  excludeCollectFeesRewards = false,
  excludeDecreaseLiquidity = false,
  separateTxs = false,
}: ClosePositionOptions): Promise<ClosePositionTxSummary> {
  const { position } = bundledPosition;
  const opMetadata = {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  };

  try {
    return expBackoff(async (retry) => {
      info('\n-- Close Position --\n', {
        ...opMetadata,
        retry,
      });

      // Must refresh data if retrying, or may generate error due to stale data.
      if (retry) {
        await position.refreshData();
      }

      if (separateTxs) {
        if (!excludeDecreaseLiquidity) {
          const { liquidity } = position.getData();

          !liquidity.isZero()
            ? await decreaseLiquidity(position, liquidity)
            : info('No liquidity to decrease:', {
              whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
              position: position.getAddress().toBase58(),
            });
        }

        if (!excludeCollectFeesRewards) {
          await collectFeesRewards(position);
        }
      }

      const { tx } = await genClosePositionTx({
        bundledPosition,
        excludeCollectFeesRewards: excludeCollectFeesRewards || separateTxs,
        excludeDecreaseLiquidity: excludeDecreaseLiquidity || separateTxs,
      });

      const signature = await executeTransaction(tx, {
        name: 'Close Position',
        ...opMetadata
      });

      const closePositionTxSummary = await genClosePositionTxSummary({
        bundledPosition,
        excludeCollectFeesRewards,
        excludeDecreaseLiquidity,
        separateTxs,
        signature,
      });

      await PositionDAO.updateClosed(closePositionTxSummary, { catchErrors: true });
      return closePositionTxSummary;
    }, {
      retryFilter: (result, err) => {
        const errInfo = getProgramErrorInfo(err);
        return ['InvalidTimestamp', 'LiquidityUnderflow', 'TokenMinSubceeded'].includes(errInfo?.name ?? '');
      },
    });
  } catch (err) {
    error('Close Position Failed:', opMetadata);
    throw err;
  }
}

/**
 * Creates a transaction to close a {@link Position} in a {@link Whirlpool}.
 *
 * @param bundledPosition The {@link BundledPosition} to close.
 * @returns A {@link Promise} that resolves to the {@link TransactionBuilder}.
 */
export async function genClosePositionTx({
  bundledPosition,
  excludeCollectFeesRewards = false,
  excludeDecreaseLiquidity = false,
}: ClosePositionOptions): Promise<GenClosePositionTxResult> {
  const { bundleIndex, position, positionBundle } = bundledPosition;
  const result: GenClosePositionTxResult = { tx: new TransactionBuilder(rpc(), wallet()) };

  info('Creating close position transaction for position:', position.getAddress());

  if (!excludeDecreaseLiquidity) {
    const { liquidity } = position.getData();

    if (!liquidity.isZero()) {
      const { tx: decreaseLiquidityTx } = await genDecreaseLiquidityTx(position, liquidity);
      result.decreaseLiquidityTx = decreaseLiquidityTx;
      result.tx.addInstruction(decreaseLiquidityTx.compressIx(true));
    } else {
      info('No liquidity to decrease:', {
        whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
        position: position.getAddress().toBase58(),
      });
    }
  }

  if (!excludeCollectFeesRewards) {
    const { feesQuote, rewardsQuote, tx } = await genCollectFeesRewardsTx(position, false); // false no update fees and rewards
    const hasFees = !feesQuote.feeOwedA.isZero() || !feesQuote.feeOwedB.isZero();
    const hasRewards = rewardsQuote.rewardOwed.some((reward) => reward && !reward.isZero());

    if (hasFees || hasRewards) {
      result.feesRewardsTx = tx;
      result.tx.addInstruction(tx.compressIx(true));
    } else {
      info('No fees or rewards to collect:', {
        whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
        position: position.getAddress().toBase58(),
      });
    }
  }

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

  const closeBundledPositionIx = WhirlpoolIx.closeBundledPositionIx(
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
  result.tx.addInstruction(closeBundledPositionIx);

  return result;
}

/**
 * Generates a {@link ClosePositionTxSummary} for a close position transaction.
 *
 * @param args The arguments for generating the close position transaction summary.
 * @returns A {@link Promise} that resolves to the {@link ClosePositionTxSummary}.
 */
export async function genClosePositionTxSummary({
  bundledPosition,
  excludeCollectFeesRewards = false,
  excludeDecreaseLiquidity = false,
  separateTxs = false,
  signature
}: GenClosePositionTxSummaryArgs): Promise<ClosePositionTxSummary> {
  const txSummary = await getTransactionSummary(signature);

  const closePositionTxSummary: ClosePositionTxSummary = {
    bundledPosition,
    signature,
    fee: txSummary.fee,
  };

  if (!excludeDecreaseLiquidity) {
    const liquidityTxSummary = await genLiquidityTxSummary(bundledPosition.position, signature);
    if (!separateTxs) liquidityTxSummary.fee = 0;
    closePositionTxSummary.liquidityTxSummary = liquidityTxSummary;
  }

  if (!excludeCollectFeesRewards) {
    const feesRewardsTxSummary = await genFeesRewardsTxSummary(bundledPosition.position, signature);
    if (!separateTxs) feesRewardsTxSummary.fee = 0;
    closePositionTxSummary.feesRewardsTxSummary = feesRewardsTxSummary;
  }

  info('Close position tx summary:', {
    whirlpool: await formatWhirlpool(bundledPosition.position.getWhirlpoolData()),
    position: bundledPosition.position.getAddress().toBase58(),
    signature,
    fee: closePositionTxSummary.fee,
  });

  return closePositionTxSummary;
}

export type * from './close-position.interfaces';
