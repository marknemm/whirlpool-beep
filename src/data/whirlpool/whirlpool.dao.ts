import TokenDAO from '@/data/token/token.dao';
import type { DAOInsertOptions, DAOOptions } from '@/interfaces/dao.interfaces';
import type { ErrorWithCode } from '@/interfaces/error.interfaces';
import type { Null } from '@/interfaces/nullable.interfaces';
import db, { handleInsertError, handleSelectError } from '@/util/db/db';
import { debug } from '@/util/log/log';
import { isAddress } from '@/util/pki/pki';
import { getWhirlpoolTokenPair, toWhirlpoolData } from '@/util/whirlpool/whirlpool';
import { type Address, AddressUtil } from '@orca-so/common-sdk';
import { type Whirlpool, type WhirlpoolData } from '@orca-so/whirlpools-sdk';

/**
 * Pure static data access object for {@link Whirlpool} DB operations.
 */
export default class WhirlpoolDAO {

    /**
     * Private constructor for pure static class.
     */
    private constructor() {}

    /**
     * Gets the DB `id` of a {@link WhirlpoolRow} from the database.
     *
     * @param address The {@link Address} of the {@link WhirlpoolRow} to get.
     * @param opts The {@link DAOOptions} to use for the operation.
     * @returns A {@link Promise} that resolves to the DB `id` of the {@link WhirlpoolRow} when the operation is complete.
     * If the select fails or the row does not exist, then resolves to `undefined`.
     * @throws An {@link ErrorWithCode} if the select fails with an error and
     * {@link DAOOptions.catchErrors} is not set in the {@link opts}.
     */
    static async getId(address: Address | Null, opts?: DAOOptions): Promise<number | undefined> {
      if (!address) return;
      address = AddressUtil.toString(address);

      debug('Getting Whirlpool ID from database:', address);

      try {
        const result = await db().selectFrom('whirlpool')
          .select('id')
          .where('address', '=', address)
          .executeTakeFirst();

        debug(`Got Whirlpool ID from database ( ID: ${result?.id} ):`, address);
        return result?.id;
      } catch (err) {
        handleSelectError(err as ErrorWithCode, 'Whirlpool', opts);
      }
    }

    /**
     * Inserts a {@link Whirlpool} into the database.
     * If the {@link Whirlpool} already exists, the operation is a no-op.
     *
     * @param whirlpool The {@link Whirlpool} to insert.
     * @param opts The {@link DAOInsertOptions} to use for the operation.
     * @returns A {@link Promise} that resolves to the inserted row's `id` when the operation is complete.
     * If the insert fails, then resolves to `undefined`.
     * @throws An {@link ErrorWithCode} if the insert fails with an error and
     * {@link DAOOptions.catchErrors} is not set in the {@link opts}.
     */
    static async insert(whirlpool: Whirlpool | Null, opts?: DAOInsertOptions): Promise<number | undefined>;

    /**
     * Inserts a {@link Whirlpool} into the database.
     * If the {@link Whirlpool} already exists, the operation is a no-op.
     *
     * @param whirlpool The {@link WhirlpoolData} to insert.
     * @param address The {@link Address} of the whirlpool to insert.
     * @param opts The {@link DAOInsertOptions} to use for the operation.
     * @returns A {@link Promise} that resolves to the inserted row's `id` when the operation is complete.
     * If the insert fails, then resolves to `undefined`.
     * @throws An {@link ErrorWithCode} if the insert fails with an error and
     * {@link DAOOptions.catchErrors} is not set in the {@link opts}.
     */
    static async insert(
      whirlpool: WhirlpoolData | Null,
      address: Address | Null,
      opts?: DAOInsertOptions
    ): Promise<number | undefined>;

    /**
     * Inserts a whirlpool into the database.
     * If the whirlpool already exists, the operation is a no-op.
     *
     * `Note`: This method also inserts the token pair associated with the whirlpool into the database.
     *
     * @param whirlpool The {@link Whirlpool} or {@link WhirlpoolData} to insert.
     * @param addressOrOpts The {@link Address} of the whirlpool to insert or the {@link DAOInsertOptions} to use for the operation.
     * @param opts The {@link DAOInsertOptions} to use for the operation.
     * @returns A {@link Promise} that resolves to the inserted row's `id` when the operation is complete.
     * If the insert fails, then resolves to `undefined`.
     * @throws An {@link ErrorWithCode} if the insert fails with an error and
     * {@link DAOOptions.catchErrors} is not set in the {@link opts}.
     */
    static async insert(
      whirlpool: Whirlpool | WhirlpoolData | Null,
      addressOrOpts?: Address | DAOInsertOptions | Null,
      opts?: DAOInsertOptions
    ): Promise<number | undefined> {
      if (!whirlpool) return;

      // Process variadic arguments and coalesce to correct types.
      opts ??= !isAddress(addressOrOpts)
        ? addressOrOpts as DAOInsertOptions ?? {}
        : {};
      opts.ignoreDuplicates ??= true;
      const address = isAddress(addressOrOpts)
        ? AddressUtil.toString(addressOrOpts as Address)
        : (whirlpool as Whirlpool).getAddress().toBase58();

      // Get token pair from whirlpool data, and implicitly store tokens in database if not already present.
      const [tokenA, tokenB] = await getWhirlpoolTokenPair(whirlpool);
      const whirlpoolData = toWhirlpoolData(whirlpool);

      debug('Inserting Whirlpool into database:', address);

      try {
        const tokenIdA = await TokenDAO.getId(tokenA.mint.publicKey);
        const tokenIdB = await TokenDAO.getId(tokenB.mint.publicKey);

        // Cannot continue without token DB IDs.
        if (!tokenIdA) throw new Error(`Failed to get Token A for Whirlpool insert: ${tokenA.mint.publicKey}`);
        if (!tokenIdB) throw new Error(`Failed to get Token B for Whirlpool insert: ${tokenB.mint.publicKey}`);

        const result = await db().insertInto('whirlpool')
          .values({
            address,
            feeRate: whirlpoolData.feeRate,
            tokenA: tokenIdA,
            tokenB: tokenIdB,
            tokenVaultA: whirlpoolData.tokenVaultA.toBase58(),
            tokenVaultB: whirlpoolData.tokenVaultB.toBase58(),
            tickSpacing: whirlpoolData.tickSpacing,
          })
          .returning('id')
          .executeTakeFirst();

        debug(`Inserted Whirlpool into database ( ID: ${result?.id} ):`, address);
        return result?.id;
      } catch (err) {
        handleInsertError(err as ErrorWithCode, 'Whirlpool', address, opts);
      }
    }

}

export type * from './whirlpool.dao.interfaces';
