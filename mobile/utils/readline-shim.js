/**
 * Readline shim for React Native
 * snarkjs imports readline but doesn't use it in browser builds
 */

module.exports = {
  createInterface: () => ({
    question: () => {},
    close: () => {},
  }),
};
