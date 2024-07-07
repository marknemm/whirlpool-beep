import { BundledPosition } from '@/interfaces/position';
import { collectFeesRewards } from '@/services/position/collect-fees-rewards';
import anchor from '@/util/anchor';
import { info } from '@/util/log';
import rpc, { verifyTransaction } from '@/util/rpc';
import whirlpoolClient from '@/util/whirlpool-client';
import { TransactionBuilder } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, WhirlpoolIx, type Position } from '@orca-so/whirlpools-sdk';
import { PublicKey } from '@solana/web3.js';
import { getWalletNFTAccount } from '../wallet/get-token-account';
import { decreaseLiquidity } from './decrease-liquidity';

/**
 * Closes a {@link Position} in a {@link Whirlpool}.
 *
 * @param bundledPosition The {@link BundledPosition} to close.
 * @returns A {@link Promise} that resolves once the position is closed.
 */
export async function closePosition(bundledPosition: BundledPosition): Promise<void> {
  info('\n-- Close Position --');

  const { bundleIndex, position, positionBundle } = bundledPosition;

  await collectFeesRewards(position);

  if (!position.getData().liquidity.isZero()) {
    await decreaseLiquidity(position, position.getData().liquidity);
  }

  const positionBundleATA = await getWalletNFTAccount(positionBundle.positionBundleMint);
  if (!positionBundleATA) throw new Error('Position bundle token account (ATA) cannot be found');

  const positionBundlePda = PDAUtil.getPositionBundle(ORCA_WHIRLPOOL_PROGRAM_ID, positionBundle.positionBundleMint);

  const closeBundledPositionIx = WhirlpoolIx.closeBundledPositionIx(
    whirlpoolClient().getContext().program,
    {
      bundledPosition: position.getAddress(),
      positionBundleAuthority: anchor().wallet.publicKey,
      positionBundleTokenAccount: new PublicKey(positionBundleATA.address),
      positionBundle: positionBundlePda.publicKey,
      bundleIndex,
      receiver: anchor().wallet.publicKey,
    }
  );

  const tx = new TransactionBuilder(rpc(), anchor().wallet);
  tx.addInstruction(closeBundledPositionIx);

  info('Executing close position transaction...');
  const signature = await tx.buildAndExecute();
  await verifyTransaction(signature);

  info('Position closed:', position.getAddress().toBase58());
}
