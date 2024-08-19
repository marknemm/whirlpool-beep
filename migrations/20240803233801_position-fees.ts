import { type Kysely } from 'kysely';

/**
 * Add `open_fee` and `close_fee` columns to the `position` table.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('position')
		.addColumn('close_fee', 'bigint', (col) => col.notNull().defaultTo(0))
		.addColumn('open_fee', 'bigint', (col) => col.notNull().defaultTo(0))
		.execute();

	await db.schema.alterTable('position')
		.alterColumn('open_fee', (col) => col.dropDefault())
		.execute();
}

/**
 * Remove `open_fee` and `close_fee` columns from the `position` table.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function down(db: Kysely<any>): Promise<void> {
	db.schema.alterTable('position')
		.dropColumn('close_fee')
		.dropColumn('open_fee')
		.execute();
}
