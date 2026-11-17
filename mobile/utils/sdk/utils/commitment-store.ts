/**
 * Commitment Storage and Management
 * Tracks user's commitments (deposits) and nullifiers for private balance calculation
 */

export interface StoredCommitment {
  commitment: string;
  nullifier: string;
  amount: string;
  secret: string;
  leafIndex: number;
  blockNumber: number;
  txHash: string;
  spent: boolean;
  timestamp: number;
}

export class CommitmentStore {
  private storageKey: string = 'veilon_commitments';

  /**
   * Store a new commitment
   */
  async addCommitment(address: string, commitment: StoredCommitment): Promise<void> {
    const commitments = await this.getCommitments(address);
    commitments.push(commitment);
    await this.saveCommitments(address, commitments);
  }

  /**
   * Get all commitments for an address
   */
  async getCommitments(address: string): Promise<StoredCommitment[]> {
    try {
      const key = `${this.storageKey}_${address.toLowerCase()}`;

      // In browser/React Native
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
      }

      // In Node.js (for testing)
      return [];
    } catch (error) {
      console.error('Failed to load commitments:', error);
      return [];
    }
  }

  /**
   * Get unspent commitments (available balance)
   */
  async getUnspentCommitments(address: string): Promise<StoredCommitment[]> {
    const commitments = await this.getCommitments(address);
    return commitments.filter(c => !c.spent);
  }

  /**
   * Mark a commitment as spent
   */
  async markAsSpent(address: string, nullifier: string): Promise<void> {
    const commitments = await this.getCommitments(address);
    const updated = commitments.map(c =>
      c.nullifier === nullifier ? { ...c, spent: true } : c
    );
    await this.saveCommitments(address, updated);
  }

  /**
   * Calculate private balance (sum of unspent commitments)
   */
  async getPrivateBalance(address: string): Promise<string> {
    const unspent = await this.getUnspentCommitments(address);
    const total = unspent.reduce((sum, c) => {
      return sum + BigInt(c.amount);
    }, BigInt(0));

    // Convert to ETH string
    const eth = Number(total) / 1e18;
    return eth.toFixed(4);
  }

  /**
   * Save commitments to storage
   */
  private async saveCommitments(address: string, commitments: StoredCommitment[]): Promise<void> {
    try {
      const key = `${this.storageKey}_${address.toLowerCase()}`;

      // In browser/React Native
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(commitments));
      }
    } catch (error) {
      console.error('Failed to save commitments:', error);
      throw error;
    }
  }

  /**
   * Clear all commitments for an address (use with caution!)
   */
  async clearCommitments(address: string): Promise<void> {
    const key = `${this.storageKey}_${address.toLowerCase()}`;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
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
}

// Export singleton instance
export const commitmentStore = new CommitmentStore();
