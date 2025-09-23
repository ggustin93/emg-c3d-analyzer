/**
 * API Configuration Module
 * Single Source of Truth for Backend API URL
 * 
 * Principles: KISS, DRY, SSoT
 * This centralized configuration ensures all services use the same API URL
 * and provides a single place to modify the backend endpoint.
 */

import { logger, LogCategory } from '@/services/logger';

/**
 * API Configuration object with all backend-related settings
 */
export const API_CONFIG = {
  // Backend API base URL - supports both development and production environments
  // Development: Uses '/api' for Vite proxy or falls back to localhost
  // Production: Uses VITE_API_URL environment variable
  baseUrl: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:8080'),
  
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
    throw new Error('VITE_API_URL is required but not defined in environment variables');
  }
  
  // Log configuration status (without exposing sensitive URLs in production)
  const isDevelopment = API_CONFIG.baseUrl.includes('localhost');
  console.info(`🔧 API Configuration validated - Mode: ${isDevelopment ? 'Development' : 'Production'}`);
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
  
  // Log request start in development
  if (import.meta.env.DEV) {
    logger.debug(LogCategory.API, `→ ${method} ${url}`, {
      correlationId,
      headers: init?.headers,
    });
  }
  
  try {
    const response = await originalFetch(input, init);
    const duration = performance.now() - startTime;
    
    // Log slow requests (>3 seconds)
    if (duration > 3000) {
      logger.warn(LogCategory.API, `Slow API request: ${method} ${url}`, {
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
      
      logger.error(LogCategory.API, `API Error: ${method} ${url}`, {
        url,
        method,
        status: response.status,
        statusText: response.statusText,
        error: errorDetails,
        duration: Math.round(duration),
        correlationId,
      });
    }
    
    // Log successful response in development
    if (import.meta.env.DEV && response.ok) {
      logger.debug(LogCategory.API, `← ${method} ${url} [${response.status}]`, {
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
    
    logger.error(LogCategory.API, `Network Error: ${method} ${url}`, {
      url,
      method,
      error: errorMessage,
      duration: Math.round(duration),
      correlationId,
      offline: isOffline,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
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