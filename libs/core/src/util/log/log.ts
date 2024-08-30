import { DECIMAL_REGEX } from '@npc/core/constants/regex';
import env, { SECRETS_REGEX } from '@npc/core/util/env/env';
import colors from 'colors';
import { inspect, type InspectOptions } from 'node:util';
import { createLogger, format, transports, type transport } from 'winston'; // eslint-disable-line no-restricted-imports
import type { LogLevel, LogMessageTransformer } from './log.interfaces';

/**
 * Options for the {@link util.inspect} function.
 */
export const INSPECT_OPTS: InspectOptions = {
  breakLength: env.LOG_BREAK_LEN,
  colors: env.LOG_COLOR,
  depth: env.LOG_DEPTH,
};

const _logger = createLogger({
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
          ? colors.yellow(stack)
          : colors.red(stack);
      }

      // Append parts of log message to output.
      const logStr = `${newlines}${timestamp}${level}${message}${stack ? `\n\n${stack}\n` : ''}`;

      // IMPORTANT - Filter out all secret values.
      return logStr.replaceAll(new RegExp(SECRETS_REGEX.source, `${SECRETS_REGEX.flags}g`), '[SECRET]');
    }),
  ),
  transports: [
    new transports.Console() as transport,
  ].concat(
    env.LOG_FILE_OUT
      ? [
        new transports.File({
          dirname: env.LOG_FILE_OUT,
          filename: `${new Date().toISOString()}.log.ansi`,
        })
      ]
      : []
  ),
});

const _transformers: LogMessageTransformer[] = [];

/**
 * Log a `debug` message.
 *
 * @param message The message to log.
 */
export function debug(...message: unknown[]) {
  log('debug', ...message);
}

/**
 * Log an `error` message.
 *
 * @param message The message to log.
 */
export function error(...message: unknown[]) {
  log('error', ...message);
}

/**
 * Log an `info` message.
 *
 * @param message The message to log.
 */
export function info(...message: unknown[]) {
  log('info', ...message);
}

/**
 * Log a `warn` message.
 *
 * @param message The message to log.
 */
export function warn(...message: unknown[]) {
  log('warn', ...message);
}

/**
 * Log a message at the specified level.
 *
 * @param level The {@link LogLevel} to log the message at.
 * @param message The message to log.
 */
export function log(level: LogLevel, ...message: unknown[]) {
  if (typeof message[0] === 'string') {
    (message.length === 1)
      ? _logger.log(level, message[0])
      : _logger.log(level, message[0], ...message.slice(1));
  } else {
    _logger.log(level, message);
  }
}

/**
 * Adds a {@link LogMessageTransformer} to the list of transformers.
 *
 * Transformers modify log messages before they are logged.
 * They will be applied directly to the message and recursively to all nested fields.
 *
 * @param transformer The {@link LogMessageTransformer} to add.
 */
export function addLogTransformer(transformer: LogMessageTransformer) {
  _transformers.push(transformer);
}

function _transformMessage(message: unknown, depth = 0): unknown {
  for (const transformer of _transformers) {
    message = transformer(message);

    // Recursively transform nested fields.
    if (message instanceof Object && depth < env.LOG_DEPTH) {
      let key: keyof typeof message;
      for (key in message) {
        Object.assign(message, { [key]: _transformMessage(message[key], depth++) });
      }
    }
  }

  return message;
}

/**
 * Format a message for logging.
 *
 * @param message The message to format.
 * @returns The formatted message.
 */
function _formatMessage(message: unknown): string {
  message = _transformMessage(message);

  return (typeof message === 'string')
    ? env.LOG_COLOR
      ? message.replaceAll(new RegExp(DECIMAL_REGEX.source, `${DECIMAL_REGEX.flags}g`), `${colors.yellow('$1')}`)
      : message
    : inspect(message, INSPECT_OPTS);
}

/**
 * Format the rest of the messages for logging.
 *
 * @param messages The messages to format.
 * @returns The formatted messages as a single `string`.
 */
function _formatRestMessages(messages: unknown[]): string {
  messages = messages?.filter((message) => !(message instanceof Error));
  if (!messages?.length) return '';

  // Treat only rest message as a data value that will receive syntax highlighting according to its type.
  if (messages.length === 1) {
    const message = _transformMessage(messages[0]);
    return ` ${inspect(message, INSPECT_OPTS)}`;
  }

  // Treat rest of messages as concatenated parts of base message.
  return messages.reduce<string>((acc, message) =>
    `${acc} ${_formatMessage(message)}`
  , '');
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

export type { LeveledLogMethod, LogCallback, Logger } from 'winston'; // eslint-disable-line no-restricted-imports
export type * from './log.interfaces';

export default log;
