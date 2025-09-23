import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger, LogCategory } from '@/services/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  level?: 'page' | 'section' | 'component';
  name?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorCount: number;
}

interface ErrorContext {
  userId?: string;
  sessionId?: string;
  path: string;
  timestamp: string;
  level: string;
  componentName?: string;
}

/**
 * Production-ready Error Boundary for React error capture
 * Automatically logs all component errors to our structured logging system
 */
export class ErrorBoundary extends Component<Props, State> {
  private errorContext: ErrorContext;
  private sessionId: string;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      errorCount: 0 
    };
    
    // Generate session ID for error tracking
    this.sessionId = this.getOrCreateSessionId();
    
    this.errorContext = {
      path: window.location.pathname,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: props.level || 'component',
      componentName: props.name,
      // Get user ID from localStorage if available (set by auth system)
      userId: this.getUserId(),
    };
  }

  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('errorSessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('errorSessionId', sessionId);
    }
    return sessionId;
  }

  private getUserId(): string | undefined {
    try {
      // Try to get user ID from localStorage (set by auth system)
      const authData = localStorage.getItem('sb-emg-analyzer-auth-token');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed?.user?.id;
      }
    } catch {
      // Silent fail if auth data is malformed
    }
    return undefined;
  }

  static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error,
      errorCount: 0 
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Enhanced error logging with full context
    const errorData = {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause,
      },
      componentStack: errorInfo.componentStack,
      context: {
        ...this.errorContext,
        timestamp: new Date().toISOString(), // Update timestamp
      },
      browser: {
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        language: navigator.language,
        platform: navigator.platform,
        cookiesEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
      },
      performance: {
        memory: (performance as any).memory?.usedJSHeapSize,
        navigation: performance.getEntriesByType('navigation')[0],
      },
    };

    // Log to structured logger (works in both dev and prod)
    logger.error(LogCategory.ERROR_BOUNDARY, `React Error: ${error.message}`, errorData);

    // In production, send minimal metrics (not full error details)
    if (!import.meta.env.DEV) {
      this.sendErrorMetric(error);
    }

    // Increment error count for circuit breaker pattern
    this.setState(prev => ({ 
      errorCount: prev.errorCount + 1 
    }));

    // If too many errors, could implement circuit breaker
    if (this.state.errorCount > 5) {
      logger.error(LogCategory.ERROR_BOUNDARY, 'Error boundary circuit breaker triggered', {
        errorCount: this.state.errorCount,
        context: this.errorContext,
      });
    }
  }

  private async sendErrorMetric(error: Error) {
    try {
      // Only send aggregated metrics, not full error details
      const metric = {
        type: 'react-error',
        level: this.props.level || 'component',
        component: this.props.name || 'unknown',
        message: error.message.substring(0, 100), // Truncate for privacy
        path: this.errorContext.path,
        sessionId: this.sessionId,
        timestamp: Date.now(),
      };

      // Use fetch directly since we're in error handling context
      await fetch('/api/metrics/frontend-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
      }).catch(() => {
        // Silent fail - don't create error loops
        // Errors will still be logged locally
      });
    } catch {
      // Absolute silent fail to prevent error cascades
    }
  }

  private handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: undefined,
      errorCount: 0 
    });
    // Optionally reload the page for a fresh start
    if (this.props.level === 'page') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default error UI based on error boundary level
      if (this.props.level === 'page') {
        // Full page error
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
              <div className="flex items-center mb-4">
                <svg className="h-12 w-12 text-red-500 mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Something went wrong
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    The application encountered an unexpected error.
                  </p>
                </div>
              </div>
              
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-4 p-3 bg-gray-100 rounded text-xs">
                  <summary className="cursor-pointer font-medium">Error Details (Dev Only)</summary>
                  <pre className="mt-2 whitespace-pre-wrap text-red-600">
                    {this.state.error.message}
                    {'\n\n'}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}

              <button
                onClick={() => window.location.reload()}
                className="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
              >
                Reload Application
              </button>
            </div>
          </div>
        );
      }

      // Section or component level error - more compact UI
      return (
        <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" 
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
                clipRule="evenodd" />
            </svg>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">
                {this.props.name ? `Error in ${this.props.name}` : 'Component Error'}
              </h3>
              <p className="mt-1 text-sm text-red-700">
                This section encountered an error and cannot be displayed.
              </p>
              
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-2 text-xs text-red-600">
                  <summary className="cursor-pointer">Debug Info</summary>
                  <pre className="mt-1">{this.state.error.message}</pre>
                </details>
              )}

              {this.props.level === 'component' && (
                <button
                  onClick={this.handleReset}
                  className="mt-3 text-sm text-red-600 hover:text-red-500 underline"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Convenience HOC for wrapping components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}