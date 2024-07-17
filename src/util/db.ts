import type { DB } from '@/interfaces/db';
import env from '@/util/env';
import { info } from '@/util/log';
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
          ssl: env.DB_SSL,
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
