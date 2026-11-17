const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Get the project root
const projectRoot = __dirname;

// SDK is embedded in mobile/utils/sdk, no external directory needed
// Only watch the project root
config.watchFolders = [projectRoot];

// Block Node.js-specific files from being processed
config.resolver.blockList = [
  /web-worker\/cjs\/node\.js$/,
  /snarkjs\/build\/cli\.cjs$/,
  /snarkjs\/build\/main\.cjs$/,
];

// Configure resolver to use project node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// Alias snarkjs to use the browser build
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'snarkjs' || moduleName.startsWith('snarkjs/')) {
    // Force use of browser build for snarkjs
    if (moduleName === 'snarkjs') {
      return {
        filePath: path.resolve(projectRoot, 'node_modules/snarkjs/build/browser.esm.js'),
        type: 'sourceFile',
      };
    }
  }

  // Block problematic Node.js-only modules
  if (moduleName === 'web-worker' || moduleName.includes('web-worker/cjs/node')) {
    return {
      filePath: path.resolve(projectRoot, 'utils/web-worker-shim.js'),
      type: 'sourceFile',
    };
  }

  // Default resolver
  return context.resolveRequest(context, moduleName, platform);
};

// Add support for react-native-quick-crypto and Node.js polyfills
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  // Use our crypto shim for SDK compatibility
  crypto: path.resolve(projectRoot, 'utils/crypto-shim.js'),
  stream: require.resolve('stream-browserify'),
  buffer: require.resolve('@craftzdog/react-native-buffer'),
  assert: require.resolve('assert'),
  http: require.resolve('stream-http'),
  https: require.resolve('https-browserify'),
  os: require.resolve('os-browserify/browser'),
  url: require.resolve('url'),
  zlib: require.resolve('browserify-zlib'),
  path: require.resolve('path-browserify'),
  readline: path.resolve(projectRoot, 'utils/readline-shim.js'), // Shim for snarkjs
  fs: path.resolve(projectRoot, 'utils/fs-shim.js'), // Shim for file system
  'web-worker': path.resolve(projectRoot, 'utils/web-worker-shim.js'), // Shim for workers
};

module.exports = config;
