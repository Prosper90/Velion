import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState } from 'react-native';

/**
 * Security Store
 * Manages PIN setup, authentication, and biometric settings
 */

interface SecurityState {
  // State
  isPinSet: boolean;
  isAuthenticated: boolean;
  biometricsEnabled: boolean;
  biometricsAvailable: boolean;
  lastAuthTime: number;
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  setupPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  changePin: (oldPin: string, newPin: string) => Promise<void>;
  authenticate: () => Promise<boolean>;
  lock: () => void;
  enableBiometrics: () => Promise<void>;
  disableBiometrics: () => Promise<void>;
  checkBiometricsAvailability: () => Promise<void>;
}

const SECURE_KEYS = {
  PIN_HASH: 'veilon_pin_hash',
  BIOMETRICS_ENABLED: 'veilon_biometrics_enabled',
};

// Simple hash function (in production, use bcrypt or similar)
const hashPin = (pin: string): string => {
  // For now, use a simple hash with salt
  // In production, use expo-crypto or a proper hashing library
  const salt = 'veilon_salt_2024';
  let hash = 0;
  const combined = salt + pin;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
};

export const useSecurityStore = create<SecurityState>((set, get) => ({
  // Initial state
  isPinSet: false,
  isAuthenticated: false,
  biometricsEnabled: false,
  biometricsAvailable: false,
  lastAuthTime: 0,
  isLoading: true,

  // Initialize security settings
  initialize: async () => {
    try {
      console.log('🔒 Initializing security store...');
      set({ isLoading: true });

      // Check if PIN is set
      const pinHash = await SecureStore.getItemAsync(SECURE_KEYS.PIN_HASH);
      const isPinSet = !!pinHash;

      // Check if biometrics is enabled
      const biometricsEnabledStr = await SecureStore.getItemAsync(SECURE_KEYS.BIOMETRICS_ENABLED);
      const biometricsEnabled = biometricsEnabledStr === 'true';

      // Check biometrics availability
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const biometricsAvailable = compatible && enrolled;

      console.log('✅ Security initialized:', {
        isPinSet,
        biometricsEnabled,
        biometricsAvailable,
      });

      set({
        isPinSet,
        biometricsEnabled: biometricsEnabled && biometricsAvailable,
        biometricsAvailable,
        isAuthenticated: !isPinSet, // If no PIN set, no auth needed
        isLoading: false,
      });

      // Set up app state listener for auto-lock
      AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'background' || nextAppState === 'inactive') {
          console.log('📱 App going to background, locking...');
          get().lock();
        }
      });
    } catch (error) {
      console.error('❌ Failed to initialize security:', error);
      set({ isLoading: false });
    }
  },

  // Set up a new PIN
  setupPin: async (pin: string) => {
    try {
      console.log('🔐 Setting up new PIN...');

      // Validate PIN
      if (!pin || pin.length < 4 || pin.length > 6) {
        throw new Error('PIN must be 4-6 digits');
      }

      if (!/^\d+$/.test(pin)) {
        throw new Error('PIN must contain only numbers');
      }

      // Hash and store PIN
      const hashedPin = hashPin(pin);
      await SecureStore.setItemAsync(SECURE_KEYS.PIN_HASH, hashedPin);

      // Don't auto-authenticate - user should verify PIN after setup
      set({ isPinSet: true, isAuthenticated: false, lastAuthTime: 0 });
      console.log('✅ PIN set up successfully');
    } catch (error: any) {
      console.error('❌ Failed to setup PIN:', error);
      throw new Error(error.message || 'Failed to setup PIN');
    }
  },

  // Verify a PIN
  verifyPin: async (pin: string): Promise<boolean> => {
    try {
      console.log('🔍 Verifying PIN...');

      const storedHash = await SecureStore.getItemAsync(SECURE_KEYS.PIN_HASH);
      if (!storedHash) {
        console.error('❌ No PIN set up');
        return false;
      }

      const inputHash = hashPin(pin);
      const isValid = inputHash === storedHash;

      if (isValid) {
        set({ isAuthenticated: true, lastAuthTime: Date.now() });
        console.log('✅ PIN verified successfully');
      } else {
        console.log('❌ Invalid PIN');
      }

      return isValid;
    } catch (error) {
      console.error('❌ Failed to verify PIN:', error);
      return false;
    }
  },

  // Change PIN
  changePin: async (oldPin: string, newPin: string) => {
    try {
      console.log('🔄 Changing PIN...');

      // Verify old PIN first
      const oldPinValid = await get().verifyPin(oldPin);
      if (!oldPinValid) {
        throw new Error('Current PIN is incorrect');
      }

      // Validate new PIN
      if (!newPin || newPin.length < 4 || newPin.length > 6) {
        throw new Error('New PIN must be 4-6 digits');
      }

      if (!/^\d+$/.test(newPin)) {
        throw new Error('New PIN must contain only numbers');
      }

      // Hash and store new PIN
      const hashedPin = hashPin(newPin);
      await SecureStore.setItemAsync(SECURE_KEYS.PIN_HASH, hashedPin);

      console.log('✅ PIN changed successfully');
    } catch (error: any) {
      console.error('❌ Failed to change PIN:', error);
      throw new Error(error.message || 'Failed to change PIN');
    }
  },

  // Authenticate using PIN or biometrics
  authenticate: async (): Promise<boolean> => {
    try {
      const { biometricsEnabled, biometricsAvailable, isPinSet } = get();

      // If no PIN set, no authentication needed
      if (!isPinSet) {
        set({ isAuthenticated: true, lastAuthTime: Date.now() });
        return true;
      }

      // Try biometrics if enabled
      if (biometricsEnabled && biometricsAvailable) {
        console.log('🔐 Attempting biometric authentication...');

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to access VeilOn',
          fallbackLabel: 'Use PIN',
          cancelLabel: 'Cancel',
        });

        if (result.success) {
          set({ isAuthenticated: true, lastAuthTime: Date.now() });
          console.log('✅ Biometric authentication successful');
          return true;
        } else {
          console.log('❌ Biometric authentication failed');
          return false;
        }
      }

      // If biometrics not available or failed, PIN will be required
      return false;
    } catch (error) {
      console.error('❌ Authentication error:', error);
      return false;
    }
  },

  // Lock the app (require authentication)
  lock: () => {
    const { isPinSet } = get();
    if (isPinSet) {
      console.log('🔒 App locked');
      set({ isAuthenticated: false });
    }
  },

  // Enable biometric authentication
  enableBiometrics: async () => {
    try {
      const { biometricsAvailable } = get();

      if (!biometricsAvailable) {
        throw new Error('Biometric authentication is not available on this device');
      }

      // Test biometric authentication
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric authentication for VeilOn',
        fallbackLabel: 'Cancel',
      });

      if (result.success) {
        await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRICS_ENABLED, 'true');
        set({ biometricsEnabled: true });
        console.log('✅ Biometrics enabled');
      } else {
        throw new Error('Biometric authentication failed');
      }
    } catch (error: any) {
      console.error('❌ Failed to enable biometrics:', error);
      throw new Error(error.message || 'Failed to enable biometric authentication');
    }
  },

  // Disable biometric authentication
  disableBiometrics: async () => {
    try {
      await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRICS_ENABLED, 'false');
      set({ biometricsEnabled: false });
      console.log('✅ Biometrics disabled');
    } catch (error) {
      console.error('❌ Failed to disable biometrics:', error);
      throw error;
    }
  },

  // Check biometrics availability
  checkBiometricsAvailability: async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const biometricsAvailable = compatible && enrolled;

      set({ biometricsAvailable });

      if (!biometricsAvailable && get().biometricsEnabled) {
        // If biometrics was enabled but is no longer available, disable it
        await get().disableBiometrics();
      }
    } catch (error) {
      console.error('❌ Failed to check biometrics availability:', error);
    }
  },
}));
