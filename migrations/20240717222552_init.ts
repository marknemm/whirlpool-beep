import { type Kysely, sql } from 'kysely';

/**
 * Initialize all tables.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.createTable('token').ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('address', 'varchar(255)', (col) => col.unique().notNull())
    .addColumn('decimals', 'integer', (col) => col.notNull())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('symbol', 'varchar(255)', (col) => col.notNull())
		.execute();

	await db.schema.createIndex('token_symbol').ifNotExists()
		.on('token')
		.columns(['symbol'])
		.execute();

  await db.schema.createTable('whirlpool').ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('address', 'varchar(255)', (col) => col.unique().notNull())
    .addColumn('feeRate', 'numeric', (col) => col.notNull())
    .addColumn('tokenA', 'integer', (col) => col.references('token.id').notNull())
    .addColumn('tokenB', 'integer', (col) => col.references('token.id').notNull())
    .addColumn('tokenVaultA', 'varchar(255)', (col) => col.notNull())
    .addColumn('tokenVaultB', 'varchar(255)', (col) => col.notNull())
    .addColumn('tickSpacing', 'int2', (col) => col.notNull())
		.execute();

  await db.schema.createIndex('whirlpool_token_a_token_b_tickSpacing').ifNotExists()
    .on('whirlpool')
    .columns(['tokenA', 'tokenB', 'tickSpacing'])
    .unique()
		.execute();

  await db.schema.createTable('position').ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('address', 'varchar(255)', (col) => col.notNull())
		.addColumn('closeTx', 'varchar(255)')
    .addColumn('createdAt', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('priceLower', 'bigint', (col) => col.notNull())
    .addColumn('priceMargin', 'integer', (col) => col.notNull())
    .addColumn('priceOrigin', 'bigint', (col) => col.notNull())
    .addColumn('priceUpper', 'bigint', (col) => col.notNull())
    .addColumn('openTx', 'varchar(255)', (col) => col.notNull())
    .addColumn('tickLowerIndex', 'integer', (col) => col.notNull())
    .addColumn('tickUpperIndex', 'integer', (col) => col.notNull())
    .addColumn('whirlpool', 'integer', (col) => col.references('whirlpool.id').notNull())
		.execute();

  await db.schema.createIndex('position_address').ifNotExists()
    .on('position')
    .columns(['address'])
    .execute();

  await db.schema.createTable('liquidityTx').ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('createdAt', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
		.addColumn('fee', 'bigint', (col) => col.notNull())
    .addColumn('position', 'integer', (col) => col.references('position.id').notNull())
    .addColumn('quote', 'json')
    .addColumn('signature', 'varchar(255)', (col) => col.notNull())
    .addColumn('tokenAmountA', 'bigint', (col) => col.notNull())
    .addColumn('tokenAmountB', 'bigint', (col) => col.notNull())
    .addColumn('usd', 'numeric(14, 2)', (col) => col.notNull())
    .execute();

  // TODO: Add field(s) for rewards.
  await db.schema.createTable('feeRewardTx').ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('createdAt', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
		.addColumn('fee', 'bigint', (col) => col.notNull())
    .addColumn('position', 'integer', (col) => col.references('position.id').notNull())
    .addColumn('signature', 'varchar(255)', (col) => col.notNull())
    .addColumn('tokenAmountA', 'bigint', (col) => col.notNull())
    .addColumn('tokenAmountB', 'bigint', (col) => col.notNull())
    .addColumn('usd', 'numeric(14, 2)', (col) => col.notNull())
    .execute();

  await db.schema.createTable('rebalanceTx').ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('createdAt', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('positionOld', 'integer', (col) => col.references('position.id').notNull())
    .addColumn('positionNew', 'integer', (col) => col.references('position.id').notNull())
    .execute();
}

/**
 * Drop all tables.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('RebalanceTx').ifExists().execute();
  await db.schema.dropTable('FeeRewardTx').ifExists().execute();
  await db.schema.dropTable('LiquidityTx').ifExists().execute();
  await db.schema.dropIndex('position_address').ifExists().execute();
  await db.schema.dropTable('Position').ifExists().execute();
  await db.schema.dropIndex('whirlpool_token_a_token_b_tickSpacing').ifExists().execute();
  await db.schema.dropTable('Whirlpool').ifExists().execute();
	await db.schema.dropIndex('token_symbol').ifExists().execute();
  await db.schema.dropTable('Token').ifExists().execute();
}
