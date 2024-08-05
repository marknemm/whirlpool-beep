import FeeRewardTxDAO from '@/data/fee-reward-tx/fee-reward-tx.dao';
import LiquidityTxDAO from '@/data/liquidity-tx/liquidity-tx.dao';
import WhirlpoolDAO from '@/data/whirlpool/whirlpool.dao';
import type { DAOOptions } from '@/interfaces/dao.interfaces';
import type { ErrorWithCode } from '@/interfaces/error.interfaces';
import type { Null } from '@/interfaces/nullable.interfaces';
import { ClosePositionTxSummary } from '@/services/position/close/close-position.interfaces';
import { OpenPositionTxSummary } from '@/services/position/open/open-position.interfaces';
import db, { handleInsertError, handleSelectError } from '@/util/db/db';
import { debug, error } from '@/util/log/log';
import { toBigInt } from '@/util/number-conversion/number-conversion';
import { toPriceRange } from '@/util/tick-range/tick-range';
import { getWhirlpoolPrice, getWhirlpoolTokenPair } from '@/util/whirlpool/whirlpool';
import { type Address, AddressUtil } from '@orca-so/common-sdk';
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
        .orderBy('id', 'desc')
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
   * Also inserts the {@link Whirlpool} associated with the {@link Position} via {@link WhirlpoolDAO},
   *
   * If the {@link Position} was opened with liquidity, then the associated {@link LiquidityTxSummary}
   * is also inserted via {@link LiquidityTxDAO}.
   *
   * @param txSummary The {@link OpenPositionTxSummary} to use for the insert.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the inserted row's DB `id` when the operation is complete.
   * If the insert fails, then resolves to `undefined`.
   * @throws An {@link ErrorWithCode} if the insert fails with an error and
   * {@link DAOOptions.catchErrors} is not set in the {@link opts}.
   */
  static async insert(txSummary: OpenPositionTxSummary, opts?: DAOOptions): Promise<number | undefined> {
    if (!txSummary?.bundledPosition) return;
    const { bundledPosition, fee, liquidityTxSummary, signature } = txSummary;
    const { position } = bundledPosition;

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

      const priceMargin = priceOrigin.minus(priceLower).div(priceOrigin).mul(100).round().toNumber();

      const result = await db().insertInto('position')
        .values({
          address,
          openFee: fee,
          openTx: signature,
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

      // If the Position was opened with liquidity, insert the LiquidityTxSummary.
      if (liquidityTxSummary) {
        await LiquidityTxDAO.insert(liquidityTxSummary, opts);
      }

      return result?.id;
    } catch (err) {
      handleInsertError(err as ErrorWithCode, 'Position', address, opts);
    }
  }

  /**
   * Updates the status of a {@link Position} in the database by setting a closeTx signature.
   * If the given {@link position} or {@link txSignature} is {@link Null}, the operation is a no-op.
   *
   * `Note`: This method also inserts the {@link FeeRewardTxSummary} and {@link LiquidityTxSummary} associated with the close operation.
   *
   * @param txSummary The {@link ClosePositionTxSummary} to use for the update.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves when the operation is complete.
   */
  static async updateClosed(
    txSummary: ClosePositionTxSummary,
    opts?: DAOOptions
  ): Promise<void> {
    const { bundledPosition, collectFeesRewardsTxSummary, decreaseLiquidityTxSummary, signature } = txSummary;
    if (!bundledPosition || !signature) return;

    const { position } = bundledPosition;
    const address = position.getAddress().toBase58();

    if (collectFeesRewardsTxSummary) {
      await FeeRewardTxDAO.insert(collectFeesRewardsTxSummary, opts);
    }
    if (decreaseLiquidityTxSummary) {
      await LiquidityTxDAO.insert(decreaseLiquidityTxSummary, opts);
    }

    debug('Closing Position in database:', address);

    try {
      await db().updateTable('position')
        .set({
          closeFee: toBigInt(txSummary.fee),
          closeTx: signature,
        })
        .where('address', '=', address)
        .execute();

      debug('Position closed in database:', `${address} -- ${signature}`);
    } catch (err) {
      if (!opts?.catchErrors) {
        throw err;
      }
      error('Failed to close position in database:', `${address} -- ${signature}`);
      error(err);
    }
  }

}
