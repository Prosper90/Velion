import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
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
import { transactionHistoryRN } from "../utils/transaction-history-rn";
import { ethers } from "ethers";
import PinVerificationModal from "../components/PinVerificationModal";
import TransferReceiptModal from "../components/TransferReceiptModal";
import { useNotificationStore } from "../stores/notificationStore";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function Transfer() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const token = (params.token as string) || "ETH";

  const [isPrivate, setIsPrivate] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    hash?: string;
    timestamp: number;
  } | null>(null);

  const activeWallet = useWalletStore((state) => state.getActiveWallet());
  const refreshBalances = useWalletStore((state) => state.refreshBalances);
  const { isAuthenticated, lastAuthTime, isPinSet } = useSecurityStore();
  const addNotification = useNotificationStore(
    (state) => state.addNotification
  );

  // Get balances
  const publicBalance = activeWallet?.publicBalance || "0.00";
  const privateBalance = activeWallet?.privateBalance || "0.00";

  // Current balance based on mode
  const currentBalance = isPrivate ? privateBalance : publicBalance;

  const handleTransfer = async () => {
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

      // Private transfers use a different flow (no recipient address needed)
      if (isPrivate) {
        // Navigate to private transfer screen instead
        Alert.alert(
          "Private Transfer",
          "Private transfers use transfer notes. Redirecting to Private Transfer screen...",
          [
            {
              text: "OK",
              onPress: () => router.push("/private-transfer"),
            },
          ]
        );
        return;
      }

      // Ethereum address validation (for public transfers only)
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
      const balance = parseFloat(currentBalance);
      if (parseFloat(amount) > balance) {
        Alert.alert(
          "Insufficient Balance",
          `You only have ${balance} ${token} in your ${
            isPrivate ? "private" : "public"
          } wallet`
        );
        return;
      }

      // ALWAYS require PIN for transfers (security best practice)
      if (isPinSet) {
        console.log("🔐 PIN required for transfer");
        setShowPinModal(true);
        return;
      }

      // Execute transfer
      await executeTransfer();
    } catch (error: any) {
      console.error("❌ Transfer failed:", error);
      Alert.alert(
        "Transfer Failed",
        error.message || "Failed to send tokens. Please try again."
      );
      setIsSending(false);
    }
  };

  const handlePinSuccess = () => {
    setShowPinModal(false);
    executeTransfer();
  };

  const handleReceiptClose = () => {
    setShowReceipt(false);
    setReceiptData(null);
    setAmount("");
    setRecipientAddress("");
    setMemo("");
    router.back();
  };

  const executeTransfer = async () => {
    try {
      setIsSending(true);

      if (isPrivate) {
        // Private transfer (demo mode)
        console.log(
          `🔄 Initiating private transfer of ${amount} ${token} to ${recipientAddress}...`
        );

        // For now, show a demo receipt (until ZK proof generation is implemented)
        setReceiptData({
          timestamp: Date.now(),
        });

        Alert.alert(
          "Private Transfer Demo",
          "Private transfers require zero-knowledge proof generation, which is currently being implemented.\n\nThis feature will:\n1. Generate commitment for the recipient\n2. Create nullifier for your input\n3. Generate ZK proof\n4. Submit transaction through relayer\n\nShowing demo receipt...",
          [
            {
              text: "View Receipt",
              onPress: () => {
                setShowReceipt(true);
              },
            },
          ]
        );
      } else {
        // Public transfer
        console.log(`💸 Sending ${amount} ${token} to ${recipientAddress}...`);

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
          token: token,
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
            token,
          });

          try {
            addNotification({
              type: "public_transfer",
              txHash: txResponse.hash,
              amount,
              token: token,
            });
            console.log("✅ Notification added successfully");
          } catch (notifError) {
            console.error("❌ ERROR adding notification:", notifError);
          }
          console.log("✅ DEBUG: About to refresh balances");
          // Refresh balances
          await refreshBalances(activeWallet!.address);

          // Show receipt
          setReceiptData({
            hash: txResponse.hash,
            timestamp: Date.now(),
          });
          setShowReceipt(true);
        } else {
          throw new Error("Transaction failed");
        }
      }
    } catch (error: any) {
      console.error("❌ Transfer failed:", error);
      Alert.alert(
        "Transfer Failed",
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
          <Text style={styles.headerTitle}>Transfer {token}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Toggle Private/Public */}
        <View style={styles.toggleContainer}>
          <Pressable
            style={[
              styles.toggleButton,
              !isPrivate && styles.toggleButtonActive,
            ]}
            onPress={() => setIsPrivate(false)}
          >
            <Text
              style={[
                styles.toggleButtonText,
                !isPrivate && styles.toggleButtonTextActive,
              ]}
            >
              Public
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleButton,
              isPrivate && styles.toggleButtonActive,
            ]}
            onPress={() => setIsPrivate(true)}
          >
            <Text
              style={[
                styles.toggleButtonText,
                isPrivate && styles.toggleButtonTextActive,
              ]}
            >
              Private
            </Text>
          </Pressable>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <View style={styles.infoBannerIcon}>
            <Text style={styles.bannerIcon}>{isPrivate ? "🛡️" : "💸"}</Text>
          </View>
          <View style={styles.infoBannerContent}>
            <Text style={styles.infoBannerTitle}>
              {isPrivate ? "Private Transfer" : "Public Transfer"}
            </Text>
            <Text style={styles.infoBannerText}>
              {isPrivate
                ? "Private transfers use transfer notes that you share with the recipient. Click 'Send' to go to the Private Transfer screen."
                : "Send tokens from your public wallet to any Ethereum address. This transaction will be visible on the blockchain."}
            </Text>
          </View>
        </View>

        {/* Recipient Address - Only show for public transfers */}
        {!isPrivate && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Recipient Address</Text>
            <View style={styles.addressContainer}>
              <TextInput
                style={styles.addressInput}
                placeholder="0x..."
                placeholderTextColor="#CCCCCC"
                value={recipientAddress}
                onChangeText={setRecipientAddress}
                autoCapitalize="none"
                autoCorrect={false}
                multiline={false}
              />
              <View style={styles.addressActions}>
                <Pressable style={styles.actionButton}>
                  <Text style={styles.actionIcon}>📋</Text>
                </Pressable>
                <Pressable style={styles.actionButton}>
                  <Text style={styles.actionIcon}>📷</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Amount to Send */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Amount to Send</Text>
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
                onPress={() => setAmount(currentBalance)}
              >
                <Text style={styles.maxButtonText}>Max</Text>
              </Pressable>
            </View>
            <View style={styles.amountFooter}>
              <Text style={styles.amountCurrency}>{token}</Text>
              <Text style={styles.availableBalance}>
                Available ({isPrivate ? "Private" : "Public"}): {currentBalance}{" "}
                {token}
              </Text>
            </View>
          </View>
        </View>

        {/* Memo (Optional - only for private) */}
        {isPrivate && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Memo (Optional)</Text>
            <View style={styles.memoContainer}>
              <TextInput
                style={styles.memoInput}
                placeholder="Add a private note (encrypted)"
                placeholderTextColor="#CCCCCC"
                value={memo}
                onChangeText={setMemo}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        )}

        {/* Send Button */}
        <Pressable
          style={[
            styles.sendButton,
            isPrivate ? styles.sendButtonPrivate : styles.sendButtonPublic,
            isSending && styles.sendButtonDisabled,
          ]}
          onPress={handleTransfer}
          disabled={isSending || !amount || !recipientAddress}
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
            <Text style={styles.sendButtonText}>
              {amount && recipientAddress
                ? `Send ${amount || "0.00"} ${token} ${
                    isPrivate ? "Privately" : ""
                  }`
                : `Send ${isPrivate ? "Privately" : "Tokens"}`}
            </Text>
          )}
        </Pressable>
      </ScrollView>

      {/* PIN Verification Modal */}
      <PinVerificationModal
        visible={showPinModal}
        onSuccess={handlePinSuccess}
        onCancel={() => setShowPinModal(false)}
        title="Verify PIN"
        subtitle={`Confirm your identity to send ${token}`}
      />

      {/* Transfer Receipt Modal */}
      {receiptData && (
        <TransferReceiptModal
          visible={showReceipt}
          type={isPrivate ? "private-transfer" : "send"}
          transactionHash={receiptData.hash}
          from={activeWallet?.address || ""}
          to={recipientAddress}
          amount={amount}
          token={token}
          timestamp={receiptData.timestamp}
          isPrivate={isPrivate}
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
  headerSpacer: {
    width: 40,
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 4,
    marginBottom: screenHeight * 0.03,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: "#000000",
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666666",
  },
  toggleButtonTextActive: {
    color: "#FFFFFF",
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
  bannerIcon: {
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
  addressContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: screenWidth * 0.04,
  },
  addressInput: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#000000",
    marginBottom: 12,
  },
  addressActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    width: 36,
    height: 36,
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  actionIcon: {
    fontSize: 18,
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
    fontSize: Math.max(18, screenWidth * 0.045),
    fontWeight: "700",
    color: "#000000",
  },
  availableBalance: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#999999",
  },
  memoContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: screenWidth * 0.04,
  },
  memoInput: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#000000",
    minHeight: 60,
    textAlignVertical: "top",
  },
  sendButton: {
    borderRadius: 12,
    paddingVertical: screenHeight * 0.02,
    alignItems: "center",
    marginBottom: screenHeight * 0.03,
  },
  sendButtonPublic: {
    backgroundColor: "#4CAF50",
  },
  sendButtonPrivate: {
    backgroundColor: "#B39DDB",
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "700",
  },
  sendButtonTextLoading: {
    marginLeft: 8,
  },
});
