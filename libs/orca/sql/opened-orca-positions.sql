SELECT
  price_margin,
  *
FROM orca_position
WHERE close_solana_tx IS NULL
ORDER BY price_margin ASC, id DESC;
