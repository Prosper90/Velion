import { NetworkConfig, SDKConfig } from "./types";

export const NETWORKS: Record<string, NetworkConfig> = {
  mainnet: {
    name: "Ethereum Mainnet",
    chainId: 1,
    rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/demo",
    blockExplorer: "https://etherscan.io",
    contracts: {
      privacyPool: "0x0000000000000000000000000000000000000000",
      relayerRegistry: "0x0000000000000000000000000000000000000000",
      governance: "0x0000000000000000000000000000000000000000",
      verifier: "0x0000000000000000000000000000000000000000",
    },
  },
  goerli: {
    name: "Ethereum Goerli",
    chainId: 5,
    rpcUrl: "https://eth-goerli.g.alchemy.com/v2/demo",
    blockExplorer: "https://goerli.etherscan.io",
    contracts: {
      privacyPool: "0x0000000000000000000000000000000000000000",
      relayerRegistry: "0x0000000000000000000000000000000000000000",
      governance: "0x0000000000000000000000000000000000000000",
      verifier: "0x0000000000000000000000000000000000000000",
    },
  },
  sepolia: {
    name: "Ethereum Sepolia",
    chainId: 11155111,
    rpcUrl: "https://eth-sepolia.public.blastapi.io",
    blockExplorer: "https://sepolia.etherscan.io",
    contracts: {
      privacyPool: "0x2f2B95f475F9774F52bE449e060fC52727B11dEB",
      relayerRegistry: "0xdD0ee5A36E7C667Fc61c6eCCD796360E5C2f6cbA",
      governance: "0x750fA4411B3bf3c6c780cd1f0A6402f2A4048BFc",
      verifier: "0x5003786D8BE3c6Faf66b087600FF0ca340B903f0",
    },
  },
  arbitrum: {
    name: "Arbitrum One",
    chainId: 42161,
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockExplorer: "https://arbiscan.io",
    contracts: {
      privacyPool: "0x0000000000000000000000000000000000000000",
      relayerRegistry: "0x0000000000000000000000000000000000000000",
      governance: "0x0000000000000000000000000000000000000000",
      verifier: "0x0000000000000000000000000000000000000000",
    },
  },
  arbitrumSepolia: {
    name: "Arbitrum Sepolia",
    chainId: 421614,
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    blockExplorer: "https://sepolia.arbiscan.io",
    contracts: {
      privacyPool: "0x0000000000000000000000000000000000000000",
      relayerRegistry: "0x0000000000000000000000000000000000000000",
      governance: "0x0000000000000000000000000000000000000000",
      verifier: "0x0000000000000000000000000000000000000000",
    },
  },
  polygon: {
    name: "Polygon",
    chainId: 137,
    rpcUrl: "https://polygon-rpc.com",
    blockExplorer: "https://polygonscan.com",
    contracts: {
      privacyPool: "0x0000000000000000000000000000000000000000",
      relayerRegistry: "0x0000000000000000000000000000000000000000",
      governance: "0x0000000000000000000000000000000000000000",
      verifier: "0x0000000000000000000000000000000000000000",
    },
  },
  mumbai: {
    name: "Polygon Mumbai",
    chainId: 80001,
    rpcUrl: "https://rpc-mumbai.maticvigil.com",
    blockExplorer: "https://mumbai.polygonscan.com",
    contracts: {
      privacyPool: "0x0000000000000000000000000000000000000000",
      relayerRegistry: "0x0000000000000000000000000000000000000000",
      governance: "0x0000000000000000000000000000000000000000",
      verifier: "0x0000000000000000000000000000000000000000",
    },
  },
  bsc: {
    name: "BNB Smart Chain",
    chainId: 56,
    rpcUrl: "https://bsc-dataseed1.binance.org",
    blockExplorer: "https://bscscan.com",
    contracts: {
      privacyPool: "0x0000000000000000000000000000000000000000",
      relayerRegistry: "0x0000000000000000000000000000000000000000",
      governance: "0x0000000000000000000000000000000000000000",
      verifier: "0x0000000000000000000000000000000000000000",
    },
  },
  testnet: {
    name: "BSC Testnet",
    chainId: 97,
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    blockExplorer: "https://testnet.bscscan.com",
    contracts: {
      privacyPool: "0x0000000000000000000000000000000000000000",
      relayerRegistry: "0x0000000000000000000000000000000000000000",
      governance: "0x0000000000000000000000000000000000000000",
      verifier: "0x0000000000000000000000000000000000000000",
    },
  },
};

