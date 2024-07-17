import { DAOOptions } from '@/interfaces/dao';
import type { Null } from '@/interfaces/nullable';
import db from '@/util/db';
import { error, info } from '@/util/log';
import { type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';

/**
 * Pure static data access object for token operations.
 */
export default class TokenDAO {

  /**
   * Private constructor for pure static class.
   */
  private constructor() {}

  /**
   * Inserts a token into the database.
   * If the token already exists, the operation is a no-op.
   *
   * @param token The token {@link DigitalAsset} to insert.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the inserted row's `address` when the operation is complete.
   * If the token is {@link Null}, an empty string is returned.
   */
  static async insert(token: DigitalAsset | Null, opts?: DAOOptions): Promise<string> {
    if (!token) return '';

    info('Inserting token into database:', token.mint.publicKey);

    try {
      const result = await db().insertInto('token')
        .values({
          address: token.mint.publicKey,
          decimals: token.mint.decimals,
          name: token.metadata.name,
          symbol: token.metadata.symbol,
        })
        .onConflict((oc) => oc.doNothing())
        .executeTakeFirst();

      result
        ? info('Inserted token into database:', token.mint.publicKey)
        : info('Token already exists in database:', token.mint.publicKey);

      return token.mint.publicKey;
    } catch (err) {
      if (!opts?.catchErrors) {
        throw err;
      }
      error('Failed to insert token into database:', token.mint.publicKey);
    }

    return '';
  }

}
