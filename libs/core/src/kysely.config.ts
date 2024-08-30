import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import { defineConfig, getKnexTimestampPrefix } from 'kysely-ctl';
import { Pool } from 'pg';

export default defineConfig({
	kysely: new Kysely({
		dialect: new PostgresDialect({
			pool: new Pool({
				database: process.env.DB_NAME,
				host: process.env.DB_HOST,
				password: process.env.DB_PASSWORD,
				port: process.env.DB_PORT
					? parseInt(process.env.DB_PORT)
					: 5432,
				ssl: process.env.DB_SSL === 'true' && {
					ca: process.env.DB_CA,
					rejectUnauthorized: true,
				},
				user: process.env.DB_USER,
			}),
		}),
		plugins: [
			new CamelCasePlugin(),
		],
	}),
	migrations: {
		allowJS: true,
		getMigrationPrefix: getKnexTimestampPrefix,
	},
});
