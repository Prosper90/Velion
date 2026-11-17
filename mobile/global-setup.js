/**
 * Global setup for React Native
 * This file is loaded FIRST to set up critical polyfills
 */

// ============================================================================
// BLOB POLYFILL - MUST BE FIRST!!!
// ============================================================================
if (typeof global.Blob !== 'undefined') {
  const RNBlob = global.Blob;
  const RNBlobPrototype = RNBlob.prototype;

  global.Blob = function(blobParts, options) {
    // Convert ALL parts to base64 strings (what RN Blob actually accepts)
    const convertedParts = (blobParts || []).map(part => {
      if (part instanceof ArrayBuffer || ArrayBuffer.isView(part)) {
        // Convert to Uint8Array first
        const uint8Array = part instanceof ArrayBuffer
          ? new Uint8Array(part)
          : new Uint8Array(part.buffer, part.byteOffset, part.byteLength);

        // Convert to regular string (RN Blob can handle this)
        let str = '';
        for (let i = 0; i < uint8Array.length; i++) {
          str += String.fromCharCode(uint8Array[i]);
        }
        return str;
      }
      return part;
    });

    // Call original Blob with converted parts
    return new RNBlob(convertedParts, options);
  };

  // Preserve prototype chain
  global.Blob.prototype = RNBlobPrototype;

  console.log('✅ Blob polyfill installed FIRST');
}

// ============================================================================
// URL.createObjectURL POLYFILL - for snarkjs
// ============================================================================
const blobUrls = new Map();
let urlCounter = 0;

// Create our polyfill functions
const createObjectURL = function(blob) {
  const url = `blob:rn-${urlCounter++}`;
  blobUrls.set(url, blob);
  return url;
};

const revokeObjectURL = function(url) {
  blobUrls.delete(url);
};

// Set on global.URL
if (typeof global.URL === 'undefined') {
  global.URL = {};
}
global.URL.createObjectURL = createObjectURL;
global.URL.revokeObjectURL = revokeObjectURL;

// ALSO set on window.URL if it exists
if (typeof window !== 'undefined') {
  if (typeof window.URL === 'undefined') {
    window.URL = {};
  }
  window.URL.createObjectURL = createObjectURL;
  window.URL.revokeObjectURL = revokeObjectURL;
}

// ALSO set directly on globalThis
if (typeof globalThis !== 'undefined') {
  if (typeof globalThis.URL === 'undefined') {
    globalThis.URL = {};
  }
  globalThis.URL.createObjectURL = createObjectURL;
  globalThis.URL.revokeObjectURL = revokeObjectURL;
}

console.log('✅ URL.createObjectURL polyfill installed (all contexts)');

// ============================================================================
// BASE64 POLYFILL - Try react-native-quick-base64 first, fallback to base64-js
// ============================================================================

// Try to use react-native-quick-base64's native implementation first
try {
  require('react-native-quick-base64');
  console.log('✅ react-native-quick-base64 native module loaded');
} catch (e) {
  console.log('⚠️  react-native-quick-base64 native module not available, using JS polyfill');
}

