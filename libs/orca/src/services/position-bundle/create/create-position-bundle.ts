import { debug, expBackoff, info } from '@npc/core';
import whirlpoolClient from '@npc/orca/util/whirlpool/whirlpool.js';
import { rpc, TransactionContext, wallet } from '@npc/solana';
import { TransactionBuilder } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, type PositionBundleData, WhirlpoolIx } from '@orca-so/whirlpools-sdk';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { Keypair, type PublicKey } from '@solana/web3.js';
import { CreatePositionBundleIxData } from './create-position-bundle.interfaces.js';

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

  const transactionCtx = new TransactionContext();

  // Generate instruction data for creating position bundle
  const ixData = await genCreatePositionBundleIxData();
  const positionBundleKey = ixData.positionBundlePda.publicKey;

  // Send transaction to create position bundle
  await transactionCtx
    .resetInstructionData(ixData)
    .send();

  // Get and return position bundle data
  const positionBundle = await expBackoff(() =>
    whirlpoolClient().getFetcher().getPositionBundle(positionBundleKey)
  );
  if (!positionBundle) throw new Error('Could not retrieve position bundle data after initialization');
  return positionBundle;
}

/**
 * Creates {@link CreatePositionBundleIxData} to initialize a position bundle.
 *
 * @returns A {@link Promise} that resolves to the {@link CreatePositionBundleIxData}.
 */
export async function genCreatePositionBundleIxData(): Promise<CreatePositionBundleIxData> {
  info('Creating Tx to initialize position bundle...');

  // Generate keypair and PDAs for position bundle
  const positionBundleMintKeypair = Keypair.generate();
  const positionBundlePda = PDAUtil.getPositionBundle(ORCA_WHIRLPOOL_PROGRAM_ID, positionBundleMintKeypair.publicKey);
  const positionBundleMetadataPda = PDAUtil.getPositionBundleMetadata(positionBundleMintKeypair.publicKey);
  const positionBundleTokenAccount = await getAssociatedTokenAddress(
    positionBundleMintKeypair.publicKey,
    wallet().publicKey
  );

  debug('Tx details for create position bundle:', {
    funder: wallet().publicKey.toBase58(),
    owner: wallet().publicKey.toBase58(),
    positionBundleMint: positionBundleMintKeypair.publicKey.toBase58(),
    positionBundle: positionBundlePda.publicKey.toBase58(),
    positionBundleMetadata: positionBundleMetadataPda.publicKey.toBase58(),
    positionBundleTokenAccount: positionBundleTokenAccount.toBase58(),
  });

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

  const tx = new TransactionBuilder(rpc(), wallet());
  tx.addInstruction(initPositionBundleIx);

  info('Created Tx to initialize position bundle:', {
    positionBundle: positionBundlePda.publicKey.toBase58(),
    positionBundleMetadata: positionBundleMetadataPda.publicKey.toBase58(),
    positionBundleMint: positionBundleMintKeypair.publicKey.toBase58(),
    positionBundleTokenAccount: positionBundleTokenAccount.toBase58(),
  });

  return {
    ...initPositionBundleIx,
    owner: wallet().publicKey,
    positionBundleMintKeypair,
    positionBundlePda,
    positionBundleMetadataPda,
    positionBundleTokenAccount,
    debugData: {
      name: 'Create Position Bundle',
      positionBundle: positionBundlePda.publicKey.toBase58()
    }
  };
}

export type * from './create-position-bundle.interfaces.js';
