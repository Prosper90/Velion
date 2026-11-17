/**
 * Multi-chain Token Configuration
 * Defines supported tokens across different blockchain networks
 */

export interface TokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
  icon: string; // emoji or asset path
  coingeckoId?: string; // For price fetching
  cryptocompareSymbol?: string; // For CryptoCompare API
}

export interface ChainTokens {
  chainId: number;
  chainName: string;
  nativeToken: TokenMetadata;
  tokens: {
    [address: string]: TokenMetadata;
  };
}

/**
 * Ethereum Mainnet (Chain ID: 1)
 */
export const ETHEREUM_MAINNET: ChainTokens = {
  chainId: 1,
  chainName: "Ethereum",
  nativeToken: {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    icon: "💎",
    coingeckoId: "ethereum",
    cryptocompareSymbol: "ETH",
  },
  tokens: {
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      icon: "💵",
      coingeckoId: "usd-coin",
      cryptocompareSymbol: "USDC",
    },
    "0x6B175474E89094C44Da98b954EedeAC495271d0F": {
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      icon: "💰",
      coingeckoId: "dai",
      cryptocompareSymbol: "DAI",
    },
    "0xdAC17F958D2ee523a2206206994597C13D831ec7": {
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      icon: "💵",
      coingeckoId: "tether",
      cryptocompareSymbol: "USDT",
    },
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": {
      symbol: "WBTC",
      name: "Wrapped Bitcoin",
      decimals: 8,
      icon: "₿",
      coingeckoId: "wrapped-bitcoin",
      cryptocompareSymbol: "WBTC",
    },
  },
};

/**
 * Ethereum Sepolia Testnet (Chain ID: 11155111)
 */
export const ETHEREUM_SEPOLIA: ChainTokens = {
  chainId: 11155111,
  chainName: "Sepolia",
  nativeToken: {
    symbol: "ETH",
    name: "Sepolia ETH",
    decimals: 18,
    icon: require("../assets/tokenLogos/eth.svg"),
    coingeckoId: "ethereum",
    cryptocompareSymbol: "ETH",
  },
  tokens: {
    "0x7A020D305764A0ba4035df7265e57917C86bC4d3": {
      symbol: "USDC",
      name: "Test USDC",
      decimals: 6,
      icon: require("../assets/tokenLogos/usdc.svg"),
      coingeckoId: "usd-coin",
      cryptocompareSymbol: "USDC",
    },
    "0xbB254d32b06494390fDBDc49B017470Be8AdA6bC": {
      symbol: "USDT",
      name: "Test USDT",
      decimals: 6,
      icon: require("../assets/tokenLogos/usdt.svg"),
      coingeckoId: "tether",
      cryptocompareSymbol: "USDT",
    },
    "0x05E54f8d58CEf540640de7FB0c3E10dB19AC9bEC": {
      symbol: "DAI",
      name: "Test DAI",
      decimals: 18,
      icon: require("../assets/tokenLogos/dai.svg"),
      coingeckoId: "dai",
      cryptocompareSymbol: "DAI",
    },
  },
};

/**
 * Polygon (Chain ID: 137)
 */
export const POLYGON_MAINNET: ChainTokens = {
  chainId: 137,
  chainName: "Polygon",
  nativeToken: {
    symbol: "MATIC",
    name: "Polygon",
    decimals: 18,
    icon: "🟣",
    coingeckoId: "matic-network",
    cryptocompareSymbol: "MATIC",
  },
  tokens: {
    "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174": {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      icon: "💵",
      coingeckoId: "usd-coin",
      cryptocompareSymbol: "USDC",
    },
    "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063": {
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      icon: "💰",
      coingeckoId: "dai",
      cryptocompareSymbol: "DAI",
    },
    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F": {
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      icon: "💵",
      coingeckoId: "tether",
      cryptocompareSymbol: "USDT",
    },
    "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619": {
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      icon: "💎",
      coingeckoId: "weth",
      cryptocompareSymbol: "WETH",
    },
    "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6": {
      symbol: "WBTC",
      name: "Wrapped Bitcoin",
      decimals: 8,
      icon: "₿",
      coingeckoId: "wrapped-bitcoin",
      cryptocompareSymbol: "WBTC",
    },
  },
};

