import FeeRewardTxDAO from '@/data/fee-reward-tx/fee-reward-tx.dao';
import LiquidityTxDAO from '@/data/liquidity-tx/liquidity-tx.dao';
import PositionDAO from '@/data/position/position.dao';
import type { BundledPosition } from '@/interfaces/position.interfaces';
import { collectFeesRewards, genCollectFeesRewardsTx, genFeesRewardsTxSummary } from '@/services/fees-rewards/collect/collect-fees-rewards';
import { decreaseLiquidity, genDecreaseLiquidityTx } from '@/services/liquidity/decrease/decrease-liquidity';
import { genLiquidityTxSummary } from '@/services/liquidity/util/liquidity';
import { getPositions } from '@/services/position/query/query-position';
import { debug, error, info } from '@/util/log/log';
import rpc from '@/util/rpc/rpc';
import { executeTransaction } from '@/util/transaction/transaction';
import wallet from '@/util/wallet/wallet';
import whirlpoolClient, { formatWhirlpool } from '@/util/whirlpool/whirlpool';
import { TransactionBuilder, type Address } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, WhirlpoolIx, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import type { ClosePositionOptions, GenClosePositionTxResult } from './close-position.interfaces';

// TODO: Improve efficiency by consolidating collect, decrease liquidity, and close transactions.

/**
 * Closes all {@link Position}s in a {@link Whirlpool}.
 *
 * @param whirlpoolAddress The {@link Address} of the {@link Whirlpool} to close all positions in.
 * @returns A {@link Promise} that resolves once all positions are closed.
 */
export async function closeAllPositions(whirlpoolAddress: Address): Promise<void> {
  info('\n-- Close All Positions --');

  const bundledPositions = await getPositions({ whirlpoolAddress });

  bundledPositions.length
    ? info(`Closing ${bundledPositions.length} positions in whirlpool:`, whirlpoolAddress)
    : info('No positions to close in whirlpool:', whirlpoolAddress);

  const promises = bundledPositions.map(
    (bundledPosition) => closePosition({ bundledPosition })
      .catch((err) => error(err))
  );

  await Promise.all(promises);
}

/**
 * Closes a {@link Position} in a {@link Whirlpool}.
 *
 * @param bundledPosition The {@link BundledPosition} to close.
 * @returns A {@link Promise} that resolves once the position is closed.
 */
export async function closePosition({
  bundledPosition,
  excludeCollectFeesRewards = false,
  excludeDecreaseLiquidity = false,
  separateTxs = false,
}: ClosePositionOptions): Promise<void> {
  const { position } = bundledPosition;

  info('\n-- Close Position --');

  if (separateTxs) {
    if (!excludeDecreaseLiquidity) {
      const { liquidity } = position.getData();

      !liquidity.isZero()
        ? await decreaseLiquidity(position, liquidity)
        : info('No liquidity to decrease:', {
          whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
          position: position.getAddress().toBase58(),
        });
    }

    if (!excludeCollectFeesRewards) {
      await collectFeesRewards(position);
    }
  }

  const { feesRewardsTx, decreaseLiquidityTx, tx } = await genClosePositionTx({
    bundledPosition,
    excludeCollectFeesRewards: excludeCollectFeesRewards || separateTxs,
    excludeDecreaseLiquidity: excludeDecreaseLiquidity || separateTxs,
  });

  const signature = await executeTransaction(tx, {
    name: 'Close Position',
    position: position.getAddress().toBase58(),
  });

  if (decreaseLiquidityTx) {
    const feesRewardsTxSummary = await genFeesRewardsTxSummary(position, signature);
    await FeeRewardTxDAO.insert(feesRewardsTxSummary);
  }

  if (feesRewardsTx) {
    const liquidityTxSummary = await genLiquidityTxSummary(position, signature);
    await LiquidityTxDAO.insert(liquidityTxSummary);
  }

  await PositionDAO.updateClosed(position, signature, { catchErrors: true });

  info('Position closed:', position.getAddress());
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
}: ClosePositionOptions): Promise<GenClosePositionTxResult> {
  const { bundleIndex, position, positionBundle } = bundledPosition;
  const result: GenClosePositionTxResult = { tx: new TransactionBuilder(rpc(), wallet()) };

  info('Creating close position transaction for position:', position.getAddress());

  if (!excludeDecreaseLiquidity) {
    const { liquidity } = position.getData();

    if (!liquidity.isZero()) {
      const { tx: decreaseLiquidityTx } = await genDecreaseLiquidityTx(position, liquidity);
      result.decreaseLiquidityTx = decreaseLiquidityTx;
      result.tx.addInstruction(decreaseLiquidityTx.compressIx(true));
    } else {
      info('No liquidity to decrease:', {
        whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
        position: position.getAddress().toBase58(),
      });
    }
  }

  if (!excludeCollectFeesRewards) {
    const { feesQuote, rewardsQuote, tx } = await genCollectFeesRewardsTx(position, false); // false no update fees and rewards
    const hasFees = !feesQuote.feeOwedA.isZero() || !feesQuote.feeOwedB.isZero();
    const hasRewards = rewardsQuote.rewardOwed.some((reward) => reward && !reward.isZero());

    if (hasFees || hasRewards) {
      result.feesRewardsTx = tx;
      result.tx.addInstruction(tx.compressIx(true));
    } else {
      info('No fees or rewards to collect:', {
        whirlpool: await formatWhirlpool(position.getWhirlpoolData()),
        position: position.getAddress().toBase58(),
      });
    }
  }

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

  const closeBundledPositionIx = WhirlpoolIx.closeBundledPositionIx(
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
  result.tx.addInstruction(closeBundledPositionIx);

  return result;
}

export type * from './close-position.interfaces';
