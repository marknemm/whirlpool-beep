import { getPositions } from '@/services/position/get-position';
import { error, info } from '@/util/log';
import rpc, { verifyTransaction } from '@/util/rpc';
import wallet from '@/util/wallet';
import { Address, TransactionBuilder } from '@orca-so/common-sdk';
import { type Position } from '@orca-so/whirlpools-sdk';

/**
 * Collects all fee rewards for all positions.
 *
 * @param whirlpoolAddress The {@link Address} of the {@link Whirlpool} to collect fees and rewards from.
 * @returns A {@link Promise} that resolves once all fees and rewards are collected.
 */
export async function collectAllFeesRewards(whirlpoolAddress?: Address): Promise<void> {
  info('\n-- Collect All Fees and Rewards --');

  const bundledPositions = await getPositions({ whirlpoolAddress });

  if (!bundledPositions.length) {
    whirlpoolAddress
      ? info('No positions to collect fees and rewards for in whirlpool:', whirlpoolAddress)
      : info('No positions to collect fees and rewards for');
  } else {
    whirlpoolAddress
      ? info(`Collecting fees and rewards for ${bundledPositions.length} positions in whirlpool:`, whirlpoolAddress)
      : info(`Collecting fees and rewards for all ${bundledPositions.length} positions...`);
  }

  const promises = bundledPositions.map(
    (bundledPosition) => collectFeesRewards(bundledPosition.position)
      .catch((err) => error(err))
  );

  await Promise.all(promises);
}

/**
 * Collects the fee reward for a given {@link position}.
 *
 * @param position The {@link Position} to collect the fee reward for.
 * @returns A {@link Promise} that resolves once the fee reward is collected.
 */
export async function collectFeesRewards(position: Position): Promise<void> {
  info('\n-- Collect Fees and Rewards --');

  const tx = await genCollectFeesRewardsTx(position);

  info('Executing collect fees and rewards transaction...');
  const signature = await tx.buildAndExecute();
  await verifyTransaction(signature);

  info('Collected fees and rewards for position:', position.getAddress());
  await position.refreshData();
}

/**
 * Creates a transaction to collect fees and rewards for a given {@link position}.
 *
 * @param position The {@link Position} to collect fees and rewards for.
 * @returns A {@link Promise} that resolves to the {@link TransactionBuilder}.
 */
export async function genCollectFeesRewardsTx(position: Position): Promise<TransactionBuilder> {
  info('Creating collect fees and rewards transaction for position:', position.getAddress());

  const collectFeesTx = await position.collectFees(true);
  const collectRewardsTxs = await position.collectRewards();

  const tx = new TransactionBuilder(rpc(), wallet());
  tx.addInstruction(collectFeesTx.compressIx(true));
  collectRewardsTxs.forEach((ix) => tx.addInstruction(ix.compressIx(true)));

  return tx;
}
