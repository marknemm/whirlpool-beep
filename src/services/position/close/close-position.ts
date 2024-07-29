import PositionDAO from '@/data/position/position.dao';
import type { BundledPosition } from '@/interfaces/position.interfaces';
import { collectFeesRewards } from '@/services/fees-rewards/collect/collect-fees-rewards';
import { decreaseLiquidity } from '@/services/liquidity/decrease/decrease-liquidity';
import { getPositions } from '@/services/position/query/query-position';
import { error, info } from '@/util/log/log';
import rpc from '@/util/rpc/rpc';
import { executeTransaction } from '@/util/transaction/transaction';
import wallet from '@/util/wallet/wallet';
import whirlpoolClient from '@/util/whirlpool/whirlpool';
import { TransactionBuilder, type Address } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, WhirlpoolIx, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import type { ClosePositionOptions } from './close-position.interfaces';

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
  info('\n-- Close Position --');

  if (!bundledPosition.position.getData().liquidity.isZero()) {
    await decreaseLiquidity(bundledPosition.position, bundledPosition.position.getData().liquidity);
  }

  await collectFeesRewards(bundledPosition.position);

  const tx = await genClosePositionTx({
    bundledPosition,
    excludeCollectFeesRewards,
    excludeDecreaseLiquidity,
  });

  const signature = await executeTransaction(tx, {
    name: 'Close Position',
    position: bundledPosition.position.getAddress().toBase58(),
  });
  await PositionDAO.updateClosed(bundledPosition.position, signature, { catchErrors: true });

  info('Position closed:', bundledPosition.position.getAddress());
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
}: ClosePositionOptions): Promise<TransactionBuilder> {
  const { bundleIndex, position, positionBundle } = bundledPosition;

  info('Creating close position transaction for position:', position.getAddress());

  const positionBundleATA = await wallet().getNFTAccount(positionBundle.positionBundleMint);
  if (!positionBundleATA) throw new Error('Position bundle token account (ATA) cannot be found');

  const positionBundlePda = PDAUtil.getPositionBundle(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    positionBundle.positionBundleMint
  );

  const closeBundledPositionIx = WhirlpoolIx.closeBundledPositionIx(
    whirlpoolClient().getContext().program,
    {
      bundledPosition: position.getAddress(),
      positionBundleAuthority: wallet().publicKey,
      positionBundleTokenAccount: new PublicKey(positionBundleATA.address),
      positionBundle: positionBundlePda.publicKey,
      bundleIndex,
      receiver: wallet().publicKey,
    }
  );

  return new TransactionBuilder(rpc(), wallet())
    .addInstruction(closeBundledPositionIx);
}

export type * from './close-position.interfaces';
