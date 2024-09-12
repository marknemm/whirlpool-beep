import { db, debug, error, handleDBInsertError, handleDBSelectError, toBigInt, warn, type DAOOptions, type ErrorWithCode, type Null } from '@npc/core';
import OrcaFeeDAO from '@npc/orca/data/orca-fee/orca-fee.dao';
import OrcaLiquidityDAO from '@npc/orca/data/orca-liquidity/orca-liquidity.dao';
import OrcaWhirlpoolDAO from '@npc/orca/data/orca-whirlpool/orca-whirlpool.dao';
import type { ClosePositionSummary } from '@npc/orca/services/close-position/close-position.interfaces';
import type { EmptyPositionSummary } from '@npc/orca/services/empty-position/empty-position.interfaces';
import type { OpenPositionSummary } from '@npc/orca/services/open-position/open-position.interfaces';
import { resolvePosition } from '@npc/orca/util/position/position';
import { getWhirlpoolPrice, getWhirlpoolTokenPair } from '@npc/orca/util/whirlpool/whirlpool';
import { SolanaTxDAO, toPubKeyStr } from '@npc/solana';
import { Percentage, type Address } from '@orca-so/common-sdk';
import { type Position } from '@orca-so/whirlpools-sdk';
import type { UpdateEmptiedResults } from './orca-position.dao.interfaces';

/**
 * Pure static data access object for Orca {@link Position} DB operations.
 */
export default class OrcaPositionDAO {

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
    address = toPubKeyStr(address);

    debug('Getting Orca Position ID from database:', address);

    try {
      const result = await db().selectFrom('orcaPosition')
        .select('id')
        .where('address', '=', address)
        .orderBy('id', 'desc')
        .executeTakeFirst();

      result?.id
        ? debug(`Got Orca Position ID from database ( ID: ${result?.id} ):`, address)
        : debug('Orca Position ID not found in database:', address);
      return result?.id;
    } catch (err) {
      handleDBSelectError(err as ErrorWithCode, 'orcaPosition', opts);
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
    address = toPubKeyStr(address);

    debug('Getting Orca Position price margin from database:', address);

    try {
      const result = await db().selectFrom('orcaPosition')
        .select('priceMargin')
        .where('address', '=', address)
        .orderBy('id', 'desc')
        .executeTakeFirst();

      result?.priceMargin
        ? debug(`Got Orca Position price margin from database ( priceMargin: ${result?.priceMargin} ):`, address)
        : debug('Orca Position price margin not found in database:', address);
      return result?.priceMargin
        ? Percentage.fromFraction(result.priceMargin, 100)
        : undefined;
    } catch (err) {
      handleDBSelectError(err as ErrorWithCode, 'orcaPosition', opts);
    }
  }

