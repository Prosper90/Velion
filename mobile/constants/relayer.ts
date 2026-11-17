/**
 * Relayer Configuration
 *
 * The relayer server handles zero-knowledge proof generation
 * since React Native cannot run Node.js modules like snarkjs
 */

// For local development, use your computer's IP address
// Find it with: ipconfig (Windows) or ifconfig (Mac/Linux)
// Example: http://192.168.1.100:3001

// Localhost won't work from mobile device/emulator
// Use your actual IP address or ngrok for testing

export const RELAYER_CONFIG = {
  // Development (local machine)
  BASE_URL: __DEV__
    ? "http://172.20.10.3:3004" // Your computer's IP address (updated)
    : "https://veilonbackend-production.up.railway.app", // Production URL

  ENDPOINTS: {
    SHIELD: "/api/privacy/shield",
    UNSHIELD: "/api/privacy/unshield",
    TRANSFER: "/api/privacy/transfer",
    HEALTH: "/api/privacy/health",
  },

  TIMEOUT: 30000, // 30 seconds
};

// Helper to get full endpoint URL
export function getRelayerEndpoint(
  endpoint: keyof typeof RELAYER_CONFIG.ENDPOINTS
): string {
  return `${RELAYER_CONFIG.BASE_URL}${RELAYER_CONFIG.ENDPOINTS[endpoint]}`;
}
