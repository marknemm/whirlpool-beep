import { env as coreEnv } from '@npc/core';
import { bool, cleanEnv, num, str } from 'envalid';

/**
 * Preprocessed, validated, and strongly typed environment variables for DB.
 */
export const env = {
  ...coreEnv,
  ...cleanEnv(process.env, {

    /**
     * The database root certificate authority signature.
     */
    DB_CA: str({ default: undefined }),

    /**
     * The database host.
     */
    DB_HOST: str(),

    /**
     * Whether to automatically migrate the database schema on startup.
     *
     * @default false
     */
    DB_MIGRATE: bool({ default: false }),

    /**
     * The database name.
     */
    DB_NAME: str(),

    /**
     * The database password.
     */
    DB_PASSWORD: str(),

    /**
     * The database port.
     *
     * @default 5432
     */
    DB_PORT: num({ default: 5432 }),

    /**
     * The database user.
     */
    DB_USER: str(),

    /**
     * Whether to use SSL for the database connection.
     *
     * @default true
     */
    DB_SSL: bool({ default: true }),

  })
};

export default env;
