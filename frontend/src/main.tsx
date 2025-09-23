import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { TooltipProvider } from './components/ui/tooltip';

// Initialize enhanced logging system with console interception and file logging
import { logger, LogCategory } from './services/logger';

/**
 * Setup global error handlers for production error capture
 * These handlers catch errors that escape React's error boundaries
 */
const setupGlobalErrorHandlers = () => {
  // Check if we're in CI/test environment
  const isCI = import.meta.env.CI;
  const isTest = import.meta.env.MODE === 'test';
  
  // Handle uncaught JavaScript errors
  window.addEventListener('error', (event: ErrorEvent) => {
    // Log all errors, not just in development
    const errorData = {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack,
      type: event.error?.name || 'Error',
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    };
    
    logger.error(LogCategory.ERROR_BOUNDARY, 'Uncaught Error', errorData);
    
    // In production, send minimal metrics (if not in test)
    if (!import.meta.env.DEV && !isTest) {
      sendErrorMetric({
        type: 'uncaught-error',
        message: event.message.substring(0, 100),
        path: window.location.pathname,
      });
    }
    
    // Don't prevent default in CI/test environments
    if (!isCI && !isTest) {
      event.preventDefault(); // Prevent default browser error handling
    }
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const errorData = {
      reason: event.reason,
      stack: event.reason?.stack,
      promise: String(event.promise),
      url: window.location.href,
      timestamp: new Date().toISOString(),
      type: 'PromiseRejection',
    };
    
    logger.error(LogCategory.ERROR_BOUNDARY, 'Unhandled Promise Rejection', errorData);
    
    // In production, send minimal metrics
    if (!import.meta.env.DEV && !isTest) {
      sendErrorMetric({
        type: 'promise-rejection',
        message: String(event.reason).substring(0, 100),
        path: window.location.pathname,
      });
    }
    
    if (!isCI && !isTest) {
      event.preventDefault(); // Prevent default browser handling
    }
  });
  
  // Intercept console.error to catch library errors (only in production)
  if (!import.meta.env.DEV) {
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      // Call original console.error
      originalConsoleError.apply(console, args);
      
      // Log to our system
      const message = args
        .map((arg: any) => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');
      
      // Skip React's development warnings in production
      if (!message.includes('Warning:') && !message.includes('DevTools')) {
        logger.error(LogCategory.ERROR_BOUNDARY, 'Console Error', {
          message: message.substring(0, 500),
          stack: new Error().stack,
          timestamp: new Date().toISOString(),
        });
      }
    };
  }
  
  // Log when the app starts
  logger.info(LogCategory.LIFECYCLE, 'Application Started', {
    mode: import.meta.env.MODE,
    dev: import.meta.env.DEV,
    url: window.location.href,
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send error metrics to backend (production only)
 * Sends minimal, aggregated data for monitoring
 */
async function sendErrorMetric(metric: {
  type: string;
  message: string;
  path: string;
}) {
  try {
    // Only send in production, not in development or test
    if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
      return;
    }
    
    const payload = {
      ...metric,
      timestamp: Date.now(),
      sessionId: sessionStorage.getItem('errorSessionId') || 'unknown',
    };
    
    // Fire and forget - don't await
    fetch('/api/metrics/frontend-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silent fail to prevent error loops
    });
  } catch {
    // Absolute silent fail
  }
}

// Set up error handlers before React renders
setupGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={100}>
      <App />
    </TooltipProvider>
  </React.StrictMode>
); 