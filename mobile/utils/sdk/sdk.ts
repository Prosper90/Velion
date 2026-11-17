import { ethers } from 'ethers';
import { SDKConfig, NetworkConfig, ContractAddresses, ProofInputs, TransactionResult } from './types';
import { PrivacyPool } from './contracts/privacy-pool';
import { RelayerRegistry } from './contracts/relayer-registry';
import { Governance } from './contracts/governance';
import { Verifier } from './contracts/verifier';
// ProofGenerator not available in React Native (requires Node.js modules)
// import { ProofGenerator } from './utils/proof-generator';
import { KeyManager } from './utils/key-manager';
import { RelayerClient } from './utils/relayer-client';
import { VeilonError } from './errors';
import { NETWORKS, DEFAULT_CONFIG } from './constants';

/**
 * Main SDK class for interacting with the Veilon Privacy Protocol
 */
export class VeilonSDK {
  private config: SDKConfig;
  private provider!: ethers.Provider;
  private signer?: ethers.Signer;
  private privacyPool!: PrivacyPool;
  private relayerRegistry!: RelayerRegistry;
  private governance!: Governance;
  private verifier!: Verifier;
  // private proofGenerator!: ProofGenerator; // Not available in RN
  private keyManager!: KeyManager;
  private relayerClient!: RelayerClient;

  constructor(config: Partial<SDKConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialize();
  }

  /**
   * Initialize the SDK with provider and contracts
   */
  private initialize(): void {
    try {
      // Initialize provider
      if (this.config.provider) {
        this.provider = this.config.provider;
      } else if (this.config.rpcUrl) {
        this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      } else {
        throw new VeilonError('Provider or RPC URL is required');
      }

      // Initialize signer if provided
      if (this.config.signer) {
        this.signer = this.config.signer;
      } else if (this.config.privateKey) {
        this.signer = new ethers.Wallet(this.config.privateKey, this.provider);
      }

      // Initialize contracts
      this.initializeContracts();

      // Initialize utilities
      // this.proofGenerator = new ProofGenerator(this.config); // Not available in RN
      this.keyManager = new KeyManager();
      this.relayerClient = new RelayerClient(this.config.relayerUrl || 'http://localhost:3001');

    } catch (error: any) {
      throw new VeilonError(`Failed to initialize SDK: ${error.message}`);
    }
  }

  /**
   * Initialize contract instances
   */
  private initializeContracts(): void {
    const addresses = this.getContractAddresses();

    this.privacyPool = new PrivacyPool(addresses.privacyPool, this.provider, this.signer);
    this.relayerRegistry = new RelayerRegistry(addresses.relayerRegistry, this.provider, this.signer);
    this.governance = new Governance(addresses.governance, this.provider, this.signer);
    this.verifier = new Verifier(addresses.verifier, this.provider, this.signer);
  }

  /**
   * Get contract addresses for the current network
   */
  private getContractAddresses(): ContractAddresses {
    const network = this.config.network || 'mainnet';
    const networkConfig = NETWORKS[network];

    if (!networkConfig) {
      throw new VeilonError(`Unsupported network: ${network}`);
    }

    return networkConfig.contracts;
  }

  /**
   * Shield tokens into the privacy pool
   */
  async shield(amount: string, recipient?: string): Promise<TransactionResult> {
    try {
      console.log('🔷 SDK.shield: Starting shield process...');

      if (!this.signer) {
        throw new VeilonError('Signer is required for shielding');
      }

      const sender = await this.signer.getAddress();
      const recipientAddress = recipient || sender;
      console.log('🔷 SDK.shield: Sender:', sender);
      console.log('🔷 SDK.shield: Recipient:', recipientAddress);

      // Generate proof inputs
      console.log('🔷 SDK.shield: Generating shield proof...');

      // TODO: In React Native, proof generation should be done via relayer
      // ProofGenerator is not available (requires Node.js modules)
      throw new VeilonError(
        'Proof generation not available in React Native. ' +
        'Shield functionality requires server-side proof generation. ' +
        'This will be implemented via relayer in a future update.'
      );

    } catch (error: any) {
      console.error('🔷 SDK.shield: ERROR:', error);
      console.error('🔷 SDK.shield: Error code:', error.code);
      console.error('🔷 SDK.shield: Error reason:', error.reason);
      throw new VeilonError(`Shield failed: ${error.message}`);
    }
  }

