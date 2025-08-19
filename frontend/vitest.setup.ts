
import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Polyfill window.fetch if needed in tests
if (!globalThis.fetch) {
  // eslint-disable-next-line @typescript-library/no-var-requires
  const fetch = require('node-fetch');
  // @ts-ignore
  globalThis.fetch = fetch;
}