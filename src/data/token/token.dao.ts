import type { DAOInsertOptions, DAOOptions } from '@/interfaces/dao.interfaces';
import type { ErrorWithCode } from '@/interfaces/error.interfaces';
import type { Null } from '@/interfaces/nullable.interfaces';
import db, { handleInsertError, handleSelectError } from '@/util/db/db';
import { debug } from '@/util/log/log';
import { type DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { type Address, AddressUtil } from '@orca-so/common-sdk';
import type { TokenRow } from './token.doa.interfaces';

/**
 * Pure static data access object for token DB operations.
 */
export default class TokenDAO {

  /**
   * Private constructor for pure static class.
   */
  private constructor() {}

  /**
   * Gets a {@link TokenRow} from the database.
   *
   * @param id The DB `id` of the token to get.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the {@link TokenRow} when the operation is complete.
   * If the select fails or the row does not exist, then resolves to `undefined`.
   * @throws An {@link ErrorWithCode} if the select fails with an error
   * {@link DAOOptions.catchErrors} is not set in the {@link opts}.
   */
  static async get(id: number | Null, opts?: DAOOptions): Promise<TokenRow | undefined>;

  /**
   * Gets a {@link TokenRow} from the database.
   *
   * @param address The {@link Address} of the token to get.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the {@link TokenRow} when the operation is complete.
   * If the select fails or the row does not exist, then resolves to `undefined`.
   * @throws An {@link ErrorWithCode} if the select fails with an error
   * {@link DAOOptions.catchErrors} is not set in the {@link opts}.
   */
  static async get(address: Address | Null, opts?: DAOOptions): Promise<TokenRow | undefined>;

  /**
   * Gets a {@link TokenRow} from the database.
   *
   * @param idAddress The DB `id` or {@link Address} of the token to get.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the {@link TokenRow} when the operation is complete.
   * If the select fails or the row does not exist, then resolves to `undefined`.
   * @throws An {@link ErrorWithCode} if the select fails with an error and
   * {@link DAOOptions.catchErrors} is not set in the {@link opts}.
   */
  static async get(idAddress: number | Address | Null, opts?: DAOOptions): Promise<TokenRow | undefined> {
    if (idAddress == null) return;

    debug('Getting Token from database:', idAddress);

    try {
      const query = db().selectFrom('token')
        .selectAll();

      (typeof idAddress === 'number')
        ? query.where('id', '=', idAddress)
        : query.where('address', '=', AddressUtil.toString(idAddress));

      debug('Got Token from database:', idAddress);
      return query.executeTakeFirst() as Promise<TokenRow>;
    } catch (err) {
      handleSelectError(err as ErrorWithCode, 'Token', opts);
    }
  }

  /**
   * Gets the DB `id` of a {@link TokenRow} from the database.
   *
   * @param address The {@link Address} of the token to get.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the DB `id` of the {@link TokenRow} when the operation is complete.
   * If the select fails or the row does not exist, then resolves to `undefined`.
   * @throws An {@link ErrorWithCode} if the select fails with an error and
   * {@link DAOOptions.catchErrors} is not set in the {@link opts}.
   */
  static async getId(address: Address | Null, opts?: DAOOptions): Promise<number | undefined> {
    if (!address) return;
    address = AddressUtil.toString(address);

    debug('Getting Token ID from database:', address);

    try {
      const result = await db().selectFrom('token')
        .select('id')
        .where('address', '=', address)
        .executeTakeFirst();

      debug(`Got Token ID from database ( ID: ${result?.id} ):`, address);
      return result?.id;
    } catch (err) {
      handleSelectError(err as ErrorWithCode, 'Token', opts);
    }
  }

  /**
   * Inserts a token into the database.
   * If the token already exists, the operation is a no-op.
   *
   * @param token The token {@link DigitalAsset} to insert.
   * @param opts The {@link DAOInsertOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the inserted row's DB `id` when the operation is complete.
   * If the insert fails, then resolves to `undefined`.
   * @throws An {@link ErrorWithCode} if the insert fails with an error and
   * {@link DAOOptions.catchErrors} is not set in the {@link opts}.
   */
  static async insert(token: DigitalAsset | Null, opts?: DAOInsertOptions): Promise<number | undefined> {
    if (!token) return;

    opts ??= {};
    opts.ignoreDuplicates ??= true;

    debug('Inserting Token into database:', token.mint.publicKey);

    try {
      const result = await db().insertInto('token')
        .values({
          address: token.mint.publicKey,
          decimals: token.mint.decimals,
          name: token.metadata.name,
          symbol: token.metadata.symbol,
        })
        .returning('id')
        .executeTakeFirst();

      debug(`Inserted Token into database ( ID: ${result?.id} ):`, token.mint.publicKey);
      return result?.id;
    } catch (err) {
      handleInsertError(err as ErrorWithCode, 'Token', token.mint.publicKey, opts);
    }
  }

}

export type * from './token.doa.interfaces';
