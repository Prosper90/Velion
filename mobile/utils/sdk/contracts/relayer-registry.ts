import { ethers } from 'ethers';
import { ContractError } from '../errors';
import { RelayerInfo, RelayerStats } from '../types';

export class RelayerRegistry {
  private contract: ethers.Contract;
  private provider: ethers.Provider;
  private signer?: ethers.Signer;

  // Relayer Registry ABI
  private static readonly ABI = [
    'function registerRelayer(uint256 fee) external payable',
    'function unregisterRelayer() external',
    'function updateFee(uint256 newFee) external',
    'function slash(address relayer, uint256 amount) external',
    'function getRelayer(address relayer) external view returns (uint256 fee, uint256 stake, bool isActive, uint256 reputation, uint256 totalTransactions)',
    'function getAllRelayers() external view returns (address[])',
    'function getActiveRelayers() external view returns (address[])',
    'function minimumStake() external view returns (uint256)',
    'function slashingPercentage() external view returns (uint256)',
    'function getTotalStaked() external view returns (uint256)',
    'function getRelayerCount() external view returns (uint256)',
    'function getActiveRelayerCount() external view returns (uint256)',
    'function getAverageFee() external view returns (uint256)',
    'event RelayerRegistered(address indexed relayer, uint256 fee, uint256 stake)',
    'event RelayerUnregistered(address indexed relayer)',
    'event FeeUpdated(address indexed relayer, uint256 oldFee, uint256 newFee)',
    'event RelayerSlashed(address indexed relayer, uint256 amount, string reason)'
  ];

  constructor(address: string, provider: ethers.Provider, signer?: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
    this.contract = new ethers.Contract(address, RelayerRegistry.ABI, signer || provider);
  }

  /**
   * Register as a relayer
   */
  async registerRelayer(fee: bigint, options: { value: bigint }): Promise<ethers.ContractTransactionResponse> {
    try {
      if (!this.signer) {
        throw new ContractError('Signer is required for relayer registration');
      }

      const tx = await this.contract.registerRelayer(fee, options);
      return tx;
    } catch (error: any) {
      throw new ContractError(`Relayer registration failed: ${error.message}`, error);
    }
  }

  /**
   * Unregister as a relayer
   */
  async unregisterRelayer(): Promise<ethers.ContractTransactionResponse> {
    try {
      if (!this.signer) {
        throw new ContractError('Signer is required for relayer unregistration');
      }

      const tx = await this.contract.unregisterRelayer();
      return tx;
    } catch (error: any) {
      throw new ContractError(`Relayer unregistration failed: ${error.message}`, error);
    }
  }

  /**
   * Update relayer fee
   */
  async updateFee(newFee: bigint): Promise<ethers.ContractTransactionResponse> {
    try {
      if (!this.signer) {
        throw new ContractError('Signer is required for fee update');
      }

      const tx = await this.contract.updateFee(newFee);
      return tx;
    } catch (error: any) {
      throw new ContractError(`Fee update failed: ${error.message}`, error);
    }
  }

  /**
   * Get relayer information
   */
  async getRelayer(address: string): Promise<RelayerInfo> {
    try {
      const result = await this.contract.getRelayer(address);

      return {
        address,
        fee: ethers.formatEther(result[0]),
        stake: ethers.formatEther(result[1]),
        isActive: result[2],
        reputation: Number(result[3]),
        totalTransactions: Number(result[4])
      };
    } catch (error: any) {
      throw new ContractError(`Failed to get relayer info: ${error.message}`, error);
    }
  }

  /**
   * Get all registered relayers
   */
  async getAllRelayers(): Promise<string[]> {
    try {
      return await this.contract.getAllRelayers();
    } catch (error: any) {
      throw new ContractError(`Failed to get all relayers: ${error.message}`, error);
    }
  }

  /**
   * Get all active relayers
   */
  async getActiveRelayers(): Promise<string[]> {
    try {
      return await this.contract.getActiveRelayers();
    } catch (error: any) {
      throw new ContractError(`Failed to get active relayers: ${error.message}`, error);
    }
  }

  /**
   * Get minimum stake required for relayers
   */
  async minimumStake(): Promise<bigint> {
    try {
      return await this.contract.minimumStake();
    } catch (error: any) {
      throw new ContractError(`Failed to get minimum stake: ${error.message}`, error);
    }
  }

  /**
   * Get slashing percentage
   */
  async getSlashingPercentage(): Promise<number> {
    try {
      const percentage = await this.contract.slashingPercentage();
      return Number(percentage);
    } catch (error: any) {
      throw new ContractError(`Failed to get slashing percentage: ${error.message}`, error);
    }
  }

  /**
   * Get relayer statistics
   */
  async getRelayerStats(): Promise<RelayerStats> {
    try {
      const [totalStaked, totalRelayers, activeRelayers, averageFee] = await Promise.all([
        this.contract.getTotalStaked(),
        this.contract.getRelayerCount(),
        this.contract.getActiveRelayerCount(),
        this.contract.getAverageFee()
      ]);

      return {
        totalRelayers: Number(totalRelayers),
        activeRelayers: Number(activeRelayers),
        totalStaked: ethers.formatEther(totalStaked),
        averageFee: ethers.formatEther(averageFee)
      };
    } catch (error: any) {
      throw new ContractError(`Failed to get relayer stats: ${error.message}`, error);
    }
  }

  /**
   * Slash a relayer (admin function)
   */
  async slashRelayer(relayerAddress: string, amount: bigint): Promise<ethers.ContractTransactionResponse> {
    try {
      if (!this.signer) {
        throw new ContractError('Signer is required for slashing');
      }

      const tx = await this.contract.slash(relayerAddress, amount);
      return tx;
    } catch (error: any) {
      throw new ContractError(`Relayer slashing failed: ${error.message}`, error);
    }
  }

  /**
   * Listen for RelayerRegistered events
   */
  onRelayerRegistered(callback: (relayer: string, fee: string, stake: string) => void): void {
    this.contract.on('RelayerRegistered', (relayer, fee, stake, event) => {
      callback(relayer, ethers.formatEther(fee), ethers.formatEther(stake));
    });
  }

  /**
   * Listen for RelayerUnregistered events
   */
  onRelayerUnregistered(callback: (relayer: string) => void): void {
    this.contract.on('RelayerUnregistered', (relayer, event) => {
      callback(relayer);
    });
  }

  /**
   * Listen for FeeUpdated events
   */
  onFeeUpdated(callback: (relayer: string, oldFee: string, newFee: string) => void): void {
    this.contract.on('FeeUpdated', (relayer, oldFee, newFee, event) => {
      callback(relayer, ethers.formatEther(oldFee), ethers.formatEther(newFee));
    });
  }

  /**
   * Listen for RelayerSlashed events
   */
  onRelayerSlashed(callback: (relayer: string, amount: string, reason: string) => void): void {
    this.contract.on('RelayerSlashed', (relayer, amount, reason, event) => {
      callback(relayer, ethers.formatEther(amount), reason);
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