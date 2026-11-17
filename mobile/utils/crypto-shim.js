/**
 * Crypto shim for React Native
 * Provides minimal crypto API compatibility
 */

// Ensure Buffer is available globally
const { Buffer } = require('@craftzdog/react-native-buffer');
if (typeof global !== 'undefined' && !global.Buffer) {
  global.Buffer = Buffer;
}

// Import the random values polyfill
require('react-native-get-random-values');

// Create a minimal crypto object
const cryptoShim = {
  getRandomValues: (array) => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      return crypto.getRandomValues(array);
    }
    // Fallback
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  },
  randomBytes: (size) => {
    const array = new Uint8Array(size);
    return cryptoShim.getRandomValues(array);
  },
  randomFillSync: (buffer, offset, size) => {
    const actualOffset = offset || 0;
    const actualSize = size || buffer.length - actualOffset;

    // Use getRandomValues for better randomness
    const randomBytes = new Uint8Array(actualSize);
    cryptoShim.getRandomValues(randomBytes);

    // Copy to buffer
    for (let i = 0; i < actualSize; i++) {
      buffer[actualOffset + i] = randomBytes[i];
    }

    return buffer;
  },
  // Hash and HMAC functions using polyfills
  createHash: (algorithm) => {
    // Check if global crypto has createHash (from global-setup.js)
    if (typeof global.crypto !== 'undefined' && global.crypto.createHash) {
      return global.crypto.createHash(algorithm);
    }
    // Fallback to direct import
    try {
      const createHash = require('create-hash');
      return createHash(algorithm);
    } catch (error) {
      throw new Error(
        `crypto.createHash('${algorithm}') not available. ` +
        `Please ensure create-hash is installed: npm install create-hash`
      );
    }
  },
  createHmac: (algorithm, key) => {
    // Check if global crypto has createHmac (from global-setup.js)
    if (typeof global.crypto !== 'undefined' && global.crypto.createHmac) {
      return global.crypto.createHmac(algorithm, key);
    }
    // Fallback to direct import
    try {
      const createHmac = require('create-hmac');
      return createHmac(algorithm, key);
    } catch (error) {
      throw new Error(
        `crypto.createHmac('${algorithm}') not available. ` +
        `Please ensure create-hmac is installed: npm install create-hmac`
      );
    }
  },
  pbkdf2Sync: (password, salt, iterations, keylen, digest) => {
    // For now, we'll throw if this is needed
    // If needed later, we can add pbkdf2 polyfill
    throw new Error('crypto.pbkdf2Sync not available in React Native');
  },
};

module.exports = cryptoShim;
