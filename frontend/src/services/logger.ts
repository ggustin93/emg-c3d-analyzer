/**
 * Professional, categorized logger for the frontend.
 * Uses `tslog` with proper transport pattern to avoid console interception issues.
 * Automatically saves all logs to frontend.log without causing infinite loops.
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
  CONSOLE = "console", // For captured console logs
}

// File logging transport for browser environment
class BrowserFileTransport {
  public logBuffer: string[] = [];  // Made public for direct console access
  private flushInterval: number;
  private originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  constructor(flushIntervalMs = 1000) {
    this.flushInterval = window.setInterval(() => this.flush(), flushIntervalMs);
    
    // Flush logs before page unload
    window.addEventListener('beforeunload', () => this.flush());
  }

  log(logObj: ILogObj): void {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const level = (logObj._meta as any)?.logLevelName?.toUpperCase().padEnd(5) || 'INFO';
    const category = (logObj._meta as any)?.name || 'frontend';
    
    // Format log entry
    const logEntry = `${timestamp}\t${level}\t[${category}] ${this.formatMessage(logObj)}`;
    this.logBuffer.push(logEntry);

    // Auto-flush if buffer gets large
    if (this.logBuffer.length > 100) {
      this.flush();
    }
  }

  private formatMessage(logObj: ILogObj): string {
    const messages = (logObj._meta as any)?.argumentsArray || [];
    return messages
      .map((arg: unknown) => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');
  }

  public async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logs = this.logBuffer.splice(0);
    
    try {
      // Send logs to backend endpoint for file writing
      const response = await fetch('/api/logs/frontend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      // Fallback: Store in localStorage if backend unavailable
      // Use original console to prevent infinite loops
      try {
        const existingLogs = localStorage.getItem('frontend_logs') || '';
        localStorage.setItem('frontend_logs', existingLogs + '\n' + logs.join('\n'));
      } catch (storageError) {
        // If even localStorage fails, use original console as last resort
        this.originalConsole.warn('Failed to flush logs to backend and localStorage:', error, storageError);
      }
    }
  }

  destroy(): void {
    this.flush();
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }
}

// Create file transport instance
const fileTransport = new BrowserFileTransport();

// Base logger configuration with file transport
const baseLogger: Logger<ILogObj> = new Logger({
  name: "frontend",
  minLevel: import.meta.env.PROD ? 3 : 0, // 3: warn, 0: silly
  prettyLogTemplate: "{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}:{{ms}}\t{{logLevelName}}\t[{{name}}]",
  prettyErrorTemplate: "\n{{errorName}} {{errorMessage}}\nerror stack:\n{{errorStack}}",
  prettyErrorStackTemplate: "  • {{fileName}}\t{{method}}\n\t{{filePathWithLine}}",
  // Disable default console transport to avoid infinite loops
  type: "hidden",
  // Store arguments in a predictable place for transport
  argumentsArrayName: "msg"
});

// Attach our custom transport with proper message extraction
baseLogger.attachTransport((logObj) => {
  // Extract messages from the logObj properly
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const level = (logObj._meta as any)?.logLevelName?.toUpperCase().padEnd(5) || 'INFO';
  const category = (logObj._meta as any)?.name || 'frontend';
  
  // Get the actual message content from the logObj
  let message = '';
  if ((logObj as any).msg && Array.isArray((logObj as any).msg)) {
    // Messages are stored in the msg array
    message = (logObj as any).msg.map((arg: unknown) => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
  } else {
    // Fallback to extracting from other properties
    const keys = Object.keys(logObj).filter(k => k !== '_meta');
    message = keys.map(k => {
      const val = logObj[k];
      if (typeof val === 'object' && val !== null) {
        try {
          return JSON.stringify(val, null, 2);
        } catch {
          return String(val);
        }
      }
      return String(val);
    }).join(' ');
  }
  
  const logEntry = `${timestamp}\t${level}\t[${category}] ${message}`;
  fileTransport.logBuffer.push(logEntry);
  
  if (fileTransport.logBuffer.length > 100) {
    fileTransport.flush();
  }
});

// Create a child logger for each category
const loggers = Object.values(LogCategory).reduce((acc, category) => {
  acc[category] = baseLogger.getSubLogger({ name: category });
  return acc;
}, {} as Record<LogCategory, Logger<ILogObj>>);

// Store original console methods safely
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

// Console interception to capture all console.* calls
// Using direct logging to file transport to ensure messages are captured
const interceptConsole = () => {
  console.log = (...args: unknown[]): void => {
    originalConsole.log(...args);
    // Directly create and send log entry to ensure message capture
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const message = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    const logEntry = `${timestamp}\tINFO \t[console] ${message}`;
    fileTransport.logBuffer.push(logEntry);
    if (fileTransport.logBuffer.length > 100) {
      fileTransport.flush();
    }
    return undefined; // Explicitly return void
  };
  
  console.info = (...args: unknown[]): void => {
    originalConsole.info(...args);
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const message = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    const logEntry = `${timestamp}\tINFO \t[console] ${message}`;
    fileTransport.logBuffer.push(logEntry);
    if (fileTransport.logBuffer.length > 100) {
      fileTransport.flush();
    }
    return undefined; // Explicitly return void
  };
  
  console.warn = (...args: unknown[]): void => {
    originalConsole.warn(...args);
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const message = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    const logEntry = `${timestamp}\tWARN \t[console] ${message}`;
    fileTransport.logBuffer.push(logEntry);
    if (fileTransport.logBuffer.length > 100) {
      fileTransport.flush();
    }
    return undefined; // Explicitly return void
  };
  
  console.error = (...args: unknown[]): void => {
    originalConsole.error(...args);
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const message = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    const logEntry = `${timestamp}\tERROR\t[console] ${message}`;
    fileTransport.logBuffer.push(logEntry);
    if (fileTransport.logBuffer.length > 100) {
      fileTransport.flush();
    }
    return undefined; // Explicitly return void
  };
  
  console.debug = (...args: unknown[]): void => {
    originalConsole.debug(...args);
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const message = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    const logEntry = `${timestamp}\tDEBUG\t[console] ${message}`;
    fileTransport.logBuffer.push(logEntry);
    if (fileTransport.logBuffer.length > 100) {
      fileTransport.flush();
    }
    return undefined; // Explicitly return void
  };
};

// Initialize console interception
if (typeof window !== 'undefined') {
  interceptConsole();
}

// Global error handler to capture unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    try {
      loggers[LogCategory.ERROR_BOUNDARY].error('Unhandled Error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack || event.error,
      });
    } catch (loggingError) {
      // Prevent infinite loops in error logging
      originalConsole.error('Error in error logging:', loggingError);
    }
  });

  // Global promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    try {
      loggers[LogCategory.ERROR_BOUNDARY].error('Unhandled Promise Rejection:', {
        reason: event.reason,
        stack: event.reason?.stack,
      });
    } catch (loggingError) {
      // Prevent infinite loops in error logging
      originalConsole.error('Error in promise rejection logging:', loggingError);
    }
  });
}

/**
 * The main logger instance. Use this for all frontend logging.
 *
 * @example
 * logger.info(LogCategory.API, "Fetching data from endpoint", { url: "/data" });
 * logger.error(LogCategory.AUTH, "Authentication failed", error);
 */
export const logger = {
  silly: (category: LogCategory, ...args: unknown[]) => loggers[category].silly(...args),
  debug: (category: LogCategory, ...args: unknown[]) => loggers[category].debug(...args),
  info: (category: LogCategory, ...args: unknown[]) => loggers[category].info(...args),
  warn: (category: LogCategory, ...args: unknown[]) => loggers[category].warn(...args),
  error: (category: LogCategory, ...args: unknown[]) => loggers[category].error(...args),
  fatal: (category: LogCategory, ...args: unknown[]) => loggers[category].fatal(...args),
  
  // Utility to restore original console (for testing or debugging)
  restoreConsole: () => {
    Object.assign(console, originalConsole);
  },
  
  // Utility to flush logs immediately
  flush: () => fileTransport.flush(),
  
  // Cleanup method
  destroy: () => fileTransport.destroy(),
};

export default logger;