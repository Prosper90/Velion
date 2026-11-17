import { ethers } from 'ethers';
import { ValidationError, VeilonError } from '../errors';

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  address: string;
}

export interface PrivacyKeys {
  viewingKey: string;
  spendingKey: string;
  nullifierKey: string;
}

export interface WalletBackup {
  mnemonic: string;
  privateKey: string;
  address: string;
  privacyKeys: PrivacyKeys;
  timestamp: number;
}

export class KeyManager {
  private keyCache: Map<string, KeyPair> = new Map();

  /**
   * Generate a new key pair
   */
  generateKeyPair(): KeyPair {
    try {
      const wallet = ethers.Wallet.createRandom();

      const keyPair: KeyPair = {
        privateKey: wallet.privateKey,
        publicKey: wallet.signingKey.publicKey || '',
        address: wallet.address
      };

      this.keyCache.set(wallet.address, keyPair);
      return keyPair;
    } catch (error: any) {
      throw new VeilonError(`Key pair generation failed: ${error.message}`, error);
    }
  }

  /**
   * Generate key pair from private key
   */
  generateKeyPairFromPrivateKey(privateKey: string): KeyPair {
    try {
      if (!this.isValidPrivateKey(privateKey)) {
        throw new ValidationError('Invalid private key format');
      }

      const wallet = new ethers.Wallet(privateKey);

      const keyPair: KeyPair = {
        privateKey: wallet.privateKey,
        publicKey: wallet.signingKey.publicKey || '',
        address: wallet.address
      };

      this.keyCache.set(wallet.address, keyPair);
      return keyPair;
    } catch (error: any) {
      throw new VeilonError(`Key pair generation from private key failed: ${error.message}`, error);
    }
  }

  /**
   * Generate key pair from mnemonic
   */
  generateKeyPairFromMnemonic(mnemonic: string, path: string = "m/44'/60'/0'/0/0"): KeyPair {
    try {
      if (!this.isValidMnemonic(mnemonic)) {
        throw new ValidationError('Invalid mnemonic phrase');
      }

      const wallet = ethers.Wallet.fromPhrase(mnemonic);

      const keyPair: KeyPair = {
        privateKey: wallet.privateKey,
        publicKey: wallet.signingKey.publicKey || '',
        address: wallet.address
      };

      this.keyCache.set(wallet.address, keyPair);
      return keyPair;
    } catch (error: any) {
      throw new VeilonError(`Key pair generation from mnemonic failed: ${error.message}`, error);
    }
  }

  /**
   * Generate privacy-specific keys for zero-knowledge operations
   */
  generatePrivacyKeys(seed?: string): PrivacyKeys {
    try {
      const seedValue = seed || this.generateRandomSeed();

      // Generate deterministic keys from seed
      const viewingKey = this.deriveKey(seedValue, 'viewing');
      const spendingKey = this.deriveKey(seedValue, 'spending');
      const nullifierKey = this.deriveKey(seedValue, 'nullifier');

      return {
        viewingKey,
        spendingKey,
        nullifierKey
      };
    } catch (error: any) {
      throw new VeilonError(`Privacy keys generation failed: ${error.message}`, error);
    }
  }

  /**
   * Generate a random mnemonic phrase
   */
  generateMnemonic(): string {
    try {
      return ethers.Wallet.createRandom().mnemonic?.phrase || '';
    } catch (error: any) {
      throw new VeilonError(`Mnemonic generation failed: ${error.message}`, error);
    }
  }

  /**
   * Create a complete wallet backup
   */
  createWalletBackup(mnemonic?: string): WalletBackup {
    try {
      const mnemonicPhrase = mnemonic || this.generateMnemonic();
      const keyPair = this.generateKeyPairFromMnemonic(mnemonicPhrase);
      const privacyKeys = this.generatePrivacyKeys(keyPair.privateKey);

      return {
        mnemonic: mnemonicPhrase,
        privateKey: keyPair.privateKey,
        address: keyPair.address,
        privacyKeys,
        timestamp: Date.now()
      };
    } catch (error: any) {
      throw new VeilonError(`Wallet backup creation failed: ${error.message}`, error);
    }
  }

  /**
   * Restore wallet from backup
   */
  restoreWalletFromBackup(backup: WalletBackup): KeyPair {
    try {
      if (!this.isValidBackup(backup)) {
        throw new ValidationError('Invalid wallet backup');
      }

      return this.generateKeyPairFromMnemonic(backup.mnemonic);
    } catch (error: any) {
      throw new VeilonError(`Wallet restoration failed: ${error.message}`, error);
    }
  }

  /**
   * Sign a message with private key
   */
  async signMessage(message: string, privateKey: string): Promise<string> {
    try {
      const wallet = new ethers.Wallet(privateKey);
      return await wallet.signMessage(message);
    } catch (error: any) {
      throw new VeilonError(`Message signing failed: ${error.message}`, error);
    }
  }

