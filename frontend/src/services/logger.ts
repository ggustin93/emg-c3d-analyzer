/**
 * Professional Logging Service
 * Structured logging with levels and categories for EMG Chart components
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export enum LogCategory {
  CHART_RENDER = 'chart-render',
  DATA_PROCESSING = 'data-processing',
  MVC_CALCULATION = 'mvc-calculation',
  CONTRACTION_ANALYSIS = 'contraction-analysis',
  ACCEPTANCE_RATES = 'acceptance-rates',
  PERFORMANCE = 'performance',
  USER_INTERACTION = 'user-interaction',
  ERROR_BOUNDARY = 'error-boundary'
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: Record<string, any>;
  context?: string;
}

class Logger {
  private currentLevel: LogLevel;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.currentLevel = this.isProduction ? LogLevel.ERROR : LogLevel.DEBUG;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLevel;
  }

  private formatMessage(entry: LogEntry): string {
    const levelStr = LogLevel[entry.level];
    const prefix = `[${entry.timestamp}] ${levelStr} [${entry.category}]`;
    return `${prefix} ${entry.message}`;
  }

  private log(level: LogLevel, category: LogCategory, message: string, data?: Record<string, any>, context?: string): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      context
    };

    const formattedMessage = this.formatMessage(entry);

    switch (level) {
      case LogLevel.DEBUG:
        if (!this.isProduction) {
          console.debug(formattedMessage, data || '');
        }
        break;
      case LogLevel.INFO:
        if (!this.isProduction) {
          console.info(formattedMessage, data || '');
        }
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, data || '');
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, data || '');
        // In production, could send to error tracking service
        break;
    }
  }

  debug(category: LogCategory, message: string, data?: Record<string, any>, context?: string): void {
    this.log(LogLevel.DEBUG, category, message, data, context);
  }

  info(category: LogCategory, message: string, data?: Record<string, any>, context?: string): void {
    this.log(LogLevel.INFO, category, message, data, context);
  }

  warn(category: LogCategory, message: string, data?: Record<string, any>, context?: string): void {
    this.log(LogLevel.WARN, category, message, data, context);
  }

  error(category: LogCategory, message: string, data?: Record<string, any>, context?: string): void {
    this.log(LogLevel.ERROR, category, message, data, context);
  }

  // Convenience methods for EMG Chart specific logging
  chartRender(message: string, data?: Record<string, any>): void {
    this.debug(LogCategory.CHART_RENDER, message, data);
  }

  dataProcessing(message: string, data?: Record<string, any>): void {
    this.debug(LogCategory.DATA_PROCESSING, message, data);
  }

  mvcCalculation(message: string, data?: Record<string, any>): void {
    this.debug(LogCategory.MVC_CALCULATION, message, data);
  }

  contractionAnalysis(message: string, data?: Record<string, any>): void {
    this.debug(LogCategory.CONTRACTION_ANALYSIS, message, data);
  }

  acceptanceRates(message: string, data?: Record<string, any>): void {
    this.debug(LogCategory.ACCEPTANCE_RATES, message, data);
  }

  performance(message: string, data?: Record<string, any>): void {
    this.info(LogCategory.PERFORMANCE, message, data);
  }

  userInteraction(message: string, data?: Record<string, any>): void {
    this.info(LogCategory.USER_INTERACTION, message, data);
  }

  // Performance timing utilities
  private timers = new Map<string, number>();

  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  endTimer(name: string, category: LogCategory = LogCategory.PERFORMANCE): void {
    const startTime = this.timers.get(name);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.performance(`Timer '${name}' completed`, { duration: `${duration.toFixed(2)}ms` });
      this.timers.delete(name);
    }
  }
}

// Create singleton instance
export const logger = new Logger();

// Null logger for production builds (if needed)
export const nullLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  chartRender: () => {},
  dataProcessing: () => {},
  mvcCalculation: () => {},
  contractionAnalysis: () => {},
  performance: () => {},
  userInteraction: () => {},
  startTimer: () => {},
  endTimer: () => {}
};

export default logger;