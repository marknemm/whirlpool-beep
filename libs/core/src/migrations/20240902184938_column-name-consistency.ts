import type { Kysely } from 'kysely';

/**
 * Rename columns for consistency.
 *
 * @param db The {@link Kysely} DB instance.
 */
export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('orca_position')
		.renameColumn('open_solana_tx', 'open_tx')
		.execute();

	await db.schema.alterTable('orca_position')
		.alterColumn('open_tx', (col) => col.setNotNull())
		.execute();

	await db.schema.alterTable('orca_position')
		.renameColumn('close_solana_tx', 'close_tx')
		.execute();

	await db.schema.alterTable('orca_position')
		.alterColumn('close_tx', (col) => col.dropNotNull())
		.execute();

	await db.schema.alterTable('orca_liquidity')
		.renameColumn('solana_tx', 'tx')
		.execute();

	await db.schema.alterTable('orca_fee')
		.renameColumn('solana_tx', 'tx')
		.execute();
}

/**
 * Revert column renames for consistency.
 *
 * @param db The {@link Kysely} DB instance.
 */
export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('orca_fee')
		.renameColumn('tx', 'solana_tx')
		.execute();

	await db.schema.alterTable('orca_liquidity')
		.renameColumn('tx', 'solana_tx')
		.execute();

	await db.schema.alterTable('orca_position')
		.renameColumn('close_tx', 'close_solana_tx')
		.execute();

	await db.schema.alterTable('orca_position')
		.renameColumn('open_tx', 'open_solana_tx')
		.execute();
}