export const DEFAULT_CONFIG: SDKConfig = {
  network: "sepolia",
  rpcUrl: NETWORKS.sepolia.rpcUrl,
  relayerUrl: "http://localhost:3001",
  proofServiceUrl: "http://localhost:3002",
};

export const CIRCUIT_TYPES = {
  SHIELD: "shield",
  UNSHIELD: "unshield",
  TRANSFER: "transfer",
  PROOF_OF_INNOCENCE: "poi",
} as const;

export const MERKLE_TREE_DEPTH = 20;
export const FIELD_SIZE =
  "21888242871839275222246405745257275088548364400416034343698204186575808495617";
export const ZERO_VALUE =
  "21663839004416932945382355908790599225266501822907911457504978515578255421292";

export const COMMITMENT_SCHEME = {
  PEDERSEN: "pedersen",
  POSEIDON: "poseidon",
} as const;

export const DEFAULT_RELAYER_FEE = "0.01"; // 1%
export const MIN_RELAYER_STAKE = "1.0"; // 1 ETH
export const GOVERNANCE_QUORUM = "0.1"; // 10%

export const ERROR_CODES = {
  INVALID_PROOF: "INVALID_PROOF",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  INVALID_COMMITMENT: "INVALID_COMMITMENT",
  INVALID_NULLIFIER: "INVALID_NULLIFIER",
  RELAYER_NOT_FOUND: "RELAYER_NOT_FOUND",
  COMPLIANCE_CHECK_FAILED: "COMPLIANCE_CHECK_FAILED",
  EMERGENCY_EXIT_ACTIVE: "EMERGENCY_EXIT_ACTIVE",
} as const;

export const API_ENDPOINTS = {
  SHIELD: "/api/v1/transactions/shield",
  UNSHIELD: "/api/v1/transactions/unshield",
  TRANSFER: "/api/v1/transactions/transfer",
  BALANCE: "/api/v1/balance",
  RELAYERS: "/api/v1/relayers",
  COMPLIANCE: "/api/v1/compliance",
  PROOF: "/api/v1/proof",
  EMERGENCY: "/api/v1/emergency",
} as const;

// DEPRECATED: Use mobile/constants/tokens.ts for comprehensive multi-chain token support
// This is kept for backward compatibility only
export const SUPPORTED_TOKENS = {
  // Ethereum Mainnet & Sepolia
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    address: "0x0000000000000000000000000000000000000000",
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Mainnet
  },
  DAI: {
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", // Mainnet
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Mainnet
  },
  WBTC: {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    decimals: 8,
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // Mainnet
  },

  // Polygon
  MATIC: {
    symbol: "MATIC",
    name: "Polygon",
    decimals: 18,
    address: "0x0000000000000000000000000000000000000000", // Native token
  },

  // BNB Chain
  BNB: {
    symbol: "BNB",
    name: "BNB",
    decimals: 18,
    address: "0x0000000000000000000000000000000000000000", // Native token
  },

  // Arbitrum
  ARB: {
    symbol: "ARB",
    name: "Arbitrum",
    decimals: 18,
    address: "0x912CE59144191C1204E64559FE8253a0e49E6548", // Arbitrum One
  },

  // Optimism
  OP: {
    symbol: "OP",
    name: "Optimism",
    decimals: 18,
    address: "0x4200000000000000000000000000000000000042", // Optimism
  },
} as const;
