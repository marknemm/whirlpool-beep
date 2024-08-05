import { type Kysely } from 'kysely';

/**
 * Migration up function for applying a DB patch.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('rebalanceTx')
		.addColumn('fee', 'bigint', (col) => col.notNull().defaultTo(0))
    .addColumn('signature', 'varchar(255)', (col) => col.notNull().defaultTo(''))
		.execute();

	await db.schema.alterTable('rebalanceTx')
		.alterColumn('fee', (col) => col.dropDefault())
		.alterColumn('signature', (col) => col.dropDefault())
		.execute();
}

/**
 * Migration down function for reverting a DB patch.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function down(db: Kysely<any>): Promise<void> {
	db.schema.alterTable('rebalanceTx')
		.dropColumn('fee')
		.execute();
}
