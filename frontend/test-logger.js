// Quick test to verify logger behavior
import { logger, LogCategory } from './src/services/logger.ts';

// Check if logger is properly configured
console.log('Testing logger configuration...');
console.log('Environment:', import.meta.env.DEV ? 'Development' : 'Production');

// Test logging in current environment
try {
  logger.info(LogCategory.API, 'Test info message');
  logger.error(LogCategory.ERROR_BOUNDARY, 'Test error message');
  
  // Check if flush works without errors
  logger.flush().then(() => {
    console.log('✅ Flush completed without errors');
  }).catch(err => {
    console.log('❌ Flush error:', err);
  });
  
  console.log('✅ Logger test completed successfully');
} catch (error) {
  console.error('❌ Logger test failed:', error);
}
