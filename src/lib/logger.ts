/**
 * Centralized logging utility for the application
 * Provides consistent logging across the application with proper levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enableDebug: boolean;
  enableInfo: boolean;
}

const config: LoggerConfig = {
  enableDebug: process.env.NODE_ENV === 'development',
  enableInfo: process.env.NODE_ENV === 'development',
};

/**
 * Formats log messages with context
 */
function formatMessage(level: LogLevel, context: string, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}${dataStr}`;
}

/**
 * Logger class for structured logging
 */
class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Debug level logging - only in development
   */
  debug(message: string, data?: unknown): void {
    if (config.enableDebug) {
      console.debug(formatMessage('debug', this.context, message, data));
    }
  }

  /**
   * Info level logging
   */
  info(message: string, data?: unknown): void {
    if (config.enableInfo) {
      console.info(formatMessage('info', this.context, message, data));
    }
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: unknown): void {
    console.warn(formatMessage('warn', this.context, message, data));
  }

  /**
   * Error level logging - always enabled
   */
  error(message: string, error?: unknown): void {
    const errorData = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;
    console.error(formatMessage('error', this.context, message, errorData));
  }
}

/**
 * Creates a logger instance for a specific context
 * @param context - The context/module name for the logger
 * @returns Logger instance
 * 
 * @example
 * const logger = createLogger('UserService');
 * logger.info('User logged in', { userId: '123' });
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}

/**
 * Default logger for general use
 */
export const logger = createLogger('App');
