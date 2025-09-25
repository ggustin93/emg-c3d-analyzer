/**
 * API Configuration Module
 * Single Source of Truth for Backend API URL
 * 
 * Principles: KISS, DRY, SSoT
 * This centralized configuration ensures all services use the same API URL
 * and provides a single place to modify the backend endpoint.
 */

/**
 * Get the appropriate API base URL based on environment
 * Automatically detects backend URL when deployed on same server
 */
const getApiBaseUrl = (): string => {
  // 1. Use explicit environment variable if set
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // 2. Development mode - use Vite proxy
  if (import.meta.env.DEV) {
    return '/api';
  }
  
  // 3. Production mode - auto-detect backend URL on same server
  const currentHost = window.location.hostname;
  const currentProtocol = window.location.protocol;
  
  // If we're on the same server, use the same hostname with backend port
  if (currentHost === '104.248.143.107' || currentHost !== 'localhost') {
    return `${currentProtocol}//${currentHost}:8080`;
  }
  
  // 4. Fallback to localhost for local development
  return 'http://localhost:8080';
};

/**
 * API Configuration object with all backend-related settings
 */
export const API_CONFIG = {
  // Backend API base URL - supports both development and production environments
  // Development: Uses '/api' for Vite proxy
  // Production: Auto-detects backend URL on same server or uses VITE_API_URL
  baseUrl: getApiBaseUrl(),
  
  // Request timeout in milliseconds (30 seconds)
  timeout: 30000,
  
  // Number of retry attempts for failed requests
  retries: 3,
  
  // Headers to be included in all API requests
  headers: {
    'Content-Type': 'application/json',
  }
} as const;

/**
 * Validates API configuration at application startup
 * Throws an error if required configuration is missing
 */
export const validateApiConfig = (): void => {
  if (!API_CONFIG.baseUrl) {
    throw new Error('API base URL could not be determined');
  }
  
  // Log configuration status with more details
  const isDevelopment = import.meta.env.DEV;
  const isLocalhost = API_CONFIG.baseUrl.includes('localhost');
  const isProxy = API_CONFIG.baseUrl === '/api';
  const isAutoDetected = !import.meta.env.VITE_API_URL && !isDevelopment;
  
  console.info(`🔧 API Configuration validated:`, {
    mode: isDevelopment ? 'Development' : 'Production',
    method: isProxy ? 'Vite Proxy' : isAutoDetected ? 'Auto-detected' : 'Environment Variable',
    baseUrl: isDevelopment ? '/api' : `${API_CONFIG.baseUrl.split('://')[0]}://[HOST]:[PORT]`
  });
};

/**
 * Helper function to construct full API URLs
 * @param endpoint - The API endpoint (e.g., '/upload', '/analysis/recalc')
 * @returns The full URL combining base URL and endpoint
 */
