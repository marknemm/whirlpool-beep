import { StrategyType, type Position } from '@meteora-ag/dlmm';
import { debug, error, expBackoff, genPriceMarginRange, invertPrice, numericToBN } from '@npc/core';
import MeteoraPositionDAO from '@npc/meteora/data/meteora-position/meteora-position.dao';
import { getPool } from '@npc/meteora/services/pool/query/query-pool';
import { getPosition } from '@npc/meteora/services/position/query/query-position';
import { getPoolTokenPair } from '@npc/meteora/util/pool/pool';
import { decodeIx, getProgramErrorInfo, getTokenAmountsForPool, getTxSummary, TransactionContext, wallet } from '@npc/solana';
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
  const { liquidity, poolAddress, priceMargin = 0.01 } = args;
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

  let totalXAmount = new BN(0);
  let totalYAmount = new BN(0);
  if (liquidity) {
    const [tokenX, tokenY] = await getPoolTokenPair(pool);
    const tokenPrice = invertPrice(activeBin.pricePerToken);
    const [decimalXAmount, decimalYAmount] = await getTokenAmountsForPool([tokenX, tokenY], liquidity, tokenPrice);
    totalXAmount = numericToBN(decimalXAmount, tokenX.mint.decimals);
    totalYAmount = numericToBN(decimalYAmount, tokenY.mint.decimals);
  }

  const positionKeypair = new Keypair();

  // // Create Position (Spot Balance deposit, Please refer ``example.ts` for more example)
  const createPositionTx = await pool.initializePositionAndAddLiquidityByStrategy({
    positionPubKey: positionKeypair.publicKey,
    user: wallet().publicKey,
    totalXAmount,
    totalYAmount,
    strategy: {
      maxBinId,
      minBinId,
      strategyType: StrategyType.SpotBalanced,
    },
  });

  const transactionCtx = TransactionContext.from(createPositionTx.instructions.slice(1), positionKeypair);
  for (const ix of transactionCtx.instructions) {
    debug(await decodeIx(ix));
  }

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

    debug('Price Margin Range:', { lowerPrice, upperPrice });
    const txSummary = await genOpenPositionTxSummary({
      openPositionIxData: {
        binRange: [minBinId, maxBinId],
        pool,
        priceMargin: new Decimal(priceMargin),
        priceOrigin,
        priceRange,
        instructions: createPositionTx.instructions,
        debugData: {
          name: 'openPosition',
        }
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

  // const increaseLiquidityQuote = increaseLiquidityIxData?.quote;
  // if (increaseLiquidityQuote) {
  //   const liquidityTxSummary = await genIncreaseLiquidityTxSummary(position, increaseLiquidityIxData, sendResult);
  //   liquidityTxSummary.fee = 0; // Fee is included in open position tx fee
  //   openPositionTxSummary.increaseLiquidityTxSummary = liquidityTxSummary;
  // }

  return openPositionTxSummary;
}

export type * from './open-position.interfaces';
