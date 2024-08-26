/**
 * Entrypoint for the `serverless` rebalance cloud function.
 */
export async function rebalance() {
  // Load and validate environment variables.
  const { loadSSMParams } = await import('@npc/core');
  await loadSSMParams();
  const { env } = await import('@npc/orca/util/env/env');

  // Load other dependencies.
  const { info } = await import('@npc/core');
  const {
    genPriceRangeRebalanceFilter,
    rebalanceAllPositions
  } = await import('@npc/orca/services/position/rebalance/rebalance-position');

  info('Environment variables loaded and validated:', { ...env }, '\n');

  if (env.DB_MIGRATE) {
    const { migrateDb } = await import('@npc/db');
    await migrateDb();
  }

  await rebalanceAllPositions({
    filter: genPriceRangeRebalanceFilter(),
    liquidity: env.INCREASE_LIQUIDITY,
    liquidityUnit: env.INCREASE_LIQUIDITY_UNIT
  });
}
