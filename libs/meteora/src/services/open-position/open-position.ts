import { StrategyType, type Position } from '@meteora-ag/dlmm';
import { debug, error, expBackoff, genPriceMarginRange, invertPrice } from '@npc/core';
import MeteoraPositionDAO from '@npc/meteora/data/meteora-position/meteora-position.dao';
import { genIncreaseLiquidityAmounts, genIncreaseLiquidityTxSummary } from '@npc/meteora/services/increase-liquidity/increase-liquidity';
import env from '@npc/meteora/util/env/env';
import { formatPool, getPool } from '@npc/meteora/util/pool/pool';
import { getPosition } from '@npc/meteora/util/position/position';
import { getProgramErrorInfo, getTxSummary, TransactionContext, wallet } from '@npc/solana';
import { Keypair } from '@solana/web3.js';
import BN from 'bn.js';
import Decimal from 'decimal.js';
import { OpenPositionArgs, OpenPositionTxSummary, OpenPositionTxSummaryArgs } from './open-position.interfaces';

/**
 * Opens a new position in a Meteora liquidity pool.
 *
 * @param args The {@link OpenPositionArgs} for opening a new position.
 * @returns A {@link Promise} that resolves to the opened {@link Position}.
 */
export async function openPosition(args: OpenPositionArgs): Promise<OpenPositionTxSummary> {
  const { liquidity, liquidityUnit, poolAddress, priceMargin = 0.01 } = args;
  const pool = await getPool({ poolAddress });

  const activeBin = await pool.getActiveBin();

  const [lowerPrice, upperPrice] = genPriceMarginRange(activeBin.price, priceMargin);
  const minBinId = Math.max(
    pool.getBinIdFromPrice(lowerPrice.toNumber(), true), // true  - round down
    activeBin.binId - 34
  );
  const maxBinId = Math.min(
    pool.getBinIdFromPrice(upperPrice.toNumber(), false), // false - round up
    activeBin.binId + 34
  );

  const positionKeypair = new Keypair();

  const increaseLiquidityAmounts = liquidity
    ? await genIncreaseLiquidityAmounts({
        liquidity,
        liquidityUnit,
        poolAddress,
      })
    : undefined;

  const createPositionTx = await pool.initializePositionAndAddLiquidityByStrategy({
    positionPubKey: positionKeypair.publicKey,
    user: wallet().publicKey,
    totalXAmount: increaseLiquidityAmounts?.totalXAmount ?? new BN(0),
    totalYAmount: increaseLiquidityAmounts?.totalYAmount ?? new BN(0),
    slippage: env.SLIPPAGE_DEFAULT,
    strategy: {
      maxBinId,
      minBinId,
      strategyType: StrategyType.SpotBalanced,
    },
  });

  const createPositionIxs = createPositionTx.instructions.slice(1); // Exclude compute unit limit ix
  const transactionCtx = new TransactionContext()
    .addInstructionData({
      instructions: createPositionIxs,
      signers: positionKeypair,
      debugData: {
        name: 'openPosition',
        pool: await formatPool(pool),
        position: positionKeypair.publicKey.toBase58(),
      }
    });

  try {
    const sendResult = await transactionCtx.send();
    debug(sendResult);
    const position = await expBackoff(() => getPosition(positionKeypair.publicKey));
    if (!position) {
      throw new Error(`Position not found: ${positionKeypair.publicKey.toBase58()}`);
    }

    const priceOrigin = invertPrice(activeBin.pricePerToken);
    const binData = await pool.getBinsBetweenLowerAndUpperBound(minBinId, maxBinId);
    const priceRange: [Decimal, Decimal] = [
      invertPrice(binData.bins[0].pricePerToken),
      invertPrice(binData.bins[binData.bins.length - 1].pricePerToken),
    ];

    const txSummary = await genOpenPositionTxSummary({
      openPositionIxData: {
        binRange: [minBinId, maxBinId],
        pool,
        priceMargin: new Decimal(priceMargin),
        priceOrigin,
        priceRange,
        instructions: createPositionTx.instructions,
      },
      position,
      sendResult,
    });
    await MeteoraPositionDAO.insert(txSummary, { catchErrors: true });
    return txSummary;
  } catch (err) {
    const programErrInfo = getProgramErrorInfo(err);
    error(programErrInfo ?? err);
    throw err;
  }
}

export async function genOpenPositionIxData(args: OpenPositionArgs) {

}

/**
 * Generates a summary of an open {@link Position} transaction.
 *
 * @param args The {@link OpenPositionTxSummaryArgs}.
 * @returns A {@link Promise} that resolves to the {@link OpenPositionTxSummary}.
 */
export async function genOpenPositionTxSummary({
  openPositionIxData,
  position,
  sendResult
}: OpenPositionTxSummaryArgs): Promise<OpenPositionTxSummary> {
  const { binRange, priceMargin, priceOrigin, priceRange } = openPositionIxData;

  const txSummary = await getTxSummary(sendResult);

  const openPositionTxSummary: OpenPositionTxSummary = {
    binRange,
    position,
    priceMargin,
    priceOrigin,
    priceRange,
    ...txSummary,
  };

  const liquidityIx = txSummary.decodedIxs.find(
    (ix) => /add\s*liquidity/i.test(ix.name)
  );
  openPositionTxSummary.increaseLiquidityTxSummary = liquidityIx
    ? await genIncreaseLiquidityTxSummary(position, sendResult)
    : undefined;

  return openPositionTxSummary;
}

export type * from './open-position.interfaces';
