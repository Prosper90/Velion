import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Image } from "expo-image";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { veilonSDK } from "../services/veilon-sdk";
import { useWalletStore } from "../stores/walletStore";
import { useSecurityStore } from "../stores/securityStore";
import { useNotificationStore } from "../stores/notificationStore";
import { transactionHistoryRN } from "../utils/transaction-history-rn";
import { ethers } from "ethers";
import PinVerificationModal from "../components/PinVerificationModal";
import TransferReceiptModal from "../components/TransferReceiptModal";
import { getSupportedTokensForChain } from "../constants/tokens";
import { useTokenStore } from "../stores/tokenStore";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function SendTokens() {
  const router = useRouter();
  const [selectedToken, setSelectedToken] = useState("ETH");
  const [amount, setAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    hash: string;
    timestamp: number;
  } | null>(null);

  const activeWallet = useWalletStore((state) => state.getActiveWallet());
  const network = useWalletStore((state) => state.network);
  const refreshBalances = useWalletStore((state) => state.refreshBalances);
  const { isAuthenticated, lastAuthTime, isPinSet } = useSecurityStore();
  const addNotification = useNotificationStore(
    (state) => state.addNotification
  );
  const tokenBalances = useTokenStore((state) => state.tokenBalances);

  // Get actual wallet balance
  const publicBalance = activeWallet?.publicBalance || "0.00";

  // Get supported tokens from centralized config
  const chainId = network?.chainId || 11155111;
  const walletAddress = activeWallet?.address || "";

  // Get token balances from store
  const walletTokenBalances = tokenBalances[walletAddress] || [];

  const TOKENS = getSupportedTokensForChain(chainId).map(token => {
    // Find balance from token store
    const tokenBalance = walletTokenBalances.find((b) => b.symbol === token.symbol);

    return {
      symbol: token.symbol,
      name: token.name,
      address: token.address,
      icon: token.icon,
      decimals: token.decimals,
      balance: tokenBalance?.balance || "0.00",
      isNative: token.isNative,
    };
  });

  const selectedTokenData = TOKENS.find((t) => t.symbol === selectedToken);

  const handleSend = async () => {
    try {
      // Validate wallet
      if (!activeWallet?.address) {
        Alert.alert("No Wallet", "Please create or import a wallet first");
        return;
      }

      // Validate recipient address
      if (!recipientAddress.trim()) {
        Alert.alert("Invalid Address", "Please enter a recipient address");
        return;
      }

      if (!recipientAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        Alert.alert("Invalid Address", "Please enter a valid Ethereum address");
        return;
      }

      // Validate amount
      if (!amount || parseFloat(amount) <= 0) {
        Alert.alert("Invalid Amount", "Please enter a valid amount to send");
        return;
      }

      // Check if amount exceeds balance
      const tokenBalance = parseFloat(selectedTokenData?.balance || "0");
      if (parseFloat(amount) > tokenBalance) {
        Alert.alert(
          "Insufficient Balance",
          `You only have ${tokenBalance} ${selectedToken}`
        );
        return;
      }

      // Check if authentication is required
      if (isPinSet) {
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        // If not authenticated or auth expired, show PIN modal
        if (!isAuthenticated || now - lastAuthTime > fiveMinutes) {
          console.log("🔐 Authentication required for send transaction");
          setShowPinModal(true);
          return;
        }
      }

      // Execute send transaction
      await executeSend();
    } catch (error: any) {
      console.error("❌ Send failed:", error);
      Alert.alert(
        "Send Failed",
        error.message || "Failed to send tokens. Please try again."
      );
      setIsSending(false);
    }
  };

  const handlePinSuccess = () => {
    setShowPinModal(false);
    // Execute send after successful PIN verification
    executeSend();
  };

  const handleReceiptClose = () => {
    setShowReceipt(false);
    setReceiptData(null);
    setAmount("");
    setRecipientAddress("");
    router.back();
  };

  const executeSend = async () => {
    try {
      setIsSending(true);

      console.log(
        `💸 Sending ${amount} ${selectedToken} to ${recipientAddress}...`
      );

      // Get signer from SDK (already initialized with wallet)
      const signer = veilonSDK.getSigner();
      if (!signer) {
        throw new Error("Wallet not initialized. Please restart the app.");
      }

      // Create transaction
      const tx = {
        to: recipientAddress,
        value: ethers.parseEther(amount),
      };

      // Estimate gas
      const gasEstimate = await signer.estimateGas(tx);
      const gasLimit = gasEstimate;

      // Send transaction
      console.log("📤 Sending transaction...");
      const txResponse = await signer.sendTransaction({ ...tx, gasLimit });

      console.log("✅ Transaction sent:", txResponse.hash);

      // Add to transaction history (pending)
      await transactionHistoryRN.addTransaction(activeWallet!.address, {
        type: "send",
        hash: txResponse.hash,
        from: activeWallet!.address,
        to: recipientAddress,
        amount,
        amountWei: ethers.parseEther(amount).toString(),
        token: selectedToken,
        status: "pending",
        timestamp: Date.now(),
        isPrivate: false,
      });

      // Wait for confirmation
      console.log("⏳ Waiting for confirmation...");
      console.log("🚨 CRITICAL DEBUG: About to call txResponse.wait()");
      const receipt = await txResponse.wait();
      console.log("🚨 CRITICAL DEBUG: txResponse.wait() completed");

      console.log("🔍 DEBUG: Receipt received:", {
        exists: !!receipt,
        status: receipt?.status,
        blockNumber: receipt?.blockNumber,
      });

      if (receipt && receipt.status === 1) {
        console.log("✅ DEBUG: Inside confirmation block - starting updates");

        // Update transaction status to confirmed
        await transactionHistoryRN.updateTransactionStatus(
          activeWallet!.address,
          txResponse.hash,
          "confirmed",
          receipt.blockNumber
        );
        console.log("✅ DEBUG: Transaction status updated");

        // Add notification
        console.log("🔔 DEBUG: About to add notification");
        console.log("🔔 Adding notification for public transfer:", {
          type: "public_transfer",
          txHash: txResponse.hash,
          amount,
          token: selectedToken,
        });

        try {
          addNotification({
            type: "public_transfer",
            txHash: txResponse.hash,
            amount,
            token: selectedToken,
          });
          console.log("✅ Notification added successfully");
        } catch (notifError) {
          console.error("❌ ERROR adding notification:", notifError);
        }

        console.log("✅ DEBUG: About to refresh balances");
        // Refresh balances
        await refreshBalances(activeWallet!.address);
        console.log("✅ DEBUG: Balances refreshed");

        // Show receipt
        console.log("✅ DEBUG: About to show receipt");
        setReceiptData({
          hash: txResponse.hash,
          timestamp: Date.now(),
        });
        setShowReceipt(true);
        console.log("✅ DEBUG: Receipt shown");
      } else {
        console.log("❌ DEBUG: Receipt failed or status !== 1");
        throw new Error("Transaction failed");
      }
    } catch (error: any) {
      console.error("❌ Send failed:", error);
      Alert.alert(
        "Send Failed",
        error.message || "Failed to send tokens. Please try again."
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Send Tokens</Text>
          <View style={styles.headerIcons}>
            <Pressable style={styles.iconButton}>
              <Text style={styles.icon}>🔍</Text>
            </Pressable>
            <Pressable style={styles.iconButton}>
              <Text style={styles.icon}>🔔</Text>
            </Pressable>
          </View>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <View style={styles.infoBannerIcon}>
            <Text style={styles.sendIcon}>💸</Text>
          </View>
          <View style={styles.infoBannerContent}>
            <Text style={styles.infoBannerTitle}>Public Transfer</Text>
            <Text style={styles.infoBannerText}>
              Send tokens from your public wallet to any Ethereum address. This
              transaction will be visible on the blockchain.
            </Text>
          </View>
        </View>

        {/* Select Token */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Select Token</Text>
          <View style={styles.tokenGrid}>
            {TOKENS.map((token) => (
              <Pressable
                key={token.symbol}
                style={[
                  styles.tokenCard,
                  selectedToken === token.symbol && styles.tokenCardActive,
                ]}
                onPress={() => setSelectedToken(token.symbol)}
              >
                {/* <Text style={styles.tokenIcon}>{token.icon}</Text> */}
                <Image source={token.icon} style={styles.tokenIconEmoji} />
                <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                <Text style={styles.tokenBalance}>{token.balance}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Recipient Address */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recipient Address</Text>
          <TextInput
            style={styles.addressInput}
            placeholder="0x..."
            placeholderTextColor="#CCCCCC"
            value={recipientAddress}
            onChangeText={setRecipientAddress}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Amount</Text>
          <View style={styles.amountContainer}>
            <View style={styles.amountInputRow}>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor="#CCCCCC"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
              <Pressable
                style={styles.maxButton}
                onPress={() => setAmount(selectedTokenData?.balance || "0")}
              >
                <Text style={styles.maxButtonText}>MAX</Text>
              </Pressable>
            </View>
            <View style={styles.amountFooter}>
              <Text style={styles.amountCurrency}>{selectedToken}</Text>
              <Text style={styles.availableBalance}>
                Available: {selectedTokenData?.balance} {selectedToken}
              </Text>
            </View>
          </View>
        </View>

        {/* Transaction Info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Transaction Details</Text>
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>From:</Text>
              <Text style={styles.infoValue}>
                {activeWallet?.address.substring(0, 6)}...
                {activeWallet?.address.substring(38)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>To:</Text>
              <Text style={styles.infoValue}>
                {recipientAddress
                  ? `${recipientAddress.substring(
                      0,
                      6
                    )}...${recipientAddress.substring(38)}`
                  : "Not set"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Network:</Text>
              <Text style={styles.infoValue}>Sepolia Testnet</Text>
            </View>
          </View>
        </View>

        {/* Send Button */}
        <Pressable
          style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={isSending}
        >
          {isSending ? (
            <View style={styles.sendButtonContent}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text
                style={[styles.sendButtonText, styles.sendButtonTextLoading]}
              >
                Sending...
              </Text>
            </View>
          ) : (
            <Text style={styles.sendButtonText}>Send Tokens</Text>
          )}
        </Pressable>
      </ScrollView>

      {/* PIN Verification Modal */}
      <PinVerificationModal
        visible={showPinModal}
        onSuccess={handlePinSuccess}
        onCancel={() => setShowPinModal(false)}
        title="Verify PIN"
        subtitle="Confirm your identity to send tokens"
      />

      {/* Transfer Receipt Modal */}
      {receiptData && (
        <TransferReceiptModal
          visible={showReceipt}
          type="send"
          transactionHash={receiptData.hash}
          from={activeWallet?.address || ""}
          to={recipientAddress}
          amount={amount}
          token={selectedToken}
          timestamp={receiptData.timestamp}
          isPrivate={false}
          onClose={handleReceiptClose}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: screenWidth * 0.05,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: screenHeight * 0.02,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  backIcon: {
    fontSize: 24,
    color: "#000000",
  },
  headerTitle: {
    fontSize: Math.max(20, screenWidth * 0.05),
    fontWeight: "700",
    color: "#000000",
  },
  headerIcons: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    fontSize: 20,
  },
  infoBanner: {
    flexDirection: "row",
    backgroundColor: "#000000",
    borderRadius: 12,
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.03,
  },
  infoBannerIcon: {
    marginRight: 12,
  },
  sendIcon: {
    fontSize: 24,
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerTitle: {
    color: "#FFFFFF",
    fontSize: Math.max(15, screenWidth * 0.038),
    fontWeight: "700",
    marginBottom: 6,
  },
  infoBannerText: {
    color: "#CCCCCC",
    fontSize: Math.max(13, screenWidth * 0.033),
    lineHeight: 18,
  },
  section: {
    marginBottom: screenHeight * 0.03,
  },
  sectionLabel: {
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "600",
    color: "#000000",
    marginBottom: 12,
  },
  tokenGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tokenCard: {
    width: (screenWidth * 0.9 - 36) / 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: screenWidth * 0.03,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  tokenCardActive: {
    borderColor: "#4CAF50",
    backgroundColor: "#E8F5E9",
  },
  tokenIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  tokenSymbol: {
    fontSize: Math.max(13, screenWidth * 0.033),
    fontWeight: "700",
    color: "#000000",
    marginBottom: 4,
  },
  tokenBalance: {
    fontSize: Math.max(11, screenWidth * 0.028),
    color: "#666666",
  },
  addressInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: screenWidth * 0.04,
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#000000",
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  amountContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: screenWidth * 0.04,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  amountInput: {
    flex: 1,
    fontSize: Math.max(32, screenWidth * 0.08),
    color: "#000000",
    fontWeight: "600",
  },
  maxButton: {
    backgroundColor: "#000000",
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenHeight * 0.015,
    borderRadius: 8,
  },
  maxButtonText: {
    color: "#FFFFFF",
    fontSize: Math.max(12, screenWidth * 0.03),
    fontWeight: "700",
  },
  amountFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountCurrency: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#666666",
  },
  availableBalance: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#999999",
  },
  infoBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: screenWidth * 0.04,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#666666",
  },
  infoValue: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#000000",
    fontWeight: "600",
  },
  sendButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingVertical: screenHeight * 0.02,
    alignItems: "center",
    marginBottom: screenHeight * 0.03,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "700",
  },
  sendButtonTextLoading: {
    color: "#FFFFFF",
  },
  tokenIconEmoji: {
    // fontSize: Math.max(20, screenWidth * 0.05),
    width: 24,
    height: 24,
  },
});
