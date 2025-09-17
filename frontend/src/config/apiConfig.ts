/**
 * API Configuration Module
 * Single Source of Truth for Backend API URL
 * 
 * Principles: KISS, DRY, SSoT
 * This centralized configuration ensures all services use the same API URL
 * and provides a single place to modify the backend endpoint.
 */

/**
 * API Configuration object with all backend-related settings
 */
export const API_CONFIG = {
  // Backend API base URL - uses environment variable with localhost fallback for development
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080',
  
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