import { ethers } from 'ethers';
import { ContractError } from '../errors';
import { PrivacyPoolStats } from '../types';

export class PrivacyPool {
  private contract: ethers.Contract;
  private provider: ethers.Provider;
  private signer?: ethers.Signer;

  // Privacy Pool ABI (simplified)
  private static readonly ABI = [
    'function shield(bytes32 commitment) external payable',
    'function unshield(bytes32 nullifier, address recipient, uint256 amount, bytes calldata proof) external',
    'function transfer(bytes32 outputCommitment, bytes32 nullifier, uint256 amount, bytes calldata proof) external',
    'function isCommitmentUsed(bytes32 commitment) external view returns (bool)',
    'function isNullifierUsed(bytes32 nullifier) external view returns (bool)',
    'function getMerkleRoot() external view returns (bytes32)',
    'function getCommitmentIndex(bytes32 commitment) external view returns (uint256)',
    'function getTotalDeposits() external view returns (uint256)',
    'function getTotalWithdrawals() external view returns (uint256)',
    'function getAnonymitySet() external view returns (uint256)',
    'function verifier() external view returns (address)',
    'function merkleTreeDepth() external view returns (uint256)',
    'function nextIndex() external view returns (uint256)',
    'event Shield(bytes32 indexed commitment, uint256 leafIndex, uint256 timestamp)',
    'event Unshield(bytes32 indexed nullifier, address indexed recipient, uint256 amount)',
    'event Transfer(bytes32 indexed inputNullifier, bytes32 indexed outputCommitment, uint256 amount)'
  ];

  constructor(address: string, provider: ethers.Provider, signer?: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
    this.contract = new ethers.Contract(address, PrivacyPool.ABI, signer || provider);
  }

  /**
   * Shield tokens into the privacy pool
   */
  async shield(commitment: string, options: { value: bigint } = { value: 0n }): Promise<ethers.ContractTransactionResponse> {
    try {
      if (!this.signer) {
        throw new ContractError('Signer is required for shield operation');
      }

      const tx = await this.contract.shield(commitment, options);
      return tx;
    } catch (error: any) {
      throw new ContractError(`Shield failed: ${error.message}`, error);
    }
  }

  /**
   * Unshield tokens from the privacy pool
   */
  async unshield(
    nullifier: string,
    recipient: string,
    amount: bigint,
    proof: string
  ): Promise<ethers.ContractTransactionResponse> {
    try {
      if (!this.signer) {
        throw new ContractError('Signer is required for unshield operation');
      }

      const tx = await this.contract.unshield(nullifier, recipient, amount, proof);
      return tx;
    } catch (error: any) {
      throw new ContractError(`Unshield failed: ${error.message}`, error);
    }
  }

  /**
   * Transfer tokens within the privacy pool
   */
  async transfer(
    outputCommitment: string,
    nullifier: string,
    amount: bigint,
    proof: string
  ): Promise<ethers.ContractTransactionResponse> {
    try {
      if (!this.signer) {
        throw new ContractError('Signer is required for transfer operation');
      }

      const tx = await this.contract.transfer(outputCommitment, nullifier, amount, proof);
      return tx;
    } catch (error: any) {
      throw new ContractError(`Transfer failed: ${error.message}`, error);
    }
  }

  /**
   * Check if a commitment has been used
   */
  async isCommitmentUsed(commitment: string): Promise<boolean> {
    try {
      return await this.contract.isCommitmentUsed(commitment);
    } catch (error: any) {
      throw new ContractError(`Failed to check commitment: ${error.message}`, error);
    }
  }

  /**
   * Check if a nullifier has been used
   */
  async isNullifierUsed(nullifier: string): Promise<boolean> {
    try {
      return await this.contract.isNullifierUsed(nullifier);
    } catch (error: any) {
      throw new ContractError(`Failed to check nullifier: ${error.message}`, error);
    }
  }

  /**
   * Get the current Merkle tree root
   */
  async getMerkleRoot(): Promise<string> {
    try {
      return await this.contract.getMerkleRoot();
    } catch (error: any) {
      throw new ContractError(`Failed to get Merkle root: ${error.message}`, error);
    }
  }

  /**
   * Get the index of a commitment in the Merkle tree
   */
  async getCommitmentIndex(commitment: string): Promise<number> {
    try {
      const index = await this.contract.getCommitmentIndex(commitment);
      return Number(index);
    } catch (error: any) {
      throw new ContractError(`Failed to get commitment index: ${error.message}`, error);
    }
  }

  /**
   * Get privacy pool statistics
   */
  async getStats(): Promise<PrivacyPoolStats> {
    try {
      const [totalDeposits, totalWithdrawals, anonymitySet, nextIndex] = await Promise.all([
        this.contract.getTotalDeposits(),
        this.contract.getTotalWithdrawals(),
        this.contract.getAnonymitySet(),
        this.contract.nextIndex()
      ]);

      return {
        totalDeposits: ethers.formatEther(totalDeposits),
        totalWithdrawals: ethers.formatEther(totalWithdrawals),
        anonymitySet: Number(anonymitySet),
        totalCommitments: Number(nextIndex)
      };
    } catch (error: any) {
      throw new ContractError(`Failed to get privacy pool stats: ${error.message}`, error);
    }
  }

  /**
   * Get the verifier contract address
   */
  async getVerifier(): Promise<string> {
    try {
      return await this.contract.verifier();
    } catch (error: any) {
      throw new ContractError(`Failed to get verifier address: ${error.message}`, error);
    }
  }

  /**
   * Get the Merkle tree depth
   */
  async getMerkleTreeDepth(): Promise<number> {
    try {
      const depth = await this.contract.merkleTreeDepth();
      return Number(depth);
    } catch (error: any) {
      throw new ContractError(`Failed to get Merkle tree depth: ${error.message}`, error);
    }
  }

  /**
   * Get the next available index in the Merkle tree
   */
  async getNextIndex(): Promise<number> {
    try {
      const index = await this.contract.nextIndex();
      return Number(index);
    } catch (error: any) {
      throw new ContractError(`Failed to get next index: ${error.message}`, error);
    }
  }

  /**
   * Listen for Shield events
   */
  onShield(callback: (commitment: string, leafIndex: number, timestamp: number) => void): void {
    this.contract.on('Shield', (commitment, leafIndex, timestamp, event) => {
      callback(commitment, Number(leafIndex), Number(timestamp));
    });
  }

  /**
   * Listen for Unshield events
   */
  onUnshield(callback: (nullifier: string, recipient: string, amount: string) => void): void {
    this.contract.on('Unshield', (nullifier, recipient, amount, event) => {
      callback(nullifier, recipient, ethers.formatEther(amount));
    });
  }

  /**
   * Listen for Transfer events
   */
  onTransfer(callback: (inputNullifier: string, outputCommitment: string, amount: string) => void): void {
    this.contract.on('Transfer', (inputNullifier, outputCommitment, amount, event) => {
      callback(inputNullifier, outputCommitment, ethers.formatEther(amount));
    });
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.contract.removeAllListeners();
  }

  /**
   * Get the contract instance
   */
  getContract(): ethers.Contract {
    return this.contract;
  }

  /**
   * Get the contract address
   */
  getAddress(): string {
    return this.contract.target as string;
  }
}