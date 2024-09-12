import { db, debug, handleDBInsertError, toBigInt, type DAOInsertOptions, type ErrorWithCode } from '@npc/core';
import OrcaPositionDAO from '@npc/orca/data/orca-position/orca-position.dao';
import type { CollectFeesRewardsSummary } from '@npc/orca/services/collect-fees-rewards/collect-fees-rewards.interfaces';
import { SolanaTxDAO, toPubKeyStr } from '@npc/solana';

/**
 * Pure static data access object for Orca Fee DB operations.
 */
export default class OrcaFeeDAO {

  /**
   * Private constructor for pure static class.
   */
  private constructor() {}

  /**
   * Inserts a {@link CollectFeesRewardsSummary} record into the database.
   *
   * @param summary The {@link CollectFeesRewardsSummary} to insert.
   * @param opts The {@link DAOInsertOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the inserted row's `address` when the operation is complete.
   */
  static async insert(
    summary: CollectFeesRewardsSummary,
    opts?: DAOInsertOptions
  ): Promise<number | undefined> {
    const { tokenMintPair } = summary.data;
    const positionAddress = toPubKeyStr(summary.data.positionAddress);

    const solanaTxId = await SolanaTxDAO.insert(summary, { ...opts, ignoreDuplicates: true });
    if (solanaTxId == null) return; // No throw error - SolanaTxDAO handles errors

    debug('Inserting Orca Fee into database for Orca Position:', positionAddress);

    try {
      const positionId = await OrcaPositionDAO.getId(positionAddress);
      if (positionId == null) {
        throw new Error(`Position does not exist in database: ${positionAddress}`);
      }

      const collectFeeIx = summary.instructions.find((ix) =>
        /fee/i.test(ix.name)
      );
      if (!collectFeeIx) {
        throw new Error('Collect Fee Ix not found in summary instructions');
      }

      const result = await db().insertInto('orcaFee')
        .values({
          position: positionId,
          tokenAmountA: toBigInt(collectFeeIx.tokens.get(toPubKeyStr(tokenMintPair[0]))),
          tokenAmountB: toBigInt(collectFeeIx.tokens.get(toPubKeyStr(tokenMintPair[1]))),
          tx: solanaTxId,
          usd: summary.usd,
        })
        .returning('id')
        .executeTakeFirst();

      debug(`Inserted Orca Fee into database ( ID: ${result?.id} ):`, summary.signature);
      return result?.id;
    } catch (err) {
      handleDBInsertError(err as ErrorWithCode, 'Orca Fee', positionAddress, opts);
    }
  }

}
