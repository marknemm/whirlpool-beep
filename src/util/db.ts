import type { DAOInsertOptions, DAOOptions } from '@/interfaces/dao';
import type { DB } from '@/interfaces/db';
import type { ErrorWithCode } from '@/interfaces/error';
import type { Null } from '@/interfaces/nullable';
import env from '@/util/env';
import { debug, error, info } from '@/util/log';
import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

let _db: Kysely<DB>;

/**
 * Gets the singleton database client instance for the application.
 *
 * @returns The `Postgres` database client instance.
 */
export default function db(): Kysely<DB> {
  if (!_db) {
    _db = new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: new Pool({
          database: env.DB_NAME,
          host: env.DB_HOST,
          password: env.DB_PASSWORD,
          port: env.DB_PORT,
          ssl: {
            ca: env.DB_CA,
            rejectUnauthorized: env.DB_SSL,
          },
          user: env.DB_USER,
        }),
      }),
      plugins: [
        new CamelCasePlugin()
      ],
    });

    info('-- Initialized DB Client --');
  }

  return _db;
}

/**
 * Handles an insert error.
 *
 * @param err The error to handle.
 * @param tableName The name of the table the insert was attempted on.
 * @param identifier An identifier of the record that failed to insert (e.g. `Address`, `Public Key`).
 * @param opts The {@link DAOInsertOptions} used for the operation.
 * @throws The {@link ErrorWithCode} if {@link DAOOptions.catchErrors} is not set in the {@link opts}.
 */
export function handleInsertError(
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
export function handleSelectError(
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
 * Database unique constraint violation error code.
 */
export const UNIQUE_VIOLATION_CODE = '23505';
