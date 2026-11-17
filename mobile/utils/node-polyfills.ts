/**
 * Node.js polyfills for React Native
 * Required for circomlibjs and other Node.js libraries
 */

// Import and setup Buffer globally IMMEDIATELY
const { Buffer } = require('@craftzdog/react-native-buffer');

// Set up global references
if (typeof global !== 'undefined') {
  global.Buffer = Buffer;
  global.global = global;
} else if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
}

// Setup process polyfill
const processPolyfill = {
  env: {},
  browser: true,
  version: 'v16.0.0',
  versions: { node: '16.0.0' },
  platform: 'browser',
  nextTick: (fn: any) => setTimeout(fn, 0),
};

if (typeof global !== 'undefined') {
  global.process = global.process || processPolyfill;
  global.process.browser = true;
} else if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || processPolyfill;
  (window as any).process.browser = true;
}

// Add __dirname and __filename polyfills
if (typeof global !== 'undefined') {
  global.__dirname = '/';
  global.__filename = '/index.js';
}

console.log('✅ Node.js polyfills loaded (Buffer available globally)');
