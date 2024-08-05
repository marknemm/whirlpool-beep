import PositionDAO from '@/data/position/position.dao';
import type { BundledPosition } from '@/interfaces/position.interfaces';
import { genCollectFeesRewardsIx, genCollectFeesRewardsTxSummary, type CollectFeesRewardsIx } from '@/services/fees-rewards/collect/collect-fees-rewards';
import { genDecreaseLiquidityIx } from '@/services/liquidity/decrease/decrease-liquidity';
import { DecreaseLiquidityIx } from '@/services/liquidity/decrease/decrease-liquidity.interfaces';
import { genLiquidityTxSummary } from '@/services/liquidity/util/liquidity';
import { getPositions } from '@/services/position/query/query-position';
import { expBackoff, timeout } from '@/util/async/async';
import { debug, error, info } from '@/util/log/log';
import { getProgramErrorInfo } from '@/util/program/program';
import rpc from '@/util/rpc/rpc';
import { executeTransaction, getTransactionSummary } from '@/util/transaction/transaction';
import wallet from '@/util/wallet/wallet';
import whirlpoolClient, { formatWhirlpool } from '@/util/whirlpool/whirlpool';
import { TransactionBuilder, type Address, type Instruction } from '@orca-so/common-sdk';
import { IGNORE_CACHE, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, WhirlpoolIx, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import type { CloseAllPositionsSummary, ClosePositionIx, ClosePositionOptions, ClosePositionTx, ClosePositionTxSummary, ClosePositionTxSummaryArgs } from './close-position.interfaces';

/**
 * Closes all {@link Position}s in a {@link Whirlpool}.
 *
 * @param whirlpoolAddress The {@link Address} of the {@link Whirlpool} to close all positions in.
 * @returns A {@link Promise} that resolves once all positions are closed.
 */
export async function closeAllPositions(whirlpoolAddress: Address): Promise<CloseAllPositionsSummary> {
  info('\n-- Close All Positions --');

  const bundledPositions = await getPositions({ whirlpoolAddress, ...IGNORE_CACHE });

  const allResults: CloseAllPositionsSummary = {
    failures: [],
    successes: [],
  };

  bundledPositions.length
    ? info(`Closing ${bundledPositions.length} positions in whirlpool:`, whirlpoolAddress)
    : info('No positions to close in whirlpool:', whirlpoolAddress);
  info(bundledPositions.map((bundledPosition) =>
    bundledPosition.position.getAddress().toBase58()
  ));

  const promises = bundledPositions.map(async (bundledPosition, idx) => {
    await timeout(250 * idx); // Stagger requests to avoid rate limiting

    try {
      const result = await closePosition({ bundledPosition });
      allResults.successes.push(result);
    } catch (err) {
      allResults.failures.push({ bundledPosition, err });
      error(err);
    }
  });
  await Promise.all(promises);

  info('Close All Positions Complete:', {
    successCnt: allResults.successes.length,
    successes: allResults.successes.map((success) =>
      success.bundledPosition.position.getAddress().toBase58()
    ),
    failureCnt: allResults.failures.length,
    failures: allResults.failures.map((failure) => ({
      position: failure.bundledPosition.position.getAddress().toBase58(),
      err: failure.err,
    })),
  });

  return allResults;
}

/**
 * Closes a {@link Position} in a {@link Whirlpool}.
 *
 * @param bundledPosition The {@link BundledPosition} to close.
 * @returns A {@link Promise} that resolves to the {@link ClosePositionTxSummary} once the position is closed.
 */
export async function closePosition({
  bundledPosition,
  excludeCollectFeesRewards = false,
  excludeDecreaseLiquidity = false,
}: ClosePositionOptions): Promise<ClosePositionTxSummary> {
  const { position } = bundledPosition;
  const opMetadata = {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  };

  try {
    return expBackoff(async (retry) => {
      info('\n-- Close Position --\n', {
        ...opMetadata,
        retry,
      });

      // Must refresh data if retrying, or may generate error due to stale data.
      if (retry) {
        await position.refreshData();
      }

      const closePositionTx = await genClosePositionTx({
        bundledPosition,
        excludeCollectFeesRewards,
        excludeDecreaseLiquidity,
      });

      const signature = await executeTransaction(closePositionTx.tx, {
        name: 'Close Position',
        ...opMetadata
      }, undefined, { commitment: 'finalized' });

      const closePositionTxSummary = await genClosePositionTxSummary({
        bundledPosition,
        closePositionIxTx: closePositionTx,
        signature,
      });

      await PositionDAO.updateClosed(closePositionTxSummary, { catchErrors: true });
      return closePositionTxSummary;
    }, {
      retryFilter: (result, err) => {
        const errInfo = getProgramErrorInfo(err);
        return ['InvalidTimestamp', 'LiquidityUnderflow', 'TokenMinSubceeded'].includes(errInfo?.name ?? '');
      },
    });
  } catch (err) {
    error('Close Position Failed:', opMetadata);
    throw err;
  }
}

/**
 * Generates a {@link ClosePositionIx} for closing a {@link Position} in a {@link Whirlpool}.
 *
 * @param opts The {@link ClosePositionOptions} for generating the {@link ClosePositionIx}.
 * @returns A {@link Promise} that resolves to the {@link ClosePositionIx}.
 */
export async function genClosePositionIx(opts: ClosePositionOptions): Promise<ClosePositionIx> {
  const { tx, ...rest } = await genClosePositionTx(opts);

  return {
    ix: tx.compressIx(true),
    ...rest,
  };
}

/**
 * Creates a transaction to close a {@link Position} in a {@link Whirlpool}.
 *
 * @param bundledPosition The {@link BundledPosition} to close.
 * @returns A {@link Promise} that resolves to the {@link TransactionBuilder}.
 */
export async function genClosePositionTx({
  bundledPosition,
  excludeCollectFeesRewards = false,
  excludeDecreaseLiquidity = false,
}: ClosePositionOptions): Promise<ClosePositionTx> {
  const { position } = bundledPosition;

  info('Creating close position transaction for position:', position.getAddress());

  const decreaseLiquidityIx = !excludeDecreaseLiquidity
    ? await _genEmptyLiquidityIx(position)
    : null;

  const collectFeesRewardsIx = !excludeCollectFeesRewards
    ? await _genCollectFeesRewardsIx(position)
    : null;

  const closePositionIx = await _genClosePositionIx(bundledPosition);

  const tx = new TransactionBuilder(rpc(), wallet());
  if (decreaseLiquidityIx) {
    tx.addInstruction(decreaseLiquidityIx.ix);
  }
  if (collectFeesRewardsIx) {
    tx.addInstruction(collectFeesRewardsIx.ix);
  }
  tx.addInstruction(closePositionIx);

  return {
    closePositionIx,
    collectFeesQuote: collectFeesRewardsIx?.collectFeesQuote,
    collectFeesIx: collectFeesRewardsIx?.collectFeesIx,
    collectRewardsQuote: collectFeesRewardsIx?.collectRewardsQuote,
    collectRewardsIxs: collectFeesRewardsIx?.collectRewardsIxs ?? [],
    decreaseLiquidityQuote: decreaseLiquidityIx?.quote,
    decreaseLiquidityIx: decreaseLiquidityIx?.ix,
    tx,
  };
}

/**
 * Generates a {@link DecreaseLiquidityIx} for emptying the liquidity in the given {@link Position}.
 *
 * @param position The {@link Position} to decrease the liquidity of.
 * @returns A {@link Promise} that resolves to the {@link DecreaseLiquidityIx}.
 * If the position has no liquidity, returns `null`.
 */
async function _genEmptyLiquidityIx(position: Position): Promise<DecreaseLiquidityIx | null> {
  const { liquidity } = position.getData();

  if (!liquidity.isZero()) {
    return await genDecreaseLiquidityIx(position, liquidity);
  }

  info('No liquidity to decrease:', {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  });
  return null;
}

/**
 * Generates a {@link CollectFeesRewardsIx} for collecting fees and rewards from the given {@link Position}.
 *
 * @param position The {@link Position} to collect fees and rewards from.
 * @returns A {@link Promise} that resolves to the {@link CollectFeesRewardsIx}.
 * If there are no fees or rewards to collect, returns `null`.
 */
async function _genCollectFeesRewardsIx(position: Position): Promise<CollectFeesRewardsIx | null> {
  const collectFeesRewardsIx = await genCollectFeesRewardsIx(position, false);

  if (collectFeesRewardsIx.collectFeesIx || collectFeesRewardsIx.collectRewardsIxs.length) {
    return collectFeesRewardsIx;
  }

  info('No fees or rewards to collect:', {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  });
  return null;
}

/**
 * Generates an {@link Instruction} to close a {@link Position} in a {@link Whirlpool}.
 *
 * @param bundledPosition The {@link BundledPosition} to close.
 * @returns A {@link Promise} that resolves to the {@link Instruction}.
 */
async function _genClosePositionIx(bundledPosition: BundledPosition): Promise<Instruction> {
  const { bundleIndex, position, positionBundle } = bundledPosition;

  const positionBundleATA = await wallet().getNFTAccount(positionBundle.positionBundleMint);
  if (!positionBundleATA) throw new Error('Position bundle token account (ATA) cannot be found');

  const positionBundlePda = PDAUtil.getPositionBundle(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    positionBundle.positionBundleMint
  );

  debug('Tx details for close position:', {
    bundledPosition: position.getAddress().toBase58(),
    positionBundleAuthority: wallet().publicKey.toBase58(),
    positionBundleTokenAccount: positionBundleATA.address.toBase58(),
    positionBundle: positionBundlePda.publicKey.toBase58(),
    bundleIndex,
    receiver: wallet().publicKey.toBase58(),
  });

  return WhirlpoolIx.closeBundledPositionIx(
    whirlpoolClient().getContext().program,
    {
      bundledPosition: position.getAddress(),
      positionBundleAuthority: wallet().publicKey,
      positionBundleTokenAccount: positionBundleATA.address,
      positionBundle: positionBundlePda.publicKey,
      bundleIndex,
      receiver: wallet().publicKey,
    }
  );
}

/**
 * Generates a {@link ClosePositionTxSummary} for a close position transaction.
 *
 * @param args The arguments for generating the close position transaction summary.
 * @returns A {@link Promise} that resolves to the {@link ClosePositionTxSummary}.
 */
export async function genClosePositionTxSummary({
  bundledPosition,
  closePositionIxTx,
  signature
}: ClosePositionTxSummaryArgs): Promise<ClosePositionTxSummary> {
  const { collectFeesIx, decreaseLiquidityIx, decreaseLiquidityQuote } = closePositionIxTx;
  const txSummary = await getTransactionSummary(signature);

  const closePositionTxSummary: ClosePositionTxSummary = {
    bundledPosition,
    collectFeesRewardsTxSummary: undefined,
    decreaseLiquidityTxSummary: undefined,
    signature,
    fee: txSummary.fee,
  };

  if (decreaseLiquidityIx) {
    const liquidityTxSummary = await genLiquidityTxSummary(bundledPosition.position, signature, decreaseLiquidityQuote);
    liquidityTxSummary.fee = 0; // Fee is included in close position tx fee
    closePositionTxSummary.decreaseLiquidityTxSummary = liquidityTxSummary;
  }

  if (collectFeesIx) {
    const collectFeesRewardsTxSummary = await genCollectFeesRewardsTxSummary(bundledPosition.position, signature);
    collectFeesRewardsTxSummary.fee = 0; // Fee is included in close position tx fee
    closePositionTxSummary.collectFeesRewardsTxSummary = collectFeesRewardsTxSummary;
  }

  info('Close position tx summary:', {
    whirlpool: await formatWhirlpool(bundledPosition.position.getWhirlpoolData()),
    position: bundledPosition.position.getAddress().toBase58(),
    signature,
    fee: closePositionTxSummary.fee,
  });

  return closePositionTxSummary;
}

export type * from './close-position.interfaces';
