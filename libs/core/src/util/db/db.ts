import type { ErrorWithCode } from '@npc/core/interfaces/error.interfaces';
import type { Null } from '@npc/core/interfaces/nullable.interfaces';
import type { DAOInsertOptions, DAOOptions } from '@npc/core/src/interfaces/dao.interfaces';
import env from '@npc/core/util/env/env';
import { debug, error } from '@npc/core/util/log/log';
import { promises as fs } from 'fs';
import { CamelCasePlugin, FileMigrationProvider, Kysely, Migrator, PostgresDialect, type MigrationResult } from 'kysely';
import { join } from 'node:path';
import path from 'path';
import { Pool } from 'pg';
import type { DB } from './db.interfaces';

let _db: Kysely<DB>;

/**
 * Gets the singleton database client instance for the application.
 *
 * @returns The `Postgres` database client instance.
 */
export function db(): Kysely<DB> {
  if (!_db) {
    _db = new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: new Pool({
          database: env.DB_NAME,
          host: env.DB_HOST,
          password: env.DB_PASSWORD,
          port: env.DB_PORT,
          ssl: env.DB_SSL && {
            ca: env.DB_CA,
            rejectUnauthorized: true,
          },
          user: env.DB_USER,
        }),
      }),
      plugins: [
        new CamelCasePlugin()
      ],
    });

    debug('-- Initialized DB Client --');
  }

  return _db;
}

/**
 * Database unique constraint violation error code.
 */
export const UNIQUE_VIOLATION_CODE = '23505';

/**
 * Handles an insert error.
 *
 * @param err The error to handle.
 * @param tableName The name of the table the insert was attempted on.
 * @param identifier An identifier of the record that failed to insert (e.g. `Address`, `Public Key`).
 * @param opts The {@link DAOInsertOptions} used for the operation.
 * @throws The {@link ErrorWithCode} if {@link DAOOptions.catchErrors} is not set in the {@link opts}.
 */
export function handleDBInsertError(
  err: ErrorWithCode,
  tableName: string,
  identifier: unknown,
  opts: DAOInsertOptions | Null
) {
  if ((err as ErrorWithCode).code === UNIQUE_VIOLATION_CODE && opts?.ignoreDuplicates) {
    debug(`${tableName} already exists in database:`, identifier);
    return;
  }

  if (opts?.catchErrors) {
    error(`Failed to insert ${tableName} into database:`, identifier);
    error(err);
    return;
  }

  throw err;
}

/**
 * Handles a select error.
 *
 * @param err The error to handle.
 * @param tableName The name of the table the select was attempted on.
 * @param opts The {@link DAOOptions} used for the operation.
 * @throws The {@link ErrorWithCode} if {@link DAOOptions.catchErrors} is not set in the {@link opts}.
 */
export function handleDBSelectError(
  err: ErrorWithCode,
  tableName: string,
  opts: DAOOptions | Null
): void {
  if (opts?.catchErrors) {
    error('Failed to select records from:', tableName);
    error(err);
    return;
  }

  throw err;
}

/**
 * Migrates the database to the latest version.
 *
 * @returns A {@link Promise} that resolves to the {@link MigrationResult} list data.
 * @throws An {@link Error} if the migration fails.
 */
export async function migrateDB(): Promise<MigrationResult[]> {
  debug('\n-- Migrating DB Schema to latest version --');

  const migrator = new Migrator({
    db: db(),
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: join(__dirname, '..', '..', 'migrations'),
    }),
  });

  const { error: err, results } = await migrator.migrateToLatest();

  for (const res of results ?? []) {
    switch (res.status) {
      case 'Success':
        debug(`migration '${res.migrationName}' was executed successfully`);
        break;
      case 'Error':
        error(`failed to execute migration "${res.migrationName}"`);
        break;
    }
  }

  if (err) {
    error('failed to migrate');
    throw err;
  }

  debug(`DB schema migration finished, completed ${(results ?? []).length} migrations\n`);
  return results ?? [];
}

export type * from './db.interfaces';
export default db;
