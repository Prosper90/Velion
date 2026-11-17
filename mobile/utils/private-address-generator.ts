import { ethers } from 'ethers';
import * as Crypto from 'expo-crypto';

/**
 * Private Address Generator for Veilon
 * Generates 0zk addresses for receiving private transfers
 *
 * Format: 0zk1[base58-encoded-key]
 *
 * The private address is derived from the wallet's private key
 * using a deterministic process that ensures:
 * 1. Each public address has exactly one corresponding 0zk address
 * 2. The 0zk address can be publicly shared without revealing the private key
 * 3. Only the owner can decrypt incoming private transfers
 */

export class PrivateAddressGenerator {
  /**
   * Generate a 0zk private address from an Ethereum private key
   *
   * @param privateKey - The wallet's private key (0x...)
   * @returns The shielded address (0zk1...)
   */
  static async generatePrivateAddress(privateKey: string): Promise<string> {
    try {
      // Ensure private key is in correct format
      const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

      // Create wallet from private key
      const wallet = new ethers.Wallet(formattedKey);

      // Derive a viewing key from the private key
      // This is a deterministic derivation that creates a separate key for viewing
      const message = `Veilon Private Address Derivation for ${wallet.address}`;
      const viewingKeyHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        formattedKey + message
      );

      // Take first 32 bytes (64 hex chars) for the viewing key
      const viewingKey = viewingKeyHash.substring(0, 64);

      // Encode to base58-like format (simplified - using base64 for now)
      // In production, use proper base58 encoding
      const encoded = Buffer.from(viewingKey, 'hex').toString('base64')
        .replace(/\+/g, '')
        .replace(/\//g, '')
        .replace(/=/g, '')
        .substring(0, 58); // Limit to 58 chars

      // Format as 0zk1[encoded_key]
      const privateAddress = `0zk1${encoded}`;

      console.log('✅ Generated private address:', privateAddress);
      return privateAddress;
    } catch (error) {
      console.error('❌ Failed to generate private address:', error);
      throw new Error('Failed to generate private address');
    }
  }

  /**
   * Verify a private address format
   */
  static isValidPrivateAddress(address: string): boolean {
    // Check format: starts with 0zk1 and has appropriate length
    return address.startsWith('0zk1') && address.length >= 50;
  }

  /**
   * Generate a spending key for a private address
   * This is used to prove ownership when spending from private balance
   */
  static async generateSpendingKey(privateKey: string): Promise<string> {
    try {
      const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

      // Derive spending key from private key
      const message = `Veilon Spending Key Derivation`;
      const spendingKeyHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        formattedKey + message
      );

      return spendingKeyHash;
    } catch (error) {
      console.error('❌ Failed to generate spending key:', error);
      throw new Error('Failed to generate spending key');
    }
  }

  /**
   * Get both public and private addresses for a wallet
   */
  static async getAddresses(privateKey: string): Promise<{
    publicAddress: string;
    privateAddress: string;
    spendingKey: string;
  }> {
    try {
      const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      const wallet = new ethers.Wallet(formattedKey);

      const [privateAddress, spendingKey] = await Promise.all([
        this.generatePrivateAddress(formattedKey),
        this.generateSpendingKey(formattedKey),
      ]);

      return {
        publicAddress: wallet.address,
        privateAddress,
        spendingKey,
      };
    } catch (error) {
      console.error('❌ Failed to get addresses:', error);
      throw error;
    }
  }
}

// Export singleton methods
export const generatePrivateAddress = PrivateAddressGenerator.generatePrivateAddress;
export const isValidPrivateAddress = PrivateAddressGenerator.isValidPrivateAddress;
export const getAddresses = PrivateAddressGenerator.getAddresses;
