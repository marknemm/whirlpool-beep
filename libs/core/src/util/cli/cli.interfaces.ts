import type { Arguments, Argv, InferredOptionTypes, Options } from 'yargs';

type CamelCaseKey<K extends PropertyKey> = K extends string ? Exclude<CamelCase<K>, ""> : K;
type CamelCase<S extends string> = string extends S ? string
  : S extends `${infer T}-${infer U}` ? `${T}${PascalCase<U>}`
  : S;
type PascalCase<S extends string> = string extends S ? string
  : S extends `${infer T}-${infer U}` ? `${Capitalize<T>}${PascalCase<U>}`
  : Capitalize<S>;

/**
 * Command line interface (CLI) type.
 */
export interface Cli {

  /**
   * Path containing the CLI command(s).
   */
  commandPath: string;

  /**
   * Description of the CLI.
   */
  description: string;

  /**
   * CLI builder function.
   *
   * @returns The yargs CLI builder.
   */
  builder: () => Argv;
}

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