export const getApiUrl = (endpoint: string): string => {
  // Ensure endpoint starts with '/'
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_CONFIG.baseUrl}${normalizedEndpoint}`;
};

// Type export for TypeScript usage
export type ApiConfig = typeof API_CONFIG;

// Store original fetch for fallback
const originalFetch = window.fetch;

// Generate or get correlation ID for request tracking
const getCorrelationId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Lazy-load logger to avoid circular dependency
let loggerModule: any = null;
const getLogger = async () => {
  if (!loggerModule) {
    loggerModule = await import('@/services/logger');
  }
  return loggerModule;
};

/**
 * Enhanced fetch function with error logging and monitoring
 * @param input - URL or Request object
 * @param init - Request options
 * @returns Promise<Response>
 */
export const enhancedFetch: typeof fetch = async (input, init) => {
  const startTime = performance.now();
  const correlationId = getCorrelationId();
  const method = init?.method || 'GET';
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
  
  // Lazy-load logger for development logging
  const loggerLib = await getLogger();
  
  // Log request start in development - SECURITY: Filter sensitive headers
  if (import.meta.env.DEV && loggerLib) {
    // Filter out sensitive headers from logs
    const safeHeaders: Record<string, any> = { ...init?.headers };
    if (safeHeaders) {
      // Mask authorization token if present
      if (safeHeaders['Authorization']) {
        safeHeaders['Authorization'] = 'Bearer [REDACTED]';
      }
      if (safeHeaders['authorization']) {
        safeHeaders['authorization'] = 'Bearer [REDACTED]';
      }
      // Remove any other potentially sensitive headers
      delete safeHeaders['Cookie'];
      delete safeHeaders['cookie'];
      delete safeHeaders['X-API-Key'];
      delete safeHeaders['x-api-key'];
    }
    
    loggerLib.logger.debug(loggerLib.LogCategory.API, `→ ${method} ${url}`, {
      correlationId,
      headers: safeHeaders,
    });
  }
  
  try {
    const response = await originalFetch(input, init);
    const duration = performance.now() - startTime;
    
    // Log slow requests (>3 seconds)
    if (duration > 3000 && loggerLib) {
      loggerLib.logger.warn(loggerLib.LogCategory.API, `Slow API request: ${method} ${url}`, {
        url,
        method,
        duration: Math.round(duration),
        correlationId,
        status: response.status,
      });
    }
    
    // Log non-2xx responses as errors
    if (!response.ok) {
      // Clone response to read body without consuming it
      const cloned = response.clone();
      let errorDetails: any = {};
      
      try {
        // Try to parse error response as JSON
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          errorDetails = await cloned.json();
        } else {
          errorDetails = { message: await cloned.text() };
        }
      } catch {
        errorDetails = { message: 'Unable to parse error response' };
      }
      
      if (loggerLib) {
        loggerLib.logger.error(loggerLib.LogCategory.API, `API Error: ${method} ${url}`, {
          url,
          method,
          status: response.status,
          statusText: response.statusText,
          error: errorDetails,
          duration: Math.round(duration),
          correlationId,
        });
      }
    }
    
    // Log successful response in development
    if (import.meta.env.DEV && response.ok && loggerLib) {
      loggerLib.logger.debug(loggerLib.LogCategory.API, `← ${method} ${url} [${response.status}]`, {
        correlationId,
        duration: Math.round(duration),
      });
    }
    
    return response;
    
  } catch (error) {
    const duration = performance.now() - startTime;
    
    // Network or other errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isOffline = !navigator.onLine;
    
    if (loggerLib) {
      loggerLib.logger.error(loggerLib.LogCategory.API, `Network Error: ${method} ${url}`, {
        url,
        method,
        error: errorMessage,
        duration: Math.round(duration),
        correlationId,
        offline: isOffline,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    
    // Re-throw the error for proper handling
    throw error;
  }
};

/**
 * API client with built-in logging and error handling
 * Use this instead of direct fetch calls for consistent error tracking
 */
export const apiClient = {
  /**
   * Make a GET request with logging
   */
  async get(endpoint: string, options?: RequestInit) {
    const url = getApiUrl(endpoint);
    return enhancedFetch(url, {
      ...options,
      method: 'GET',
      headers: {
        ...API_CONFIG.headers,
        ...options?.headers,
      },
    });
  },
  
  /**
   * Make a POST request with logging
   */
  async post(endpoint: string, body?: any, options?: RequestInit) {
    const url = getApiUrl(endpoint);
    return enhancedFetch(url, {
      ...options,
      method: 'POST',
      headers: {
        ...API_CONFIG.headers,
        ...options?.headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  },
  
  /**
   * Make a PUT request with logging
   */
  async put(endpoint: string, body?: any, options?: RequestInit) {
    const url = getApiUrl(endpoint);
    return enhancedFetch(url, {
      ...options,
      method: 'PUT',
      headers: {
        ...API_CONFIG.headers,
        ...options?.headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  },
  
  /**
   * Make a DELETE request with logging
   */
  async delete(endpoint: string, options?: RequestInit) {
    const url = getApiUrl(endpoint);
    return enhancedFetch(url, {
      ...options,
      method: 'DELETE',
      headers: {
        ...API_CONFIG.headers,
        ...options?.headers,
      },
    });
  },
};

// Optional: Override global fetch to catch all API calls
// Uncomment the following line to enable global interception
// window.fetch = enhancedFetch;