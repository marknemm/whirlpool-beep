import { type Address } from '@coral-xyz/anchor';
import { StrategyParameters, StrategyType } from '@meteora-ag/dlmm';
import { error, expBackoff, info, invertPrice, numericToString, toBN } from '@npc/core';
import MeteoraLiquidityDAO from '@npc/meteora/data/meteora-liquidity/meteora-liquidity.dao';
import type { LiquidityTxSummary } from '@npc/meteora/interfaces/liquidity.interfaces';
import env from '@npc/meteora/util/env/env';
import { formatPool, getPool, getPoolTokenPair } from '@npc/meteora/util/pool/pool';
import { resolvePosition, type Position } from '@npc/meteora/util/position/position';
import { getProgramErrorInfo, getTokenAmountsForPool, getTransferTotalsFromIxs, getTxSummary, InstructionSetMap, SendTransactionResult, toPubKey, TransactionContext, wallet } from '@npc/solana';
import BN from 'bn.js';
import type { IncreaseLiquidityAmounts, IncreaseLiquidityAmountsArgs, IncreaseLiquidityArgs } from './increase-liquidity.interfaces';

/**
 * Increases liquidity in a given {@link position}.
 *
 * @param args The {@link IncreaseLiquidityArgs} for increasing the liquidity.
 * @returns A {@link Promise} that resolves to the {@link LiquidityTxSummary} delta info.
 * @throws An {@link Error} if the transaction fails to complete.
 */
export async function increaseLiquidity(args: IncreaseLiquidityArgs): Promise<LiquidityTxSummary> {
  const { liquidity, liquidityUnit = 'usd', positionAddress } = args;
  const transactionCtx = new TransactionContext();

  const position = await resolvePosition(positionAddress);
  const pool = await getPool({ poolAddress: position.poolPublicKey });

  const opMetadata = {
    pool: await formatPool(pool),
    position: position.publicKey.toBase58(),
    liquidity: `${liquidity.toString()} ${liquidityUnit}`,
  };

  try {
    return expBackoff(async (retry) => {
      info('\n-- Increasing liquidity --\n', {
        ...opMetadata,
        retry,
      });

      // Must refresh data if retrying, or may generate error due to stale data
      if (retry) {
        await pool.refetchStates();
      }

      // Generate instruction data to increase liquidity
      const ixData = await genIncreaseLiquidityIxData(args);

      // Send transaction
      const sendResult = await transactionCtx
        .resetInstructionData(ixData)
        .send();

      // Get Liquidity tx summary and insert into DB
      const txSummary = await genIncreaseLiquidityTxSummary(position, sendResult);
      await MeteoraLiquidityDAO.insert(txSummary, { catchErrors: true });

      return txSummary;
    }, {
      retryFilter: (result, err) => {
        const errInfo = getProgramErrorInfo(err);
        return ['InvalidTimestamp', 'TokenMaxExceeded'].includes(errInfo?.name ?? '');
      }
    });
  } catch (err) {
    error('Failed to increase liquidity:', opMetadata);
    throw err;
  }
}

/**
 * Generates the instruction data for increasing liquidity in a given {@link position}.
 *
 * @param args The {@link IncreaseLiquidityArgs} for generating the instruction data.
 * @returns A {@link Promise} that resolves to the {@link InstructionSetMap} to increase liquidity.
 */
export async function genIncreaseLiquidityIxData(args: IncreaseLiquidityArgs): Promise<InstructionSetMap> {
  const { poolAddress, positionAddress } = args;

  const pool = await getPool({ poolAddress });
  const increaseLiquidityAmounts = await genIncreaseLiquidityAmounts(args);

  const strategy = args.strategy
                ?? await genDefaultLiquidityStrategy(positionAddress);

  const tx = await pool.addLiquidityByStrategy({
    positionPubKey: toPubKey(positionAddress),
    user: wallet().publicKey,
    slippage: env.SLIPPAGE_DEFAULT,
    totalXAmount: increaseLiquidityAmounts.totalXAmount,
    totalYAmount: increaseLiquidityAmounts.totalYAmount,
    strategy,
  });

  return { instructions: tx.instructions.slice(1) };
}

/**
 * Generates the token amounts to deposit into a {@link Position} for increasing liquidity.
 *
 * @param args The {@link IncreaseLiquidityAmountsArgs} to use for generating the amounts.
 * @returns A {@link Promise} that resolves to the {@link IncreaseLiquidityAmounts} to deposit.
 */
export async function genIncreaseLiquidityAmounts(
  args: IncreaseLiquidityAmountsArgs
): Promise<IncreaseLiquidityAmounts> {
  const { liquidity, liquidityUnit = 'usd', poolAddress } = args;

  const pool = await getPool({ poolAddress });
  await pool.refetchStates();
  const activeBin = await pool.getActiveBin();

  if (liquidityUnit === 'usd') {
    const [tokenX, tokenY] = await getPoolTokenPair(pool);
    const tokenPrice = invertPrice(activeBin.pricePerToken);
    const [decimalXAmount, decimalYAmount] = await getTokenAmountsForPool([tokenX, tokenY], liquidity, tokenPrice);
    const totalXAmount = toBN(decimalXAmount, tokenX.mint.decimals);
    const totalYAmount = toBN(decimalYAmount, tokenY.mint.decimals);

    return {
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
 * Generates the default liquidity strategy for a given {@link position}.
 *
 * @param positionAddress The {@link Address} of the {@link Position} to generate the default strategy for.
 * @returns A {@link Promise} that resolves to the default {@link StrategyParameters}.
 */
export async function genDefaultLiquidityStrategy(positionAddress: Address): Promise<StrategyParameters> {
  const position = await resolvePosition(positionAddress);

  return {
    maxBinId: position.positionData.upperBinId,
    minBinId: position.positionData.lowerBinId,
    strategyType: StrategyType.SpotBalanced,
  };
}

/**
 * Generates a summary of a liquidity increase transaction.
 *
 * @param position The {@link Position} that had its liquidity increased.
 * @param sendResult The result of the transaction.
 * @returns A {@link Promise} that resolves to the {@link LiquidityTxSummary}.
 */
export async function genIncreaseLiquidityTxSummary(
  position: Position,
  sendResult: SendTransactionResult
): Promise<LiquidityTxSummary> {
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

export type * from './increase-liquidity.interfaces';
