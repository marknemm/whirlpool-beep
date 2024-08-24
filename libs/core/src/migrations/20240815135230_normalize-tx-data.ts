import { Connection, type TransactionSignature } from '@solana/web3.js';
import { sql, type Kysely } from 'kysely';

const rpc = new Connection(
	(process.env.NODE_ENV === 'development')
		? 'https://api.devnet.solana.com'
		: 'https://api.mainnet-beta.solana.com',
);

/**
 * Normalize tx data by creating central `solana_tx` table.
 * Update existing table names to reference specific DEX or chain.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.createTable('solana_token').ifNotExists()
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('address', 'varchar(255)', (col) => col.notNull().unique())
		.addColumn('decimals', 'integer', (col) => col.notNull())
		.addColumn('name', 'varchar(255)')
		.addColumn('symbol', 'varchar(255)')
		.execute();

	await db.executeQuery(sql`
		INSERT INTO solana_token (id, address, decimals, name, symbol)
		SELECT DISTINCT id, address, decimals, name, symbol
		FROM token
	`.compile(db));

	await db.executeQuery(sql`
		ALTER TABLE whirlpool
		DROP CONSTRAINT whirlpool_token_a_fkey,
		DROP CONSTRAINT whirlpool_token_b_fkey,
		ADD CONSTRAINT whirlpool_token_a_fkey FOREIGN KEY (token_a) REFERENCES solana_token(id),
		ADD CONSTRAINT whirlpool_token_b_fkey FOREIGN KEY (token_b) REFERENCES solana_token(id)
	`.compile(db));

	await db.schema.dropTable('token').execute();

	await db.executeQuery(sql`
		DELETE FROM liquidity_tx
		WHERE position IN (
			SELECT id
			FROM position
			WHERE open_tx IS NULL
				OR LENGTH(open_tx) < 15
				OR (
					close_tx IS NOT NULL
					AND LENGTH(close_tx) < 15
				)
		)
	`.compile(db));

	await db.executeQuery(sql`
		DELETE FROM rebalance_tx
		WHERE position_old IN (
			SELECT id
			FROM position
			WHERE open_tx IS NULL
				OR LENGTH(open_tx) < 15
				OR (
					close_tx IS NOT NULL
					AND LENGTH(close_tx) < 15
				)
		)
		OR position_new IN (
			SELECT id
			FROM position
			WHERE open_tx IS NULL
				OR LENGTH(open_tx) < 15
				OR (
					close_tx IS NOT NULL
					AND LENGTH(close_tx) < 15
				)
		)
	`.compile(db));

	await db.executeQuery(sql`
		DELETE FROM fee_reward_tx
		WHERE position IN (
			SELECT id
			FROM position
			WHERE open_tx IS NULL
				OR LENGTH(open_tx) < 15
				OR (
					close_tx IS NOT NULL
					AND LENGTH(close_tx) < 15
				)
		)
	`.compile(db));

	await db.executeQuery(sql`
		DELETE FROM position
		WHERE open_tx IS NULL
			 OR LENGTH(open_tx) < 15
			 OR (
				 close_tx IS NOT NULL
				 AND LENGTH(close_tx) < 15
			 )
	`.compile(db));

	await db.schema.createTable('solana_tx').ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
		.addColumn('compute_units_consumed', 'integer')
		.addColumn('fee', 'integer', (col) => col.notNull())
		.addColumn('signature', 'varchar(255)', (col) => col.unique())
		.addColumn('size', 'integer', (col) => col.notNull())
		.execute();

	await db.schema.createTable('solana_compute_budget').ifNotExists()
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('solana_tx', 'integer', (col) => col.references('solana_tx.id'))
		.addColumn('compute_unit_limit', 'integer')
		.addColumn('priority', 'varchar(255)')
		.addColumn('priority_fee', 'integer')
		.execute();

	await db.schema.createTable('solana_tx_error').ifNotExists()
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('solana_tx', 'integer', (col) => col.references('solana_tx.id'))
		.addColumn('code', 'integer')
		.addColumn('error', 'json', (col) => col.notNull())
		.addColumn('message', 'varchar', (col) => col.notNull())
		.execute();

	await db.schema.createTable('solana_ix').ifNotExists()
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('solana_tx', 'integer', (col) => col.references('solana_tx.id'))
		.addColumn('data', 'json')
		.addColumn('program_id', 'varchar(255)', (col) => col.notNull())
		.addColumn('program_name', 'varchar(255)', (col) => col.notNull())
		.execute();

	await db.schema.createTable('solana_inner_ix').ifNotExists()
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('solana_ix', 'integer', (col) => col.references('solana_ix.id'))
		.addColumn('data', 'json')
		.addColumn('name', 'varchar(255)', (col) => col.notNull())
		.addColumn('program_id', 'varchar(255)', (col) => col.notNull())
		.addColumn('program_name', 'varchar(255)', (col) => col.notNull())
		.execute();

	await db.schema.createTable('solana_tx_transfer').ifNotExists()
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('solana_tx', 'integer', (col) => col.references('solana_tx.id'))
		.addColumn('solana_token', 'integer', (col) => col.references('solana_token.id'))
		.addColumn('amount', 'bigint')
		.addColumn('destination', 'varchar(255)')
		.addColumn('destination_owner', 'varchar(255)')
		.addColumn('source', 'varchar(255)')
		.addColumn('source_owner', 'varchar(255)')
		.execute();

	await db.schema.alterTable('liquidity_tx')
		.addColumn('solana_tx', 'integer', (col) => col.references('solana_tx.id'))
		.addColumn('slippage', 'numeric(5, 4)', (col) => col.notNull().defaultTo(0.3))
		.execute();

	await db.schema.alterTable('liquidity_tx')
		.alterColumn('slippage', (col) => col.dropDefault())
		.execute();

	await db.schema.alterTable('fee_reward_tx')
		.addColumn('solana_tx', 'integer', (col) => col.references('solana_tx.id'))
		.execute();

	await db.schema.alterTable('position')
		.renameColumn('open_tx', 'open_signature')
		.execute();

	await db.schema.alterTable('position')
		.renameColumn('close_tx', 'close_signature')
		.execute();

	await db.schema.alterTable('position')
		.addColumn('open_solana_tx', 'integer', (col) => col.references('solana_tx.id'))
		.addColumn('close_solana_tx', 'integer', (col) => col.references('solana_tx.id'))
		.execute();

	await db.schema.alterTable('whirlpool')
		.alterColumn('fee_rate', (col) => col.setDataType('integer'))
		.execute();

	const liquidityTxSignatures = (
		await db.selectFrom('liquidity_tx')
			.select('signature')
			.execute()
	).map(({ signature }) => signature);

	for (const signature of liquidityTxSignatures) {
		await insertSolanaTxIfNotExists(db, signature);
	}

	const feeTxSignatures = (
		await db.selectFrom('fee_reward_tx')
			.select('signature')
			.execute()
	).map(({ signature }) => signature);

	for (const signature of feeTxSignatures) {
		await insertSolanaTxIfNotExists(db, signature);
	}

	const positionTxData = await db.selectFrom('position')
		.select('open_signature')
		.select('close_signature')
		.execute();

	for (const { open_signature, close_signature } of positionTxData) {
		await insertSolanaTxIfNotExists(db, open_signature);
		await insertSolanaTxIfNotExists(db, close_signature);
	}

	await db.executeQuery(sql`
		UPDATE liquidity_tx
		SET solana_tx = solana_tx.id
		FROM solana_tx
		WHERE liquidity_tx.signature = solana_tx.signature
	`.compile(db));

	await db.executeQuery(sql`
		UPDATE fee_reward_tx
		SET solana_tx = solana_tx.id
		FROM solana_tx
		WHERE fee_reward_tx.signature = solana_tx.signature
	`.compile(db));

	await db.executeQuery(sql`
		UPDATE position
		SET open_solana_tx = solana_tx.id
		FROM solana_tx
		WHERE position.open_signature = solana_tx.signature
	`.compile(db));

	await db.executeQuery(sql`
		UPDATE position
		SET close_solana_tx = solana_tx.id
		FROM solana_tx
		WHERE position.close_signature = solana_tx.signature
	`.compile(db));

	await db.schema.alterTable('liquidity_tx')
		.dropColumn('created_at')
		.dropColumn('fee')
		.dropColumn('quote')
		.dropColumn('signature')
		.alterColumn('solana_tx', (col) => col.setNotNull())
		.execute();

	await db.schema.alterTable('fee_reward_tx')
		.dropColumn('created_at')
		.dropColumn('fee')
		.dropColumn('signature')
		.alterColumn('solana_tx', (col) => col.setNotNull())
		.execute();

	await db.schema.alterTable('position')
		.dropColumn('open_fee')
		.dropColumn('close_fee')
		.dropColumn('open_signature')
		.dropColumn('close_signature')
		.alterColumn('close_solana_tx', (col) => col.setNotNull())
		.execute();

	await db.schema.alterTable('rebalance_tx')
		.renameTo('orca_rebalance')
		.execute();
	await db.schema.alterTable('position')
		.renameTo('orca_position')
		.execute();
	await db.schema.alterTable('liquidity_tx')
		.renameTo('orca_liquidity')
		.execute();
	await db.schema.alterTable('fee_reward_tx')
		.renameTo('orca_fee')
		.execute();
	await db.schema.alterTable('whirlpool')
		.renameTo('orca_whirlpool')
		.execute();
}

async function insertSolanaTxIfNotExists(
	db: Kysely<any>,
	signature: TransactionSignature | null | undefined,
): Promise<number | undefined> {
	if (!signature) return undefined;

	const exists = !!await db.selectFrom('solana_tx')
		.select('id')
		.where('signature', '=', signature)
		.executeTakeFirst();
	if (exists) return undefined;

	console.log(`Fetching Solana tx from chain: ${signature}`);
	await new Promise((resolve) => setTimeout(resolve, 100));

	const txResponse = await rpc.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
	const { blockTime, meta, transaction } = txResponse ?? {};
	const size = transaction?.message.serialize().length;

	console.log(`Inserting Solana tx into DB: ${signature}`);

	const { id } = await db.insertInto('solana_tx')
		.values({
			created_at: blockTime ? new Date(blockTime * 1000) : undefined,
			compute_units_consumed: meta?.computeUnitsConsumed,
			fee: meta?.fee,
			signature,
			size,
		})
		.returning('id')
		.executeTakeFirst() ?? {};

	return id;
}

/**
 * Not implemented!
 *
 * Restore the database from a backup or dump to revert this migration.
 *
 * @param db The {@link Kysely} DB instance.
 * @returns A {@link Promise} that resolves when the migration is complete.
 */
export async function down(db: Kysely<any>): Promise<void> {
	throw new Error('Not implemented! Restore the database from a backup or dump to revert this migration.');
}
