/**
 * VEILON Mobile App Entry Point
 * This file ensures polyfills are loaded BEFORE anything else
 */

// Load polyfills FIRST (most critical)
import './global-setup';

// Now load the Expo Router entry point
import 'expo-router/entry';
