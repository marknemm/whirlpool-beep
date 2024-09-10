import { type Address } from '@coral-xyz/anchor';
import { type Position } from '@meteora-ag/dlmm';
import { db, debug, handleDBInsertError, handleDBSelectError, toBigInt, type DAOOptions, type ErrorWithCode, type Null } from '@npc/core';
import MeteoraLiquidityDAO from '@npc/meteora/data/meteora-liquidity/meteora-liquidity.dao';
import MeteoraPoolDAO from '@npc/meteora/data/meteora-pool/meteora-pool.dao';
import type { OpenPositionTxSummary } from '@npc/meteora/services/open-position/open-position.interfaces';
import { getPool, getPoolTokenPair } from '@npc/meteora/util/pool/pool';
import { SolanaTxDAO, toPubKeyStr } from '@npc/solana';
import Decimal from 'decimal.js';

/**
 * Pure static data access object for Meteora {@link Position} DB operations.
 */
export default class MeteoraPositionDAO {

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

    debug('Getting Meteora Position ID from database:', address);

    try {
      const result = await db().selectFrom('meteoraPosition')
        .select('id')
        .where('address', '=', address)
        .orderBy('id', 'desc')
        .executeTakeFirst();

      result?.id
        ? debug(`Got Meteora Position ID from database ( ID: ${result?.id} ):`, address)
        : debug('Meteora Position ID not found in database:', address);
      return result?.id;
    } catch (err) {
      handleDBSelectError(err as ErrorWithCode, 'meteoraPosition', opts);
    }
  }

  /**
   * Gets the price margin of a {@link Position} from the database.
   *
   * @param address The {@link Address} of the {@link Position} to get the price margin for.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the price margin of the {@link Position} when the operation is complete.
   */
  static async getPriceMargin(address: Address | Null, opts?: DAOOptions): Promise<Decimal | undefined> {
    if (!address) return;
    address = toPubKeyStr(address);

    debug('Getting Meteora Position price margin from database:', address);

    try {
      const result = await db().selectFrom('meteoraPosition')
        .select('priceMargin')
        .where('address', '=', address)
        .orderBy('id', 'desc')
        .executeTakeFirst();

      result?.priceMargin
        ? debug(`Got Meteora Position price margin from database ( priceMargin: ${result?.priceMargin} ):`, address)
        : debug('Meteora Position price margin not found in database:', address);
      return result?.priceMargin
        ? new Decimal(result.priceMargin).div(100)
        : undefined;
    } catch (err) {
      handleDBSelectError(err as ErrorWithCode, 'Meteora Position', opts);
    }
  }

  /**
   * Inserts a {@link Position} into the database.
   * If the {@link Position} already exists, the operation is a no-op.
   *
   * Also inserts the {@link Whirlpool} associated with the {@link Position} via {@link OrcaWhirlpoolDAO},
   *
   * If the {@link Position} was opened with liquidity, then the associated {@link LiquidityTxSummary}
   * is also inserted via {@link MeteoraLiquidityDAO}.
   *
   * @param txSummary The {@link OpenPositionTxSummary} to use for the insert.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the inserted row's DB `id` when the operation is complete.
   * If the insert fails, then resolves to `undefined`.
   * @throws An {@link ErrorWithCode} if the insert fails with an error and
   * {@link DAOOptions.catchErrors} is not set in the {@link opts}.
   */
  static async insert(txSummary: OpenPositionTxSummary, opts?: DAOOptions): Promise<number | undefined> {
    if (!txSummary?.position) return;
    const {
      binRange,
      increaseLiquidityTxSummary,
      priceMargin,
      priceOrigin,
      priceRange,
      position
    } = txSummary;

    const pool = await getPool({ poolAddress: position.poolPublicKey });
    await MeteoraPoolDAO.insert(pool, opts);

    const solanaTxId = await SolanaTxDAO.insert(txSummary, { ...opts, ignoreDuplicates: true });
    if (solanaTxId == null) return; // No throw error - SolanaTxDAO handles errors

    const address = position.publicKey.toBase58();
    debug('Inserting Position into database:', address);

    try {
      const poolId = await MeteoraPoolDAO.getId(pool.pubkey);
      if (poolId == null) { // Cannot continue without Whirlpool DB ID.
        throw new Error(`Failed to get Whirlpool for Position Insert: ${toPubKeyStr(address)}`);
      }

      const [, tokenB] = await getPoolTokenPair(pool);
      const [minBinId, maxBinId] = binRange;

      const [priceLower, priceUpper] = priceRange;

      const result = await db().insertInto('meteoraPosition')
        .values({
          address,
          maxBinId,
          minBinId,
          openTx: solanaTxId,
          pool: poolId,
          priceLower: toBigInt(priceLower, tokenB.mint.decimals),
          priceMargin: priceMargin.mul(100).round().toNumber(),
          priceOrigin: toBigInt(priceOrigin, tokenB.mint.decimals),
          priceUpper: toBigInt(priceUpper, tokenB.mint.decimals),
        })
        .returning('id')
        .executeTakeFirst();

      debug(`Inserted Meteora Position into database ( ID: ${result?.id} ):`, address);

      // If the Position was opened with liquidity, insert the LiquidityTxSummary.
      if (increaseLiquidityTxSummary) {
        await MeteoraLiquidityDAO.insert(increaseLiquidityTxSummary, opts);
      }

      return result?.id;
    } catch (err) {
      handleDBInsertError(err as ErrorWithCode, 'Meteora Position', address, opts);
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
  // static async updateClosed(
  //   txSummary: ClosePositionTxSummary,
  //   opts?: DAOOptions
  // ): Promise<number | undefined> {
  //   const { bundledPosition, signature } = txSummary;
  //   if (!bundledPosition || !signature) return;

  //   const { position } = bundledPosition;
  //   const address = position.getAddress().toBase58();

  //   // Update meteora_liquidity and meteora_fee tables
  //   await MeteoraPositionDAO.updateEmptied(txSummary, opts);

  //   // Insert solana_tx
  //   const solanaTxId = await SolanaTxDAO.insert(txSummary, { ...opts, ignoreDuplicates: true });
  //   if (solanaTxId == null) return; // No throw error - SolanaTxDAO handles errors

  //   debug('Closing Position in database:', address);

  //   try {
  //     const result = await db().updateTable('meteoraPosition')
  //       .set({ closeTx: solanaTxId })
  //       .where('address', '=', address)
  //       .where('closeTx', 'is', null)
  //       .returning('id')
  //       .executeTakeFirst();

  //     result
  //       ? debug('Meteora position closed in database:', `${address} -- ${signature}`)
  //       : warn('Could not close Meteora position in database:', `${address} -- ${signature}`);

  //     return result?.id;
  //   } catch (err) {
  //     if (!opts?.catchErrors) {
  //       throw err;
  //     }
  //     error('Failed to close Meteora position in database:', `${address} -- ${signature}`);
  //     error(err);
  //   }
  // }

  /**
   * Updates the liquidity and fee / reward data associated with a position to reflect emptied state.
   *
   * @param txSummary The {@link EmptyPositionTxSummary} or {@link ClosePositionTxSummary} to use for the update.
   * @param opts The {@link DAOOptions} to use for the operation.
   * @returns A {@link Promise} that resolves to the {@link UpdateEmptiedResults} when the operation is complete.
   */
  // static async updateEmptied(
  //   txSummary: ClosePositionTxSummary,
  //   opts?: DAOOptions
  // ): Promise<UpdateEmptiedResults> {
  //   const { collectFeesRewardsTxSummary, decreaseLiquidityTxSummary } = txSummary;

  //   return {
  //     feeRewardTxId: collectFeesRewardsTxSummary
  //       ? await MeteoraFeeDAO.insert(collectFeesRewardsTxSummary, opts)
  //       : undefined,
  //     liquidityTxId: decreaseLiquidityTxSummary
  //       ? await MeteoraLiquidityDAO.insert(decreaseLiquidityTxSummary, opts)
  //       : undefined,
  //   };
  // }

}

export type * from './meteora-position.dao.interfaces';
