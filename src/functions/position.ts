/**
 * Entrypoint for the `serverless` rebalance cloud function.
 */
export async function rebalance() {
  // Load and validate environment variables.
  const { loadSSMParams } = await import('@/util/ssm/ssm');
  await loadSSMParams();
  const env = (await import('@/util/env/env')).default;

  // Load other dependencies.
  const { info } = await import('@/util/log/log');
  const {
    genPriceRangeRebalanceFilter,
    rebalanceAllPositions
  } = await import('@/services/position/rebalance/rebalance-position');

  info('Environment variables loaded and validated:', { ...env }, '\n');

  await rebalanceAllPositions({
    filter: genPriceRangeRebalanceFilter(),
    liquidity: env.INCREASE_LIQUIDITY,
    liquidityUnit: env.INCREASE_LIQUIDITY_UNIT
  });
}
