import { anchor, rpc } from '@/util/anchor';
import { lamportsToSol } from '@/util/currency';
import { debug } from '@/util/log';

/**
 * Queries the wallet account balance.
 *
 * @returns A {@link Promise} that resolves to the wallet account balance (SOL).
 */
export async function getBalance(): Promise<number> {
  const lamports = await rpc.getBalance(anchor.publicKey);
  const sol = lamportsToSol(lamports);

  debug('Wallet balance: %s %s', sol, 'SOL');
  return sol;
}
