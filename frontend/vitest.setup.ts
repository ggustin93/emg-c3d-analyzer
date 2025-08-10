
// Polyfill window.fetch if needed in tests
if (!globalThis.fetch) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fetch = require('node-fetch');
  // @ts-ignore
  globalThis.fetch = fetch;
}


