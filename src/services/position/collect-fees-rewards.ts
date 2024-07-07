import { getPositions } from '@/services/position/get-position';
import anchor from '@/util/anchor';
import { error, info } from '@/util/log';
import rpc, { verifyTransaction } from '@/util/rpc';
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
 */
export async function collectFeesRewards(position: Position): Promise<void> {
  info('\n-- Collect Fees and Rewards --');

  const collectFeesTx = await position.collectFees(true);
  const collectRewardsTxs = await position.collectRewards();

  const tx = new TransactionBuilder(rpc(), anchor().wallet);
  tx.addInstruction(collectFeesTx.compressIx(true));
  collectRewardsTxs.forEach((ix) => tx.addInstruction(ix.compressIx(true)));

  info('Executing collect fees and rewards transaction...');
  const signature = await tx.buildAndExecute();
  await verifyTransaction(signature);

  info('Collected fees and rewards for position:', position.getAddress().toBase58());
  await position.refreshData();
}
