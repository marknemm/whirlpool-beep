/**
 * Entrypoint for the `serverless` rebalance cloud function.
 */
export async function rebalance() {
  // Load and validate environment variables
  const { loadSSMParams } = await import('@npc/core');
  await loadSSMParams();
  const { env } = await import('@npc/orca/util/env/env');

  // Initialize Orca configuration
  const { Config } = await import('@npc/orca/util/config/config');
  await Config.init();

  // Load other dependencies
  const {
    genPriceRangeRebalanceFilter,
    rebalanceAllPositions
  } = await import('@npc/orca/services/position/rebalance/rebalance-position');

  // Rebalance all positions
  await rebalanceAllPositions({
    filter: genPriceRangeRebalanceFilter(),
    liquidity: env.INCREASE_LIQUIDITY,
    liquidityUnit: env.INCREASE_LIQUIDITY_UNIT
  });
}
