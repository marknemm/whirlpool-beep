import anchor from '@/util/anchor';
import { debug, info } from '@/util/log';
import rpc, { verifyTransaction } from '@/util/rpc';
import whirlpoolClient from '@/util/whirlpool-client';
import { TransactionBuilder } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PositionBundleData, WhirlpoolIx } from '@orca-so/whirlpools-sdk';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { Keypair, PublicKey } from '@solana/web3.js';

/**
 * Creates a position bundle.
 *
 * @returns A {@link Promise} that resolves to the {@link PublicKey} (address) of the position bundle.
 * @throws An {@link Error} if the position bundle initialization fails to complete.
 */
export async function createPositionBundle(): Promise<PositionBundleData | null> {
  const positionBundleMintKeypair = Keypair.generate();
  const positionBundlePda = PDAUtil.getPositionBundle(ORCA_WHIRLPOOL_PROGRAM_ID, positionBundleMintKeypair.publicKey);
  const positionBundleMetadataPda = PDAUtil.getPositionBundleMetadata(positionBundleMintKeypair.publicKey);
  const positionBundleTokenAccount = await getAssociatedTokenAddress(
    positionBundleMintKeypair.publicKey,
    anchor().wallet.publicKey
  );

  const initPositionBundleIx = WhirlpoolIx.initializePositionBundleWithMetadataIx(
    whirlpoolClient().getContext().program,
    {
      funder: anchor().wallet.publicKey,
      owner: anchor().wallet.publicKey,
      positionBundleMintKeypair,
      positionBundlePda,
      positionBundleMetadataPda,
      positionBundleTokenAccount,
    }
  );

  const txBuilder = new TransactionBuilder(rpc(), anchor().wallet);
  txBuilder.addInstruction(initPositionBundleIx);

  debug('Initializing position bundle...');
  const signature = await txBuilder.buildAndExecute();
  await verifyTransaction(signature);
  info('Position bundle initialized with address:', positionBundlePda.publicKey.toBase58());
  info('Position bundle mint:', positionBundleMintKeypair.publicKey.toBase58());

  return whirlpoolClient().getFetcher().getPositionBundle(positionBundlePda.publicKey);
}
