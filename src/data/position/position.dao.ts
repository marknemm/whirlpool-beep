import FeeRewardTxDAO from '@/data/fee-reward-tx/fee-reward-tx.dao';
import LiquidityTxDAO from '@/data/liquidity-tx/liquidity-tx.dao';
import WhirlpoolDAO from '@/data/whirlpool/whirlpool.dao';
import type { DAOOptions } from '@/interfaces/dao.interfaces';
import type { ErrorWithCode } from '@/interfaces/error.interfaces';
import type { Null } from '@/interfaces/nullable.interfaces';
import type { ClosePositionTxSummary } from '@/services/position/close/close-position.interfaces';
import type { EmptyPositionTxSummary } from '@/services/position/empty/empty-position.interfaces';
import type { OpenPositionTxSummary } from '@/services/position/open/open-position.interfaces';
import db, { handleInsertError, handleSelectError } from '@/util/db/db';
import { debug, error, warn } from '@/util/log/log';
import { toBigInt } from '@/util/number-conversion/number-conversion';
import { getWhirlpoolPrice, getWhirlpoolTokenPair } from '@/util/whirlpool/whirlpool';
import { type Address, AddressUtil, Percentage } from '@orca-so/common-sdk';
import { type Position } from '@orca-so/whirlpools-sdk';
import { UpdateEmptiedResults } from './position.dao.interfaces';

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

      result?.id
        ? debug(`Got Position ID from database ( ID: ${result?.id} ):`, address)
        : debug('Position ID not found in database:', address);
      return result?.id;
    } catch (err) {
      handleSelectError(err as ErrorWithCode, 'Position', opts);
    }
  }

  /**
   * Gets the price margin of a {@link Position} from the database.
   *
   * @param address The {@link Address} of the {@link Position} to get the price margin for.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the price margin of the {@link Position} when the operation is complete.
   */
  static async getPriceMargin(address: Address | Null, opts?: DAOOptions): Promise<Percentage | undefined> {
    if (!address) return;
    address = AddressUtil.toString(address);

    debug('Getting Position price margin from database:', address);

    try {
      const result = await db().selectFrom('position')
        .select('priceMargin')
        .where('address', '=', address)
        .orderBy('id', 'desc')
        .executeTakeFirst();

      result?.priceMargin
        ? debug(`Got Position price margin from database ( priceMargin: ${result?.priceMargin} ):`, address)
        : debug('Position price margin not found in database:', address);
      return result?.priceMargin
        ? Percentage.fromFraction(result.priceMargin, 100)
        : undefined;
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
    const {
      bundledPosition,
      fee,
      increaseLiquidityTxSummary,
      priceMargin,
      priceRange,
      signature,
      tickRange
    } = txSummary;
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

      const [, tokenB] = await getWhirlpoolTokenPair(whirlpoolData);
      const [tickLowerIndex, tickUpperIndex] = tickRange;

      const priceOrigin = await getWhirlpoolPrice(whirlpoolData);
      const [priceLower, priceUpper] = priceRange;

      const result = await db().insertInto('position')
        .values({
          address,
          openFee: fee,
          openTx: signature,
          priceLower: toBigInt(priceLower, tokenB.mint.decimals),
          priceMargin: priceMargin.toDecimal().mul(100).round().toNumber(),
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
      if (increaseLiquidityTxSummary) {
        await LiquidityTxDAO.insert(increaseLiquidityTxSummary, opts);
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
   * @returns A {@link Promise} that resolves to the updated row's DB `id` when the operation is complete.
   * If the update fails, then resolves to `undefined`.
   */
  static async updateClosed(
    txSummary: ClosePositionTxSummary,
    opts?: DAOOptions
  ): Promise<number | undefined> {
    const { bundledPosition, signature } = txSummary;
    if (!bundledPosition || !signature) return;

    const { position } = bundledPosition;
    const address = position.getAddress().toBase58();

    await PositionDAO.updateEmptied(txSummary, opts);

    debug('Closing Position in database:', address);

    try {
      const result = await db().updateTable('position')
        .set({
          closeFee: toBigInt(txSummary.fee),
          closeTx: signature,
        })
        .where('address', '=', address)
        .where('closeTx', 'is', null)
        .returning('id')
        .executeTakeFirst();

      result
        ? debug('Position closed in database:', `${address} -- ${signature}`)
        : warn('Could not close position in database:', `${address} -- ${signature}`);

      return result?.id;
    } catch (err) {
      if (!opts?.catchErrors) {
        throw err;
      }
      error('Failed to close position in database:', `${address} -- ${signature}`);
      error(err);
    }
  }

  /**
   * Updates the liquidity and fee / reward data associated with a position to reflect emptied state.
   *
   * @param txSummary The {@link EmptyPositionTxSummary} or {@link ClosePositionTxSummary} to use for the update.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the {@link UpdateEmptiedResults} when the operation is complete.
   */
  static async updateEmptied(
    txSummary: EmptyPositionTxSummary | ClosePositionTxSummary,
    opts?: DAOOptions
  ): Promise<UpdateEmptiedResults> {
    const { collectFeesRewardsTxSummary, decreaseLiquidityTxSummary } = txSummary;

    return {
      feeRewardTxId: collectFeesRewardsTxSummary
        ? await FeeRewardTxDAO.insert(collectFeesRewardsTxSummary, opts)
        : undefined,
      liquidityTxId: decreaseLiquidityTxSummary
        ? await LiquidityTxDAO.insert(decreaseLiquidityTxSummary, opts)
        : undefined,
    };
  }

}

export type * from './position.dao.interfaces';