/**
 * Arbitrum One (Chain ID: 42161)
 */
export const ARBITRUM_MAINNET: ChainTokens = {
  chainId: 42161,
  chainName: "Arbitrum",
  nativeToken: {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    icon: "💎",
    coingeckoId: "ethereum",
    cryptocompareSymbol: "ETH",
  },
  tokens: {
    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831": {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      icon: "💵",
      coingeckoId: "usd-coin",
      cryptocompareSymbol: "USDC",
    },
    "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1": {
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      icon: "💰",
      coingeckoId: "dai",
      cryptocompareSymbol: "DAI",
    },
    "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9": {
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      icon: "💵",
      coingeckoId: "tether",
      cryptocompareSymbol: "USDT",
    },
    "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f": {
      symbol: "WBTC",
      name: "Wrapped Bitcoin",
      decimals: 8,
      icon: "₿",
      coingeckoId: "wrapped-bitcoin",
      cryptocompareSymbol: "WBTC",
    },
    "0x912CE59144191C1204E64559FE8253a0e49E6548": {
      symbol: "ARB",
      name: "Arbitrum",
      decimals: 18,
      icon: "🔵",
      coingeckoId: "arbitrum",
      cryptocompareSymbol: "ARB",
    },
  },
};

/**
 * BNB Smart Chain (Chain ID: 56)
 */
export const BSC_MAINNET: ChainTokens = {
  chainId: 56,
  chainName: "BNB Chain",
  nativeToken: {
    symbol: "BNB",
    name: "BNB",
    decimals: 18,
    icon: "🟡",
    coingeckoId: "binancecoin",
    cryptocompareSymbol: "BNB",
  },
  tokens: {
    "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d": {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 18,
      icon: "💵",
      coingeckoId: "usd-coin",
      cryptocompareSymbol: "USDC",
    },
    "0x55d398326f99059fF775485246999027B3197955": {
      symbol: "USDT",
      name: "Tether USD",
      decimals: 18,
      icon: "💵",
      coingeckoId: "tether",
      cryptocompareSymbol: "USDT",
    },
    "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56": {
      symbol: "BUSD",
      name: "Binance USD",
      decimals: 18,
      icon: "💵",
      coingeckoId: "binance-usd",
      cryptocompareSymbol: "BUSD",
    },
    "0x2170Ed0880ac9A755fd29B2688956BD959F933F8": {
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
      icon: "💎",
      coingeckoId: "ethereum",
      cryptocompareSymbol: "ETH",
    },
    "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c": {
      symbol: "BTCB",
      name: "Bitcoin BEP2",
      decimals: 18,
      icon: "₿",
      coingeckoId: "bitcoin-bep2",
      cryptocompareSymbol: "BTC",
    },
  },
};

/**
 * Optimism (Chain ID: 10)
 */
export const OPTIMISM_MAINNET: ChainTokens = {
  chainId: 10,
  chainName: "Optimism",
  nativeToken: {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    icon: "💎",
    coingeckoId: "ethereum",
    cryptocompareSymbol: "ETH",
  },
  tokens: {
    "0x7F5c764cBc14f9669B88837ca1490cCa17c31607": {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      icon: "💵",
      coingeckoId: "usd-coin",
      cryptocompareSymbol: "USDC",
    },
    "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1": {
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      icon: "💰",
      coingeckoId: "dai",
      cryptocompareSymbol: "DAI",
    },
    "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58": {
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      icon: "💵",
      coingeckoId: "tether",
      cryptocompareSymbol: "USDT",
    },
    "0x68f180fcCe6836688e9084f035309E29Bf0A2095": {
      symbol: "WBTC",
      name: "Wrapped Bitcoin",
      decimals: 8,
      icon: "₿",
      coingeckoId: "wrapped-bitcoin",
      cryptocompareSymbol: "WBTC",
    },
    "0x4200000000000000000000000000000000000042": {
      symbol: "OP",
      name: "Optimism",
      decimals: 18,
      icon: "🔴",
      coingeckoId: "optimism",
      cryptocompareSymbol: "OP",
    },
  },
};

