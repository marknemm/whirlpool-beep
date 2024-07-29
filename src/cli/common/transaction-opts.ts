import type { CliArgs, CliOpts } from '@/util/cli/cli.interfaces';
import deepmerge from 'deepmerge';

const _transactionCliOpts = {
  'dry-run': {
    alias: 'dry',
    description: 'Perform dry run that simulates the transaction',
    group: 'Transaction',
    type: 'boolean' as const,
  },
};

/**
 * Common CLI arguments for issuing a transaction.
 */
export type TransactionCliArgs = CliArgs<typeof _transactionCliOpts>;

/**
 * Common CLI options for issuing a transaction.
 */
export type TransactionCliOpts = CliOpts<typeof _transactionCliOpts>;

/**
 * Generates the transaction options.
 *
 * @param overrides The override options to merge into the default options.
 * @returns The transaction options.
 */
export function genTransactionCliOpts(
  overrides: Partial<TransactionCliOpts> = {}
): typeof _transactionCliOpts {
  return deepmerge(_transactionCliOpts, overrides);
}
