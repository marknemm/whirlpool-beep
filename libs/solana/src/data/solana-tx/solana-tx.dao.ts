import { db, debug, handleDBInsertError, handleDBSelectError, type DAOInsertOptions, type DAOOptions, type ErrorWithCode, type Null } from '@npc/core';
import { type TxSummary } from '@npc/solana/util/transaction-query/transaction-query';

/**
 * Pure static data access object for Solana Tx DB operations.
 */
export class SolanaTxDAO {

  /**
   * Private constructor for pure static class.
   */
  private constructor() {}

  /**
   * Gets the ID of a Solana Tx record by its signature.
   *
   * @param signature The signature of the Solana Tx.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the ID of the Solana Tx record if found.
   */
  static async getId(signature: string, opts?: DAOOptions): Promise<number | undefined> {
    debug('Getting Solana Tx ID from database:', signature);

    try {
      const result = await db()
        .selectFrom('solanaTx')
        .select('id')
        .where('signature', '=', signature)
        .executeTakeFirst();

      result
        ? debug(`Got Solana Tx ID from database ( ID: ${result?.id} ):`, signature)
        : debug('Solana Tx not found in database:', signature);
      return result?.id;
    } catch (err) {
      handleDBSelectError(err as ErrorWithCode, 'SolanaTx', opts);
    }
  }

  /**
   * Inserts a {@link TxSummary} record into the database.
   *
   * @param txSummary The {@link TxSummary} to insert.
   * @param opts The {@link DAOInsertOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the inserted row's `address` when the operation is complete.
   */
  static async insert(txSummary: TxSummary | Null, opts?: DAOInsertOptions): Promise<number | undefined> {
    if (!txSummary) return;

    if (opts?.ignoreDuplicates) {
      const id = await SolanaTxDAO.getId(txSummary.signature, opts);
      if (id != null) {
        debug('Ignoring duplicate Solana Tx:', txSummary.signature);
        return id;
      }
    }

    debug('Inserting Solana Tx into database:', txSummary.signature);

    try {
      const result = await db().insertInto('solanaTx')
        .values({
          computeUnitsConsumed: txSummary.computeUnitsConsumed,
          fee: txSummary.fee,
          signature: txSummary.signature,
          size: txSummary.size,
        })
        .returning('id')
        .executeTakeFirst();

      debug(`Inserted Solana Tx into database ( ID: ${result?.id} ):`, txSummary.signature);
      return result?.id;
    } catch (err) {
      handleDBInsertError(err as ErrorWithCode, 'Solana Tx', txSummary.signature, opts);
    }
  }

}

export default SolanaTxDAO;
