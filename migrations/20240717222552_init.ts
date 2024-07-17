import { type Kysely, sql } from 'kysely';

/**
 * Migration up function for applying a DB patch.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.createTable('token').ifNotExists()
    .addColumn('address', 'varchar(100)', (col) => col.primaryKey())
    .addColumn('decimals', 'integer', (col) => col.notNull())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('symbol', 'varchar(10)', (col) => col.notNull())
		.execute();

	await db.schema.createIndex('token_symbol').ifNotExists()
		.on('token')
		.columns(['symbol'])
		.execute();

  await db.schema.createTable('whirlpool').ifNotExists()
    .addColumn('address', 'varchar(100)', (col) => col.primaryKey())
    .addColumn('feeRate', 'numeric(4, 9)', (col) => col.notNull())
    .addColumn('tokenA', 'varchar(100)', (col) => col.references('token.address').notNull())
    .addColumn('tokenB', 'varchar(100)', (col) => col.references('token.address').notNull())
    .addColumn('tokenVaultA', 'varchar(100)', (col) => col.notNull())
    .addColumn('tokenVaultB', 'varchar(100)', (col) => col.notNull())
    .addColumn('tickSpacing', 'integer', (col) => col.notNull())
		.execute();

  await db.schema.createIndex('whirlpool_tokenA_tokenB_tickSpacing').ifNotExists()
    .on('whirlpool')
    .columns(['tokenA', 'tokenB', 'tickSpacing'])
    .unique()
		.execute();

  await db.schema.createTable('position').ifNotExists()
    .addColumn('address', 'varchar(100)', (col) => col.primaryKey())
    .addColumn('createdAt', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('whirlpool', 'varchar(100)', (col) => col.references('whirlpool.address').notNull())
    .addColumn('liquidity', 'bigint', (col) => col.notNull())
    .addColumn('priceLower', 'numeric(10, 9)', (col) => col.notNull())
    .addColumn('priceUpper', 'numeric(10, 9)', (col) => col.notNull())
    .addColumn('tokenAmountA', 'bigint', (col) => col.notNull())
    .addColumn('tokenAmountB', 'bigint', (col) => col.notNull())
    .addColumn('tickLower', 'integer', (col) => col.notNull())
    .addColumn('tickUpper', 'integer', (col) => col.notNull())
		.execute();

  await db.schema.createTable('rebalanceTx').ifNotExists()
    .addColumn('address', 'varchar(100)', (col) => col.primaryKey())
    .addColumn('createdAt', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('positionOld', 'varchar(100)', (col) => col.references('position.address').notNull())
    .addColumn('positionNew', 'varchar(100)', (col) => col.references('position.address').notNull())
    .addColumn('liquidity', 'bigint', (col) => col.notNull())
    .addColumn('tokenAmountA', 'bigint', (col) => col.notNull())
    .addColumn('tokenAmountB', 'bigint', (col) => col.notNull())
    .addColumn('tokenFeesA', 'bigint', (col) => col.notNull())
    .addColumn('tokenFeesB', 'bigint', (col) => col.notNull())
    .execute();
}

/**
 * Migration down function for reverting a DB patch.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('rebalanceTx').ifExists().execute();
  await db.schema.dropTable('position').ifExists().execute();
  await db.schema.dropIndex('whirlpool_tokenA_tokenB_tickSpacing').ifExists().execute();
  await db.schema.dropTable('whirlpool').ifExists().execute();
	await db.schema.dropIndex('token_symbol').ifExists().execute();
  await db.schema.dropTable('token').ifExists().execute();
}
