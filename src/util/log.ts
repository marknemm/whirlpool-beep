import { DECIMAL_REGEX, SECRETS_REGEX } from '@/constants/regex';
import env from '@/util/env';
import { red, yellow } from 'colors';
import { inspect, type InspectOptions } from 'util';
import { createLogger, format, transports, type Logger } from 'winston'; // eslint-disable-line no-restricted-imports

export * from '@/interfaces/log';

const inspectOpts: InspectOptions = { depth: 5, colors: env.LOG_COLOR, breakLength: 40 };

/**
 * The {@link Logger} instance.
 */
const logger = createLogger({
  format: format.combine(
    format.errors({ stack: true }),
    format.timestamp(),
  ),
  transports: [
    new transports.Console({
      level: env.LOG_LEVEL,
      format: format.combine(
        env.LOG_COLOR
          ? format.colorize()
          : format.combine(), // no-op
        format.printf(({ level, message, timestamp, stack, ...rest }) => {
          const restMessages = rest[Symbol.for('splat')];

          // Include/exclude timestamp in log message
          timestamp = env.LOG_TIMESTAMP ? `[${timestamp}] ` : '';

          // Add space to align messages after log levels
          level = `[${level}] ${level.match(/info|warn/)?.length ? ' ' : ''}`;

          // Generate formatted and colored base log message
          message = formatMessage(message);

          // Append formatted and colored rest message values to log message
          message += formatRestMessages(restMessages);

          // Generate formatted and colored stack trace
          stack = stack?.replace(/^Error: /, '');
          if (stack && env.LOG_COLOR) {
            stack = red(stack);
          }

          // Append parts of log message to output.
          const logStr = stack
            ? `${timestamp}${level}${stack}\n`
            : `${timestamp}${level}${message}`;

          // IMPORTANT - Filter out all secret values.
          return logStr.replaceAll(SECRETS_REGEX, '[SECRET]');
        })
      ),
    })
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

  if (messages.length === 1) {
    return ` ${inspect(messages[0], inspectOpts)}`;
  }

  return messages.reduce<string>((acc, message) =>
    `${acc} ${formatMessage(message)}`
  , '');
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

export default logger;
