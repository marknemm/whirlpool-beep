import { db, debug, handleDBInsertError, numericToBigInt, type DAOInsertOptions, type ErrorWithCode, type Null } from '@npc/core';
import MeteoraPositionDAO from '@npc/meteora/data/meteora-position/meteora-position.dao';
import type { LiquidityTxSummary } from '@npc/meteora/services/liquidity/interfaces/liquidity-tx.interfaces';
import { SolanaTxDAO } from '@npc/solana';

/**
 * Pure static data access object for Meteora Liquidity DB operations.
 */
export default class MeteoraLiquidityDAO {

  /**
   * Private constructor for pure static class.
   */
  private constructor() {}

  /**
   * Inserts a Meteora {@link LiquidityTxSummary} record into the database.
   *
   * @param txSummary The {@link LiquidityTxSummary} to insert.
   * @param opts The {@link DAOInsertOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the inserted row's `address` when the operation is complete.
   */
  static async insert(txSummary: LiquidityTxSummary | Null, opts?: DAOInsertOptions): Promise<number | undefined> {
    if (!txSummary) return;

    const solanaTxId = await SolanaTxDAO.insert(txSummary, { ...opts, ignoreDuplicates: true });
    if (solanaTxId == null) return; // No throw error - SolanaTxDAO handles errors

    const positionAddress = txSummary.position.publicKey.toBase58();
    debug('Inserting Meteora Liquidity into database for Meteora Position:', positionAddress);

    try {
      const positionId = await MeteoraPositionDAO.getId(txSummary.position.publicKey);
      if (positionId == null) {
        throw new Error(`Meteora Position does not exist in database: ${positionAddress}`);
      }

      const result = await db().insertInto('meteoraLiquidity')
        .values({
          position: positionId,
          liquidity: numericToBigInt(txSummary.liquidity),
          liquidityUnit: txSummary.liquidityUnit,
          tokenAmountX: numericToBigInt(txSummary.totalXAmount),
          tokenAmountY: numericToBigInt(txSummary.totalYAmount),
          tx: solanaTxId,
          usd: txSummary.usd,
        })
        .returning('id')
        .executeTakeFirst();

      debug(`Inserted Meteora Liquidity into database ( ID: ${result?.id} ):`, txSummary.signature);
      return result?.id;
    } catch (err) {
      handleDBInsertError(err as ErrorWithCode, 'Meteora Liquidity', positionAddress, opts);
    }
  }

}
