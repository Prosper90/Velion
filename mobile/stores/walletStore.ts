// IMPORTANT: Import crypto setup BEFORE ethers to register native crypto functions
import "../utils/crypto-setup";

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { ethers } from "ethers";
import { veilonSDK } from "../services/veilon-sdk";

interface Wallet {
  address: string;
  name: string;
  publicBalance: string;
  privateBalance: string;
  createdAt: number;
  privateAddress?: string; // 0zk address for receiving private transfers
}

interface NetworkInfo {
  name: string;
  chainId: number;
  isTestnet: boolean;
}

interface WalletState {
  // State
  wallets: Wallet[];
  activeWalletAddress: string | null;
  isConnected: boolean;
  isLoading: boolean;
  network: NetworkInfo | null;

  // Getters
  getActiveWallet: () => Wallet | null;

  // Actions
  setActiveWallet: (address: string) => void;
  setBalances: (address: string, publicBal: string, privateBal: string) => void;
  setLoading: (loading: boolean) => void;
  updateWalletName: (address: string, name: string) => Promise<void>;

  // Balance operations
  refreshBalances: (address?: string) => Promise<void>;

  // Network operations
  switchNetwork: (chainId: number, rpcUrl: string) => Promise<void>;

  // Wallet operations
  createWallet: (name?: string) => Promise<string>;
  importWallet: (privateKeyOrMnemonic: string, name?: string) => Promise<void>;
  deleteWallet: (address: string) => Promise<void>;

  // Initialize
  initializeWallet: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  // Initial state
  wallets: [],
  activeWalletAddress: null,
  isConnected: false,
  isLoading: true,
  network: null,

  // Getters
  getActiveWallet: () => {
    const { wallets, activeWalletAddress } = get();
    return wallets.find((w) => w.address === activeWalletAddress) || null;
  },

  // Simple setters
  setActiveWallet: async (address) => {
    const { wallets } = get();
    const wallet = wallets.find((w) => w.address === address);
    if (wallet) {
      try {
        console.log(`🔄 Switching to wallet: ${address}`);

        // Get private key for the wallet
        const privateKey = await SecureStore.getItemAsync(`wallet_pk_${address}`);
        if (!privateKey) {
          throw new Error('Private key not found for this wallet');
        }

        // Reinitialize SDK with new wallet's private key
        await veilonSDK.initialize(privateKey);
        console.log('✅ SDK reinitialized with new wallet');

        // Update state and storage
        set({ activeWalletAddress: address, isConnected: true });
        await AsyncStorage.setItem("active_wallet_address", address);

        // Refresh balances for the new active wallet
        await get().refreshBalances(address);

        console.log(`✅ Switched to wallet: ${address}`);
      } catch (error) {
        console.error('❌ Failed to switch wallet:', error);
        throw error;
      }
    }
  },

  setBalances: (address, publicBalance, privateBalance) => {
    const { wallets } = get();
    const updatedWallets = wallets.map((w) =>
      w.address === address ? { ...w, publicBalance, privateBalance } : w
    );
    set({ wallets: updatedWallets });
    AsyncStorage.setItem("wallets", JSON.stringify(updatedWallets));
  },

  setLoading: (isLoading) => set({ isLoading }),

  updateWalletName: async (address, name) => {
    const { wallets } = get();
    const updatedWallets = wallets.map((w) =>
      w.address === address ? { ...w, name } : w
    );
    set({ wallets: updatedWallets });
    await AsyncStorage.setItem("wallets", JSON.stringify(updatedWallets));
  },

  refreshBalances: async (address?: string) => {
    const { activeWalletAddress, wallets } = get();
    const targetAddress = address || activeWalletAddress;

    if (!targetAddress) {
      console.warn("⚠️ No address to refresh balances for");
      return;
    }

    try {
      console.log("💰 Refreshing balances for:", targetAddress);

      // Get balances using SDK
      const [publicBal, privateBal] = await Promise.all([
        veilonSDK.getPublicBalance(targetAddress).catch((err) => {
          console.error("Failed to fetch public balance:", err);
          return "0.00";
        }),
        veilonSDK.getPrivateBalance(targetAddress).catch((err) => {
          console.error("Failed to fetch private balance:", err);
          return "0.00";
        }),
      ]);

      // Scan for incoming transactions (don't block on this)
      const provider = veilonSDK.getProvider();
      if (provider) {
        const { transactionHistoryRN } = await import("../utils/transaction-history-rn");
        transactionHistoryRN.scanForIncomingTransactions(targetAddress, provider).catch((err) => {
          console.error("Failed to scan for incoming transactions:", err);
        });
      }

      // Update wallets array
      const updatedWallets = wallets.map((w) =>
        w.address === targetAddress
          ? { ...w, publicBalance: publicBal, privateBalance: privateBal }
          : w
      );

      set({ wallets: updatedWallets });
      await AsyncStorage.setItem("wallets", JSON.stringify(updatedWallets));

      console.log("✅ Balances refreshed:", {
        public: publicBal,
        private: privateBal,
      });
    } catch (error) {
      console.error("❌ Failed to refresh balances:", error);
    }
  },

