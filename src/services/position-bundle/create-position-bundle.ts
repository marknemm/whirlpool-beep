import { debug, info } from '@/util/log';
import rpc, { verifyTransaction } from '@/util/rpc';
import wallet from '@/util/wallet';
import whirlpoolClient from '@/util/whirlpool';
import { TransactionBuilder } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PositionBundleData, WhirlpoolIx } from '@orca-so/whirlpools-sdk';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { Keypair, PublicKey } from '@solana/web3.js';

/**
 * Creates a position bundle.
 *
 * A position bundle encompasses ownership of multiple positions using only a single NFT.
 * This renders management of multiple positions more cost-effective since rent cannot be refunded for NFTs.
 *
 * The position bundle is created with the following linked accounts:
 * - Mint: The mint account for the position bundle.
 * - Position Bundle: The position bundle account.
 * - Metadata: The metadata account for the position bundle.
 * - Token Account: The associated token account (`ATA`) for the position bundle.
 *
 * @returns A {@link Promise} that resolves to the {@link PublicKey} (address) of the position bundle.
 * @throws An {@link Error} if the position bundle initialization fails to complete.
 */
export async function createPositionBundle(): Promise<PositionBundleData> {
  info('\n-- Create Position Bundle --');

  // Generate keypair and PDAs for position bundle
  const positionBundleMintKeypair = Keypair.generate();
  const positionBundlePda = PDAUtil.getPositionBundle(ORCA_WHIRLPOOL_PROGRAM_ID, positionBundleMintKeypair.publicKey);
  const positionBundleMetadataPda = PDAUtil.getPositionBundleMetadata(positionBundleMintKeypair.publicKey);
  const positionBundleTokenAccount = await getAssociatedTokenAddress(
    positionBundleMintKeypair.publicKey,
    wallet().publicKey
  );

  // Create instruction
  const initPositionBundleIx = WhirlpoolIx.initializePositionBundleWithMetadataIx(
    whirlpoolClient().getContext().program,
    {
      funder: wallet().publicKey,
      owner: wallet().publicKey,
      positionBundleMintKeypair,
      positionBundlePda,
      positionBundleMetadataPda,
      positionBundleTokenAccount,
    }
  );

  // Crate transaction
  const txBuilder = new TransactionBuilder(rpc(), wallet());
  txBuilder.addInstruction(initPositionBundleIx);

  // Execute and verify transaction
  info('Executing initialize position bundle transaction...');
  const signature = await txBuilder.buildAndExecute();
  await verifyTransaction(signature);
  info('Position bundle initialized with address:', positionBundlePda.publicKey.toBase58());
  info('Position bundle mint:', positionBundleMintKeypair.publicKey.toBase58());

  // Get and return position bundle data
  const positionBundle = await whirlpoolClient().getFetcher().getPositionBundle(positionBundlePda.publicKey);
  if (!positionBundle) throw new Error('Could not retrieve position bundle data after initialization');
  debug('Position bundle:', positionBundle);
  return positionBundle;
}
