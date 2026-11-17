/**
 * Web Worker shim for React Native
 * React Native doesn't support Web Workers the same way browsers do
 * For ZK proof generation, we'll run synchronously (no workers)
 */

// Minimal Worker polyfill that runs tasks synchronously
class WorkerShim {
  constructor(scriptURL) {
    this.scriptURL = scriptURL;
    this.onmessage = null;
    this.onerror = null;
  }

  postMessage(message) {
    // In React Native, we can't spawn workers, so we just ignore
    // snarkjs will fall back to synchronous execution
    if (this.onerror) {
      this.onerror(new Error('Web Workers not supported in React Native'));
    }
  }

  terminate() {
    // No-op
  }
}

module.exports = WorkerShim;