  switchNetwork: async (chainId: number, rpcUrl: string) => {
    try {
      console.log(`🌐 Switching to network: ${chainId}`);
      set({ isLoading: true });

      const { activeWalletAddress } = get();
      if (!activeWalletAddress) {
        throw new Error("No active wallet");
      }

      // Get private key for active wallet
      const privateKey = await SecureStore.getItemAsync(`wallet_pk_${activeWalletAddress}`);
      if (!privateKey) {
        throw new Error("Private key not found");
      }

      // Reinitialize SDK with new network
      await veilonSDK.switchNetwork(chainId, rpcUrl, privateKey);

      // Get new network info
      const network = await veilonSDK.getNetwork();
      console.log('✅ Switched to network:', network.name);

      set({ network, isLoading: false });

      // Refresh balances on new network
      await get().refreshBalances(activeWalletAddress);
    } catch (error: any) {
      console.error("❌ Failed to switch network:", error);
      set({ isLoading: false });
      throw error;
    }
  },

  // Initialize - check for existing wallets
  initializeWallet: async () => {
    try {
      console.log("🔍 Checking for stored wallets...");

      // Load wallets from storage
      const walletsJson = await AsyncStorage.getItem("wallets");
      const wallets: Wallet[] = walletsJson ? JSON.parse(walletsJson) : [];

      // Load active wallet address
      const activeAddress = await AsyncStorage.getItem("active_wallet_address");

      console.log(`✅ Found ${wallets.length} wallet(s)`);

      // If there's an active wallet, initialize SDK and get network
      let network: NetworkInfo | null = null;
      if (activeAddress) {
        try {
          const privateKey = await SecureStore.getItemAsync(`wallet_pk_${activeAddress}`);
          if (privateKey) {
            await veilonSDK.initialize(privateKey);
            network = await veilonSDK.getNetwork();
            console.log('🌐 Connected to network:', network.name);
          }
        } catch (error) {
          console.error('Failed to initialize SDK:', error);
        }
      }

      const finalActiveAddress = activeAddress || (wallets.length > 0 ? wallets[0].address : null);

      set({
        wallets,
        activeWalletAddress: finalActiveAddress,
        isConnected: wallets.length > 0,
        network,
        isLoading: false,
      });

      // Refresh balances for active wallet if it exists
      if (finalActiveAddress && network) {
        console.log('📊 Fetching balances...');
        await get().refreshBalances(finalActiveAddress);
      }
    } catch (error) {
      console.error("❌ Failed to initialize wallets:", error);
      set({ isLoading: false });
    }
  },

  // Create new wallet
  createWallet: async (name?: string) => {
    try {
      console.log("🆕 Creating new wallet...");
      set({ isLoading: true });

      // Generate random wallet
      const wallet = ethers.Wallet.createRandom();
      const mnemonic = wallet.mnemonic?.phrase;

      if (!mnemonic) {
        throw new Error("Failed to generate mnemonic");
      }

      // Generate private address (0zk format)
      const { generatePrivateAddress } = await import("../utils/private-address-generator");
      const privateAddress = await generatePrivateAddress(wallet.privateKey);
      console.log("🔐 Generated private address:", privateAddress);

      const { wallets } = get();
      const walletNumber = wallets.length + 1;
      const walletName = name || `Wallet ${walletNumber}`;

      const newWallet: Wallet = {
        address: wallet.address,
        name: walletName,
        publicBalance: "0.00",
        privateBalance: "0.00",
        createdAt: Date.now(),
        privateAddress,
      };

      const updatedWallets = [...wallets, newWallet];

      // Store private key with address as part of key for multiple wallet support
      await SecureStore.setItemAsync(
        `wallet_pk_${wallet.address}`,
        wallet.privateKey
      );

      // Store wallets array
      await AsyncStorage.setItem("wallets", JSON.stringify(updatedWallets));

      // Set as active wallet
      await AsyncStorage.setItem("active_wallet_address", wallet.address);

      // Initialize SDK and get network
      await veilonSDK.initialize(wallet.privateKey);
      const network = await veilonSDK.getNetwork();
      console.log('🌐 Connected to network:', network.name);

      set({
        wallets: updatedWallets,
        activeWalletAddress: wallet.address,
        isConnected: true,
        network,
        isLoading: false,
      });

      console.log("✅ Wallet created:", wallet.address);

      // Refresh balances for the new wallet
      await get().refreshBalances(wallet.address);

      return mnemonic;
    } catch (error: any) {
      console.error("❌ Failed to create wallet:", error);
      set({ isLoading: false });
      throw new Error(error.message || "Failed to create wallet");
    }
  },

