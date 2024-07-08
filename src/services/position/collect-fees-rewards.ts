import { getPositions } from '@/services/position/get-position';
import { error, info } from '@/util/log';
import rpc, { verifyTransaction } from '@/util/rpc';
import wallet from '@/util/wallet';
import { TransactionBuilder } from '@orca-so/common-sdk';
import { type Position } from '@orca-so/whirlpools-sdk';

/**
 * Collects all fee rewards for all positions.
 */
export async function collectAllFeesRewards(): Promise<void> {
  info('\n-- Collect All Fees and Rewards --');

  const positions = await getPositions();
  for (const position of positions) {
    try {
      await collectFeesRewards(position);
    } catch (err) {
      error('Failed to collect fees and rewards for position:', position.getAddress().toBase58());
      error(err);
    }
  }
}

/**
 * Collects the fee reward for a given {@link position}.
 *
 * @param position The {@link Position} to collect the fee reward for.
 * @returns A {@link Promise} that resolves once the fee reward is collected.
 */
export async function collectFeesRewards(position: Position): Promise<void> {
  info('\n-- Collect Fees and Rewards --');

  const tx = await collectFeesRewardsTx(position);

  info('Executing collect fees and rewards transaction...');
  const signature = await tx.buildAndExecute();
  await verifyTransaction(signature);

  info('Collected fees and rewards for position:', position.getAddress().toBase58());
  await position.refreshData();
}

/**
 * Creates a transaction to collect fees and rewards for a given {@link position}.
 *
 * @param position The {@link Position} to collect fees and rewards for.
 * @returns A {@link Promise} that resolves to the {@link TransactionBuilder}.
 */
export async function collectFeesRewardsTx(position: Position): Promise<TransactionBuilder> {
  const collectFeesTx = await position.collectFees(true);
  const collectRewardsTxs = await position.collectRewards();

  const tx = new TransactionBuilder(rpc(), wallet());
  tx.addInstruction(collectFeesTx.compressIx(true));
  collectRewardsTxs.forEach((ix) => tx.addInstruction(ix.compressIx(true)));

  return tx;
}
