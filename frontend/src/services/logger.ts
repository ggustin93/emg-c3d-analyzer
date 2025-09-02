/**
 * Production-grade logger for the frontend.
 * In production: Silently captures all logs to file
 * In development: Shows in console + saves to file
 */
import { Logger, ILogObj } from "tslog";

export enum LogCategory {
  API = "api",
  AUTH = "auth",
  CHART_RENDER = "chart-render",
  DATA_PROCESSING = "data-processing",
  MVC_CALCULATION = "mvc-calculation",
  CONTRACTION_ANALYSIS = "contraction-analysis",
  PERFORMANCE = "performance",
  USER_INTERACTION = "user-interaction",
  ERROR_BOUNDARY = "error-boundary",
  LIFECYCLE = "lifecycle",
}

const isDevelopment = import.meta.env.DEV;

// Simple file transport for browser
class BrowserFileTransport {
  private logBuffer: string[] = [];
  private flushInterval: number;

  constructor(flushIntervalMs = 1000) {
    this.flushInterval = window.setInterval(() => this.flush(), flushIntervalMs);
    window.addEventListener('beforeunload', () => this.flush());
  }

  log(timestamp: string, level: string, category: string, message: string): void {
    const logEntry = `${timestamp}\t${level}\t[${category}] ${message}`;
    this.logBuffer.push(logEntry);

    if (this.logBuffer.length > 100) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return;
    const logs = this.logBuffer.splice(0);
    
    try {
      await fetch('/api/logs/frontend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs }),
      });
    } catch {
      // Fallback to localStorage if backend unavailable
      try {
        const existing = localStorage.getItem('frontend_logs') || '';
        localStorage.setItem('frontend_logs', existing + '\n' + logs.join('\n'));
      } catch {
        // Silent fail in production
      }
    }
  }

  destroy(): void {
    this.flush();
    clearInterval(this.flushInterval);
  }
}

const fileTransport = new BrowserFileTransport();

// Base logger configuration
const baseLogger = new Logger<ILogObj>({
  name: "frontend",
  minLevel: isDevelopment ? 2 : 3, // 2: info+ in dev, 3: warn+ in prod (reduced verbosity)
  type: isDevelopment ? "pretty" : "hidden", // Show in console only in dev
});

// Create categorized loggers
const loggers = Object.values(LogCategory).reduce((acc, category) => {
  acc[category] = baseLogger.getSubLogger({ name: category });
  return acc;
}, {} as Record<LogCategory, Logger<ILogObj>>);

// Attach file transport for all log levels
baseLogger.attachTransport((logObj) => {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const level = (logObj._meta as any)?.logLevelName?.toUpperCase().padEnd(5) || 'INFO';
  const category = (logObj._meta as any)?.name || 'frontend';
  
  let message = '';
  if ((logObj as any).msg && Array.isArray((logObj as any).msg)) {
    message = (logObj as any).msg.map((arg: unknown) => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
  }
  
  fileTransport.log(timestamp, level, category, message);
});

// In production, intercept console to prevent leaks
if (!isDevelopment) {
  const noop = () => undefined;
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  // Keep warn and error in production for critical issues
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  
  console.warn = (...args: unknown[]) => {
    fileTransport.log(
      new Date().toISOString().replace('T', ' ').substring(0, 19),
      'WARN',
      'console',
      args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
    );
    if (isDevelopment) originalWarn(...args);
  };
  
  console.error = (...args: unknown[]) => {
    fileTransport.log(
      new Date().toISOString().replace('T', ' ').substring(0, 19),
      'ERROR',
      'console',
      args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
    );
    if (isDevelopment) originalError(...args);
  };
}

// Global error handlers
window.addEventListener('error', (event) => {
  loggers[LogCategory.ERROR_BOUNDARY].error('Unhandled Error:', {
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    column: event.colno,
    stack: event.error?.stack,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  loggers[LogCategory.ERROR_BOUNDARY].error('Unhandled Promise Rejection:', {
    reason: event.reason,
    stack: event.reason?.stack,
  });
});

/**
 * Main logger instance for categorized logging
 * @example
 * logger.info(LogCategory.API, "Fetching data", { url: "/api/data" });
 * logger.error(LogCategory.AUTH, "Login failed", error);
 */
export const logger = {
  debug: (category: LogCategory, ...args: unknown[]) => loggers[category].debug(...args),
  info: (category: LogCategory, ...args: unknown[]) => loggers[category].info(...args),
  warn: (category: LogCategory, ...args: unknown[]) => loggers[category].warn(...args),
  error: (category: LogCategory, ...args: unknown[]) => loggers[category].error(...args),
  flush: () => fileTransport.flush(),
  destroy: () => fileTransport.destroy(),
};

export default logger;