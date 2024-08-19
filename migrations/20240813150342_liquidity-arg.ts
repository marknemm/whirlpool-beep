import { type Kysely } from 'kysely';

/**
 * Add `liquidity` and `liquidity_unit` columns to `liquidity_tx` table.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('liquidity_tx')
		.addColumn('liquidity', 'bigint', (col) => col.notNull().defaultTo(0))
		.addColumn('liquidity_unit', 'varchar(255)', (col) => col.notNull().defaultTo('usd'))
		.execute();

	await db.schema.alterTable('liquidity_tx')
		.alterColumn('liquidity', (col) => col.dropDefault())
		.alterColumn('liquidity_unit', (col) => col.dropDefault())
		.execute();
}

/**
 * Remove `liquidity` and `liquidity_unit` from `liquidity_tx` table.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function down(db: Kysely<any>): Promise<void> {
	db.schema.alterTable('liquidity_tx')
		.dropColumn('liquidity')
		.dropColumn('liquidity_unit')
		.execute();
}
