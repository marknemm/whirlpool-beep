// import { type Position } from '@meteora-ag/dlmm';
// import { db, debug, handleDBInsertError, numericToBigInt, type DAOInsertOptions, type ErrorWithCode, type Null } from '@npc/core';
// import MeteoraPositionDAO from '@npc/meteora/data/meteora-position/meteora-position.dao';
// import type { CollectFeesRewardsTxSummary } from '@npc/meteora/services/fees-rewards/collect/collect-fees-rewards.interfaces';
// import { SolanaTxDAO } from '@npc/solana';

// /**
//  * Pure static data access object for Meteora Fee DB operations.
//  */
// export default class MeteoraFeeDAO {

//   /**
//    * Private constructor for pure static class.
//    */
//   private constructor() {}

//   /**
//    * Inserts a {@link CollectFeesRewardsTxSummary} record into the database.
//    *
//    * @param txSummary The {@link CollectFeesRewardsTxSummary} to insert.
//    * @param opts The {@link DAOInsertOptions} to use for the operation.
//    * @returns A {@link Promise} that resolves to the inserted row's `address` when the operation is complete.
//    * If the {@link Position} is {@link Null}, an empty string is returned.
//    */
//   static async insert(
//     txSummary: CollectFeesRewardsTxSummary | Null,
//     opts?: DAOInsertOptions
//   ): Promise<number | undefined> {
//     if (!txSummary) return;

//     const solanaTxId = await SolanaTxDAO.insert(txSummary, { ...opts, ignoreDuplicates: true });
//     if (solanaTxId == null) return; // No throw error - SolanaTxDAO handles errors

//     const positionAddress = txSummary.position.getAddress().toBase58();
//     debug('Inserting Meteora Fee into database for Meteora Position:', positionAddress);

//     try {
//       const positionId = await MeteoraPositionDAO.getId(txSummary.position.getAddress());
//       if (positionId == null) {
//         throw new Error(`Position does not exist in database: ${positionAddress}`);
//       }

//       const result = await db().insertInto('meteoraFee')
//         .values({
//           position: positionId,
//           tokenAmountX: numericToBigInt(txSummary.tokenAmountA),
//           tokenAmountY: numericToBigInt(txSummary.tokenAmountB),
//           tx: solanaTxId,
//           usd: txSummary.usd,
//         })
//         .returning('id')
//         .executeTakeFirst();

//       debug(`Inserted Meteora Fee into database ( ID: ${result?.id} ):`, txSummary.signature);
//       return result?.id;
//     } catch (err) {
//       handleDBInsertError(err as ErrorWithCode, 'Meteora Fee', positionAddress, opts);
//     }
//   }

// }