  /**
   * Unshield tokens from the privacy pool
   */
  async unshield(
    nullifier: string,
    recipient: string,
    amount: string,
    proof: string
  ): Promise<TransactionResult> {
    try {
      console.log('🔷 SDK.unshield: Starting unshield process...');

      if (!this.signer) {
        throw new VeilonError('Signer is required for unshielding');
      }

      const sender = await this.signer.getAddress();
      console.log('🔷 SDK.unshield: Sender:', sender);
      console.log('🔷 SDK.unshield: Recipient:', recipient);
      console.log('🔷 SDK.unshield: Amount:', amount, 'ETH');
      console.log('🔷 SDK.unshield: Nullifier:', nullifier);
      console.log('🔷 SDK.unshield: Proof length:', proof.length, 'chars');

      // Create unshield transaction
      console.log('🔷 SDK.unshield: Calling privacy pool contract unshield...');
      const amountWei = ethers.parseEther(amount);
      console.log('🔷 SDK.unshield: Amount in wei:', amountWei.toString());

      const tx = await this.privacyPool.unshield(
        nullifier,
        recipient,
        amountWei,
        proof
      );

      console.log('🔷 SDK.unshield: Transaction sent!');
      console.log('🔷 SDK.unshield: TX Hash:', tx.hash);

      return {
        hash: tx.hash,
        type: 'unshield',
        amount,
        recipient,
        status: 'pending'
      };

    } catch (error: any) {
      console.error('🔷 SDK.unshield: ERROR:', error);
      console.error('🔷 SDK.unshield: Error code:', error.code);
      console.error('🔷 SDK.unshield: Error reason:', error.reason);
      throw new VeilonError(`Unshield failed: ${error.message}`);
    }
  }

  /**
   * Transfer tokens within the privacy pool
   */
  async transfer(
    inputCommitment: string,
    outputCommitment: string,
    nullifier: string,
    amount: string,
    recipient: string,
    proof: string
  ): Promise<TransactionResult> {
    try {
      if (!this.signer) {
        throw new VeilonError('Signer is required for transfer');
      }

      // Create transfer transaction
      const tx = await this.privacyPool.transfer(
        outputCommitment,
        nullifier,
        ethers.parseEther(amount),
        proof
      );

      return {
        hash: tx.hash,
        type: 'transfer',
        amount,
        recipient,
        status: 'pending'
      };

    } catch (error: any) {
      throw new VeilonError(`Transfer failed: ${error.message}`);
    }
  }

  // ========================================
  // REMOVED: Governance and Relayer Functions
  // ========================================
  // The following functions have been removed as they are not used in the current app:
  // - registerRelayer()
  // - getRelayerInfo()
  // - getAllRelayers()
  // - createProposal()
  // - vote()
  // - getProposal()
  //
  // If you need these features in the future, they can be found in git history.

  /**
   * Verify a zero-knowledge proof
   */
  async verifyProof(
    circuitType: string,
    proof: any,
    publicInputs: string[]
  ): Promise<boolean> {
    try {
      return await this.verifier.verifyProof(circuitType, proof, publicInputs);
    } catch (error: any) {
      throw new VeilonError(`Proof verification failed: ${error.message}`);
    }
  }

  /**
   * Generate a zero-knowledge proof
   */
  async generateProof(
    circuitType: string,
    inputs: ProofInputs
  ): Promise<any> {
    // ProofGenerator not available in React Native
    throw new VeilonError(
      'Proof generation not available in React Native. ' +
      'Use relayer-based proof generation instead.'
    );
  }

  // ========================================
  // REMOVED: Statistics Functions
  // ========================================
  // The following statistics functions have been removed as they are not used:
  // - getPrivacyPoolStats()
  // - getGovernanceStats()
  // - getRelayerStats()
  //
  // If you need these features in the future, they can be found in git history.

  /**
   * Get the current provider
   */
  getProvider(): ethers.Provider {
    return this.provider;
  }

  /**
   * Get the current signer
   */
  getSigner(): ethers.Signer | undefined {
    return this.signer;
  }

  /**
   * Get the current configuration
   */
  getConfig(): SDKConfig {
    return this.config;
  }

  /**
   * Update the configuration
   */
  updateConfig(config: Partial<SDKConfig>): void {
    this.config = { ...this.config, ...config };
    this.initialize();
  }
} 