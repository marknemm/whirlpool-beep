import PositionDAO from '@/data/position-dao';
import type { DAOInsertOptions } from '@/interfaces/dao';
import type { ErrorWithCode } from '@/interfaces/error';
import type { FeesRewardsTxSummary } from '@/interfaces/fees-rewards';
import type { Null } from '@/interfaces/nullable';
import db, { handleInsertError } from '@/util/db';
import { debug } from '@/util/log';
import { toBigInt } from '@/util/number-conversion';
import { type Position } from '@orca-so/whirlpools-sdk';

/**
 * Pure static data access object for {@link FeesRewardsTxSummary} DB operations.
 */
export default class FeeRewardTxDAO {

  /**
   * Private constructor for pure static class.
   */
  private constructor() {}

  /**
   * Inserts a {@link FeesRewardsTxSummary} record into the database.
   *
   * @param txSummary The {@link FeesRewardsTxSummary} to insert.
   * @param opts The {@link DAOInsertOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the inserted row's `address` when the operation is complete.
   * If the {@link Position} is {@link Null}, an empty string is returned.
   */
  static async insert(txSummary: FeesRewardsTxSummary | Null, opts?: DAOInsertOptions): Promise<number | undefined> {
    if (!txSummary) return;
    const positionAddress = txSummary.position.getAddress().toBase58();

    debug('Inserting Fees / Rewards Tx Summary into database:', txSummary.signature);

    try {
      const positionId = await PositionDAO.getId(txSummary.position.getAddress());
      if (positionId == null) {
        throw new Error(`Position does not exist in database: ${positionAddress}`);
      }

      const result = await db().insertInto('feeRewardTx')
        .values({
          fee: toBigInt(txSummary.fee),
          position: positionId,
          signature: txSummary.signature,
          tokenAmountA: toBigInt(txSummary.tokenAmountA),
          tokenAmountB: toBigInt(txSummary.tokenAmountB),
          usd: txSummary.usd,
        })
        .returning('id')
        .executeTakeFirst();

      debug(`Inserted Fees / Rewards Tx Summary into database ( ID: ${result?.id} ):`, txSummary.signature);
      return result?.id;
    } catch (err) {
      handleInsertError(err as ErrorWithCode, 'FeeRewardTx', positionAddress, opts);
    }
  }

}