  // Import existing wallet
  importWallet: async (privateKeyOrMnemonic: string, name?: string) => {
    try {
      console.log("📥 Importing wallet...");
      set({ isLoading: true });

      let privateKey: string;

      // Check if it's a mnemonic (12 or 24 words)
      const words = privateKeyOrMnemonic.trim().split(/\s+/);
      if (words.length === 12 || words.length === 24) {
        const wallet = ethers.Wallet.fromPhrase(privateKeyOrMnemonic.trim());
        privateKey = wallet.privateKey;
      } else {
        // It's a private key
        privateKey = privateKeyOrMnemonic.startsWith("0x")
          ? privateKeyOrMnemonic
          : `0x${privateKeyOrMnemonic}`;
      }

      // Validate and get address
      const wallet = new ethers.Wallet(privateKey);

      const { wallets } = get();

      // Check if wallet already exists
      if (wallets.some((w) => w.address === wallet.address)) {
        throw new Error("Wallet already imported");
      }

      // Generate private address (0zk format)
      const { generatePrivateAddress } = await import("../utils/private-address-generator");
      const privateAddress = await generatePrivateAddress(privateKey);
      console.log("🔐 Generated private address:", privateAddress);

      const walletNumber = wallets.length + 1;
      const walletName = name || `Wallet ${walletNumber}`;

      const newWallet: Wallet = {
        address: wallet.address,
        name: walletName,
        publicBalance: "0.00",
        privateBalance: "0.00",
        createdAt: Date.now(),
        privateAddress,
      };

      const updatedWallets = [...wallets, newWallet];

      // Store private key with address as part of key
      await SecureStore.setItemAsync(`wallet_pk_${wallet.address}`, privateKey);

      // Store wallets array
      await AsyncStorage.setItem("wallets", JSON.stringify(updatedWallets));

      // Set as active wallet
      await AsyncStorage.setItem("active_wallet_address", wallet.address);

      // Initialize SDK and get network
      await veilonSDK.initialize(privateKey);
      const network = await veilonSDK.getNetwork();
      console.log('🌐 Connected to network:', network.name);

      set({
        wallets: updatedWallets,
        activeWalletAddress: wallet.address,
        isConnected: true,
        network,
        isLoading: false,
      });

      console.log("✅ Wallet imported:", wallet.address);

      // Refresh balances for the imported wallet
      await get().refreshBalances(wallet.address);
    } catch (error: any) {
      console.error("❌ Failed to import wallet:", error);
      set({ isLoading: false });
      throw new Error(error.message || "Failed to import wallet");
    }
  },

  // Delete wallet
  deleteWallet: async (address: string) => {
    try {
      console.log("🗑️ Deleting wallet:", address);

      const { wallets, activeWalletAddress } = get();

      // Remove from wallets array
      const updatedWallets = wallets.filter((w) => w.address !== address);

      // Delete private key
      await SecureStore.deleteItemAsync(`wallet_pk_${address}`);

      // Update storage
      await AsyncStorage.setItem("wallets", JSON.stringify(updatedWallets));

      // If this was the active wallet, switch to another or clear
      let newActiveAddress = activeWalletAddress;
      if (activeWalletAddress === address) {
        newActiveAddress =
          updatedWallets.length > 0 ? updatedWallets[0].address : null;
        if (newActiveAddress) {
          await AsyncStorage.setItem("active_wallet_address", newActiveAddress);
        } else {
          await AsyncStorage.removeItem("active_wallet_address");
        }
      }

      set({
        wallets: updatedWallets,
        activeWalletAddress: newActiveAddress,
        isConnected: updatedWallets.length > 0,
      });

      console.log("✅ Wallet deleted");
    } catch (error) {
      console.error("❌ Failed to delete wallet:", error);
      throw error;
    }
  },
}));