// If the native module didn't install the global functions, use base64-js polyfill
if (typeof global.base64FromArrayBuffer !== 'function') {
  console.log('📦 Installing base64-js polyfill...');
  const base64js = require('base64-js');

/**
 * Convert ArrayBuffer to base64 string
 * @param {ArrayBuffer} arrayBuffer - The buffer to encode
 * @param {boolean} urlSafe - Use URL-safe encoding (optional)
 * @returns {string} Base64 encoded string
 */
function base64FromArrayBuffer(arrayBuffer, urlSafe = false) {
  const uint8Array = new Uint8Array(arrayBuffer);
  let base64String = base64js.fromByteArray(uint8Array);

  // Convert to URL-safe format if requested
  if (urlSafe) {
    base64String = base64String
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  return base64String;
}

/**
 * Convert base64 string to ArrayBuffer
 * @param {string} base64 - The base64 string to decode
 * @param {boolean} removeLinebreaks - Remove line breaks before decoding
 * @returns {ArrayBuffer} Decoded ArrayBuffer
 */
function base64ToArrayBuffer(base64, removeLinebreaks = false) {
  let cleanedBase64 = base64;

  // Remove linebreaks if requested
  if (removeLinebreaks) {
    cleanedBase64 = base64.replace(/\s/g, '');
  }

  // Convert URL-safe base64 to standard base64
  cleanedBase64 = cleanedBase64
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  // Add padding if needed
  while (cleanedBase64.length % 4 !== 0) {
    cleanedBase64 += '=';
  }

  const uint8Array = base64js.toByteArray(cleanedBase64);
  return uint8Array.buffer;
}

  // Install global functions BEFORE any modules that depend on them
  global.base64FromArrayBuffer = base64FromArrayBuffer;
  global.base64ToArrayBuffer = base64ToArrayBuffer;

  console.log('✅ base64-js polyfill installed (global.base64FromArrayBuffer ready)');
} else {
  console.log('✅ base64FromArrayBuffer already available (from react-native-quick-base64)');
}

// Now set up Buffer globally
const { Buffer } = require('@craftzdog/react-native-buffer');
global.Buffer = Buffer;

// Set up global reference
global.global = global;

// Set up process
if (!global.process) {
  global.process = {};
}
global.process.env = global.process.env || {};
global.process.browser = true;
global.process.version = 'v16.0.0';
global.process.versions = { node: '16.0.0' };
global.process.platform = 'browser';
global.process.nextTick = global.process.nextTick || ((fn, ...args) => {
  setTimeout(() => fn(...args), 0);
});

// Random values polyfill
require('react-native-get-random-values');

// ============================================================================
// WEBASSEMBLY POLYFILL for React Native
// ============================================================================

// Add WebAssembly support for React Native
if (typeof global.WebAssembly === 'undefined') {
  try {
    const wasmPolyfill = require('react-native-webassembly');
    global.WebAssembly = wasmPolyfill;
    console.log('✅ WebAssembly polyfill installed');
  } catch (error) {
    console.warn('⚠️  WebAssembly polyfill not available:', error.message);
    // Provide a minimal fallback
    global.WebAssembly = {
      compile: () => Promise.reject(new Error('WebAssembly not supported')),
      instantiate: () => Promise.reject(new Error('WebAssembly not supported')),
      validate: () => false,
    };
  }
}

// ============================================================================
// CRYPTO POLYFILLS for Node.js crypto module compatibility
// ============================================================================

// Polyfill crypto.getRandomValues (already provided by react-native-get-random-values)
if (typeof global.crypto === 'undefined') {
  global.crypto = {};
}

if (typeof global.crypto.getRandomValues === 'undefined') {
  global.crypto.getRandomValues = (array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };
}

// Polyfill crypto.randomFillSync for circomlibjs compatibility
if (typeof global.crypto.randomFillSync === 'undefined') {
  global.crypto.randomFillSync = (buffer, offset, size) => {
    const actualOffset = offset || 0;
    const actualSize = size || buffer.length - actualOffset;

    // Use crypto.getRandomValues if available
    if (global.crypto.getRandomValues) {
      const randomBytes = new Uint8Array(actualSize);
      global.crypto.getRandomValues(randomBytes);

      // Copy to buffer
      for (let i = 0; i < actualSize; i++) {
        buffer[actualOffset + i] = randomBytes[i];
      }
    } else {
      // Fallback to Math.random
      for (let i = 0; i < actualSize; i++) {
        buffer[actualOffset + i] = Math.floor(Math.random() * 256);
      }
    }

    return buffer;
  };

  console.log('✅ crypto.randomFillSync polyfill installed');
}

// Polyfill crypto.randomBytes for additional compatibility
if (typeof global.crypto.randomBytes === 'undefined') {
  global.crypto.randomBytes = (size) => {
    const buffer = new Uint8Array(size);
    return global.crypto.randomFillSync(buffer);
  };

  console.log('✅ crypto.randomBytes polyfill installed');
}

console.log('🚀 Global setup complete - base64, Buffer, crypto, and polyfills loaded');
