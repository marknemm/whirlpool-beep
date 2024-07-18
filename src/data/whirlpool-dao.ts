import type { DAOOptions } from '@/interfaces/dao';
import type { Null } from '@/interfaces/nullable';
import db from '@/util/db';
import { error, info } from '@/util/log';
import { getWhirlpoolTokenPair, toWhirlpoolData } from '@/util/whirlpool';
import { type Address, AddressUtil } from '@orca-so/common-sdk';
import { type Whirlpool, type WhirlpoolData } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';

/**
 * Pure static data access object for {@link Whirlpool} DB operations.
 */
export default class WhirlpoolDAO {

    /**
     * Private constructor for pure static class.
     */
    private constructor() {}

    /**
     * Inserts a {@link Whirlpool} into the database.
     * If the {@link Whirlpool} already exists, the operation is a no-op.
     *
     * @param whirlpool The {@link Whirlpool} to insert.
     * @param opts The {@link DAOOptions} to use for the operation.
     * @returns A {@link Promise} that resolves to the inserted row's `address` when the operation is complete.
     * If the {@link Whirlpool} is {@link Null}, an empty string is returned.
     */
    static async insert(whirlpool: Whirlpool | Null, opts?: DAOOptions): Promise<string>;

    /**
     * Inserts a {@link Whirlpool} into the database.
     * If the {@link Whirlpool} already exists, the operation is a no-op.
     *
     * @param whirlpool The {@link WhirlpoolData} to insert.
     * @param address The {@link Address} of the whirlpool to insert.
     * @param opts The {@link DAOOptions} to use for the operation.
     * @returns A {@link Promise} that resolves to the inserted row's `address` when the operation is complete.
     * If the whirlpool is {@link Null}, an empty string is returned.
     */
    static async insert(whirlpool: WhirlpoolData | Null, address: Address | Null, opts?: DAOOptions): Promise<string>;

    /**
     * Inserts a whirlpool into the database.
     * If the whirlpool already exists, the operation is a no-op.
     *
     * `Note`: This method also inserts the token pair associated with the whirlpool into the database.
     *
     * @param whirlpool The {@link Whirlpool} or {@link WhirlpoolData} to insert.
     * @param address The {@link Address} of the whirlpool to insert. Required if `whirlpool` is a {@link WhirlpoolData}.
     * @param opts The {@link DAOOptions} to use for the operation.
     * @returns A {@link Promise} that resolves to the inserted row's `address` when the operation is complete.
     * If the whirlpool is {@link Null}, an empty string is returned.
     */
    static async insert(
      whirlpool: Whirlpool | WhirlpoolData | Null,
      address?: Address | DAOOptions | Null,
      opts?: DAOOptions
    ): Promise<string> {
      if (!whirlpool) return '';

      // Get token pair from whirlpool data, and implicitly store tokens in database if not already present.
      const [tokenA, tokenB] = await getWhirlpoolTokenPair(whirlpool);

      info('Inserting whirlpool into database:', address);

      try {
        // Process variadic arguments and coalesce to correct types.
        opts ??= (address && typeof address !== 'string' && !(address instanceof PublicKey)) ? address : {};
        address ??= (whirlpool as Whirlpool).getAddress();
        address = AddressUtil.toString(address as Address);
        const whirlpoolData = toWhirlpoolData(whirlpool);

        const result = await db().insertInto('whirlpool')
          .values({
            address,
            feeRate: whirlpoolData.feeRate,
            tokenA: tokenA.mint.publicKey,
            tokenB: tokenB.mint.publicKey,
            tokenVaultA: whirlpoolData.tokenVaultA.toBase58(),
            tokenVaultB: whirlpoolData.tokenVaultB.toBase58(),
            tickSpacing: whirlpoolData.tickSpacing,
          })
          .onConflict((oc) => oc.doNothing())
          .executeTakeFirst();

        result
          ? info('Inserted whirlpool into database:', address)
          : info('Whirlpool already exists in database:', address);

        return address;
      } catch (err) {
        if (!opts?.catchErrors) {
          throw err;
        }
        error('Failed to insert whirlpool into database:', address);
        error(err);
      }

      return '';
    }

}
