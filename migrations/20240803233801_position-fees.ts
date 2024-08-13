import { type Kysely } from 'kysely';

/**
 * Add `openFee` and `closeFee` columns to the `position` table.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('position')
		.addColumn('closeFee', 'bigint', (col) => col.notNull().defaultTo(0))
		.addColumn('openFee', 'bigint', (col) => col.notNull().defaultTo(0))
		.execute();

	await db.schema.alterTable('position')
		.alterColumn('openFee', (col) => col.dropDefault())
		.execute();
}

/**
 * Remove `openFee` and `closeFee` columns from the `position` table.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function down(db: Kysely<any>): Promise<void> {
	db.schema.alterTable('position')
		.dropColumn('closeFee')
		.dropColumn('openFee')
		.execute();
}
