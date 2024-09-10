import { type Address } from '@coral-xyz/anchor';
import { error, expBackoff, info, numericToString } from '@npc/core';
import MeteoraFeeDAO from '@npc/meteora/data/meteora-fee/meteora-fee.dao';
import { formatPool, getPool, getPoolTokenPair } from '@npc/meteora/util/pool/pool';
import { getPositions, resolvePosition, type Position } from '@npc/meteora/util/position/position';
import { getProgramErrorInfo, getTransferTotalsFromIxs, getTxSummary, InstructionSetMap, TransactionContext, wallet, type SendTransactionResult } from '@npc/solana';
import BN from 'bn.js';
import type { CollectFeesRewardsTxSummary } from './collect-fees-rewards.interfaces';

/**
 * Collects all fee rewards for all positions.
 *
 * @param poolAddress The {@link Address} of the Meteora {@link DLMM} pool to collect fees and rewards from.
 * If not provided, collects fees and rewards from {@link Position}s across all {@link DLMM} pools.
 * @returns A {@link Promise} that resolves once all fees and rewards are collected.
 */
export async function collectAllFeesRewards(poolAddress?: Address): Promise<void> {
  info('\n-- Collect All Fees and Rewards --');

  const positions = await getPositions({ poolAddress });

  if (!positions.length) {
    poolAddress
      ? info('No positions to collect fees and rewards for in Meteora DLMM pool:', poolAddress)
      : info('No positions to collect fees and rewards for');
  } else {
    poolAddress
      ? info(`Collecting fees and rewards for ${positions.length} positions in Meteora DLMM pool:`, poolAddress)
      : info(`Collecting fees and rewards for all ${positions.length} positions...`);
  }

  const promises = positions.map(
    (position) => collectFeesRewards(position.publicKey)
      .catch((err) => error(err))
  );

  await Promise.all(promises);
}

/**
 * Collects the fee reward for a given {@link position}.
 *
 * @param position The {@link Position} or {@link Address} of the {@link Position} to collect the fee reward from.
 * @returns A {@link Promise} that resolves to a {@link CollectFeesRewardsTxSummary} once the transaction completes.
 */
export async function collectFeesRewards(position: Position | Address): Promise<CollectFeesRewardsTxSummary> {
  position = await resolvePosition(position);
  const pool = await getPool({ poolAddress: position.poolPublicKey });

  const transactionCtx = new TransactionContext();
  const opMetadata = {
    whirlpool: await formatPool(pool),
    position: position.publicKey.toBase58(),
  };

  try {
    return expBackoff(async (retry) => {
      info('\n-- Collect Fees and Rewards --\n', {
        ...opMetadata,
        retry,
      });

      // Must refresh data if retrying, or may generate error due to stale data.
      if (retry) {
        await pool.refetchStates();
      }

      const collectFeesRewardsIxData = await genCollectFeesRewardsIxData(position);
      const sendResult = await transactionCtx
        .resetInstructionData(collectFeesRewardsIxData)
        .send();

      const txSummary = await genCollectFeesRewardsTxSummary(position, sendResult);
      await MeteoraFeeDAO.insert(txSummary, { catchErrors: true });

      return txSummary;
    }, {
      retryFilter: (result, err) => {
        const errInfo = getProgramErrorInfo(err);
        return ['InvalidTimestamp'].includes(errInfo?.name ?? '');
      }
    });
  } catch (err) {
    error('Failed to collect fees and rewards:', opMetadata);
    throw err;
  }
}

/**
 * Creates {@link CollectFeesRewardsIxData} to collect fees and rewards for a given {@link position}.
 *
 * @param position The {@link Position} or {@link Address} of the {@link Position} to collect fees and rewards from.
 * @returns A {@link Promise} that resolves to the {@link CollectFeesRewardsIxData}.
 */
export async function genCollectFeesRewardsIxData(position: Position | Address): Promise<InstructionSetMap> {
  position = await resolvePosition(position);
  const pool = await getPool({ poolAddress: position.poolPublicKey });

  info('Creating collect fees and rewards transaction:', {
    whirlpool: await formatPool(pool),
    position: position.publicKey.toBase58(),
  });

  const tx = await pool.claimSwapFee({
    owner: wallet().publicKey,
    position,
  });

  return { instructions: tx.instructions };
}

/**
 * Generates a {@link CollectFeesRewardsTxSummary} for a collect fees / rewards transaction.
 *
 * @param position The {@link Position} to get the {@link CollectFeesRewardsTxSummary} for.
 * @param sendResult The {@link SendTransactionResult} of the collection transaction.
 * @returns A {@link Promise} that resolves to the {@link CollectFeesRewardsTxSummary}.
 */
export async function genCollectFeesRewardsTxSummary(
  position: Position,
  sendResult: SendTransactionResult,
): Promise<CollectFeesRewardsTxSummary> {
  const pool = await getPool({ poolAddress: position.poolPublicKey });
  const [tokenX, tokenY] = await getPoolTokenPair(pool);
  const txSummary = await getTxSummary(sendResult);

  const feesRewardsIx = txSummary.decodedIxs.find(
    (ix) => ix.name.toLowerCase().includes('fee')
  );
  if (!feesRewardsIx) throw new Error('No collect fees / rewards instruction found in transaction');
  const { tokenTotals, usd } = await getTransferTotalsFromIxs([feesRewardsIx]);

  const feesRewardsTxSummary: CollectFeesRewardsTxSummary = {
    position,
    tokenAmountX: tokenTotals.get(tokenX.mint.publicKey) ?? new BN(0),
    tokenAmountY: tokenTotals.get(tokenY.mint.publicKey) ?? new BN(0),
    ...txSummary,
    usd,
  };

  info('Fees and rewards tx summary:', {
    pool: await formatPool(pool),
    position: position.publicKey.toBase58(),
    [tokenX.metadata.symbol]: numericToString(feesRewardsTxSummary.tokenAmountX, tokenX.mint.decimals),
    [tokenY.metadata.symbol]: numericToString(feesRewardsTxSummary.tokenAmountY, tokenY.mint.decimals),
    usd: `$${feesRewardsTxSummary.usd}`,
    fee: `${feesRewardsTxSummary.fee}`,
    signature: feesRewardsTxSummary.signature,
  });

  return feesRewardsTxSummary;
}

export type * from './collect-fees-rewards.interfaces';
