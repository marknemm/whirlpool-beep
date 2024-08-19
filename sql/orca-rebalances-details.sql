SELECT
  position.price_margin
  ,position.price_lower::float / (10 ^ token_b.decimals) AS price_lower
  ,position.price_upper::float / (10 ^ token_b.decimals) AS price_upper
  ,TO_CHAR(open_tx.created_at, 'MM/DD HH:MI') AS opened
  ,TO_CHAR(close_tx.created_at, 'MM/DD HH:MI') AS closed
  ,AGE(open_tx.created_at, close_tx.created_at) AS duration
  ,liquidity_deposit.id
  ,liquidity_deposit.token_amount_a::float / (10 ^ token_a.decimals) AS sol_deposit
  ,liquidity_deposit.token_amount_b::float / (10 ^ token_b.decimals) AS usdc_deposit
  ,liquidity_deposit.usd AS usd_deposit
  ,liquidity_withdraw.token_amount_a::float / (10 ^ token_a.decimals) * -1 AS sol_withdraw
  ,liquidity_withdraw.token_amount_b::float / (10 ^ token_b.decimals) * -1 AS usdc_withdraw
  ,liquidity_withdraw.usd * -1 AS usd_withdraw
  ,fee_reward.token_amount_a::float / (10 ^ token_a.decimals) AS sol_collected
  ,fee_reward.token_amount_b::float / (10 ^ token_b.decimals) AS usdc_collected
  ,fee_reward.usd AS usd_collected
  ,(open_tx.fee + close_tx.fee)::float / (10 ^ 9) AS tx_fee_sol
  ,((liquidity_withdraw.token_amount_a * -1) - liquidity_deposit.token_amount_a + fee_reward.token_amount_a - (open_tx.fee + close_tx.fee)) / (10 ^ token_a.decimals) AS sol_net
  ,((liquidity_withdraw.token_amount_b * -1) - liquidity_deposit.token_amount_b + fee_reward.token_amount_b) / (10 ^ token_b.decimals)  AS usdc_net
FROM orca_position as position
INNER JOIN solana_tx AS open_tx
  ON position.open_solana_tx = open_tx.id
INNER JOIN solana_tx AS close_tx
  ON position.close_solana_tx = close_tx.id
INNER JOIN orca_liquidity AS liquidity_deposit
  ON position.id = liquidity_deposit.position AND liquidity_deposit.usd > 0
INNER JOIN orca_liquidity AS liquidity_withdraw
  ON position.id = liquidity_withdraw.position AND liquidity_withdraw.usd < 0
INNER JOIN orca_fee AS fee_reward
  ON position.id = fee_reward.position
INNER JOIN orca_whirlpool AS whirlpool
  ON position.whirlpool = whirlpool.id
INNER JOIN solana_token AS token_a
  ON whirlpool.token_a = token_a.id
INNER JOIN solana_token AS token_b
  ON whirlpool.token_b = token_b.id
ORDER BY open_tx.created_at
