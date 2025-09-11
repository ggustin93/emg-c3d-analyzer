
import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { configure } from '@testing-library/react';
import { act } from 'react';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Configure testing library to use React.act instead of ReactDOMTestUtils.act
configure({
  reactStrictMode: true,
  // This helps reduce deprecation warnings
  asyncUtilTimeout: 5000,
});

// Override the deprecated ReactDOMTestUtils.act with React.act
// This prevents the deprecation warnings from showing up in tests
global.IS_REACT_ACT_ENVIRONMENT = true;

// Suppress the specific React.act deprecation warnings during tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: any[]) => {
  if (
    args[0]?.includes?.('ReactDOMTestUtils.act is deprecated') ||
    args[0]?.includes?.('Warning: `ReactDOMTestUtils.act` is deprecated')
  ) {
    return; // Suppress this specific warning
  }
  originalConsoleError(...args);
};

console.warn = (...args: any[]) => {
  if (
    args[0]?.includes?.('ReactDOMTestUtils.act is deprecated') ||
    args[0]?.includes?.('Warning: `ReactDOMTestUtils.act` is deprecated')
  ) {
    return; // Suppress this specific warning
  }
  originalConsoleWarn(...args);
};

// Polyfill window.fetch if needed in tests
if (!globalThis.fetch) {
  // eslint-disable-next-line @typescript-library/no-var-requires
  const fetch = require('node-fetch');
  // @ts-ignore
  globalThis.fetch = fetch;
}