import { SECRETS_REGEX } from '@/constants/regex';
import type { PositionTickRange, WhirlpoolPriceData } from '@/interfaces/whirlpool';
import { env } from '@/util/env';
import { PriceMath, type Whirlpool } from '@orca-so/whirlpools-sdk';
import { inspect } from 'util';
import { createLogger, format, transports, type LeveledLogMethod, type Logger } from 'winston'; // eslint-disable-line no-restricted-imports

/**
 * The {@link Logger} instance.
 */
const logger = createLogger({
  format: format.combine(
    format.errors({ stack: true }),
  ),
  transports: [
    new transports.Console({
      level: env.LOG_LEVEL,
      format: format.combine(
        format.colorize(),
        format.splat(),
        format.printf(({level, message, stack}) => {
          const logStr = !stack
            ? `${level}: ${inspect(message, { depth: 5, colors: true, breakLength: 40 })}`
            : `${level}: ${stack.replace(/^Error: /, '')}\n`;

          return logStr.replaceAll(SECRETS_REGEX, '[SECRET]');
        })
      ),
    })
  ],
});

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
  log(`Price of ${tokenA.symbol} in terms of ${tokenB.symbol}: %d`, fixedPrice);
}

/**
 * Log the price range data for a {@link Whirlpool} position.
 *
 * @param tickRange The {@link PositionTickRange} to log.
 * @param whirlpool The {@link Whirlpool} to log the position range for.
 * @param log The {@link LeveledLogMethod} to log with. Defaults to {@link debug}.
 */
export function logPositionRange(tickRange: PositionTickRange, whirlpool: Whirlpool, log: LeveledLogMethod = debug) {
  const tokenA = whirlpool.getTokenAInfo();
  const tokenB = whirlpool.getTokenBInfo();

  log('Lower & upper tick index: [%d, %d]', tickRange[0], tickRange[1]);
  log('Lower & upper price: [%d, %d]',
    PriceMath.tickIndexToPrice(tickRange[0], tokenA.decimals, tokenB.decimals).toFixed(tokenB.decimals),
    PriceMath.tickIndexToPrice(tickRange[1], tokenA.decimals, tokenB.decimals).toFixed(tokenB.decimals)
  );
}

export default logger;
