import type { ErrorWithCode, Null } from '@npc/core';
import { db, debug, handleDBInsertError, type DAOInsertOptions } from '@npc/core';
import OrcaPositionDAO from '@npc/orca/data/orca-position/orca-position.dao';
import type { RebalanceTxSummary } from '@npc/orca/services/position/rebalance/rebalance-position.interfaces';
import { type Position } from '@orca-so/whirlpools-sdk';

/**
 * Pure static data access object for Orca Rebalance DB operations.
 */
export default class OrcaRebalanceDAO {

  /**
   * Private constructor for pure static class.
   */
  private constructor() {}

  /**
   * Inserts a {@link RebalanceTxSummary} record into the database.
   *
   * @param txSummary The {@link RebalanceTxSummary} to insert.
   * @param opts The {@link DAOInsertOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the inserted row's `address` when the operation is complete.
   * If the {@link Position} is {@link Null}, an empty string is returned.
   */
  static async insert(txSummary: RebalanceTxSummary | Null, opts?: DAOInsertOptions): Promise<number | undefined> {
    if (!txSummary) return;
    debug('Inserting Orca Rebalance into database...');

    const positionOldAddress = txSummary.bundledPositionOld.position.getAddress().toBase58();
    const positionNewAddress = txSummary.bundledPositionNew.position.getAddress().toBase58();

    try {
      const positionOldId = await OrcaPositionDAO.getId(positionOldAddress);
      if (positionOldId == null) {
        throw new Error(`Orca Position does not exist in database: ${positionOldAddress}`);
      }

      const positionNewId = await OrcaPositionDAO.getId(positionNewAddress);
      if (positionNewId == null) {
        throw new Error(`Orca Position does not exist in database: ${positionNewAddress}`);
      }

      const result = await db().insertInto('orcaRebalance')
        .values({
          positionOld: positionOldId,
          positionNew: positionNewId,
        })
        .returning('id')
        .executeTakeFirst();

      debug(`Inserted Orca Rebalance into database ( ID: ${result?.id} )`);
      return result?.id;
    } catch (err) {
      handleDBInsertError(
        err as ErrorWithCode,
        'Orca Rebalance',
        `${positionOldAddress} --> ${positionNewAddress}`,
        opts
      );
    }
  }

}
