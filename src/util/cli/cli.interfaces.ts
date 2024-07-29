import type { Arguments, CamelCaseKey, InferredOptionTypes, Options } from 'yargs';

/**
 * Argument type based off of a given options literal type.
 *
 * @template T_OPTS The options literal type.
 */
export type CliArgs<T_OPTS extends Record<string, Options>> = {
  [K in keyof _CliArgs<T_OPTS> as K | CamelCaseKey<K>]: _CliArgs<T_OPTS>[K]
}

/**
 * Arguments type without camel case keys based off of a given options literal type.
 *
 * @template T_OPTS The options literal type.
 */
type _CliArgs<T_OPTS extends Record<string, Options>> = Arguments<InferredOptionTypes<T_OPTS>>;

/**
 * CLI options type based off of a given options literal type.
 *
 * @template T_OPTS The options literal type.
 */
export type CliOpts<T_OPTS extends Record<string, Options>> = {
  [K in keyof T_OPTS]: Options
};
