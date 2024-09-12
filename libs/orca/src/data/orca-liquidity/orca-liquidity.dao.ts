import { db, debug, handleDBInsertError, toBigInt, type DAOInsertOptions, type ErrorWithCode, type Null } from '@npc/core';
import OrcaPositionDAO from '@npc/orca/data/orca-position/orca-position.dao';
import type { DecreaseLiquiditySummary } from '@npc/orca/services/decrease-liquidity/decrease-liquidity.interfaces';
import type { IncreaseLiquiditySummary } from '@npc/orca/services/increase-liquidity/increase-liquidity.interfaces';
import env from '@npc/orca/util/env/env';
import { SolanaTxDAO, toPubKeyStr } from '@npc/solana';

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
   * @param summary The {@link IncreaseLiquiditySummary} or {@link DecreaseLiquiditySummary} to insert.
   * @param opts The {@link DAOInsertOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the inserted row's `address` when the operation is complete.
   */
  static async insert(
    summary: IncreaseLiquiditySummary | DecreaseLiquiditySummary | Null,
    opts?: DAOInsertOptions
  ): Promise<number | undefined> {
    if (!summary) return;
    const { positionAddress, tokenMintPair } = summary.data;

    const solanaTxId = await SolanaTxDAO.insert(summary, { ...opts, ignoreDuplicates: true });
    if (solanaTxId == null) return; // No throw error - SolanaTxDAO handles errors

    debug('Inserting Orca Liquidity into database for Orca Position:', positionAddress);

    try {
      const positionId = await OrcaPositionDAO.getId(positionAddress);
      if (positionId == null) {
        throw new Error(`Position does not exist in database: ${positionAddress}`);
      }

      const liquidityIx = summary.instructions.find((ix) =>
        /increase|decrease\s?liquidity/i.test(ix.name)
      );
      if (!liquidityIx) {
        throw new Error('Liquidity Increase/Decrease Ix not found in summary instructions');
      }

      const result = await db().insertInto('orcaLiquidity')
        .values({
          position: positionId,
          liquidity: toBigInt(0),
          liquidityUnit: 'usd',
          tokenAmountA: toBigInt(liquidityIx.tokens.get(toPubKeyStr(tokenMintPair[0]))),
          tokenAmountB: toBigInt(liquidityIx.tokens.get(toPubKeyStr(tokenMintPair[1]))),
          tx: solanaTxId,
          slippage: env.SLIPPAGE_DEFAULT,
          usd: summary.usd,
        })
        .returning('id')
        .executeTakeFirst();

      debug(`Inserted Orca Liquidity into database ( ID: ${result?.id} ):`, summary.signature);
      return result?.id;
    } catch (err) {
      handleDBInsertError(err as ErrorWithCode, 'Orca Liquidity', positionAddress, opts);
    }
  }

}
