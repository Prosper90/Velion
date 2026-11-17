import AsyncStorage from '@react-native-async-storage/async-storage';
import { ethers } from 'ethers';

/**
 * React Native Commitment Storage
 * Uses AsyncStorage instead of localStorage
 */

export interface StoredCommitment {
  commitment: string;
  nullifier: string;
  amount: string;
  secret: string;
  randomness?: string; // Added for unshield proof generation
  token?: string; // NEW: Token type (ETH, USDC, USDT, etc.)
  tokenAddress?: string; // NEW: Token contract address (0x0 for ETH)
  leafIndex: number;
  blockNumber: number;
  txHash: string;
  spent: boolean;
  timestamp: number;
}

export class CommitmentStoreRN {
  private storageKey: string = 'veilon_commitments';

  /**
   * Store a new commitment
   */
  async addCommitment(address: string, commitment: StoredCommitment): Promise<void> {
    try {
      console.log('💾 Adding commitment for address:', address);
      console.log('💾 Commitment data:', {
        commitment: commitment.commitment,
        amount: commitment.amount,
        txHash: commitment.txHash
      });

      const commitments = await this.getCommitments(address);
      commitments.push(commitment);
      await this.saveCommitments(address, commitments);

      console.log('✅ Commitment saved. Total commitments:', commitments.length);
    } catch (error) {
      console.error('❌ Failed to add commitment:', error);
      throw error;
    }
  }

  /**
   * Get all commitments for an address
   */
  async getCommitments(address: string): Promise<StoredCommitment[]> {
    try {
      const key = `${this.storageKey}_${address.toLowerCase()}`;
      const stored = await AsyncStorage.getItem(key);

      if (!stored) {
        console.log('📭 No commitments found for:', address);
        return [];
      }

      const commitments = JSON.parse(stored);
      console.log(`📬 Loaded ${commitments.length} commitment(s) for:`, address);
      return commitments;
    } catch (error) {
      console.error('❌ Failed to load commitments:', error);
      return [];
    }
  }

  /**
   * Get unspent commitments (available balance)
   */
  async getUnspentCommitments(address: string): Promise<StoredCommitment[]> {
    const commitments = await this.getCommitments(address);
    const unspent = commitments.filter(c => !c.spent);
    console.log(`💰 Found ${unspent.length} unspent commitment(s) for:`, address);
    return unspent;
  }

  /**
   * Mark a commitment as spent
   */
  async markAsSpent(address: string, nullifier: string): Promise<void> {
    try {
      const commitments = await this.getCommitments(address);
      const updated = commitments.map(c =>
        c.nullifier === nullifier ? { ...c, spent: true } : c
      );
      await this.saveCommitments(address, updated);
      console.log('✅ Marked commitment as spent:', nullifier);
    } catch (error) {
      console.error('❌ Failed to mark commitment as spent:', error);
      throw error;
    }
  }

  /**
   * Calculate private balance (sum of unspent commitments)
   * @deprecated Use getPrivateBalanceByToken() for multi-token support
   */
  async getPrivateBalance(address: string): Promise<string> {
    try {
      console.log('🔍 Calculating ETH private balance for:', address);

      const unspent = await this.getUnspentCommitments(address);

      // Filter only ETH commitments (for backward compatibility)
      const ethCommitments = unspent.filter(c => !c.token || c.token === 'ETH');

      if (ethCommitments.length === 0) {
        console.log('💰 No unspent ETH commitments, balance is 0');
        return '0.00';
      }

      const total = ethCommitments.reduce((sum, c) => {
        console.log(`  + Adding commitment: ${c.amount} wei`);
        return sum + BigInt(c.amount);
      }, BigInt(0));

      console.log('💰 Total in wei:', total.toString());

      // Convert to ETH string
      const ethValue = ethers.formatEther(total);
      console.log('💰 Total in ETH:', ethValue);

      return parseFloat(ethValue).toFixed(4);
    } catch (error) {
      console.error('❌ Failed to calculate private balance:', error);
      return '0.00';
    }
  }

  /**
   * Calculate private balance for a specific token
   */
  async getPrivateBalanceByToken(
    address: string,
    token: string,
    decimals: number = 18
  ): Promise<string> {
    try {
      console.log(`🔍 Calculating ${token} private balance for:`, address);

      const unspent = await this.getUnspentCommitments(address);

      // Filter commitments for this specific token
      const tokenCommitments = unspent.filter(c =>
        (c.token || 'ETH') === token
      );

      if (tokenCommitments.length === 0) {
        console.log(`💰 No unspent ${token} commitments, balance is 0`);
        return '0.00';
      }

      const total = tokenCommitments.reduce((sum, c) => {
        console.log(`  + Adding ${token} commitment: ${c.amount} wei`);
        return sum + BigInt(c.amount);
      }, BigInt(0));

      console.log(`💰 Total ${token} in wei:`, total.toString());

      // Convert based on decimals
      const tokenValue = ethers.formatUnits(total, decimals);
      console.log(`💰 Total in ${token}:`, tokenValue);

      return parseFloat(tokenValue).toFixed(4);
    } catch (error) {
      console.error(`❌ Failed to calculate ${token} private balance:`, error);
      return '0.00';
    }
  }

