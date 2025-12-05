/**
 * Logger utility for backend operations
 * Centralized logging for debugging and monitoring
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
}

class Logger {
  private context: string;

  constructor(context: string = 'app') {
    this.context = context;
  }

  private format(level: LogLevel, message: string, context?: Record<string, any>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message: `[${this.context}] ${message}`,
      context
    };
  }

  info(message: string, context?: Record<string, any>) {
    const entry = this.format('info', message, context);
    console.log(JSON.stringify(entry));
  }

  warn(message: string, context?: Record<string, any>) {
    const entry = this.format('warn', message, context);
    console.warn(JSON.stringify(entry));
  }

  error(message: string, context?: Record<string, any>) {
    const entry = this.format('error', message, context);
    console.error(JSON.stringify(entry));
  }

  debug(message: string, context?: Record<string, any>) {
    const entry = this.format('debug', message, context);
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify(entry));
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export factory for named loggers
export function getLogger(name: string): Logger {
  return new Logger(name);
}