/**
 * Base (Chain ID: 8453)
 */
export const BASE_MAINNET: ChainTokens = {
  chainId: 8453,
  chainName: "Base",
  nativeToken: {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    icon: "💎",
    coingeckoId: "ethereum",
    cryptocompareSymbol: "ETH",
  },
  tokens: {
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      icon: "💵",
      coingeckoId: "usd-coin",
      cryptocompareSymbol: "USDC",
    },
    "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb": {
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      icon: "💰",
      coingeckoId: "dai",
      cryptocompareSymbol: "DAI",
    },
  },
};

/**
 * Map of all supported chains
 */
export const SUPPORTED_CHAINS: { [chainId: number]: ChainTokens } = {
  1: ETHEREUM_MAINNET,
  11155111: ETHEREUM_SEPOLIA,
  137: POLYGON_MAINNET,
  42161: ARBITRUM_MAINNET,
  56: BSC_MAINNET,
  10: OPTIMISM_MAINNET,
  8453: BASE_MAINNET,
};

/**
 * Get tokens for a specific chain
 */
export function getTokensForChain(chainId: number): ChainTokens | null {
  return SUPPORTED_CHAINS[chainId] || null;
}

/**
 * Get all tokens for a chain (including native token)
 */
export function getAllTokensForChain(chainId: number): TokenMetadata[] {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) return [];

  const tokens: TokenMetadata[] = [chain.nativeToken];
  Object.values(chain.tokens).forEach((token) => tokens.push(token));

  return tokens;
}

/**
 * Get token by address on a specific chain
 */
export function getTokenByAddress(
  chainId: number,
  address: string
): TokenMetadata | null {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) return null;

  // Check if it's the native token (address 0x0 or empty)
  if (!address || address === "0x0000000000000000000000000000000000000000") {
    return chain.nativeToken;
  }

  // Normalize address to lowercase for comparison
  const normalizedAddress = address.toLowerCase();

  // Find in ERC20 tokens
  for (const [tokenAddress, tokenData] of Object.entries(chain.tokens)) {
    if (tokenAddress.toLowerCase() === normalizedAddress) {
      return tokenData;
    }
  }

  return null;
}

/**
 * Check if a token is supported on a chain
 */
export function isTokenSupported(chainId: number, address: string): boolean {
  return getTokenByAddress(chainId, address) !== null;
}

/**
 * Get token address by symbol on a specific chain
 */
export function getTokenAddressBySymbol(
  chainId: number,
  symbol: string
): string | null {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) return null;

  // Check if it's the native token
  if (chain.nativeToken.symbol === symbol) {
    return "0x0000000000000000000000000000000000000000";
  }

  // Find in ERC20 tokens
  for (const [tokenAddress, tokenData] of Object.entries(chain.tokens)) {
    if (tokenData.symbol === symbol) {
      return tokenAddress;
    }
  }

  return null;
}

/**
 * Get supported tokens for display in UI
 * Returns tokens with address included for ERC20 balance fetching
 */
export interface TokenWithAddress extends TokenMetadata {
  address: string;
  isNative: boolean;
}

export function getSupportedTokensForChain(
  chainId: number
): TokenWithAddress[] {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) return [];

  const tokens: TokenWithAddress[] = [
    {
      ...chain.nativeToken,
      address: "0x0000000000000000000000000000000000000000",
      isNative: true,
    },
  ];

  // Add ERC20 tokens
  for (const [address, tokenData] of Object.entries(chain.tokens)) {
    tokens.push({
      ...tokenData,
      address: address,
      isNative: false,
    });
  }

  return tokens;
}
