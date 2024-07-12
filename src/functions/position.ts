import { info } from '@/util/log';

/**
 * Entrypoint for the `serverless` rebalance cloud function.
 */
export async function rebalance() {
  info(`Your cron function ran at ${new Date()}`);
}
