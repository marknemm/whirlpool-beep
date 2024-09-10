import { Address } from '@coral-xyz/anchor';
import type DLMM from '@meteora-ag/dlmm';
import { error, expBackoff, info, numericToString, toBN } from '@npc/core';
import MeteoraLiquidityDAO from '@npc/meteora/data/meteora-liquidity/meteora-liquidity.dao';
import type { LiquidityTxSummary } from '@npc/meteora/interfaces/liquidity.interfaces';
import env from '@npc/meteora/util/env/env';
import { formatPool, getPool, getPoolTokenPair } from '@npc/meteora/util/pool/pool';
import { getPosition, getPositions, resolvePosition, type Position } from '@npc/meteora/util/position/position';
import { getProgramErrorInfo, getTransferTotalsFromIxs, getTxSummary, InstructionSetMap, SendTransactionResult, toPubKeyStr, TransactionContext, wallet } from '@npc/solana';
import { Transaction } from '@solana/web3.js';
import BN from 'bn.js';
import { DecreaseLiquidityArgs } from './decrease-liquidity.interfaces';

/**
 * Decreases liquidity of all {@link Position}s in a Meteora {@link DLMM} pool.
 *
 * @param poolAddress The {@link Address} of the Meteora {@link DLMM} pool to decrease liquidity in.
 * @param amount The amount of liquidity to withdraw from the Meteora {@link DLMM} pool. Divided evenly among open positions.
 * @returns A {@link Promise} that resolves to a {@link Map} of {@link Position} addresses to {@link LiquidityTxSummary}s.
 */
export async function decreasePoolLiquidity(
  poolAddress: Address,
  amount: BN | number
): Promise<Map<string, LiquidityTxSummary>> {
  info('\n-- Decrease All liquidity --');

  const txSummaries = new Map<string, LiquidityTxSummary>();

  const positions = await getPositions({ poolAddress });
  const divLiquidity = new BN(amount).div(new BN(positions.length));

  positions.length
    ? info(`Decreasing liquidity of ${positions.length} positions in Meteora DLMM pool:`, poolAddress)
    : info('No positions to decrease liquidity of in Meteora DLMM pool:', poolAddress);

  const promises = positions.map(async (position) => {
    const txSummary = await decreaseLiquidity({
      positionAddress: position.publicKey,
      liquidity: divLiquidity
    }).catch((err) => { error(err); });

    if (txSummary) {
      txSummaries.set(position.publicKey.toBase58(), txSummary);
    }
  });

  await Promise.all(promises);
  return txSummaries;
}

/**
 * Decreases liquidity in a given {@link position}.
 *
 * @param args The {@link DecreaseLiquidityArgs} for decreasing the liquidity.
 * @returns A {@link Promise} that resolves to the {@link LiquidityTxSummary}.
 * @throws An {@link Error} if the transaction fails to complete.
 */
export async function decreaseLiquidity(args: DecreaseLiquidityArgs): Promise<LiquidityTxSummary> {
  const { positionAddress, liquidity } = args;
  const transactionCtx = new TransactionContext();

  const position = await resolvePosition(positionAddress);
  const pool = await getPool({ poolAddress: position.poolPublicKey });

  const opMetadata = {
    pool: await formatPool(pool),
    position: positionAddress,
    liquidity: numericToString(liquidity),
  };

  try {
    return expBackoff(async (retry) => {
      info('\n-- Decreasing liquidity --\n', {
        ...opMetadata,
        retry,
      });

      // Must refresh data if retrying, or may generate error due to stale data.
      if (retry) {
        await pool.refetchStates();
      }

      // Generate instruction data to decrease liquidity
      const ixData = await genDecreaseLiquidityIxData(args);

      // Execute and verify the transaction
      const sendResult = await transactionCtx
        .resetInstructionData(ixData)
        .send();

      // Get Liquidity tx summary and insert into DB
      const txSummary = await genDecreaseLiquidityTxSummary(position, sendResult);
      await MeteoraLiquidityDAO.insert(txSummary, { catchErrors: true });

      return txSummary;
    }, {
      retryFilter: (result, err) => {
        const errInfo = getProgramErrorInfo(err);
        return ['InvalidTimestamp', 'LiquidityUnderflow', 'TokenMinSubceeded'].includes(errInfo?.name ?? '');
      },
    });
  } catch (err) {
    error('Failed to decrease liquidity:', opMetadata);
    throw err;
  }
}

/**
 * Generates the {@link InstructionSetMap} to decrease liquidity in a given {@link Position}.
 *
 * @param ixArgs The {@link DecreaseLiquidityArgs} for generating the decrease liquidity instruction data.
 * @returns A {@link Promise} that resolves to the {@link InstructionSetMap} to decrease liquidity.
 */
export async function genDecreaseLiquidityIxData(ixArgs: DecreaseLiquidityArgs): Promise<InstructionSetMap> {
  const { positionAddress, liquidity } = ixArgs;
  const position = await getPosition(positionAddress);
  if (!position) {
    throw new Error(`Position not found: ${toPubKeyStr(positionAddress)}`);
  }

  const { poolPublicKey } = position;
  const pool = await getPool({ poolAddress: poolPublicKey, ignoreCache: true });

  const binIds = position.positionData.positionBinData.map(
    (bin) => bin.binId
  );

  const tx = await pool.removeLiquidity({
    position: position.publicKey,
    user: wallet().publicKey,
    binIds,
    bps: toBN(liquidity),
  }) as Transaction;

  return { instructions: tx.instructions.slice(1) };
}

/**
 * Generates a {@link LiquidityTxSummary}.
 *
 * @param position The {@link Position} to get the {@link LiquidityTxSummary} for.
 * @param sendResult The {@link TransactionSendResult} of the transaction that changed the liquidity.
 * @returns A {@link Promise} that resolves to the {@link LiquidityTxSummary}.
 */
export async function genDecreaseLiquidityTxSummary(
  position: Position,
  sendResult: SendTransactionResult,
): Promise<LiquidityTxSummary> {
  const pool = await getPool({ poolAddress: position.poolPublicKey });
  const [tokenX, tokenY] = await getPoolTokenPair(pool);
  const txSummary = await getTxSummary(sendResult);

  const liquidityIx = txSummary.decodedIxs.find(
    (ix) => /remove\s*liquidity/i.test(ix.name)
  );
  if (!liquidityIx) throw new Error('No decrease liquidity instruction found in transaction');
  const { tokenTotals, usd } = await getTransferTotalsFromIxs([liquidityIx]);

  const liquidityTxSummary: LiquidityTxSummary = {
    position,
    slippage: env.SLIPPAGE_DEFAULT,
    tokenAmountX: tokenTotals.get(tokenX.mint.publicKey)?.neg() ?? new BN(0),
    tokenAmountY: tokenTotals.get(tokenY.mint.publicKey)?.neg() ?? new BN(0),
    ...txSummary,
    usd: usd * -1, // Tx data is in relationship to wallet, so negate to get flow in/out of pool
  };

  info('Decrease liquidity tx summary:', {
    pool: await formatPool(pool),
    position: liquidityTxSummary.position.publicKey.toBase58(),
    [tokenX.metadata.symbol]: numericToString(liquidityTxSummary.tokenAmountX, tokenX.mint.decimals),
    [tokenY.metadata.symbol]: numericToString(liquidityTxSummary.tokenAmountY, tokenY.mint.decimals),
    usd: `$${liquidityTxSummary.usd}`,
    fee: liquidityTxSummary.fee,
    signature: liquidityTxSummary.signature,
  });

  return liquidityTxSummary;
}