import AsyncStorage from "@react-native-async-storage/async-storage";
import { ethers } from "ethers";
import { useNotificationStore } from "../stores/notificationStore";

/**
 * Transaction History Storage for React Native
 * Tracks all shield, unshield, and transfer transactions
 */

export type TransactionType =
  | "shield"
  | "unshield"
  | "transfer"
  | "send"
  | "receive";
export type TransactionStatus = "pending" | "confirmed" | "failed";

export interface Transaction {
  id: string; // Unique ID (timestamp + random)
  type: TransactionType;
  hash: string; // Transaction hash
  from: string; // Sender address
  to?: string; // Recipient address (for transfers/unshield)
  amount: string; // Amount in ETH (human readable)
  amountWei: string; // Amount in wei
  token: string; // Token symbol (ETH, USDC, etc.)
  status: TransactionStatus;
  timestamp: number; // Unix timestamp
  blockNumber?: number;
  confirmations?: number;
  commitment?: string; // For shield transactions
  nullifier?: string; // For unshield transactions
  isPrivate: boolean; // True for shield/unshield/private transfers
}

export class TransactionHistoryRN {
  private storageKey: string = "veilon_transactions";

  /**
   * Add a new transaction to history
   */
  async addTransaction(
    address: string,
    transaction: Omit<Transaction, "id">
  ): Promise<Transaction> {
    try {
      const newTransaction: Transaction = {
        ...transaction,
        id: `${Date.now()}_${Math.random().toString(36).substring(7)}`,
      };

      console.log("📝 Adding transaction to history:", {
        type: newTransaction.type,
        amount: newTransaction.amount,
        hash: newTransaction.hash.substring(0, 10) + "...",
      });

      const transactions = await this.getTransactions(address);
      transactions.unshift(newTransaction); // Add to beginning (newest first)
      await this.saveTransactions(address, transactions);

      console.log(
        "✅ Transaction saved. Total transactions:",
        transactions.length
      );
      return newTransaction;
    } catch (error) {
      console.error("❌ Failed to add transaction:", error);
      throw error;
    }
  }

  /**
   * Get all transactions for an address
   */
  async getTransactions(address: string): Promise<Transaction[]> {
    try {
      const key = `${this.storageKey}_${address.toLowerCase()}`;
      const stored = await AsyncStorage.getItem(key);

      if (!stored) {
        console.log("📭 No transaction history for:", address);
        return [];
      }

      const transactions = JSON.parse(stored);
      console.log(
        `📬 Loaded ${transactions.length} transaction(s) for:`,
        address
      );
      return transactions;
    } catch (error) {
      console.error("❌ Failed to load transactions:", error);
      return [];
    }
  }

  /**
   * Get transactions by type
   */
  async getTransactionsByType(
    address: string,
    type: TransactionType
  ): Promise<Transaction[]> {
    const transactions = await this.getTransactions(address);
    return transactions.filter((tx) => tx.type === type);
  }

  /**
   * Get transactions by status
   */
  async getTransactionsByStatus(
    address: string,
    status: TransactionStatus
  ): Promise<Transaction[]> {
    const transactions = await this.getTransactions(address);
    return transactions.filter((tx) => tx.status === status);
  }

  /**
   * Get pending transactions
   */
  async getPendingTransactions(address: string): Promise<Transaction[]> {
    return this.getTransactionsByStatus(address, "pending");
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    address: string,
    hash: string,
    status: TransactionStatus,
    blockNumber?: number,
    confirmations?: number
  ): Promise<void> {
    try {
      const transactions = await this.getTransactions(address);
      const updated = transactions.map((tx) => {
        if (tx.hash === hash) {
          return {
            ...tx,
            status,
            ...(blockNumber && { blockNumber }),
            ...(confirmations && { confirmations }),
          };
        }
        return tx;
      });

      await this.saveTransactions(address, updated);
      console.log(
        "✅ Transaction status updated:",
        hash.substring(0, 10) + "...",
        "→",
        status
      );
    } catch (error) {
      console.error("❌ Failed to update transaction status:", error);
      throw error;
    }
  }

  /**
   * Find transaction by hash
   */
  async findByHash(address: string, hash: string): Promise<Transaction | null> {
    const transactions = await this.getTransactions(address);
    return transactions.find((tx) => tx.hash === hash) || null;
  }

  /**
   * Find transaction by commitment
   */
  async findByCommitment(
    address: string,
    commitment: string
  ): Promise<Transaction | null> {
    const transactions = await this.getTransactions(address);
    return transactions.find((tx) => tx.commitment === commitment) || null;
  }

  /**
   * Clear all transactions for an address
   */
  async clearTransactions(address: string): Promise<void> {
    try {
      const key = `${this.storageKey}_${address.toLowerCase()}`;
      await AsyncStorage.removeItem(key);
      console.log("🗑️ Cleared all transactions for:", address);
    } catch (error) {
      console.error("❌ Failed to clear transactions:", error);
      throw error;
    }
  }

