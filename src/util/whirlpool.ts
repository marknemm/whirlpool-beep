import anchor from '@/util/anchor';
import { debug, info } from '@/util/log';
import rpc from '@/util/rpc';
import { TransactionBuilder } from '@orca-so/common-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID, WhirlpoolClient, WhirlpoolContext, buildWhirlpoolClient } from '@orca-so/whirlpools-sdk';

export * from '@/interfaces/whirlpool';

let _whirlpoolClient: WhirlpoolClient;

/**
 * Gets the singleton {@link WhirlpoolClient}, and initializes it if it has not already been initialized.
 *
 * @returns The {@link WhirlpoolClient} singleton.
 */
export default function whirlpoolClient(): WhirlpoolClient {
  if (!_whirlpoolClient) {
    const ctx = WhirlpoolContext.withProvider(anchor(), ORCA_WHIRLPOOL_PROGRAM_ID);

    _whirlpoolClient = buildWhirlpoolClient(ctx);

    info('-- Initialized Whirlpool Client --');
  }

  return _whirlpoolClient;
}

/**
 * Signs a transaction payload with the {@link WhirlpoolClient}'s {@link AnchorProvider}, and sends it out.
 *
 * @param tx The {@link TransactionBuilder} containing the transaction instructions to send.
 * @returns A {@link Promise} that resolves once the transaction is complete.
 * @throws An {@link Error} if the transaction fails to complete.
 */
export async function sendTx(tx: TransactionBuilder): Promise<void> {
  // Sign and send transaction
  const signature = await tx.buildAndExecute();
  debug('Tx Signature:', signature);

  // Wait for the transaction to complete
  const latestBlockhash = await rpc().getLatestBlockhash();
  const confirmResponse = await rpc().confirmTransaction({ signature, ...latestBlockhash }, 'confirmed');

  if (confirmResponse.value.err) {
    throw new Error(confirmResponse.value.err.toString());
  }
}
