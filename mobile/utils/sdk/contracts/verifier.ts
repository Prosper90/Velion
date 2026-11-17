import { ethers } from 'ethers';
import { ContractError } from '../errors';

export class Verifier {
  private contract: ethers.Contract;
  private provider: ethers.Provider;
  private signer?: ethers.Signer;

  // Verifier ABI
  private static readonly ABI = [
    'function verifyProof(string calldata circuitType, bytes calldata proof, uint256[] calldata publicInputs) external view returns (bool)',
    'function verifyShieldProof(bytes calldata proof, uint256[] calldata publicInputs) external view returns (bool)',
    'function verifyUnshieldProof(bytes calldata proof, uint256[] calldata publicInputs) external view returns (bool)',
    'function verifyTransferProof(bytes calldata proof, uint256[] calldata publicInputs) external view returns (bool)',
    'function isCircuitSupported(string calldata circuitType) external view returns (bool)',
    'function getSupportedCircuits() external view returns (string[] memory)',
    'function getCircuitVerificationKey(string calldata circuitType) external view returns (bytes memory)',
    'function updateVerificationKey(string calldata circuitType, bytes calldata vk) external',
    'event VerificationKeyUpdated(string indexed circuitType, bytes32 indexed vkHash)',
    'event ProofVerified(string indexed circuitType, bool result, bytes32 indexed proofHash)'
  ];

  constructor(address: string, provider: ethers.Provider, signer?: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
    this.contract = new ethers.Contract(address, Verifier.ABI, signer || provider);
  }

  /**
   * Verify a zero-knowledge proof for any supported circuit type
   */
  async verifyProof(
    circuitType: string,
    proof: any,
    publicInputs: string[]
  ): Promise<boolean> {
    try {
      // Convert proof object to bytes if necessary
      const proofBytes = this.serializeProof(proof);

      // Convert public inputs to uint256 array
      const publicInputsUint = publicInputs.map(input => BigInt(input));

      const result = await this.contract.verifyProof(circuitType, proofBytes, publicInputsUint);
      return result;
    } catch (error: any) {
      throw new ContractError(`Proof verification failed: ${error.message}`, error);
    }
  }

  /**
   * Verify a shield proof specifically
   */
  async verifyShieldProof(proof: any, publicInputs: string[]): Promise<boolean> {
    try {
      const proofBytes = this.serializeProof(proof);
      const publicInputsUint = publicInputs.map(input => BigInt(input));

      const result = await this.contract.verifyShieldProof(proofBytes, publicInputsUint);
      return result;
    } catch (error: any) {
      throw new ContractError(`Shield proof verification failed: ${error.message}`, error);
    }
  }

  /**
   * Verify an unshield proof specifically
   */
  async verifyUnshieldProof(proof: any, publicInputs: string[]): Promise<boolean> {
    try {
      const proofBytes = this.serializeProof(proof);
      const publicInputsUint = publicInputs.map(input => BigInt(input));

      const result = await this.contract.verifyUnshieldProof(proofBytes, publicInputsUint);
      return result;
    } catch (error: any) {
      throw new ContractError(`Unshield proof verification failed: ${error.message}`, error);
    }
  }

  /**
   * Verify a transfer proof specifically
   */
  async verifyTransferProof(proof: any, publicInputs: string[]): Promise<boolean> {
    try {
      const proofBytes = this.serializeProof(proof);
      const publicInputsUint = publicInputs.map(input => BigInt(input));

      const result = await this.contract.verifyTransferProof(proofBytes, publicInputsUint);
      return result;
    } catch (error: any) {
      throw new ContractError(`Transfer proof verification failed: ${error.message}`, error);
    }
  }

  /**
   * Check if a circuit type is supported
   */
  async isCircuitSupported(circuitType: string): Promise<boolean> {
    try {
      return await this.contract.isCircuitSupported(circuitType);
    } catch (error: any) {
      throw new ContractError(`Failed to check circuit support: ${error.message}`, error);
    }
  }

  /**
   * Get all supported circuit types
   */
  async getSupportedCircuits(): Promise<string[]> {
    try {
      return await this.contract.getSupportedCircuits();
    } catch (error: any) {
      throw new ContractError(`Failed to get supported circuits: ${error.message}`, error);
    }
  }

  /**
   * Get verification key for a circuit type
   */
  async getCircuitVerificationKey(circuitType: string): Promise<string> {
    try {
      return await this.contract.getCircuitVerificationKey(circuitType);
    } catch (error: any) {
      throw new ContractError(`Failed to get verification key: ${error.message}`, error);
    }
  }

  /**
   * Update verification key for a circuit type (admin function)
   */
  async updateVerificationKey(circuitType: string, vk: string): Promise<ethers.ContractTransactionResponse> {
    try {
      if (!this.signer) {
        throw new ContractError('Signer is required for updating verification keys');
      }

      const tx = await this.contract.updateVerificationKey(circuitType, vk);
      return tx;
    } catch (error: any) {
      throw new ContractError(`Verification key update failed: ${error.message}`, error);
    }
  }

  /**
   * Batch verify multiple proofs
   */
  async batchVerifyProofs(
    proofs: Array<{
      circuitType: string;
      proof: any;
      publicInputs: string[];
    }>
  ): Promise<boolean[]> {
    try {
      const results = await Promise.all(
        proofs.map(({ circuitType, proof, publicInputs }) =>
          this.verifyProof(circuitType, proof, publicInputs)
        )
      );
      return results;
    } catch (error: any) {
      throw new ContractError(`Batch proof verification failed: ${error.message}`, error);
    }
  }

  /**
   * Get verification statistics
   */
  async getVerificationStats(): Promise<{
    supportedCircuits: string[];
    totalVerifications: number;
  }> {
    try {
      const supportedCircuits = await this.getSupportedCircuits();

      // Note: totalVerifications would need to be tracked in the contract
      // This is a placeholder implementation
      return {
        supportedCircuits,
        totalVerifications: 0
      };
    } catch (error: any) {
      throw new ContractError(`Failed to get verification stats: ${error.message}`, error);
    }
  }

  /**
   * Serialize proof object to bytes format expected by contract
   */
  private serializeProof(proof: any): string {
    try {
      // Handle different proof formats
      if (typeof proof === 'string') {
        return proof;
      }

      if (proof.pi_a && proof.pi_b && proof.pi_c) {
        // Standard Groth16 proof format
        const serialized = {
          a: proof.pi_a,
          b: proof.pi_b,
          c: proof.pi_c
        };
        return ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify(serialized)));
      }

      if (proof.proof) {
        return this.serializeProof(proof.proof);
      }

      // Fallback: stringify the proof object
      return ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify(proof)));
    } catch (error: any) {
      throw new ContractError(`Failed to serialize proof: ${error.message}`, error);
    }
  }

  /**
   * Listen for VerificationKeyUpdated events
   */
  onVerificationKeyUpdated(callback: (circuitType: string, vkHash: string) => void): void {
    this.contract.on('VerificationKeyUpdated', (circuitType, vkHash, event) => {
      callback(circuitType, vkHash);
    });
  }

  /**
   * Listen for ProofVerified events
   */
  onProofVerified(callback: (circuitType: string, result: boolean, proofHash: string) => void): void {
    this.contract.on('ProofVerified', (circuitType, result, proofHash, event) => {
      callback(circuitType, result, proofHash);
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