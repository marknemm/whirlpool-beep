import { DECIMAL_REGEX, SECRETS_REGEX } from '@/constants/regex';
import type { PositionTickRange, WhirlpoolPriceData } from '@/interfaces/whirlpool';
import env from '@/util/env';
import { PriceMath, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { red, yellow } from 'colors';
import { inspect, type InspectOptions } from 'util';
import { createLogger, format, transports, type LeveledLogMethod, type Logger } from 'winston'; // eslint-disable-line no-restricted-imports

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
    ? (env.LOG_COLOR)
      ? message.replaceAll(DECIMAL_REGEX, `$1${yellow('$2')}$3`)
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
    acc + ` ${formatMessage(message)}`
  , '');
}

/**
 * Debug logger for logging debug data.
 *
 * Will not log if the log level is set to `info`.
 *
 * Should be configured in prod env to log at `info` level, and therefore, debug logs will not display.
 */
export const debug = logger.debug;

/**
 * Info logger for logging general information.
 */
export const info = logger.info;

/**
 * Error logger for logging errors.
 */
export const error = logger.error;

/**
 * Warning logger for logging warnings.
 */
export const warn = logger.warn;

/**
 * Log the price of a token, {@link tokenA}, in terms of another token, {@link tokenB}.
 * If input is missing, this function does nothing.
 *
 * @param tokenPrice The {@link WhirlpoolPriceData} to log.
 * @param log The {@link LeveledLogMethod} to log with. Defaults to {@link debug}.
 */
export function logPrice(tokenPrice: WhirlpoolPriceData, log: LeveledLogMethod = debug) {
  if (!tokenPrice) return;

  const { price, tokenA, tokenB } = tokenPrice;

  const fixedPrice = parseFloat(price.toFixed(tokenB.decimals));
  log(`Price of ${tokenA.symbol} in terms of ${tokenB.symbol}:`, fixedPrice);
}

/**
 * Log the price range data for a {@link Whirlpool} position.
 *
 * @param tickRange The {@link PositionTickRange} to log.
 * @param whirlpool The {@link Whirlpool} to log the position range for.
 * @param log The {@link LeveledLogMethod} to log with. Defaults to {@link debug}.
 */
export function logPositionRange(tickRange: PositionTickRange, whirlpool: Whirlpool, log: LeveledLogMethod = debug) {
  if (!tickRange || !whirlpool) return;

  const tokenA = whirlpool.getTokenAInfo();
  const tokenB = whirlpool.getTokenBInfo();

  const priceRange = [
    PriceMath.tickIndexToPrice(tickRange[0], tokenA.decimals, tokenB.decimals).toFixed(tokenB.decimals),
    PriceMath.tickIndexToPrice(tickRange[1], tokenA.decimals, tokenB.decimals).toFixed(tokenB.decimals),
  ];

  log(`Lower & upper tick index: [${tickRange[0]}, ${tickRange[1]}]`);
  log(`Lower & upper price: [${priceRange[0]}, ${priceRange[1]}]`);
}

export default logger;
