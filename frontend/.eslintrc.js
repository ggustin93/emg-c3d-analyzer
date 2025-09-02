module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    // Prevent console.log usage in production code
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    
    // More specific console restrictions
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.object.name='console'][callee.property.name='log']",
        message: 'Use logger.debug() instead of console.log(). Import { logger, LogCategory } from "@/services/logger"'
      },
      {
        selector: "CallExpression[callee.object.name='console'][callee.property.name='info']",
        message: 'Use logger.info() instead of console.info(). Import { logger, LogCategory } from "@/services/logger"'
      }
    ],
    
    // Allow console.warn and console.error for critical debugging
    // These will still be captured by the logging system
    
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    
    // React specific rules
    'react/jsx-uses-react': 'off', // Not needed with React 17+ JSX transform
    'react/react-in-jsx-scope': 'off', // Not needed with React 17+ JSX transform
    'react-hooks/exhaustive-deps': 'warn'
  },
  
  // Allow console methods in specific patterns
  overrides: [
    {
      // Test files can suppress console output
      files: ['**/__tests__/**/*', '**/*.test.*', '**/*.spec.*'],
      rules: {
        'no-console': 'off',
        'no-restricted-syntax': 'off'
      }
    },
    {
      // Logger service itself can use console
      files: ['**/logger.ts', '**/logger.js'],
      rules: {
        'no-console': 'off',
        'no-restricted-syntax': 'off'
      }
    }
  ]
};

