import { env } from '@/util/env/env';
import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import { defineConfig, getKnexTimestampPrefix } from 'kysely-ctl';
import { Pool } from 'pg';

export default defineConfig({
	kysely: new Kysely({
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
			new CamelCasePlugin(),
		],
	}),
	migrations: {
		getMigrationPrefix: getKnexTimestampPrefix,
	},
});
