import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ethers } from "ethers";
import { getSupportedTokensForChain, TokenWithAddress } from "../constants/tokens";
import { getMultipleERC20Balances } from "../utils/erc20-balance";
import { veilonSDK } from "../services/veilon-sdk";

/**
 * Custom Token Interface
 */
export interface CustomToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
  chainId: number;
  addedAt: number;
}

/**
 * Token Balance Interface
 */
export interface TokenBalance {
  symbol: string;
  address: string;
  balance: string;
  decimals: number;
  isNative: boolean;
}

interface TokenStore {
  // State
  customTokens: CustomToken[];
  tokenBalances: Record<string, TokenBalance[]>; // walletAddress => balances
  isLoading: boolean;

  // Actions
  addCustomToken: (token: Omit<CustomToken, "addedAt">) => Promise<void>;
  removeCustomToken: (address: string, chainId: number) => Promise<void>;
  getCustomTokensForChain: (chainId: number) => CustomToken[];
  getAllTokensForChain: (chainId: number) => TokenWithAddress[];

  // Balance actions
  fetchTokenBalances: (walletAddress: string, chainId: number) => Promise<void>;
  getTokenBalances: (walletAddress: string) => TokenBalance[];

  // Initialize
  loadCustomTokens: () => Promise<void>;
}

const CUSTOM_TOKENS_KEY = "custom_tokens";

export const useTokenStore = create<TokenStore>((set, get) => ({
  customTokens: [],
  tokenBalances: {},
  isLoading: false,

  addCustomToken: async (token) => {
    try {
      const customToken: CustomToken = {
        ...token,
        addedAt: Date.now(),
      };

      const { customTokens } = get();

      // Check if token already exists
      const exists = customTokens.some(
        (t) =>
          t.address.toLowerCase() === token.address.toLowerCase() &&
          t.chainId === token.chainId
      );

      if (exists) {
        throw new Error("Token already added");
      }

      const updatedTokens = [...customTokens, customToken];
      set({ customTokens: updatedTokens });

      await AsyncStorage.setItem(
        CUSTOM_TOKENS_KEY,
        JSON.stringify(updatedTokens)
      );

      console.log("✅ Custom token added:", customToken.symbol);
    } catch (error) {
      console.error("❌ Failed to add custom token:", error);
      throw error;
    }
  },

  removeCustomToken: async (address, chainId) => {
    try {
      const { customTokens } = get();
      const updatedTokens = customTokens.filter(
        (t) =>
          !(
            t.address.toLowerCase() === address.toLowerCase() &&
            t.chainId === chainId
          )
      );

      set({ customTokens: updatedTokens });
      await AsyncStorage.setItem(
        CUSTOM_TOKENS_KEY,
        JSON.stringify(updatedTokens)
      );

      console.log("✅ Custom token removed:", address);
    } catch (error) {
      console.error("❌ Failed to remove custom token:", error);
      throw error;
    }
  },

  getCustomTokensForChain: (chainId) => {
    const { customTokens } = get();
    return customTokens.filter((t) => t.chainId === chainId);
  },

  getAllTokensForChain: (chainId) => {
    // Get default tokens
    const defaultTokens = getSupportedTokensForChain(chainId);

    // Get custom tokens
    const customTokens = get().getCustomTokensForChain(chainId);

    // Convert custom tokens to TokenWithAddress format
    const customTokensFormatted: TokenWithAddress[] = customTokens.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      icon: t.icon || "🪙",
      address: t.address,
      isNative: false,
    }));

    return [...defaultTokens, ...customTokensFormatted];
  },

  fetchTokenBalances: async (walletAddress, chainId) => {
    try {
      set({ isLoading: true });

      const provider = veilonSDK.getProvider();
      if (!provider) {
        throw new Error("Provider not initialized");
      }

      // Get all tokens for the chain (default + custom)
      const allTokens = get().getAllTokensForChain(chainId);

      // Separate native and ERC20 tokens
      const nativeToken = allTokens.find((t) => t.isNative);
      const erc20Tokens = allTokens.filter((t) => !t.isNative);

      // Fetch native balance
      let nativeBalance = "0.00";
      if (nativeToken) {
        try {
          const balance = await provider.getBalance(walletAddress);
          nativeBalance = parseFloat(ethers.formatEther(balance)).toFixed(4);
        } catch (error) {
          console.error("Failed to fetch native balance:", error);
        }
      }

      // Fetch ERC20 balances
      const erc20Addresses = erc20Tokens.map((t) => t.address);
      const erc20Balances = await getMultipleERC20Balances(
        erc20Addresses,
        walletAddress,
        provider
      );

      // Build token balances array
      const balances: TokenBalance[] = [];

      // Add native token
      if (nativeToken) {
        balances.push({
          symbol: nativeToken.symbol,
          address: nativeToken.address,
          balance: nativeBalance,
          decimals: nativeToken.decimals,
          isNative: true,
        });
      }

      // Add ERC20 tokens
      erc20Tokens.forEach((token) => {
        const balanceData =
          erc20Balances[token.address.toLowerCase()] || {};
        balances.push({
          symbol: token.symbol,
          address: token.address,
          balance: balanceData.balance || "0.00",
          decimals: balanceData.decimals || token.decimals,
          isNative: false,
        });
      });

      // Update state
      const { tokenBalances } = get();
      set({
        tokenBalances: {
          ...tokenBalances,
          [walletAddress]: balances,
        },
        isLoading: false,
      });

      console.log("✅ Token balances fetched:", balances.length, "tokens");
    } catch (error) {
      console.error("❌ Failed to fetch token balances:", error);
      set({ isLoading: false });
    }
  },

  getTokenBalances: (walletAddress) => {
    const { tokenBalances } = get();
    return tokenBalances[walletAddress] || [];
  },

  loadCustomTokens: async () => {
    try {
      const stored = await AsyncStorage.getItem(CUSTOM_TOKENS_KEY);
      if (stored) {
        const customTokens = JSON.parse(stored);
        set({ customTokens });
        console.log("✅ Loaded custom tokens:", customTokens.length);
      }
    } catch (error) {
      console.error("❌ Failed to load custom tokens:", error);
    }
  },
}));
