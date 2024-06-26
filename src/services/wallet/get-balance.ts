import { anchor, rpc } from '@/util/anchor';
import { lamportsToSol } from '@/util/currency';

/**
 * Queries the wallet account balance.
 *
 * @returns A {@link Promise} that resolves to the wallet account balance (SOL).
 */
export async function getBalance(): Promise<number> {
  const lamports = await rpc.getBalance(anchor.publicKey);
  return lamportsToSol(lamports);
}
