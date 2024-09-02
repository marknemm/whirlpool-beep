// import { type Position } from '@meteora-ag/dlmm';
// import type { ErrorWithCode, Null } from '@npc/core';
// import { db, debug, handleDBInsertError, type DAOInsertOptions } from '@npc/core';
// import MeteoraPositionDAO from '@npc/meteora/data/meteora-position/meteora-position.dao';
// import type { RebalanceTxSummary } from '@npc/meteora/services/position/rebalance/rebalance-position.interfaces';

// /**
//  * Pure static data access object for Meteora Rebalance DB operations.
//  */
// export default class MeteoraRebalanceDAO {

//   /**
//    * Private constructor for pure static class.
//    */
//   private constructor() {}

//   /**
//    * Inserts a {@link RebalanceTxSummary} record into the database.
//    *
//    * @param txSummary The {@link RebalanceTxSummary} to insert.
//    * @param opts The {@link DAOInsertOptions} to use for the operation.
//    * @returns A {@link Promise} that resolves to the inserted row's `address` when the operation is complete.
//    * If the {@link Position} is {@link Null}, an empty string is returned.
//    */
//   static async insert(txSummary: RebalanceTxSummary | Null, opts?: DAOInsertOptions): Promise<number | undefined> {
//     if (!txSummary) return;
//     debug('Inserting Meteora Rebalance into database...');

//     const positionOldAddress = txSummary.bundledPositionOld.position.getAddress().toBase58();
//     const positionNewAddress = txSummary.bundledPositionNew.position.getAddress().toBase58();

//     try {
//       const positionOldId = await MeteoraPositionDAO.getId(positionOldAddress);
//       if (positionOldId == null) {
//         throw new Error(`Meteora Position does not exist in database: ${positionOldAddress}`);
//       }

//       const positionNewId = await MeteoraPositionDAO.getId(positionNewAddress);
//       if (positionNewId == null) {
//         throw new Error(`Meteora Position does not exist in database: ${positionNewAddress}`);
//       }

//       const result = await db().insertInto('meteoraRebalance')
//         .values({
//           positionOld: positionOldId,
//           positionNew: positionNewId,
//         })
//         .returning('id')
//         .executeTakeFirst();

//       debug(`Inserted Meteora Rebalance into database ( ID: ${result?.id} )`);
//       return result?.id;
//     } catch (err) {
//       handleDBInsertError(
//         err as ErrorWithCode,
//         'Meteora Rebalance',
//         `${positionOldAddress} --> ${positionNewAddress}`,
//         opts
//       );
//     }
//   }

// }
