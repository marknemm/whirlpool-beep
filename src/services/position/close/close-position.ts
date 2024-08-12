import PositionDAO from '@/data/position/position.dao';
import type { BundledPosition } from '@/interfaces/position.interfaces';
import { genCollectFeesRewardsIxData, genCollectFeesRewardsTxSummary, type CollectFeesRewardsIxData } from '@/services/fees-rewards/collect/collect-fees-rewards';
import { genDecreaseLiquidityIxData } from '@/services/liquidity/decrease/decrease-liquidity';
import { DecreaseLiquidityIxData } from '@/services/liquidity/decrease/decrease-liquidity.interfaces';
import { genLiquidityTxSummary } from '@/services/liquidity/util/liquidity';
import { getPositions } from '@/services/position/query/query-position';
import { expBackoff, timeout } from '@/util/async/async';
import { debug, error, info } from '@/util/log/log';
import { getProgramErrorInfo } from '@/util/program/program';
import TransactionContext from '@/util/transaction-context/transaction-context';
import { getTransactionSummary } from '@/util/transaction-query/transaction-query';
import wallet from '@/util/wallet/wallet';
import whirlpoolClient, { formatWhirlpool } from '@/util/whirlpool/whirlpool';
import { TransactionBuilder, type Address, type Instruction } from '@orca-so/common-sdk';
import { IGNORE_CACHE, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, WhirlpoolIx, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import type { CloseAllPositionsSummary, ClosePositionIxData, ClosePositionOptions, ClosePositionTxSummary, ClosePositionTxSummaryArgs } from './close-position.interfaces';

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
  const transactionCtx = new TransactionContext();
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

      const closePositionIxData = await genClosePositionIxData({
        bundledPosition,
        excludeCollectFeesRewards,
        excludeDecreaseLiquidity,
      });

      const { signature } = await transactionCtx.resetInstructionData(
        closePositionIxData.decreaseLiquidityIxData,
        closePositionIxData.collectFeesRewardsIxData,
        closePositionIxData
      ).send({ confirmCommitment: 'finalized' });

      const closePositionTxSummary = await genClosePositionTxSummary({
        bundledPosition,
        closePositionIxData,
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
 * Creates a transaction to close a {@link Position} in a {@link Whirlpool}.
 *
 * @param bundledPosition The {@link BundledPosition} to close.
 * @returns A {@link Promise} that resolves to the {@link TransactionBuilder}.
 */
export async function genClosePositionIxData({
  bundledPosition,
  excludeCollectFeesRewards = false,
  excludeDecreaseLiquidity = false,
}: ClosePositionOptions): Promise<ClosePositionIxData> {
  const { position } = bundledPosition;

  info('Creating close instruction data for position:', position.getAddress());

  const decreaseLiquidityIxData = !excludeDecreaseLiquidity
    ? await _genEmptyLiquidityIxData(position)
    : undefined;

  const collectFeesRewardsIxData = !excludeCollectFeesRewards
    ? await _genCollectFeesRewardsIxData(position)
    : undefined;

  const closePositionIx = await _genClosePositionIx(bundledPosition);

  return {
    ...closePositionIx,
    collectFeesRewardsIxData,
    decreaseLiquidityIxData,
    debugData: {
      name: 'Close Position',
      whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
      position: position.getAddress().toBase58(),
    }
  };
}

/**
 * Generates a {@link DecreaseLiquidityIx} for emptying the liquidity in the given {@link Position}.
 *
 * @param position The {@link Position} to decrease the liquidity of.
 * @returns A {@link Promise} that resolves to the {@link DecreaseLiquidityIx}.
 * If the position has no liquidity, returns `undefined`.
 */
async function _genEmptyLiquidityIxData(position: Position): Promise<DecreaseLiquidityIxData | undefined> {
  const { liquidity } = position.getData();

  if (!liquidity.isZero()) {
    return await genDecreaseLiquidityIxData(position, liquidity);
  }

  info('No liquidity to decrease:', {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  });
  return undefined;
}

/**
 * Generates a {@link CollectFeesRewardsIxData} for collecting fees and rewards from the given {@link Position}.
 *
 * @param position The {@link Position} to collect fees and rewards from.
 * @returns A {@link Promise} that resolves to the {@link CollectFeesRewardsIxData}.
 * If there are no fees or rewards to collect, returns `undefined`.
 */
async function _genCollectFeesRewardsIxData(position: Position): Promise<CollectFeesRewardsIxData | undefined> {
  const collectFeesRewardsIxData = await genCollectFeesRewardsIxData(position, false);

  if (collectFeesRewardsIxData.collectFeesIx || collectFeesRewardsIxData.collectRewardsIxs.length) {
    return collectFeesRewardsIxData;
  }

  info('No fees or rewards to collect:', {
    whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
    position: position.getAddress().toBase58(),
  });
  return undefined;
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
  closePositionIxData,
  signature
}: ClosePositionTxSummaryArgs): Promise<ClosePositionTxSummary> {
  const { collectFeesRewardsIxData, decreaseLiquidityIxData } = closePositionIxData;
  const txSummary = await getTransactionSummary(signature);

  const closePositionTxSummary: ClosePositionTxSummary = {
    bundledPosition,
    collectFeesRewardsTxSummary: undefined,
    decreaseLiquidityTxSummary: undefined,
    signature,
    fee: txSummary.fee,
  };

  if (decreaseLiquidityIxData) {
    const decreaseLiquidityQuote = decreaseLiquidityIxData.quote;
    const liquidityTxSummary = await genLiquidityTxSummary(bundledPosition.position, signature, decreaseLiquidityQuote);
    liquidityTxSummary.fee = 0; // Fee is included in close position tx fee
    closePositionTxSummary.decreaseLiquidityTxSummary = liquidityTxSummary;
  }

  if (collectFeesRewardsIxData) {
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
