import anchor from '@/util/anchor';
import { toSol } from '@/util/currency';
import { debug } from '@/util/log';

/**
 * Queries the wallet account balance.
 *
 * @returns A {@link Promise} that resolves to the wallet account balance (SOL).
 */
export async function getBalance(): Promise<number> {
  const lamports = await anchor().connection.getBalance(anchor().publicKey);
  const sol = toSol(lamports);

  debug('Wallet balance:', sol, 'SOL');
  return sol;
}
