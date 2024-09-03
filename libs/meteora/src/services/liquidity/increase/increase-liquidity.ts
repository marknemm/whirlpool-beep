import { info, invertPrice, LiquidityUnit, numericToBN, numericToString } from '@npc/core';
import { Position } from '@npc/meteora/interfaces/position';
import { getPool } from '@npc/meteora/services/pool/query/query-pool';
import env from '@npc/meteora/util/env/env';
import { formatPool, getPoolTokenPair } from '@npc/meteora/util/pool/pool';
import { getTokenAmountsForPool, getTransferTotalsFromIxs, getTxSummary, SendTransactionResult } from '@npc/solana';
import BN from 'bn.js';
import type { LiquidityTxSummary } from '../interfaces/liquidity-tx.interfaces';
import type { IncreaseLiquidityAmounts, IncreaseLiquidityIxArgs, IncreaseLiquidityIxData } from './increase-liquidity.interfaces';

/**
 * Increases liquidity in a given {@link position}.
 *
 * @param position The {@link Position} to increase the liquidity of.
 * @param amount The amount of liquidity to deposit in the {@link Position}.
 * @param unit The {@link LiquidityUnit} to use for the amount. Defaults to `usd`.
 * @returns A {@link Promise} that resolves to the {@link LiquidityTxSummary} delta info.
 * @throws An {@link Error} if the transaction fails to complete.
 */
// export async function increaseLiquidity(
//   position: Position,
//   amount: BN | Decimal.Value,
//   unit: LiquidityUnit = 'usd'
// ): Promise<LiquidityTxSummary> {
//   const transactionCtx = new TransactionContext();
//   const pool = await getPool({ poolAddress: position.poolPublicKey });

//   const opMetadata = {
//     pool: await formatPool(pool),
//     position: position.publicKey.toBase58(),
//     amount: `${amount.toString()} ${unit}`,
//   };

//   try {
//     return expBackoff(async (retry) => {
//       info('\n-- Increasing liquidity --\n', {
//         ...opMetadata,
//         retry,
//       });

//       // Must refresh data if retrying, or may generate error due to stale data
//       if (retry) {
//         await position
//       }

//       position.positionData.

//       pool.addLiquidityByStrategy({
//         positionPubKey: position.publicKey,
//         user: wallet().publicKey,
//         slippage: env.SLIPPAGE_DEFAULT,
//       })

//       // Generate instruction data to increase liquidity
//       const ixData = await genIncreaseLiquidityIxData({
//         liquidity: amount,
//         positionAddress: position.getAddress(),
//         positionMint: position.getData().positionMint,
//         tickRange: [position.getData().tickLowerIndex, position.getData().tickUpperIndex],
//         pool,
//         liquidityUnit: unit,
//       });

//       // Send transaction
//       const sendResult = await transactionCtx
//         .resetInstructionData(ixData)
//         .send();

//       // Get Liquidity tx summary and insert into DB
//       const txSummary = await genIncreaseLiquidityTxSummary(position, ixData, sendResult);
//       await MeteoraLiquidityDAO.insert(txSummary, { catchErrors: true });

//       return txSummary;
//     }, {
//       retryFilter: (result, err) => {
//         const errInfo = getProgramErrorInfo(err);
//         return ['InvalidTimestamp', 'TokenMaxExceeded'].includes(errInfo?.name ?? '');
//       }
//     });
//   } catch (err) {
//     error('Failed to increase liquidity:', opMetadata);
//     throw err;
//   }
// }

/**
 * Generates the token amounts to deposit into a {@link Position} for increasing liquidity.
 *
 * @param ixArgs The {@link IncreaseLiquidityIxArgs} to use for generating the amounts.
 * @returns A {@link Promise} that resolves to the {@link IncreaseLiquidityAmounts} to deposit.
 */
export async function genIncreaseLiquidityIxData(ixArgs: IncreaseLiquidityIxArgs): Promise<IncreaseLiquidityIxData> {
  const { liquidity, liquidityUnit = 'usd', poolAddress } = ixArgs;

  const pool = await getPool({ poolAddress });
  await pool.refetchStates();
  const activeBin = await pool.getActiveBin();

  if (liquidityUnit === 'usd') {
    const [tokenX, tokenY] = await getPoolTokenPair(pool);
    const tokenPrice = invertPrice(activeBin.pricePerToken);
    const [decimalXAmount, decimalYAmount] = await getTokenAmountsForPool([tokenX, tokenY], liquidity, tokenPrice);
    const totalXAmount = numericToBN(decimalXAmount, tokenX.mint.decimals);
    const totalYAmount = numericToBN(decimalYAmount, tokenY.mint.decimals);

    return {
      ixArgs,
      totalXAmount,
      totalYAmount,
    };
  } else if (liquidityUnit === 'tokenA') {
    throw new Error('TokenA liquidity unit not yet supported');
  } else if (liquidityUnit === 'tokenB') {
    throw new Error('TokenB liquidity unit not yet supported');
  } else {
    throw new Error(`Invalid liquidity unit: ${liquidityUnit}`);
  }
}

/**
 * Generates a summary of a liquidity increase transaction.
 *
 * @param position The {@link Position} that had its liquidity increased.
 * @param ixData The instruction data used to increase the liquidity.
 * @param sendResult The result of the transaction.
 * @returns A {@link Promise} that resolves to the {@link LiquidityTxSummary}.
 */
export async function genIncreaseLiquidityTxSummary(
  position: Position,
  ixData: IncreaseLiquidityIxData,
  sendResult: SendTransactionResult
): Promise<LiquidityTxSummary> {
  const { ixArgs } = ixData;
  const { liquidity, liquidityUnit = 'usd' } = ixArgs;

  const pool = await getPool({ poolAddress: position.poolPublicKey });
  const [tokenX, tokenY] = await getPoolTokenPair(pool);
  const txSummary = await getTxSummary(sendResult.signature);

  const liquidityIx = txSummary.decodedIxs.find(
    (ix) => /add\s*liquidity/i.test(ix.name)
  );
  if (!liquidityIx) throw new Error('No increase liquidity instruction found in transaction');
  const { tokenTotals, usd } = await getTransferTotalsFromIxs([liquidityIx]);

  const liquidityTxSummary: LiquidityTxSummary = {
    ...txSummary,
    liquidity: numericToBN(liquidity),
    liquidityUnit,
    position,
    slippage: env.SLIPPAGE_DEFAULT,
    tokenAmountX: tokenTotals.get(tokenX.mint.publicKey)?.neg() ?? new BN(0),
    tokenAmountY: tokenTotals.get(tokenY.mint.publicKey)?.neg() ?? new BN(0),
    usd: usd * -1,
    sendResult,
  };

  info('Increase liquidity tx summary:', {
    pool: await formatPool(pool),
    position: liquidityTxSummary.position.publicKey.toBase58(),
    [tokenX.metadata.symbol]: numericToString(liquidityTxSummary.tokenAmountX, tokenX.mint.decimals),
    [tokenY.metadata.symbol]: numericToString(liquidityTxSummary.tokenAmountY, tokenY.mint.decimals),
    usd: `$${liquidityTxSummary.usd}`,
    fee: `${liquidityTxSummary.fee}`,
    signature: liquidityTxSummary.signature,
  });

  return liquidityTxSummary;
}