  /**
   * Get all private balances (multi-token)
   */
  async getAllPrivateBalances(address: string): Promise<Record<string, string>> {
    try {
      console.log('🔍 Calculating all token balances for:', address);

      const unspent = await this.getUnspentCommitments(address);

      // Group by token
      const balances: Record<string, bigint> = {};

      for (const commitment of unspent) {
        const token = commitment.token || 'ETH';
        if (!balances[token]) {
          balances[token] = BigInt(0);
        }
        balances[token] += BigInt(commitment.amount);
      }

      // Convert to formatted strings
      const result: Record<string, string> = {};
      for (const [token, amount] of Object.entries(balances)) {
        // For now, assume 18 decimals for all tokens (update later for USDC/USDT which use 6)
        const decimals = token === 'USDC' || token === 'USDT' ? 6 : 18;
        result[token] = parseFloat(ethers.formatUnits(amount, decimals)).toFixed(4);
      }

      console.log('💰 All private balances:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to calculate all balances:', error);
      return {};
    }
  }

  /**
   * Save commitments to storage
   */
  private async saveCommitments(address: string, commitments: StoredCommitment[]): Promise<void> {
    try {
      const key = `${this.storageKey}_${address.toLowerCase()}`;
      await AsyncStorage.setItem(key, JSON.stringify(commitments));
      console.log('💾 Saved commitments to AsyncStorage');
    } catch (error) {
      console.error('❌ Failed to save commitments:', error);
      throw error;
    }
  }

  /**
   * Clear all commitments for an address (use with caution!)
   */
  async clearCommitments(address: string): Promise<void> {
    try {
      const key = `${this.storageKey}_${address.toLowerCase()}`;
      await AsyncStorage.removeItem(key);
      console.log('🗑️ Cleared all commitments for:', address);
    } catch (error) {
      console.error('❌ Failed to clear commitments:', error);
      throw error;
    }
  }

  /**
   * Sync commitments with blockchain to mark spent ones
   * This directly queries the PrivacyPool contract's spentNullifiers mapping
   * Much more efficient and reliable than querying events!
   */
  async syncCommitmentsWithBlockchain(
    address: string,
    provider: any,
    privacyPoolAddress: string
  ): Promise<{
    totalCommitments: number;
    markedAsSpent: number;
    stillUnspent: number;
  }> {
    try {
      console.log('🔄 Syncing commitments with blockchain for:', address);

      const commitments = await this.getCommitments(address);
      if (commitments.length === 0) {
        console.log('📭 No commitments to sync');
        return { totalCommitments: 0, markedAsSpent: 0, stillUnspent: 0 };
      }

      console.log(`📊 Found ${commitments.length} commitment(s) to check`);

      // Privacy Pool ABI - we only need the spentNullifiers mapping
      const privacyPoolABI = [
        'function spentNullifiers(bytes32) public view returns (bool)',
      ];

      const contract = new ethers.Contract(privacyPoolAddress, privacyPoolABI, provider);

      console.log(`🔍 Checking spent status for each nullifier on-chain...`);

      // Check each commitment's nullifier directly on the contract
      let markedAsSpent = 0;
      const updatedCommitments = await Promise.all(
        commitments.map(async (c) => {
          try {
            // Query the contract to see if this nullifier is spent
            const isSpentOnChain = await contract.spentNullifiers(c.nullifier);

            console.log(`  🔍 Nullifier ${c.nullifier.slice(0, 10)}... - On-chain: ${isSpentOnChain ? 'SPENT' : 'unspent'}, Local: ${c.spent ? 'spent' : 'unspent'}`);

            if (isSpentOnChain && !c.spent) {
              console.log(`  ✅ Marking commitment as spent: ${c.nullifier.slice(0, 10)}...`);
              markedAsSpent++;
              return { ...c, spent: true };
            } else if (!isSpentOnChain && c.spent) {
              console.log(`  ⚠️ WARNING: Local shows spent but blockchain shows unspent - keeping as spent for safety`);
              // Don't mark as unspent - better to be conservative
            }
            return c;
          } catch (error) {
            console.error(`  ❌ Failed to check nullifier ${c.nullifier.slice(0, 10)}...:`, error);
            // If we can't check, keep the current state
            return c;
          }
        })
      );

      // Save updated commitments
      await this.saveCommitments(address, updatedCommitments);

      const stillUnspent = updatedCommitments.filter(c => !c.spent).length;

      console.log('✅ Sync complete!');
      console.log(`📊 Total commitments: ${commitments.length}`);
      console.log(`📊 Marked as spent: ${markedAsSpent}`);
      console.log(`📊 Still unspent: ${stillUnspent}`);

      return {
        totalCommitments: commitments.length,
        markedAsSpent,
        stillUnspent,
      };
    } catch (error) {
      console.error('❌ Failed to sync commitments:', error);
      throw error;
    }
  }

  /**
   * Find commitment by nullifier
   */
  async findByNullifier(address: string, nullifier: string): Promise<StoredCommitment | null> {
    const commitments = await this.getCommitments(address);
    return commitments.find(c => c.nullifier === nullifier) || null;
  }

  /**
   * Find commitment by transaction hash
   */
  async findByTxHash(address: string, txHash: string): Promise<StoredCommitment | null> {
    const commitments = await this.getCommitments(address);
    return commitments.find(c => c.txHash === txHash) || null;
  }

  /**
   * Get all commitments across all addresses (for debugging)
   */
  async getAllStoredData(): Promise<Record<string, StoredCommitment[]>> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const commitmentKeys = allKeys.filter(key => key.startsWith(this.storageKey));

      const result: Record<string, StoredCommitment[]> = {};

      for (const key of commitmentKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          result[key] = JSON.parse(data);
        }
      }

      return result;
    } catch (error) {
      console.error('❌ Failed to get all stored data:', error);
      return {};
    }
  }
}

// Export singleton instance
export const commitmentStoreRN = new CommitmentStoreRN();
