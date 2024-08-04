import { type Kysely } from 'kysely';

/**
 * Migration up function for applying a DB patch.
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
 * Migration down function for reverting a DB patch.
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
