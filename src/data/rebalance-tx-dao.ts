import PositionDAO from '@/data/position-dao';
import type { DAOInsertOptions } from '@/interfaces/dao';
import type { ErrorWithCode } from '@/interfaces/error';
import type { Null } from '@/interfaces/nullable';
import type { RebalanceTxSummary } from '@/interfaces/rebalance';
import db, { handleInsertError } from '@/util/db';
import { debug } from '@/util/log';
import { type Position } from '@orca-so/whirlpools-sdk';

/**
 * Pure static data access object for {@link RebalanceTxSummary} DB operations.
 */
export default class RebalanceTxDAO {

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
    debug('Inserting Rebalance Tx Summary into database...');

    const positionOldAddress = txSummary.positionOld.getAddress().toBase58();
    const positionNewAddress = txSummary.positionNew.getAddress().toBase58();

    try {
      const positionOldId = await PositionDAO.getId(positionOldAddress);
      if (positionOldId == null) {
        throw new Error(`Position does not exist in database: ${positionOldAddress}`);
      }

      const positionNewId = await PositionDAO.getId(positionNewAddress);
      if (positionNewId == null) {
        throw new Error(`Position does not exist in database: ${positionNewAddress}`);
      }

      const result = await db().insertInto('rebalanceTx')
        .values({
          positionOld: positionOldId,
          positionNew: positionNewId,
        })
        .returning('id')
        .executeTakeFirst();

      debug(`Inserted Rebalance Tx Summary into database ( ID: ${result?.id} )`);
      return result?.id;
    } catch (err) {
      handleInsertError(err as ErrorWithCode, 'RebalanceTx', `${positionOldAddress} --> ${positionNewAddress}`, opts);
    }
  }

}