  /**
   * Inserts a {@link Position} into the database.
   * If the {@link Position} already exists, the operation is a no-op.
   *
   * Also inserts the {@link Whirlpool} associated with the {@link Position} via {@link OrcaWhirlpoolDAO},
   *
   * If the {@link Position} was opened with liquidity, then the associated {@link LiquidityTxSummary}
   * is also inserted via {@link OrcaLiquidityDAO}.
   *
   * @param summary The {@link OpenPositionSummary} to use for the insert.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the inserted row's DB `id` when the operation is complete.
   * If the insert fails, then resolves to `undefined`.
   * @throws An {@link ErrorWithCode} if the insert fails with an error and
   * {@link DAOOptions.catchErrors} is not set in the {@link opts}.
   */
  static async insert(summary: OpenPositionSummary, opts?: DAOOptions): Promise<number | undefined> {
    const {
      positionAddress,
      priceMargin,
      priceRange,
      tickRange
    } = summary.data;
    const position = await resolvePosition(positionAddress);

    await OrcaWhirlpoolDAO.insert(position.getWhirlpoolData(), position.getData().whirlpool, opts);
    const whirlpoolData = position.getWhirlpoolData();

    const solanaTxId = await SolanaTxDAO.insert(summary, { ...opts, ignoreDuplicates: true });
    if (solanaTxId == null) return; // No throw error - SolanaTxDAO handles errors

    const address = position.getAddress().toBase58();
    debug('Inserting Position into database:', address);

    try {
      const whirlpoolId = await OrcaWhirlpoolDAO.getId(position.getData().whirlpool);
      if (whirlpoolId == null) { // Cannot continue without Whirlpool DB ID.
        throw new Error(`Failed to get Whirlpool for Position Insert: ${position.getData().whirlpool}`);
      }

      const [, tokenB] = await getWhirlpoolTokenPair(whirlpoolData);
      const [tickLowerIndex, tickUpperIndex] = tickRange;

      const priceOrigin = await getWhirlpoolPrice(whirlpoolData);
      const [priceLower, priceUpper] = priceRange;

      const result = await db().insertInto('orcaPosition')
        .values({
          address,
          openTx: solanaTxId,
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

      debug(`Inserted Orca Position into database ( ID: ${result?.id} ):`, address);

      // If the Position was opened with liquidity, insert the LiquidityTxSummary.
      if (summary.data.increaseLiquidityData) {
        await OrcaLiquidityDAO.insert({ ...summary, data: summary.data.increaseLiquidityData }, opts);
      }

      return result?.id;
    } catch (err) {
      handleDBInsertError(err as ErrorWithCode, 'Orca Position', address, opts);
    }
  }

  /**
   * Updates the status of a {@link Position} in the database by setting a closeTx signature.
   * If the given {@link position} or {@link txSignature} is {@link Null}, the operation is a no-op.
   *
   * `Note`: This method also inserts the {@link FeeRewardTxSummary} and {@link LiquidityTxSummary} associated with the close operation.
   *
   * @param summary The {@link ClosePositionSummary} to use for the update.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the updated row's DB `id` when the operation is complete.
   * If the update fails, then resolves to `undefined`.
   */
  static async updateClosed(
    summary: ClosePositionSummary,
    opts?: DAOOptions
  ): Promise<number | undefined> {
    const positionAddress = toPubKeyStr(summary.data.positionAddress);

    // Update orcaLiquidity and orcaFee tables
    await OrcaPositionDAO.updateEmptied(summary, opts);

    // Insert SolanaTx
    const solanaTxId = await SolanaTxDAO.insert(summary, { ...opts, ignoreDuplicates: true });
    if (solanaTxId == null) return; // No throw error - SolanaTxDAO handles errors

    debug('Closing Position in database:', positionAddress);

    try {
      const result = await db().updateTable('orcaPosition')
        .set({ closeTx: solanaTxId })
        .where('address', '=', positionAddress)
        .where('closeTx', 'is', null)
        .returning('id')
        .executeTakeFirst();

      result
        ? debug('Position closed in database:', positionAddress)
        : warn('Could not close position in database:', positionAddress);

      return result?.id;
    } catch (err) {
      if (!opts?.catchErrors) {
        throw err;
      }
      error('Failed to close position in database:', positionAddress);
      error(err);
    }
  }

  /**
   * Updates the liquidity and fee / reward data associated with a position to reflect emptied state.
   *
   * @param summary The {@link EmptyPositionSummary} or {@link ClosePositionSummary} to use for the update.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the {@link UpdateEmptiedResults} when the operation is complete.
   */
  static async updateEmptied(
    summary: EmptyPositionSummary,
    opts?: DAOOptions
  ): Promise<UpdateEmptiedResults> {
    const { collectFeesRewards, decreaseLiquidity } = summary.data;

    return {
      feeRewardTxId: collectFeesRewards
        ? await OrcaFeeDAO.insert({ ...summary, data: collectFeesRewards }, opts)
        : undefined,
      liquidityTxId: decreaseLiquidity
        ? await OrcaLiquidityDAO.insert({ ...summary, data: decreaseLiquidity }, opts)
        : undefined,
    };
  }

}

export type * from './orca-position.dao.interfaces';
