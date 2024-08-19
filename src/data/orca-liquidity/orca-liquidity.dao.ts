import OrcaPositionDAO from '@/data/orca-position/orca-position.dao';
import SolanaTxDAO from '@/data/solana-tx.dao.ts/solana-tx.dao';
import type { DAOInsertOptions } from '@/interfaces/dao.interfaces';
import type { ErrorWithCode } from '@/interfaces/error.interfaces';
import type { Null } from '@/interfaces/nullable.interfaces';
import type { LiquidityTxSummary } from '@/services/liquidity/interfaces/liquidity-tx.interfaces';
import db, { handleInsertError } from '@/util/db/db';
import { debug } from '@/util/log/log';
import { toBigInt } from '@/util/number-conversion/number-conversion';

/**
 * Pure static data access object for Orca Liquidity DB operations.
 */
export default class OrcaLiquidityDAO {

  /**
   * Private constructor for pure static class.
   */
  private constructor() {}

  /**
   * Inserts a {@link LiquidityTxSummary} record into the database.
   *
   * @param txSummary The {@link LiquidityTxSummary} to insert.
   * @param opts The {@link DAOInsertOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the inserted row's `address` when the operation is complete.
   */
  static async insert(txSummary: LiquidityTxSummary | Null, opts?: DAOInsertOptions): Promise<number | undefined> {
    if (!txSummary) return;

    const solanaTxId = await SolanaTxDAO.insert(txSummary, { ...opts, ignoreDuplicates: true });
    if (solanaTxId == null) return; // No throw error - SolanaTxDAO handles errors

    const positionAddress = txSummary.position.getAddress().toBase58();
    debug('Inserting Orca Liquidity into database for Orca Position:', positionAddress);

    try {
      const positionId = await OrcaPositionDAO.getId(txSummary.position.getAddress());
      if (positionId == null) {
        throw new Error(`Position does not exist in database: ${positionAddress}`);
      }

      const result = await db().insertInto('orcaLiquidity')
        .values({
          position: positionId,
          liquidity: toBigInt(txSummary.liquidity),
          liquidityUnit: txSummary.liquidityUnit,
          tokenAmountA: toBigInt(txSummary.tokenAmountA),
          tokenAmountB: toBigInt(txSummary.tokenAmountB),
          solanaTx: solanaTxId,
          slippage: txSummary.slippage,
          usd: txSummary.usd,
        })
        .returning('id')
        .executeTakeFirst();

      debug(`Inserted Orca Liquidity into database ( ID: ${result?.id} ):`, txSummary.signature);
      return result?.id;
    } catch (err) {
      handleInsertError(err as ErrorWithCode, 'Orca Liquidity', positionAddress, opts);
    }
  }

}
