/**
 * Professional, categorized logger for the frontend.
 * Uses `tslog` for structured, beautiful, and extensible logging.
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

// Base logger configuration
const baseLogger: Logger<ILogObj> = new Logger({
  name: "frontend",
  minLevel: import.meta.env.PROD ? 3 : 0, // 3: warn, 0: silly
  prettyLogTemplate: "{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}:{{ms}}\t{{logLevelName}}\t[{{name}}]",
  prettyErrorTemplate: "\n{{errorName}} {{errorMessage}}\nerror stack:\n{{errorStack}}",
  prettyErrorStackTemplate: "  • {{fileName}}\t{{method}}\n\t{{filePathWithLine}}",
});

// Create a child logger for each category
const loggers = Object.values(LogCategory).reduce((acc, category) => {
  acc[category] = baseLogger.getSubLogger({ name: category });
  return acc;
}, {} as Record<LogCategory, Logger<ILogObj>>);

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
};

export default logger;