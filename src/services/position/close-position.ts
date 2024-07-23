import PositionDAO from '@/data/position-dao';
import type { BundledPosition } from '@/interfaces/position';
import { collectFeesRewards } from '@/services/position/collect-fees-rewards';
import { decreaseLiquidity } from '@/services/position/decrease-liquidity';
import { getPositions } from '@/services/position/get-position';
import { error, info } from '@/util/log';
import rpc from '@/util/rpc';
import { executeTransaction } from '@/util/transaction';
import wallet from '@/util/wallet';
import whirlpoolClient from '@/util/whirlpool';
import { TransactionBuilder, type Address } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, WhirlpoolIx, type Position, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';

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
    (bundledPosition) => closePosition(bundledPosition)
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
export async function closePosition(bundledPosition: BundledPosition): Promise<void> {
  info('\n-- Close Position --');

  await collectFeesRewards(bundledPosition.position);
  if (!bundledPosition.position.getData().liquidity.isZero()) {
    await decreaseLiquidity(bundledPosition.position, bundledPosition.position.getData().liquidity);
  }

  const tx = await genClosePositionTx(bundledPosition);

  info('Executing close position transaction...');
  const signature = await executeTransaction(tx);
  await PositionDAO.updateClosed(bundledPosition.position, signature, { catchErrors: true });

  info('Position closed:', bundledPosition.position.getAddress());
}

/**
 * Creates a transaction to close a {@link Position} in a {@link Whirlpool}.
 *
 * @param bundledPosition The {@link BundledPosition} to close.
 * @returns A {@link Promise} that resolves to the {@link TransactionBuilder}.
 */
export async function genClosePositionTx(bundledPosition: BundledPosition): Promise<TransactionBuilder> {
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
