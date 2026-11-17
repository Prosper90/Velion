import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const PIN_HASH_KEY = 'veilon_pin_hash';
const PIN_SALT_KEY = 'veilon_pin_salt';

/**
 * PIN Security Service
 * Handles PIN creation, verification, and security
 */
export class PinSecurityService {
  /**
   * Hash a PIN with salt for secure storage
   */
  private static async hashPin(pin: string, salt: string): Promise<string> {
    const combined = pin + salt;
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined
    );
    return hash;
  }

  /**
   * Generate a random salt
   */
  private static async generateSalt(): Promise<string> {
    const randomBytes = await Crypto.getRandomBytesAsync(16);
    return Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Check if a PIN has been set
   */
  static async isPinSet(): Promise<boolean> {
    try {
      const pinHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
      return pinHash !== null;
    } catch (error) {
      console.error('Error checking PIN status:', error);
      return false;
    }
  }

  /**
   * Set up a new PIN
   */
  static async setupPin(pin: string): Promise<boolean> {
    try {
      // Validate PIN format (must be 4-6 digits)
      if (!/^\d{4,6}$/.test(pin)) {
        throw new Error('PIN must be 4-6 digits');
      }

      // Generate salt
      const salt = await this.generateSalt();

      // Hash PIN with salt
      const pinHash = await this.hashPin(pin, salt);

      // Store hash and salt securely
      await SecureStore.setItemAsync(PIN_HASH_KEY, pinHash);
      await SecureStore.setItemAsync(PIN_SALT_KEY, salt);

      console.log('✅ PIN set up successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to set up PIN:', error);
      throw error;
    }
  }

  /**
   * Verify a PIN
   */
  static async verifyPin(pin: string): Promise<boolean> {
    try {
      // Get stored hash and salt
      const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
      const salt = await SecureStore.getItemAsync(PIN_SALT_KEY);

      if (!storedHash || !salt) {
        throw new Error('PIN not set up');
      }

      // Hash the provided PIN with the same salt
      const inputHash = await this.hashPin(pin, salt);

      // Compare hashes
      return inputHash === storedHash;
    } catch (error) {
      console.error('❌ Failed to verify PIN:', error);
      return false;
    }
  }

  /**
   * Change PIN (requires old PIN verification)
   */
  static async changePin(oldPin: string, newPin: string): Promise<boolean> {
    try {
      // Verify old PIN first
      const isOldPinValid = await this.verifyPin(oldPin);
      if (!isOldPinValid) {
        throw new Error('Invalid old PIN');
      }

      // Set up new PIN
      return await this.setupPin(newPin);
    } catch (error) {
      console.error('❌ Failed to change PIN:', error);
      throw error;
    }
  }

  /**
   * Remove PIN (requires PIN verification)
   */
  static async removePin(pin: string): Promise<boolean> {
    try {
      // Verify PIN first
      const isPinValid = await this.verifyPin(pin);
      if (!isPinValid) {
        throw new Error('Invalid PIN');
      }

      // Remove PIN hash and salt
      await SecureStore.deleteItemAsync(PIN_HASH_KEY);
      await SecureStore.deleteItemAsync(PIN_SALT_KEY);

      console.log('✅ PIN removed successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to remove PIN:', error);
      throw error;
    }
  }
}
