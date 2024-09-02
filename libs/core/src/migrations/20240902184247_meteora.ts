import { type Kysely, sql } from 'kysely';

/**
 * Initialize all Meteora tables.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.createTable('meteora_pool').ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('address', 'varchar(255)', (col) => col.unique().notNull())
    .addColumn('bin_step', 'int2', (col) => col.notNull())
    .addColumn('base_fee_percentage', 'numeric(10, 5)', (col) => col.notNull())
    .addColumn('max_fee_percentage', 'numeric(10, 5)', (col) => col.notNull())
    .addColumn('token_x', 'integer', (col) => col.references('solana_token.id').notNull())
    .addColumn('token_y', 'integer', (col) => col.references('solana_token.id').notNull())
    .addColumn('reserve_x', 'varchar(255)', (col) => col.notNull())
    .addColumn('reserve_y', 'varchar(255)', (col) => col.notNull())
		.execute();

  await db.schema.createIndex('meteora_pool_token_x_token_y_bin_step').ifNotExists()
    .on('meteora_pool')
    .columns(['token_x', 'token_y', 'bin_step'])
    .unique()
		.execute();

  await db.schema.createTable('meteora_position').ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('address', 'varchar(255)', (col) => col.notNull())
		.addColumn('close_tx', 'integer', (col) => col.references('solana_tx.id'))
    .addColumn('max_bin_id', 'integer', (col) => col.notNull())
    .addColumn('pool', 'integer', (col) => col.references('meteora_pool.id').notNull())
    .addColumn('min_bin_id', 'integer', (col) => col.notNull())
    .addColumn('open_tx', 'integer', (col) => col.references('solana_tx.id').notNull())
    .addColumn('price_lower', 'bigint', (col) => col.notNull())
    .addColumn('price_margin', 'integer', (col) => col.notNull())
    .addColumn('price_origin', 'bigint', (col) => col.notNull())
    .addColumn('price_upper', 'bigint', (col) => col.notNull())
		.execute();

  await db.schema.createIndex('meteora_position_address').ifNotExists()
    .on('meteora_position')
    .columns(['address'])
    .execute();

  await db.schema.createTable('meteora_liquidity').ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('liquidity', 'bigint', (col) => col.notNull())
    .addColumn('liquidity_unit', 'varchar(255)', (col) => col.notNull())
    .addColumn('position', 'integer', (col) => col.references('meteora_position.id').notNull())
    .addColumn('token_amount_x', 'bigint', (col) => col.notNull())
    .addColumn('token_amount_y', 'bigint', (col) => col.notNull())
    .addColumn('tx', 'integer', (col) => col.references('solana_tx.id').notNull())
    .addColumn('usd', 'numeric(14, 2)', (col) => col.notNull())
    .execute();

  // TODO: Add field(s) for rewards.
  await db.schema.createTable('meteora_fee').ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('position', 'integer', (col) => col.references('meteora_position.id').notNull())
    .addColumn('token_amount_x', 'bigint', (col) => col.notNull())
    .addColumn('token_amount_y', 'bigint', (col) => col.notNull())
    .addColumn('tx', 'integer', (col) => col.references('solana_tx.id').notNull())
    .addColumn('usd', 'numeric(14, 2)', (col) => col.notNull())
    .execute();

  await db.schema.createTable('meteora_rebalance').ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('position_old', 'integer', (col) => col.references('meteora_position.id').notNull())
    .addColumn('position_new', 'integer', (col) => col.references('meteora_position.id').notNull())
    .execute();
}

/**
 * Drop all Meteora tables.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('meteora_rebalance').ifExists().execute();
  await db.schema.dropTable('meteora_fee').ifExists().execute();
  await db.schema.dropTable('meteora_liquidity').ifExists().execute();
  await db.schema.dropIndex('meteora_position_address').ifExists().execute();
  await db.schema.dropTable('meteora_position').ifExists().execute();
  await db.schema.dropIndex('meteora_pool_token_x_token_y_bin_step').ifExists().execute();
  await db.schema.dropTable('meteora_pool').ifExists().execute();
}
