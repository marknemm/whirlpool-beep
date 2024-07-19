import type { DAOInsertOptions } from '@/interfaces/dao';
import type { Liquidity } from '@/interfaces/liquidity';
import type { Null } from '@/interfaces/nullable';
import { type Position } from '@orca-so/whirlpools-sdk';
import PositionDAO from './position-dao';
import { ErrorWithCode } from '@/interfaces/error';
import db, { handleInsertError } from '@/util/db';
import { toBigInt } from '@/util/number-conversion';
import { debug } from '@/util/log';

/**
 * Pure static data access object for {@link Liquidity} DB operations.
 */
export default class LiquidityDAO {

  /**
   * Private constructor for pure static class.
   */
  private constructor() {}

  /**
   * Inserts a {@link Liquidity} record into the database.
   *
   * @param liquidity The {@link Liquidity} to insert.
   * @param opts The {@link DAOInsertOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the inserted row's `address` when the operation is complete.
   * If the {@link Position} is {@link Null}, an empty string is returned.
   */
  static async insert(liquidity: Liquidity | Null, opts?: DAOInsertOptions): Promise<number | undefined> {
    if (!liquidity) return;
    const positionAddress = liquidity.position.getAddress().toBase58();

    debug('Inserting Liquidity into database:', liquidity.signature);

    try {
      const positionId = await PositionDAO.getId(liquidity.position.getAddress());
      if (positionId == null) {
        throw new Error(`Position does not exist in database: ${positionAddress}`);
      }

      const result = await db().insertInto('liquidity')
        .values({
          position: positionId,
          quote: JSON.stringify(liquidity.quote),
          signature: liquidity.signature,
          tokenAmountA: toBigInt(liquidity.tokenAmountA),
          tokenAmountB: toBigInt(liquidity.tokenAmountB),
          usd: liquidity.usd,
        })
        .returning('id')
        .executeTakeFirst();

      debug(`Inserted Liquidity into database ( ID: ${result?.id} ):`, liquidity.signature);
      return result?.id;
    } catch (err) {
      handleInsertError(err as ErrorWithCode, 'Liquidity', positionAddress, opts);
    }
  }

}
