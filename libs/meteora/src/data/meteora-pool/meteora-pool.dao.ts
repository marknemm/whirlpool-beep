import { type Address } from '@coral-xyz/anchor';
import type DLMM from '@meteora-ag/dlmm';
import { db, debug, handleDBInsertError, handleDBSelectError, type DAOInsertOptions, type DAOOptions, type ErrorWithCode, type Null } from '@npc/core';
import { getPoolTokenPair } from '@npc/meteora/util/pool/pool';
import { SolanaTokenDAO, toPubKeyStr } from '@npc/solana';
import type { MeteoraPoolRow } from './meteora-pool.dao.interfaces';

/**
 * Pure static data access object for Meteora {@link DLMM} pool DB operations.
 */
export default class MeteoraPoolDAO {

    /**
     * Private constructor for pure static class.
     */
    private constructor() {}

    /**
     * Gets the DB `id` of a {@link MeteoraPoolRow} from the database.
     *
     * @param address The {@link Address} of the {@link MeteoraPoolRow} to get.
     * @param opts The {@link DAOOptions} to use for the operation.
     * @returns A {@link Promise} that resolves to the DB `id` of the {@link MeteoraPoolRow} when the operation is complete.
     * If the select fails or the row does not exist, then resolves to `undefined`.
     * @throws An {@link ErrorWithCode} if the select fails with an error and
     * {@link DAOOptions.catchErrors} is not set in the {@link opts}.
     */
    static async getId(address: Address | Null, opts?: DAOOptions): Promise<number | undefined> {
      if (!address) return;
      address = toPubKeyStr(address);

      debug('Getting Meteora pool ID from database:', address);

      try {
        const result = await db().selectFrom('meteoraPool')
          .select('id')
          .where('address', '=', address)
          .executeTakeFirst();

        debug(`Got Meteora pool ID from database ( ID: ${result?.id} ):`, address);
        return result?.id;
      } catch (err) {
        handleDBSelectError(err as ErrorWithCode, 'Meteora Pool', opts);
      }
    }

    /**
     * Inserts a Meteora {@link DLMM} pool into the database.
     * If the pool already exists, or given {@link Null}, the operation is a no-op.
     *
     * @param pool The {@link DLMM} pool to insert.
     * @param opts The {@link DAOInsertOptions} to use for the operation.
     * @returns A {@link Promise} that resolves to the inserted row's `id` when the operation is complete.
     * If the insert fails, then resolves to `undefined`.
     * @throws An {@link ErrorWithCode} if the insert fails with an error and
     * {@link DAOOptions.catchErrors} is not set in the {@link opts}.
     */
    static async insert(pool: DLMM | Null, opts?: DAOInsertOptions): Promise<number | undefined> {
      if (!pool) return;
      opts ??= {};
      opts.ignoreDuplicates ??= true;

      // Get token pair from pool data, and implicitly store tokens in database if not already present.
      const [tokenA, tokenB] = await getPoolTokenPair(pool);

      debug('Inserting Meteora pool into database:', pool.pubkey);

      try {
        const tokenIdA = await SolanaTokenDAO.getId(tokenA.mint.publicKey);
        const tokenIdB = await SolanaTokenDAO.getId(tokenB.mint.publicKey);

        // Cannot continue without token DB IDs.
        if (!tokenIdA) throw new Error(`Failed to get Token A for Meteora pool insert: ${tokenA.mint.publicKey}`);
        if (!tokenIdB) throw new Error(`Failed to get Token B for Meteora pool insert: ${tokenB.mint.publicKey}`);

        const result = await db().insertInto('meteoraPool')
          .values({
            address: pool.pubkey.toBase58(),
            binStep: pool.lbPair.binStep,
            baseFeePercentage: pool.getFeeInfo().baseFeeRatePercentage.toNumber(),
            maxFeePercentage: pool.getFeeInfo().maxFeeRatePercentage.toNumber(),
            tokenX: tokenIdA,
            tokenY: tokenIdB,
            reserveX: pool.lbPair.reserveX.toBase58(),
            reserveY: pool.lbPair.reserveY.toBase58(),
          })
          .returning('id')
          .executeTakeFirst();

        debug(`Inserted Meteora pool into database ( ID: ${result?.id} ):`, pool.pubkey);
        return result?.id;
      } catch (err) {
        handleDBInsertError(err as ErrorWithCode, 'Meteora Pool', pool.pubkey, opts);
      }
    }

}

export type * from './meteora-pool.dao.interfaces';
