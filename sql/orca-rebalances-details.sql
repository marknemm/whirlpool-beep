SELECT
  token_a.symbol                                                    AS token_a
  ,token_b.symbol                                                   AS token_b
  ,whirlpool.tick_spacing                                           AS tick_spacing
  ,whirlpool.fee_rate / (10 ^ 4)                                    AS fee_rate
  ,position.price_margin
  ,position.price_lower / (10 ^ token_b.decimals)                   AS price_lower
  ,position.price_upper / (10 ^ token_b.decimals)                   AS price_upper
  ,TO_CHAR(open_tx.created_at, 'MM/DD HH:MI')                       AS opened
  ,TO_CHAR(close_tx.created_at, 'MM/DD HH:MI')                      AS closed
  ,AGE(close_tx.created_at, open_tx.created_at)                     AS duration
  ,liquidity_deposit.token_amount_a / (10 ^ token_a.decimals)       AS a_deposit
  ,liquidity_deposit.token_amount_b / (10 ^ token_b.decimals)       AS b_deposit
  ,liquidity_deposit.usd                                            AS usd_deposit
  ,liquidity_withdraw.token_amount_a / (10 ^ token_a.decimals) * -1 AS a_withdraw
  ,liquidity_withdraw.token_amount_b / (10 ^ token_b.decimals) * -1 AS b_withdraw
  ,liquidity_withdraw.usd * -1                                      AS usd_withdraw
  ,fee_reward.token_amount_a / (10 ^ token_a.decimals)              AS a_collect
  ,fee_reward.token_amount_b / (10 ^ token_b.decimals)              AS b_collect
  ,fee_reward.usd                                                   AS usd_collect
  ,(open_tx.fee + close_tx.fee) / (10 ^ 9)                          AS tx_fee_sol
  ,(
    (liquidity_withdraw.token_amount_a * -1)
    - liquidity_deposit.token_amount_a
    + fee_reward.token_amount_a
  ) / (10 ^ token_a.decimals)                                       AS a_net
  ,(
    (liquidity_withdraw.token_amount_b * -1)
    - liquidity_deposit.token_amount_b
    + fee_reward.token_amount_b
  ) / (10 ^ token_b.decimals)                                       AS b_net
FROM orca_position as position
INNER JOIN solana_tx AS open_tx
  ON position.open_solana_tx = open_tx.id
INNER JOIN solana_tx AS close_tx
  ON position.close_solana_tx = close_tx.id
INNER JOIN (
  SELECT
    position
    ,SUM(token_amount_a) AS token_amount_a
    ,SUM(token_amount_b) AS token_amount_b
    ,SUM(usd) AS usd
  FROM orca_liquidity
  WHERE usd > 0
  GROUP BY position
) AS liquidity_deposit
  ON position.id = liquidity_deposit.position
INNER JOIN (
  SELECT
    position
    ,SUM(token_amount_a) AS token_amount_a
    ,SUM(token_amount_b) AS token_amount_b
    ,SUM(usd) AS usd
  FROM orca_liquidity
  WHERE usd < 0
  GROUP BY position
) AS liquidity_withdraw
  ON position.id = liquidity_withdraw.position
INNER JOIN (
  SELECT
    position
    ,SUM(token_amount_a) AS token_amount_a
    ,SUM(token_amount_b) AS token_amount_b
    ,SUM(usd) AS usd
  FROM orca_fee
  GROUP BY position
) AS fee_reward
  ON position.id = fee_reward.position
INNER JOIN orca_whirlpool AS whirlpool
  ON position.whirlpool = whirlpool.id
INNER JOIN solana_token AS token_a
  ON whirlpool.token_a = token_a.id
INNER JOIN solana_token AS token_b
  ON whirlpool.token_b = token_b.id
WHERE position.id NOT IN (
  SELECT position.id
  FROM orca_position AS position
  INNER JOIN orca_liquidity AS liquidity
    ON position.id = liquidity.position
  GROUP BY position.id
  HAVING COUNT(liquidity.id) % 2 = 1
)
ORDER BY open_tx.created_at DESC;
