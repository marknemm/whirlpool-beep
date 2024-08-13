import { type Kysely } from 'kysely';

/**
 * Add `liquidity` and `liquidityUnit` columns to `liquidityTx` table.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('liquidityTx')
		.addColumn('liquidity', 'bigint', (col) => col.notNull().defaultTo(0))
		.addColumn('liquidityUnit', 'varchar(255)', (col) => col.notNull().defaultTo('usd'))
		.execute();

	await db.schema.alterTable('liquidityTx')
		.alterColumn('liquidity', (col) => col.dropDefault())
		.alterColumn('liquidityUnit', (col) => col.dropDefault())
		.execute();
}

/**
 * Remove `liquidity` and `liquidityUnit` from `liquidityTx` table.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function down(db: Kysely<any>): Promise<void> {
	db.schema.alterTable('liquidityTx')
		.dropColumn('liquidity')
		.dropColumn('liquidityUnit')
		.execute();
}
