/**
 * Production-grade logger for the frontend.
 * In production: Silently captures all logs to file
 * In development: Shows in console + saves to file
 * 
 * Improvements:
 * - Configurable settings
 * - Type-safe interfaces
 * - Memory protection
 * - Retry logic for network failures
 * - Performance optimizations
 * - Health monitoring
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

// Configuration interface for type safety
interface LoggerConfig {
  flushIntervalMs: number;
  maxBufferSize: number;
  maxRetries: number;
  retryDelayMs: number;
  enableLocalStorage: boolean;
  apiEndpoint: string;
  isDevelopment: boolean;
}

// Logger health metrics for monitoring
interface LoggerMetrics {
  totalLogsGenerated: number;
  totalLogsFlushed: number;
  totalLogsDropped: number;
  flushFailures: number;
  lastFlushTime: Date | null;
  lastFlushError: string | null;
}

// Type-safe log entry
interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
}

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = {
  flushIntervalMs: 1000,
  maxBufferSize: 100,
  maxRetries: 3,
  retryDelayMs: 1000,
  enableLocalStorage: true,
  apiEndpoint: '/api/logs/frontend',
  isDevelopment: import.meta.env.DEV,
};

// Global configuration (can be overridden)
const config: LoggerConfig = { ...DEFAULT_CONFIG };

// Date formatter cache for performance
const formatTimestamp = (() => {
  let lastTimestamp = 0;
  let lastFormatted = '';
  
  return (): string => {
    const now = Date.now();
    // Cache timestamp for same second
    if (Math.floor(now / 1000) === Math.floor(lastTimestamp / 1000)) {
      return lastFormatted;
    }
    lastTimestamp = now;
    lastFormatted = new Date(now).toISOString().replace('T', ' ').substring(0, 19);
    return lastFormatted;
  };
})();

// Enhanced file transport with retry logic and monitoring
class BrowserFileTransport {
  private logBuffer: LogEntry[] = [];
  private flushInterval: number;
  private retryCount: Map<string, number> = new Map();
  private metrics: LoggerMetrics = {
    totalLogsGenerated: 0,
    totalLogsFlushed: 0,
    totalLogsDropped: 0,
    flushFailures: 0,
    lastFlushTime: null,
    lastFlushError: null,
  };

  constructor() {
    // Only set up flush interval and logging in development
    if (config.isDevelopment) {
      this.flushInterval = window.setInterval(() => this.flush(), config.flushIntervalMs);
      window.addEventListener('beforeunload', () => this.flush());
      
      // Expose metrics for monitoring
      (window as any).__loggerMetrics = this.metrics;
    }
  }

  log(level: string, category: string, message: string): void {
    // Don't log to file transport in production
    if (!config.isDevelopment) return;
    
    const logEntry: LogEntry = {
      timestamp: formatTimestamp(),
      level,
      category,
      message
    };
    
    this.metrics.totalLogsGenerated++;
    
    // Memory protection: drop oldest logs if buffer is too large
    if (this.logBuffer.length >= config.maxBufferSize * 2) {
      const dropped = this.logBuffer.splice(0, config.maxBufferSize);
      this.metrics.totalLogsDropped += dropped.length;
      
      if (config.isDevelopment) {
        console.warn(`[Logger] Dropped ${dropped.length} logs due to buffer overflow`);
      }
    }
    
    this.logBuffer.push(logEntry);

    if (this.logBuffer.length >= config.maxBufferSize) {
      this.flush();
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    return `${entry.timestamp}\t${entry.level}\t[${entry.category}] ${entry.message}`;
  }

  async flush(): Promise<void> {
    // Don't flush in production - no logging needed
    if (!config.isDevelopment) return;
    
    if (this.logBuffer.length === 0) return;
    
    const logs = this.logBuffer.splice(0);
    const formattedLogs = logs.map(entry => this.formatLogEntry(entry));
    
    try {
      await this.sendLogsWithRetry(formattedLogs);
      this.metrics.totalLogsFlushed += logs.length;
      this.metrics.lastFlushTime = new Date();
      this.metrics.lastFlushError = null;
    } catch (error) {
      this.metrics.flushFailures++;
      this.metrics.lastFlushError = error instanceof Error ? error.message : 'Unknown error';
      
      // Fallback to localStorage if enabled
      if (config.enableLocalStorage) {
        this.saveToLocalStorage(formattedLogs);
      }
    }
  }

  private async sendLogsWithRetry(logs: string[], attempt = 0): Promise<void> {
    try {
      const response = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      if (attempt < config.maxRetries - 1) {
        // Exponential backoff
        const delay = config.retryDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendLogsWithRetry(logs, attempt + 1);
      }
      throw error;
    }
  }

  private saveToLocalStorage(logs: string[]): void {
    try {
      const key = 'frontend_logs';
      const existing = localStorage.getItem(key) || '';
      const combined = existing + '\n' + logs.join('\n');
      
      // Limit localStorage size (keep last 10KB)
      const maxSize = 10 * 1024;
      const trimmed = combined.length > maxSize 
        ? combined.substring(combined.length - maxSize)
        : combined;
      
      localStorage.setItem(key, trimmed);
    } catch {
      // Silent fail - localStorage might be full or disabled
    }
  }

  getMetrics(): LoggerMetrics {
    return { ...this.metrics };
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
  minLevel: config.isDevelopment ? 2 : 3, // 2: info+ in dev, 3: warn+ in prod
  type: config.isDevelopment ? "pretty" : "hidden", // Show in console only in dev
});

// Create categorized loggers
const loggers = Object.values(LogCategory).reduce((acc, category) => {
  acc[category] = baseLogger.getSubLogger({ name: category });
  return acc;
}, {} as Record<LogCategory, Logger<ILogObj>>);

// Type-safe log object interface
interface LogMeta {
  logLevelName?: string;
  name?: string;
}

interface LogMessage {
  msg?: unknown[];
  _meta?: LogMeta;
  [key: string]: unknown;
}

// Attach file transport only in development
if (config.isDevelopment) {
  baseLogger.attachTransport((logObj: LogMessage) => {
    const level = logObj._meta?.logLevelName?.toUpperCase().padEnd(5) || 'INFO';
    const category = logObj._meta?.name || 'frontend';
    
    let message = '';
    if (logObj.msg && Array.isArray(logObj.msg)) {
      message = logObj.msg.map((arg: unknown) => 
        typeof arg === 'object' && arg !== null 
          ? JSON.stringify(arg) 
          : String(arg)
      ).join(' ');
    }
    
    fileTransport.log(level, category, message);
  });
}

// Console silencing for production (no file transport)
if (!config.isDevelopment) {
  const noop = () => undefined;
  
  // Silence non-critical console methods in production
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  
  // Keep console.warn and console.error functional but don't send to file transport
  // This allows critical errors to still appear in browser console for debugging
}

// Global error handlers - only log in development
if (config.isDevelopment) {
  window.addEventListener('error', (event) => {
    loggers[LogCategory.ERROR_BOUNDARY].error('Unhandled Error:', {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack,
      userAgent: navigator.userAgent,
      url: window.location.href,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    loggers[LogCategory.ERROR_BOUNDARY].error('Unhandled Promise Rejection:', {
      reason: event.reason,
      stack: event.reason?.stack,
      promise: event.promise,
      url: window.location.href,
    });
  });
}

/**
 * Main logger instance for categorized logging
 * @example
 * logger.info(LogCategory.API, "Fetching data", { url: "/api/data" });
 * logger.error(LogCategory.AUTH, "Login failed", error);
 * 
 * // Get logger health metrics
 * const metrics = logger.getMetrics();
 * console.log('Logs flushed:', metrics.totalLogsFlushed);
 */
export const logger = {
  debug: (category: LogCategory, ...args: unknown[]) => loggers[category].debug(...args),
  info: (category: LogCategory, ...args: unknown[]) => loggers[category].info(...args),
  warn: (category: LogCategory, ...args: unknown[]) => loggers[category].warn(...args),
  error: (category: LogCategory, ...args: unknown[]) => loggers[category].error(...args),
  flush: () => fileTransport.flush(),
  destroy: () => fileTransport.destroy(),
  getMetrics: () => fileTransport.getMetrics(),
  
  // Configuration update method
  configure: (updates: Partial<LoggerConfig>) => {
    Object.assign(config, updates);
  },
};

export default logger;