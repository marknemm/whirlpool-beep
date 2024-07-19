import WhirlpoolDAO from '@/data/whirlpool-dao';
import type { DAOOptions } from '@/interfaces/dao';
import type { ErrorWithCode } from '@/interfaces/error';
import type { Null } from '@/interfaces/nullable';
import type { PositionStatus } from '@/interfaces/position';
import db, { handleInsertError, handleSelectError } from '@/util/db';
import { debug, error } from '@/util/log';
import { toBigInt, toPriceRange } from '@/util/number-conversion';
import { getWhirlpoolPrice, getWhirlpoolTokenPair } from '@/util/whirlpool';
import { Address, AddressUtil } from '@orca-so/common-sdk';
import { type Position } from '@orca-so/whirlpools-sdk';

/**
 * Pure static data access object for {@link Position} DB operations.
 */
export default class PositionDAO {

  /**
   * Private constructor for pure static class.
   */
  private constructor() {}

  /**
   * Gets the DB `id` of a {@link Position} from the database.
   *
   * @param address The {@link Address} of the {@link Position} to get.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the DB `id` of the {@link Position} when the operation is complete.
   * If the select fails or the row does not exist, then resolves to `undefined`.
   * @throws An {@link ErrorWithCode} if the select fails with an error and
   * {@link DAOOptions.catchErrors} is not set in the {@link opts}.
   */
  static async getId(address: Address | Null, opts?: DAOOptions): Promise<number | undefined> {
    if (!address) return;
    address = AddressUtil.toString(address);

    debug('Getting Position ID from database:', address);

    try {
      const result = await db().selectFrom('position')
        .select('id')
        .where('address', '=', address)
        .executeTakeFirst();

      debug(`Got Position ID from database ( ID: ${result?.id} ):`, address);
      return result?.id;
    } catch (err) {
      handleSelectError(err as ErrorWithCode, 'Position', opts);
    }
  }

  /**
   * Inserts a {@link Position} into the database.
   * If the {@link Position} already exists, the operation is a no-op.
   *
   * `Note`: This method also inserts the {@link Whirlpool} associated with the {@link Position} via {@link WhirlpoolDAO}.
   *
   * @param position The {@link Position} to insert.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the inserted row's DB `id` when the operation is complete.
   * If the insert fails, then resolves to `undefined`.
   * @throws An {@link ErrorWithCode} if the insert fails with an error and
   * {@link DAOOptions.catchErrors} is not set in the {@link opts}.
   */
  static async insert(position: Position | Null, opts?: DAOOptions): Promise<number | undefined> {
    if (!position) return;

    await WhirlpoolDAO.insert(position.getWhirlpoolData(), position.getData().whirlpool, opts);
    const whirlpoolData = position.getWhirlpoolData();

    const address = position.getAddress().toBase58();
    debug('Inserting Position into database:', address);

    try {
      const whirlpoolId = await WhirlpoolDAO.getId(position.getData().whirlpool);
      if (whirlpoolId == null) { // Cannot continue without Whirlpool DB ID.
        throw new Error(`Failed to get Whirlpool for Position Insert: ${position.getData().whirlpool}`);
      }

      const [tokenA, tokenB] = await getWhirlpoolTokenPair(whirlpoolData);
      const { tickLowerIndex, tickUpperIndex } = position.getData();

      const priceOrigin = await getWhirlpoolPrice(whirlpoolData);

      const [priceLower, priceUpper] = toPriceRange(
        [tickLowerIndex, tickUpperIndex],
        [tokenA.mint.decimals, tokenB.mint.decimals]
      );

      const priceMargin = priceOrigin.minus(priceLower).div(priceOrigin).mul(100).ceil().toNumber();

      const result = await db().insertInto('position')
        .values({
          address,
          priceLower: toBigInt(priceLower, tokenB.mint.decimals),
          priceMargin,
          priceOrigin: toBigInt(priceOrigin, tokenB.mint.decimals),
          priceUpper: toBigInt(priceUpper, tokenB.mint.decimals),
          tickLowerIndex,
          tickUpperIndex,
          whirlpool: whirlpoolId,
        })
        .returning('id')
        .executeTakeFirst();

      debug(`Inserted Position into database ( ID: ${result?.id} ):`, address);
      return result?.id;
    } catch (err) {
      handleInsertError(err as ErrorWithCode, 'Position', address, opts);
    }
  }

  /**
   * Updates the {@link PositionStatus} of a {@link Position} in the database.
   * If the given {@link position} or {@link status} is {@link Null}, the operation is a no-op.
   *
   * @param position The {@link Position} to update the {@link PositionStatus} of.
   * @param status The {@link PositionStatus} to update the {@link Position} to.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves when the operation is complete.
   */
  static async updateStatus(
    position: Position | Null,
    status: PositionStatus | Null,
    opts?: DAOOptions
  ): Promise<void> {
    if (!position || !status) return;
    const address = position.getAddress().toBase58();

    debug('Updating Position status in database:', address);

    try {
      await db().updateTable('position')
        .set({ status })
        .where('address', '=', address)
        .execute();

      debug('Updated Position status in database:', `${address} -- ${status}`);
    } catch (err) {
      if (!opts?.catchErrors) {
        throw err;
      }
      error('Failed to update position status in database:', `${address} -- ${status}`);
      error(err);
    }
  }

}
