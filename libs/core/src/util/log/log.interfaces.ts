
/**
 * Supported log levels.
 */
export type LogLevel = 'debug' | 'error' | 'info' | 'warn';

/**
 * A log message transformer callback.
 *
 * @param message The message to transform.
 * @returns The transformed message.
 */
export type LogMessageTransformer = (message: unknown) => unknown;
