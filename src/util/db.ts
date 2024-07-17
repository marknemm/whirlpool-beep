import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import env from '@/util/env';

const dialect = new PostgresDialect({
  pool: new Pool({
    database: env.DB_NAME,
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
    ssl: env.DB_SSL,
    user: env.DB_USER,
  })
});

/**
 * Database instance for the application.
 */
export const db = new Kysely({ dialect });
