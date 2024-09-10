import { db, debug, handleDBInsertError, toBigInt, type DAOInsertOptions, type ErrorWithCode, type Null } from '@npc/core';
import OrcaPositionDAO from '@npc/orca/data/orca-position/orca-position.dao';
import type { CollectFeesRewardsTxSummary } from '@npc/orca/services/fees-rewards/collect/collect-fees-rewards.interfaces';
import { SolanaTxDAO } from '@npc/solana';
import { type Position } from '@orca-so/whirlpools-sdk';

/**
 * Pure static data access object for Orca Fee DB operations.
 */
export default class OrcaFeeDAO {

  /**
   * Private constructor for pure static class.
   */
  private constructor() {}

  /**
   * Inserts a {@link CollectFeesRewardsTxSummary} record into the database.
   *
   * @param txSummary The {@link CollectFeesRewardsTxSummary} to insert.
   * @param opts The {@link DAOInsertOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the inserted row's `address` when the operation is complete.
   * If the {@link Position} is {@link Null}, an empty string is returned.
   */
  static async insert(
    txSummary: CollectFeesRewardsTxSummary | Null,
    opts?: DAOInsertOptions
  ): Promise<number | undefined> {
    if (!txSummary) return;

    const solanaTxId = await SolanaTxDAO.insert(txSummary, { ...opts, ignoreDuplicates: true });
    if (solanaTxId == null) return; // No throw error - SolanaTxDAO handles errors

    const positionAddress = txSummary.position.getAddress().toBase58();
    debug('Inserting Orca Fee into database for Orca Position:', positionAddress);

    try {
      const positionId = await OrcaPositionDAO.getId(txSummary.position.getAddress());
      if (positionId == null) {
        throw new Error(`Position does not exist in database: ${positionAddress}`);
      }

      const result = await db().insertInto('orcaFee')
        .values({
          position: positionId,
          tokenAmountA: toBigInt(txSummary.tokenAmountA),
          tokenAmountB: toBigInt(txSummary.tokenAmountB),
          tx: solanaTxId,
          usd: txSummary.usd,
        })
        .returning('id')
        .executeTakeFirst();

      debug(`Inserted Orca Fee into database ( ID: ${result?.id} ):`, txSummary.signature);
      return result?.id;
    } catch (err) {
      handleDBInsertError(err as ErrorWithCode, 'Orca Fee', positionAddress, opts);
    }
  }

}
