// Core SDK exports
export { VeilonSDK } from './sdk';
export { PrivacyPool } from './contracts/privacy-pool';
export { RelayerRegistry } from './contracts/relayer-registry';
export { Governance } from './contracts/governance';
export { Verifier } from './contracts/verifier';

// Types
export type {
  SDKConfig,
  NetworkConfig,
  ContractAddresses,
  ProofInputs,
  ShieldInputs,
  UnshieldInputs,
  TransferInputs,
  RelayerInfo,
  TransactionResult,
  ProofResult
} from './types';

// Utilities (React Native compatible only)
// NOTE: ProofGenerator and CircuitCompiler are NOT exported for React Native
// They require Node.js modules (circomlibjs, snarkjs) that don't work in RN
// Proof generation should be done server-side via relayer
export { KeyManager } from './utils/key-manager';
export { RelayerClient } from './utils/relayer-client';
export { CommitmentStore, commitmentStore } from './utils/commitment-store';
export type { StoredCommitment } from './utils/commitment-store';

// Constants
export { NETWORKS, DEFAULT_CONFIG } from './constants';

// Errors
export { VeilonError, ProofError, ContractError, RelayerError } from './errors'; 