  /**
   * Verify message signature
   */
  verifySignature(message: string, signature: string, address: string): boolean {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error: any) {
      throw new VeilonError(`Signature verification failed: ${error.message}`, error);
    }
  }

  /**
   * Encrypt private key with password
   */
  async encryptPrivateKey(privateKey: string, password: string): Promise<string> {
    try {
      const wallet = new ethers.Wallet(privateKey);
      return await wallet.encrypt(password);
    } catch (error: any) {
      throw new VeilonError(`Private key encryption failed: ${error.message}`, error);
    }
  }

  /**
   * Decrypt private key with password
   */
  async decryptPrivateKey(encryptedKey: string, password: string): Promise<string> {
    try {
      const wallet = await ethers.Wallet.fromEncryptedJson(encryptedKey, password);
      return wallet.privateKey;
    } catch (error: any) {
      throw new VeilonError(`Private key decryption failed: ${error.message}`, error);
    }
  }

  /**
   * Generate deterministic commitment from keys
   */
  generateCommitment(amount: string, recipient: string, secret: string): string {
    try {
      const hash = ethers.keccak256(
        ethers.solidityPacked(
          ['uint256', 'address', 'uint256'],
          [ethers.parseEther(amount), recipient, secret]
        )
      );
      return hash;
    } catch (error: any) {
      throw new VeilonError(`Commitment generation failed: ${error.message}`, error);
    }
  }

  /**
   * Generate nullifier from commitment and nullifier key
   */
  generateNullifier(commitment: string, nullifierKey: string): string {
    try {
      const hash = ethers.keccak256(
        ethers.solidityPacked(['bytes32', 'bytes32'], [commitment, nullifierKey])
      );
      return hash;
    } catch (error: any) {
      throw new VeilonError(`Nullifier generation failed: ${error.message}`, error);
    }
  }

  /**
   * Get cached key pair by address
   */
  getCachedKeyPair(address: string): KeyPair | undefined {
    return this.keyCache.get(address.toLowerCase());
  }

  /**
   * Clear key cache
   */
  clearCache(): void {
    this.keyCache.clear();
  }

  /**
   * Validate private key format
   */
  private isValidPrivateKey(privateKey: string): boolean {
    try {
      // Check if it's a valid hex string of correct length
      const cleaned = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
      return /^[0-9a-fA-F]{64}$/.test(cleaned);
    } catch {
      return false;
    }
  }

  /**
   * Validate mnemonic phrase
   */
  private isValidMnemonic(mnemonic: string): boolean {
    try {
      // Basic validation - check word count and format
      const words = mnemonic.trim().split(/\s+/);
      return words.length >= 12 && words.length <= 24 && words.length % 3 === 0;
    } catch {
      return false;
    }
  }

  /**
   * Validate wallet backup
   */
  private isValidBackup(backup: WalletBackup): boolean {
    try {
      return !!(
        backup.mnemonic &&
        backup.privateKey &&
        backup.address &&
        backup.privacyKeys &&
        backup.timestamp &&
        this.isValidMnemonic(backup.mnemonic) &&
        this.isValidPrivateKey(backup.privateKey)
      );
    } catch {
      return false;
    }
  }

  /**
   * Generate random seed
   */
  private generateRandomSeed(): string {
    return ethers.hexlify(ethers.randomBytes(32));
  }

  /**
   * Derive key from seed and purpose
   */
  private deriveKey(seed: string, purpose: string): string {
    const hash = ethers.keccak256(
      ethers.solidityPacked(['string', 'string'], [seed, purpose])
    );
    return hash;
  }

  /**
   * Generate HD wallet addresses
   */
  generateHDAddresses(mnemonic: string, count: number = 10): KeyPair[] {
    try {
      const addresses: KeyPair[] = [];

      for (let i = 0; i < count; i++) {
        const path = `m/44'/60'/0'/0/${i}`;
        const keyPair = this.generateKeyPairFromMnemonic(mnemonic, path);
        addresses.push(keyPair);
      }

      return addresses;
    } catch (error: any) {
      throw new VeilonError(`HD address generation failed: ${error.message}`, error);
    }
  }

  /**
   * Create emergency recovery key
   */
  createEmergencyKey(): { emergencyKey: string; recoveryCode: string } {
    try {
      const emergencyWallet = ethers.Wallet.createRandom();
      const recoveryCode = this.generateRecoveryCode();

      return {
        emergencyKey: emergencyWallet.privateKey,
        recoveryCode
      };
    } catch (error: any) {
      throw new VeilonError(`Emergency key creation failed: ${error.message}`, error);
    }
  }

  /**
   * Generate recovery code
   */
  private generateRecoveryCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
      if (i % 4 === 3 && i < 11) result += '-';
    }
    return result;
  }
}