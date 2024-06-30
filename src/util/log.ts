import { DECIMAL_REGEX, SECRETS_REGEX } from '@/constants/regex';
import env from '@/util/env';
import { red, yellow } from 'colors';
import { inspect, type InspectOptions } from 'util';
import { createLogger, format, transports, type Logger } from 'winston'; // eslint-disable-line no-restricted-imports

const inspectOpts: InspectOptions = { depth: 5, colors: env.LOG_COLOR, breakLength: 40 };

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
      level = `[${level}] ${level.match(/info|warn/)?.length ? ' ' : ''}`;

      // Generate formatted and colored base log message
      message = formatMessage(message);

      // Append formatted and colored rest message values to log message
      message += formatRestMessages(rest[Symbol.for('splat')]);

      // Extract leading newlines from message
      const newlines = getLeadingNewlines(message);
      message = message.substring(newlines.length);

      // Generate formatted and colored stack trace
      stack = stack?.replace(/^Error: /, '');
      if (stack && env.LOG_COLOR) {
        stack = red(stack);
      }

      // Append parts of log message to output.
      const logStr = `${newlines}${timestamp}${level}${stack ? `${stack}\n` : message}`;

      // IMPORTANT - Filter out all secret values.
      return logStr.replaceAll(SECRETS_REGEX, '[SECRET]');
    }),
  ),
  transports: [
    new transports.Console(),
  ],
});

/**
 * Format a message for logging.
 *
 * @param message The message to format.
 * @returns The formatted message.
 */
function formatMessage(message: object | string): string {
  return (typeof message === 'string')
    ? env.LOG_COLOR
      ? message.replaceAll(DECIMAL_REGEX, `${yellow('$1')}`)
      : message
    : inspect(message, inspectOpts);
}

/**
 * Format the rest of the messages for logging.
 *
 * @param messages The messages to format.
 * @returns The formatted messages as a single `string`.
 */
function formatRestMessages(messages: (object | string)[]): string {
  if (!messages?.length) return '';

  // Treat only rest message as a data value that will receive syntax highlighting according to its type.
  if (messages.length === 1) {
    return ` ${inspect(messages[0], inspectOpts)}`;
  }

  // Treat rest of messages as concatenated parts of base message.
  return messages.reduce<string>((acc, message) =>
    `${acc} ${formatMessage(message)}`
  , '');
}

/**
 * Get the leading newlines from a message.
 *
 * @param message The message to get the leading newlines from.
 * @returns The leading newlines.
 */
function getLeadingNewlines(message: string): string {
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

export type * from '@/interfaces/log';
export type { LeveledLogMethod, LogCallback, Logger } from 'winston'; // eslint-disable-line no-restricted-imports

export default logger;
