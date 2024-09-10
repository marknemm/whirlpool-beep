import { type Address } from '@coral-xyz/anchor';
import type DLMM from '@meteora-ag/dlmm';
import { error, expBackoff, info, timeout } from '@npc/core';
import { genCollectFeesRewardsIxData, genCollectFeesRewardsTxSummary } from '@npc/meteora/services/collect-fees-rewards/collect-fees-rewards';
import { genDecreaseLiquidityIxData, genDecreaseLiquidityTxSummary } from '@npc/meteora/services/decrease-liquidity/decrease-liquidity';
import { formatPool, getPool } from '@npc/meteora/util/pool/pool';
import { getPositions, resolvePosition, type Position } from '@npc/meteora/util/position/position';
import { getTxSummary, TransactionContext, wallet } from '@npc/solana';
import { BN } from 'bn.js';
import { CloseAllPositionsSummary, ClosePositionOptions, ClosePositionTxSummary, ClosePositionTxSummaryArgs } from './close-position.interfaces';

/**
 * Closes all {@link Position}s in a Meteora {@link DLMM} pool.
 *
 * @param poolAddress The {@link Address} of the Meteora {@link DLMM} pool to close all positions in.
 * @returns A {@link Promise} that resolves to a {@link CloseAllPositionsSummary} once all positions are closed.
 */
export async function closeAllPositions(poolAddress: Address): Promise<CloseAllPositionsSummary> {
  info('\n-- Close All Positions --');

  const positions = await getPositions({ poolAddress });

  const allResults: CloseAllPositionsSummary = {
    failures: [],
    successes: [],
  };

  positions.length
    ? info(`Closing ${positions.length} positions in Meteora DLMM pool:`, poolAddress)
    : info('No positions to close in Meteora DLMM pool:', poolAddress);
  info(positions.map((position) =>
    position.publicKey.toBase58()
  ));

  const promises = positions.map(async (position, idx) => {
    await timeout(250 * idx); // Stagger requests to avoid rate limiting

    try {
      const result = await closePosition(position);
      allResults.successes.push(result);
    } catch (err) {
      allResults.failures.push({ position, err });
      error(err);
    }
  });
  await Promise.all(promises);

  info('Close All Positions Complete:', {
    successCnt: allResults.successes.length,
    successes: allResults.successes.map((success) =>
      success.position.publicKey.toBase58()
    ),
    failureCnt: allResults.failures.length,
    failures: allResults.failures.map((failure) => ({
      position: failure.position.publicKey.toBase58(),
      err: failure.err,
    })),
  });

  return allResults;
}

/**
 * Closes a given {@link Position}.
 *
 * @param position The {@link Position} to close.
 * @param opts The {@link ClosePositionOptions}.
 * @returns A {@link Promise} that resolves to the {@link ClosePositionTxSummary}.
 */
export async function closePosition(
  position: Position | Address,
  opts: ClosePositionOptions = {}
): Promise<ClosePositionTxSummary> {
  position = await resolvePosition(position, opts);

  const sendResult = await expBackoff(async (retry) => {
    const pool = await getPool({
      poolAddress: position.poolPublicKey,
      ignoreCache: opts.ignoreCache,
    });

    // Must refresh data if retrying, or may generate error due to stale data
    if (retry) {
      await pool.refetchStates();
    }

    const transactionCtx = await genClosePositionTransactionCtx(position, opts);

    return transactionCtx.send();
  });

  const txSummary = await genClosePositionTxSummary({
    position,
    sendResult
  });
  return txSummary;
}

/**
 * Generates the {@link TransactionContext} for closing a given {@link Position}.
 *
 * @param position The {@link Position} or {@link Address} of the {@link Position} to close.
 * @param opts The {@link ClosePositionOptions}.
 * @returns A {@link Promise} that resolves to the {@link TransactionContext} to close the position.
 */
export async function genClosePositionTransactionCtx(
  position: Position | Address,
  opts: ClosePositionOptions = {}
): Promise<TransactionContext> {
  const transactionCtx = new TransactionContext();
  position = await resolvePosition(position);
  const pool = await getPool({ poolAddress: position.poolPublicKey });

  opts.excludeDecreaseLiquidity = opts.excludeDecreaseLiquidity
    || (position.positionData.totalXAmount === '0' && position.positionData.totalYAmount === '0');
  if (!opts.excludeDecreaseLiquidity) {
    const decreaseLiquidityIxData = await genDecreaseLiquidityIxData({
      liquidity: new BN(100 * 100), // 100% of liquidity
      positionAddress: position.publicKey,
    });
    transactionCtx.addInstructionData(decreaseLiquidityIxData);
  }

  opts.excludeCollectFeesRewards = !!opts.excludeCollectFeesRewards;
  if (!opts.excludeCollectFeesRewards) {
    const collectFeesRewardsIxData = await genCollectFeesRewardsIxData(position);
    transactionCtx.addInstructionData(collectFeesRewardsIxData);
  }

  const tx = await pool.closePosition({
    owner: wallet().publicKey,
    position,
  });
  transactionCtx.addInstructions(...tx.instructions);

  return transactionCtx;
}

/**
 * Generates a {@link ClosePositionTxSummary} for a close position transaction.
 *
 * @param args The arguments for generating the close position transaction summary.
 * @returns A {@link Promise} that resolves to the {@link ClosePositionTxSummary}.
 */
export async function genClosePositionTxSummary({
  position,
  sendResult
}: ClosePositionTxSummaryArgs): Promise<ClosePositionTxSummary> {
  const txSummary = await getTxSummary(sendResult);

  const closePositionTxSummary: ClosePositionTxSummary = {
    position,
    collectFeesRewardsTxSummary: undefined, // Assigned below if exists
    decreaseLiquidityTxSummary: undefined,  // Assigned below if exists
    ...txSummary,
  };

  const liquidityIx = txSummary.decodedIxs.find(
    (ix) => /remove\s*liquidity/i.test(ix.name)
  );
  closePositionTxSummary.decreaseLiquidityTxSummary = liquidityIx
    ? await genDecreaseLiquidityTxSummary(position, sendResult)
    : undefined;

  const collectFeeIx = txSummary.decodedIxs.find(
    (ix) => /claim\s*fee/i.test(ix.name)
  );
  closePositionTxSummary.collectFeesRewardsTxSummary = collectFeeIx
    ? await genCollectFeesRewardsTxSummary(position, sendResult)
    : undefined;

  info('Close position tx summary:', {
    pool: await formatPool(position.poolPublicKey),
    position: position.publicKey.toBase58(),
    fee: closePositionTxSummary.fee,
    signature: closePositionTxSummary.signature,
  });

  return closePositionTxSummary;
}

export type * from './close-position.interfaces';
