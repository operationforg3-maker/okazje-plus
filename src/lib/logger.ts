/**
 * M6 Logger - Wrapper for Structured Logging
 * 
 * Extends the existing logging.ts module with M6-specific logging utilities.
 * Provides consistent logging interface for price monitoring and alerts.
 * 
 * @module lib/logger
 */

import { logger as baseLogger, LogLevel, LogContext } from './logging';

/**
 * M6-specific logger with additional context
 */
class M6Logger {
  private readonly context: LogContext;
  
  constructor(context: LogContext = {}) {
    this.context = {
      ...context,
      module: 'm6_price_monitoring',
    };
  }
  
  /**
   * Log debug message
   */
  debug(message: string, additionalContext?: LogContext): void {
    baseLogger.debug(message, { ...this.context, ...additionalContext });
  }
  
  /**
   * Log info message
   */
  info(message: string, additionalContext?: LogContext): void {
    baseLogger.info(message, { ...this.context, ...additionalContext });
  }
  
  /**
   * Log warning message
   */
  warn(message: string, additionalContext?: LogContext): void {
    baseLogger.warn(message, { ...this.context, ...additionalContext });
  }
  
  /**
   * Log error message
   */
  error(message: string, additionalContext?: LogContext): void {
    baseLogger.error(message, { ...this.context, ...additionalContext });
  }
  
  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): M6Logger {
    return new M6Logger({ ...this.context, ...additionalContext });
  }
}

/**
 * Default M6 logger instance
 */
export const m6Logger = new M6Logger();

/**
 * Create a logger for price snapshot operations
 */
export function createSnapshotLogger(operationId: string): M6Logger {
  return m6Logger.child({
    operation: 'price_snapshot',
    operationId,
  });
}

/**
 * Create a logger for alert operations
 */
export function createAlertLogger(alertId?: string): M6Logger {
  return m6Logger.child({
    operation: 'alert_check',
    ...(alertId && { alertId }),
  });
}

/**
 * Create a logger for notification operations
 */
export function createNotificationLogger(channel: 'email' | 'web_push' | 'in_app'): M6Logger {
  return m6Logger.child({
    operation: 'notification',
    channel,
  });
}

/**
 * Log snapshot operation stats
 */
export function logSnapshotStats(
  logger: M6Logger,
  stats: {
    processed: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    durationMs: number;
  }
): void {
  logger.info('Snapshot operation completed', {
    stats,
    throughput: stats.processed / (stats.durationMs / 1000), // items per second
  });
}

/**
 * Log alert check stats
 */
export function logAlertStats(
  logger: M6Logger,
  stats: {
    checked: number;
    triggered: number;
    notified: number;
    errors: number;
    durationMs: number;
  }
): void {
  logger.info('Alert check completed', {
    stats,
    throughput: stats.checked / (stats.durationMs / 1000), // checks per second
  });
}

/**
 * Log error with full context
 */
export function logError(
  logger: M6Logger,
  error: Error | unknown,
  context?: LogContext
): void {
  const errorDetails = error instanceof Error ? {
    name: error.name,
    message: error.message,
    stack: error.stack,
  } : {
    message: String(error),
  };
  
  logger.error('Operation failed', {
    error: errorDetails,
    ...context,
  });
}

/**
 * Re-export base logger for convenience
 */
export { baseLogger as logger };
export type { LogLevel, LogContext };
