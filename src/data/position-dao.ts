import WhirlpoolDAO from '@/data/whirlpool-dao';
import type { DAOOptions } from '@/interfaces/dao';
import type { Null } from '@/interfaces/nullable';
import db from '@/util/db';
import { error, info } from '@/util/log';
import { toBigInt, toNum, toPriceRange } from '@/util/number-conversion';
import { getWhirlpoolPrice, getWhirlpoolTokenPair } from '@/util/whirlpool';
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
   * Inserts a {@link Position} into the database.
   * If the {@link Position} already exists, the operation is a no-op.
   *
   * `Note`: This method also inserts the {@link Whirlpool} associated with the {@link Position} via {@link WhirlpoolDAO}.
   *
   * @param position The {@link Position} to insert.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the inserted row's `address` when the operation is complete.
   * If the {@link Position} is {@link Null}, an empty string is returned.
   */
  static async insert(position: Position | Null, opts?: DAOOptions): Promise<string> {
    if (!position) return '';

    await WhirlpoolDAO.insert(position.getWhirlpoolData(), position.getData().whirlpool, opts);
    const whirlpoolData = position.getWhirlpoolData();

    const address = position.getAddress().toBase58();
    info('Inserting position into database:', address);

    try {
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
          whirlpool: position.getData().whirlpool.toBase58(),

        })
        .onConflict((oc) => oc.doNothing())
        .executeTakeFirst();

      result
        ? info('Inserted position into database:', address)
        : info('Position already exists in database:', address);

      return address;
    } catch (err) {
      if (!opts?.catchErrors) {
        throw err;
      }
      error('Failed to insert position into database:', address);
      error(err);
    }

    return '';
  }

}