  /**
   * Get transaction statistics
   */
  async getStats(address: string): Promise<{
    total: number;
    shield: number;
    unshield: number;
    transfer: number;
    send: number;
    receive: number;
    pending: number;
    confirmed: number;
    failed: number;
  }> {
    const transactions = await this.getTransactions(address);

    return {
      total: transactions.length,
      shield: transactions.filter((tx) => tx.type === "shield").length,
      unshield: transactions.filter((tx) => tx.type === "unshield").length,
      transfer: transactions.filter((tx) => tx.type === "transfer").length,
      send: transactions.filter((tx) => tx.type === "send").length,
      receive: transactions.filter((tx) => tx.type === "receive").length,
      pending: transactions.filter((tx) => tx.status === "pending").length,
      confirmed: transactions.filter((tx) => tx.status === "confirmed").length,
      failed: transactions.filter((tx) => tx.status === "failed").length,
    };
  }

  /**
   * Scan blockchain for incoming transactions
   * This checks the last 1000 blocks for transfers TO this address
   */
  async scanForIncomingTransactions(
    address: string,
    provider: ethers.JsonRpcProvider
  ): Promise<number> {
    try {
      console.log("🔍 Scanning for incoming transactions to:", address);

      // Ethers v6 removed provider.getHistory()
      // Using Etherscan API as the most reliable solution
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      // Etherscan API V2 - unified endpoint for all chains
      // See: https://docs.etherscan.io/v2-migration
      const etherscanApiUrl = "https://api.etherscan.io/v2/api";

      console.log(`📡 Fetching transaction history from Etherscan V2 API...`);

      // Get Etherscan API key from environment (optional, but recommended)
      // Get your free API key from: https://etherscan.io/apis
      const ETHERSCAN_API_KEY =
        process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY ||
        "B1U18KNWNRF73Y58K35G2E84AN6I1W9SJZ";

      if (!ETHERSCAN_API_KEY) {
        console.warn("⚠️ No Etherscan API key available");
        return 0;
      }

      // Etherscan V2 API format: chainid is required
      // Chain IDs: 1 = Ethereum Mainnet, 11155111 = Sepolia Testnet
      const apiUrl = `${etherscanApiUrl}?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${ETHERSCAN_API_KEY}`;

      console.log("📡 Etherscan V2 API Request:", {
        endpoint: etherscanApiUrl,
        chainId: chainId,
        network: chainId === 11155111 ? "Sepolia" : chainId === 1 ? "Mainnet" : "Unknown",
        address: address.substring(0, 10) + "...",
        hasApiKey: !!ETHERSCAN_API_KEY,
        apiKeyLength: ETHERSCAN_API_KEY?.length || 0,
      });

      const response = await fetch(apiUrl);

      if (!response.ok) {
        console.warn("⚠️ Failed to fetch from Etherscan API");
        return 0;
      }

      const data = await response.json();

      console.log("📊 Etherscan API Response:", {
        status: data.status,
        message: data.message,
        resultType: Array.isArray(data.result) ? 'array' : typeof data.result,
        resultLength: Array.isArray(data.result) ? data.result.length : 'N/A',
      });

      if (data.status !== "1" || !data.result || !Array.isArray(data.result)) {
        console.log("ℹ️ No transactions found from Etherscan API");
        console.log("🔍 Reason - Status:", data.status, "Message:", data.message, "Result:", data.result);
        return 0;
      }

      let newTransactionsCount = 0;
      const existingTransactions = await this.getTransactions(address);
      const existingHashes = new Set(existingTransactions.map((tx) => tx.hash));

      // Process incoming transactions
      for (const tx of data.result) {
        // Skip if we already have this transaction
        if (existingHashes.has(tx.hash)) {
          continue;
        }

        // Only process incoming transactions (where this address is the recipient)
        if (
          tx.to?.toLowerCase() === address.toLowerCase() &&
          tx.from.toLowerCase() !== address.toLowerCase() &&
          tx.value !== "0" &&
          tx.isError === "0"
        ) {
          // Add as received transaction
          const amount = ethers.formatEther(tx.value);
          await this.addTransaction(address, {
            type: "receive",
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            amount,
            amountWei: tx.value,
            token: "ETH",
            status: "confirmed",
            timestamp: parseInt(tx.timeStamp) * 1000, // Convert to milliseconds
            blockNumber: parseInt(tx.blockNumber),
            isPrivate: false,
          });

          // Add notification for received transaction
          console.log("🔔 Adding notification for received transaction");
          useNotificationStore.getState().addNotification({
            type: "receive",
            txHash: tx.hash,
            amount,
            token: "ETH",
          });

          newTransactionsCount++;
          console.log(
            `✅ Found new incoming tx: ${tx.hash.substring(
              0,
              10
            )}... (${amount} ETH)`
          );
        }
      }

      console.log(
        `✅ Scan complete. Found ${newTransactionsCount} new incoming transaction(s)`
      );
      return newTransactionsCount;
    } catch (error) {
      console.error("❌ Failed to scan for incoming transactions:", error);
      return 0;
    }
  }

  /**
   * Save transactions to storage
   */
  private async saveTransactions(
    address: string,
    transactions: Transaction[]
  ): Promise<void> {
    try {
      const key = `${this.storageKey}_${address.toLowerCase()}`;
      await AsyncStorage.setItem(key, JSON.stringify(transactions));
      console.log("💾 Saved transactions to AsyncStorage");
    } catch (error) {
      console.error("❌ Failed to save transactions:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const transactionHistoryRN = new TransactionHistoryRN();
