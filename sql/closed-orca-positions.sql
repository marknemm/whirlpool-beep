SELECT *
FROM orca_position
WHERE close_solana_tx IS NOT NULL
ORDER BY id DESC;
