import { db, debug, handleDBInsertError, numericToBigInt, type DAOInsertOptions, type ErrorWithCode, type Null } from '@npc/core';
import OrcaPositionDAO from '@npc/orca/data/orca-position/orca-position.dao';
import type { LiquidityTxSummary } from '@npc/orca/services/liquidity/interfaces/liquidity-tx.interfaces';
import { SolanaTxDAO } from '@npc/solana';

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
          liquidity: numericToBigInt(txSummary.liquidity),
          liquidityUnit: txSummary.liquidityUnit,
          tokenAmountA: numericToBigInt(txSummary.tokenAmountA),
          tokenAmountB: numericToBigInt(txSummary.tokenAmountB),
          tx: solanaTxId,
          slippage: txSummary.slippage,
          usd: txSummary.usd,
        })
        .returning('id')
        .executeTakeFirst();

      debug(`Inserted Orca Liquidity into database ( ID: ${result?.id} ):`, txSummary.signature);
      return result?.id;
    } catch (err) {
      handleDBInsertError(err as ErrorWithCode, 'Orca Liquidity', positionAddress, opts);
    }
  }

}
