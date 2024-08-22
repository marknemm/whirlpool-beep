import type { DAOOptions, ErrorWithCode, Null } from '@npc/core';
import { db, debug, error, handleInsertError, handleSelectError, toBigInt, warn } from '@npc/core';
import OrcaFeeDAO from '@npc/orca/data/orca-fee/orca-fee.dao';
import OrcaLiquidityDAO from '@npc/orca/data/orca-liquidity/orca-liquidity.dao';
import OrcaWhirlpoolDAO from '@npc/orca/data/orca-whirlpool/orca-whirlpool.dao';
import type { ClosePositionTxSummary } from '@npc/orca/services/position/close/close-position.interfaces';
import type { EmptyPositionTxSummary } from '@npc/orca/services/position/empty/empty-position.interfaces';
import type { OpenPositionTxSummary } from '@npc/orca/services/position/open/open-position.interfaces';
import { getWhirlpoolPrice, getWhirlpoolTokenPair } from '@npc/orca/util/whirlpool/whirlpool';
import { SolanaTxDAO } from '@npc/solana';
import { type Address, AddressUtil, Percentage } from '@orca-so/common-sdk';
import { type Position } from '@orca-so/whirlpools-sdk';
import { UpdateEmptiedResults } from './orca-position.dao.interfaces';

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
    address = AddressUtil.toString(address);

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
      handleSelectError(err as ErrorWithCode, 'orcaPosition', opts);
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
      handleSelectError(err as ErrorWithCode, 'orcaPosition', opts);
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
      increaseLiquidityTxSummary,
      priceMargin,
      priceRange,
      tickRange
    } = txSummary;
    const { position } = bundledPosition;

    await OrcaWhirlpoolDAO.insert(position.getWhirlpoolData(), position.getData().whirlpool, opts);
    const whirlpoolData = position.getWhirlpoolData();

    const solanaTxId = await SolanaTxDAO.insert(txSummary, { ...opts, ignoreDuplicates: true });
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
          openSolanaTx: solanaTxId,
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
      if (increaseLiquidityTxSummary) {
        await OrcaLiquidityDAO.insert(increaseLiquidityTxSummary, opts);
      }

      return result?.id;
    } catch (err) {
      handleInsertError(err as ErrorWithCode, 'Orca Position', address, opts);
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

    // Update orcaLiquidity and orcaFee tables
    await OrcaPositionDAO.updateEmptied(txSummary, opts);

    // Insert SolanaTx
    const solanaTxId = await SolanaTxDAO.insert(txSummary, { ...opts, ignoreDuplicates: true });
    if (solanaTxId == null) return; // No throw error - SolanaTxDAO handles errors

    debug('Closing Position in database:', address);

    try {
      const result = await db().updateTable('orcaPosition')
        .set({ closeSolanaTx: solanaTxId })
        .where('address', '=', address)
        .where('closeSolanaTx', 'is', null)
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
        ? await OrcaFeeDAO.insert(collectFeesRewardsTxSummary, opts)
        : undefined,
      liquidityTxId: decreaseLiquidityTxSummary
        ? await OrcaLiquidityDAO.insert(decreaseLiquidityTxSummary, opts)
        : undefined,
    };
  }

}

export type * from './orca-position.dao.interfaces';
