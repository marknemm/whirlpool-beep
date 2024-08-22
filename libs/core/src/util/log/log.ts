import { DECIMAL_REGEX, SECRETS_REGEX } from '@npc/core/constants/regex';
import env from '@npc/core/util/env/env';
import { PublicKey } from '@solana/web3.js';
import { path as appRootPath } from 'app-root-path';
import { red, yellow } from 'colors';
import { join } from 'node:path';
import { inspect, type InspectOptions } from 'node:util';
import { createLogger, format, transports, type Logger, type transport } from 'winston'; // eslint-disable-line no-restricted-imports

const _inspectOpts: InspectOptions = {
  breakLength: env.LOG_BREAK_LEN,
  colors: env.LOG_COLOR,
  depth: env.LOG_DEPTH,
};

/**
 * The {@link Logger} instance.
 */
const logger = createLogger({
  level: env.LOG_LEVEL,             // Specify lowest log level that shall be output: 'debug' | 'info'
  format: format.combine(           // Define format for lot message output
    env.LOG_COLOR
      ? format.colorize()           // Add standard color to log level
      : format.combine(),           // no-op - Do not add color
    env.LOG_TIMESTAMP
      ? format.timestamp()          // Include timestamp data with each log message
      : format.combine(),           // no-op - Do not include timestamp
    format.errors({ stack: true }), // Enable processing of Error object with stack trace
    format.printf(({ level, message = '', timestamp, stack = '', ...rest }) => {
      // Include/exclude timestamp in log message
      timestamp = env.LOG_TIMESTAMP ? `[${timestamp}] ` : '';

      // Add space to align messages after log levels
      level = `[${level}] ${/info|warn/.test(level) ? ' ' : ''}`;

      // Generate formatted and colored base log message
      message = _formatMessage(message);

      // Append formatted and colored rest message values to log message
      message += _formatRestMessages(rest[Symbol.for('splat')]);

      // Extract leading newlines from message
      const newlines = _getLeadingNewlines(message);
      message = message.substring(newlines.length);

      // Generate formatted and colored stack trace
      stack = stack?.replace(/^Error: /, '');
      if (stack && env.LOG_COLOR) {
        stack = /warn/.test(level)
          ? yellow(stack)
          : red(stack);
      }

      // Append parts of log message to output.
      const logStr = `${newlines}${timestamp}${level}${message}${stack ? `\n\n${stack}\n` : ''}`;

      // importANT - Filter out all secret values.
      return logStr.replaceAll(SECRETS_REGEX, '[SECRET]');
    }),
  ),
  transports: [
    new transports.Console() as transport,
  ].concat(
    env.LOG_FILE_OUT
      ? [
        new transports.File({
          dirname: env.LOG_FILE_OUT.charAt(0) !== '/'
            ? join(appRootPath, env.LOG_FILE_OUT)
            : env.LOG_FILE_OUT,
          filename: `${new Date().toISOString()}.log.ansi`,
        })
      ]
      : []
  ),
});

/**
 * Format a message for logging.
 *
 * @param message The message to format.
 * @returns The formatted message.
 */
function _formatMessage(message: object | string): string {
  message = _transformMessage(message);

  return (typeof message === 'string')
    ? env.LOG_COLOR
      ? message.replaceAll(DECIMAL_REGEX, `${yellow('$1')}`)
      : message
    : inspect(message, _inspectOpts);
}

/**
 * Format the rest of the messages for logging.
 *
 * @param messages The messages to format.
 * @returns The formatted messages as a single `string`.
 */
function _formatRestMessages(messages: (object | string)[]): string {
  messages = messages?.filter((message) => !(message instanceof Error));
  if (!messages?.length) return '';

  // Treat only rest message as a data value that will receive syntax highlighting according to its type.
  if (messages.length === 1) {
    const message = _transformMessage(messages[0]);
    return ` ${inspect(message, _inspectOpts)}`;
  }

  // Treat rest of messages as concatenated parts of base message.
  return messages.reduce<string>((acc, message) =>
    `${acc} ${_formatMessage(message)}`
  , '');
}

/**
 * Transforms a message from one data type to another preferred one.
 * If already in preferred type, returns the message as is.
 *
 * @param message The message to transform.
 * @returns The transformed message.
 */
function _transformMessage(message: object | string): object | string {
  return (message instanceof PublicKey)
    ? message.toBase58()
    : message;
}

/**
 * Get the leading newlines from a message.
 *
 * @param message The message to get the leading newlines from.
 * @returns The leading newlines.
 */
function _getLeadingNewlines(message: string): string {
  let newlines = '';
  for (let i = 0; i < message.length && message.charAt(i) === '\n'; i++) {
    newlines += '\n';
  }
  return newlines;
}

/**
 * Log level methods for the logger.
 *
 * @property debug The debug log level. Should only output in dev.
 * @property error The error log level. Used for logging errors in both dev and prod.
 * @property info The info log level. Used for general information logging in both dev and prod.
 * @property warn The warn log level. Used for logging warnings in both dev and prod.
 */
export const { debug, error, info, warn } = logger;

export type { LeveledLogMethod, LogCallback, Logger } from 'winston'; // eslint-disable-line no-restricted-imports
export type * from './log.interfaces';

export default logger;
