import { ethers } from 'ethers';

export interface SDKConfig {
  network?: string;
  provider?: ethers.Provider;
  signer?: ethers.Signer;
  rpcUrl?: string;
  privateKey?: string;
  relayerUrl?: string;
  proofServiceUrl?: string;
  contracts?: ContractAddresses;
}

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  contracts: ContractAddresses;
}

export interface ContractAddresses {
  privacyPool: string;
  relayerRegistry: string;
  governance: string;
  verifier: string;
  token?: string;
}

export interface ProofInputs {
  amount?: string;
  recipient?: string;
  sender?: string;
  commitment?: string;
  nullifier?: string;
  secret?: string;
  privateKey?: string;
  merkleProof?: string[];
  merkleRoot?: string;
}

export interface ShieldInputs {
  amount: string;
  recipient: string;
  sender: string;
}

export interface UnshieldInputs {
  commitment: string;
  nullifier: string;
  amount: string;
  recipient: string;
  merkleProof: string[];
  secret: string;
}

export interface TransferInputs {
  inputCommitment: string;
  outputCommitment: string;
  nullifier: string;
  amount: string;
  recipient: string;
  merkleProof: string[];
  secret: string;
}

export interface RelayerInfo {
  address: string;
  fee: string;
  stake: string;
  isActive: boolean;
  reputation: number;
  totalTransactions: number;
}

export interface TransactionResult {
  hash: string;
  type: string;
  amount?: string;
  recipient?: string;
  status: 'pending' | 'confirmed' | 'failed';
  fee?: string;
  proposalId?: number;
  support?: boolean;
  description?: string;
  // Shield/Transfer commitment data
  commitment?: string;
  nullifier?: string;
  secret?: string;
}

export interface ProofResult {
  proof: any;
  publicInputs: string[];
  circuitType: string;
  // Private data that should be stored locally (not shared publicly)
  secret?: string;
  commitment?: string;
  nullifier?: string;
}

export interface PrivacyPoolStats {
  totalDeposits: string;
  totalWithdrawals: string;
  anonymitySet: number;
  totalCommitments: number;
}

export interface GovernanceStats {
  totalProposals: number;
  activeProposals: number;
  totalVotes: number;
  quorum: string;
}

export interface RelayerStats {
  totalRelayers: number;
  activeRelayers: number;
  totalStaked: string;
  averageFee: string;
}

export interface Commitment {
  value: string;
  nullifier: string;
  secret: string;
  merkleIndex: number;
}

export interface MerkleTree {
  root: string;
  depth: number;
  nextIndex: number;
  leaves: string[];
}

export interface CircuitInputs {
  [key: string]: any;
}

export interface ZKProof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

export interface WalletConnection {
  address: string;
  provider: ethers.Provider;
  signer: ethers.Signer;
  chainId: number;
}

export interface Transaction {
  id: string;
  hash: string;
  type: 'shield' | 'unshield' | 'transfer';
  amount: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  from?: string;
  to?: string;
  fee?: string;
  blockNumber?: number;
}

export interface Balance {
  public: string;
  private: string;
  pending: string;
}

export interface ComplianceCheck {
  address: string;
  riskScore: number;
  isBlacklisted: boolean;
  sanctions: string[];
  lastChecked: number;
}

export interface EmergencyExit {
  exitKey: string;
  amount: string;
  recipient: string;
  timestamp: number;
  txHash?: string;
}