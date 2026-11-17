import { useRouter } from "expo-router";
import React, { useState, useEffect, useRef } from "react";
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
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { ethers } from "ethers";
import { veilonSDK } from "../services/veilon-sdk";
import { useWalletStore } from "../stores/walletStore";
import { useSecurityStore } from "../stores/securityStore";
import { useNotificationStore } from "../stores/notificationStore";
import { commitmentStoreRN } from "../utils/commitment-store-rn";
import { transactionHistoryRN } from "../utils/transaction-history-rn";
import { generateTransferNote } from "../utils/transfer-note";
import PinVerificationModal from "../components/PinVerificationModal";
import TransferNoteModal from "../components/TransferNoteModal";
import { getSupportedTokensForChain } from "../constants/tokens";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function PrivateTransfer() {
  const router = useRouter();
  const [selectedToken, setSelectedToken] = useState("ETH");
  const [selectedCommitment, setSelectedCommitment] = useState<any>(null);
  const [amount, setAmount] = useState(""); // Amount to transfer (partial amounts supported)
  const [memo, setMemo] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showTransferNote, setShowTransferNote] = useState(false);
  const [transferNote, setTransferNote] = useState<string>("");
  const [transferProofData, setTransferProofData] = useState<any>(null);
  const [commitments, setCommitments] = useState<any[]>([]);

  const activeWallet = useWalletStore((state) => state.getActiveWallet());
  const { isPinSet } = useSecurityStore();
  const addNotification = useNotificationStore((state) => state.addNotification);

  // Animation setup
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Multi-token private balances
  const [privateBalances, setPrivateBalances] = React.useState<
    Record<string, string>
  >({});

  // Fetch private balances for all tokens
  React.useEffect(() => {
    const fetchBalances = async () => {
      if (activeWallet?.address) {
        try {
          const balances = await commitmentStoreRN.getAllPrivateBalances(
            activeWallet.address
          );
          setPrivateBalances(balances);
        } catch (error) {
          console.error("Failed to fetch private balances:", error);
        }
      }
    };
    fetchBalances();
  }, [activeWallet?.address]);

  // Load commitments when token changes
  React.useEffect(() => {
    const loadCommitments = async () => {
      if (activeWallet?.address) {
        try {
          const allCommitments = await commitmentStoreRN.getUnspentCommitments(
            activeWallet.address
          );
          const tokenCommitments = allCommitments.filter(
            (c) => (c.token || "ETH") === selectedToken
          );
          setCommitments(tokenCommitments);

          // Auto-select the first (latest) commitment
          if (tokenCommitments.length > 0) {
            setSelectedCommitment(tokenCommitments[0]);
          } else {
            setSelectedCommitment(null);
          }
          setAmount(""); // Reset amount when token changes
        } catch (error) {
          console.error("Failed to load commitments:", error);
          setCommitments([]);
          setSelectedCommitment(null);
        }
      }
    };
    loadCommitments();
  }, [activeWallet?.address, selectedToken]);

  // Get supported tokens from centralized config (Sepolia testnet = 11155111)
  const chainId = 11155111; // TODO: Get from wallet store when multi-chain support is added
  const TOKENS = getSupportedTokensForChain(chainId).map(token => ({
    symbol: token.symbol,
    address: token.address,
    balance: privateBalances[token.symbol] || "0.00",
    icon: token.icon,
    decimals: token.decimals,
    isNative: token.isNative,
  }));

  const selectedTokenData = TOKENS.find((t) => t.symbol === selectedToken);

  const handlePrivateTransfer = async () => {
    try {
      // Validate commitment selection
      if (!selectedCommitment) {
        Alert.alert(
          "No Commitment Selected",
          "Please select a commitment to transfer"
        );
        return;
      }

      // Validate amount
      if (!amount || parseFloat(amount) <= 0) {
        Alert.alert(
          "Invalid Amount",
          "Please enter a valid amount to transfer"
        );
        return;
      }

      const decimals = selectedTokenData?.decimals || 18;
      const commitmentAmount = ethers.formatUnits(
        selectedCommitment.amount,
        decimals
      );

      // Validate amount doesn't exceed commitment
      if (parseFloat(amount) > parseFloat(commitmentAmount)) {
        Alert.alert(
          "Amount Too Large",
          `Cannot transfer ${amount} ${selectedToken}. Maximum available: ${commitmentAmount} ${selectedToken}`
        );
        return;
      }

      // ALWAYS require PIN for private transfers (security)
      if (isPinSet) {
        console.log("🔐 PIN required for private transfer");
        setShowPinModal(true);
        return;
      }

      await executePrivateTransfer();
    } catch (error: any) {
      console.error("❌ Private transfer failed:", error);
      Alert.alert(
        "Transfer Failed",
        error.message || "Failed to complete private transfer"
      );
      setIsTransferring(false);
    }
  };

  const handlePinSuccess = () => {
    setShowPinModal(false);
    executePrivateTransfer();
  };

  const handleTransferNoteClose = () => {
    setShowTransferNote(false);
    // Delay clearing the transfer note to allow modal animation to complete
    setTimeout(() => {
      setTransferNote("");
      setMemo("");
      setSelectedCommitment(null);
    }, 300); // 300ms matches typical modal animation duration
    router.back();
  };

  const executePrivateTransfer = async () => {
    try {
      setIsTransferring(true);

      if (!activeWallet?.address) {
        throw new Error("No active wallet");
      }

      if (!selectedCommitment) {
        throw new Error("No commitment selected");
      }

      // Get commitment amount
      const decimals = selectedTokenData?.decimals || 18;
      const commitmentAmount = ethers.formatUnits(selectedCommitment.amount, decimals);

      console.log(
        `🔄 Initiating private transfer of ${amount} ${selectedToken} from ${commitmentAmount} ${selectedToken} commitment...`
      );
      console.log(`📂 Using selected commitment:`, {
        commitment: selectedCommitment.commitment.substring(0, 10) + "...",
        inputAmount: commitmentAmount,
        outputAmount: amount,
        token: selectedToken,
      });

      // Step 1: Generate ZK proof via backend relayer
      console.log("🔐 Step 1: Generating zero-knowledge proof via relayer...");
      const result = await veilonSDK.privateTransfer(
        selectedCommitment.commitment,
        selectedCommitment.secret,
        selectedCommitment.nullifier,
        selectedCommitment.randomness || selectedCommitment.secret,
        commitmentAmount, // inputAmount (full commitment)
        amount, // outputAmount (what user wants to transfer)
        activeWallet.address // recipient (for metadata only)
      );

      if (!result.proof || !result.outputCommitment) {
        throw new Error("Failed to generate transfer proof");
      }

      console.log("✅ Proof generated successfully!");

      // Step 2: Submit transaction to blockchain
      console.log("📤 Step 2: Submitting transaction to blockchain...");

      const changeCommitment = result.changeCommitment || ethers.ZeroHash;
      const changeAmount = result.changeAmount || "0";

      console.log("📊 Transaction details:", {
        outputAmount: amount,
        changeAmount,
        changeCommitment: changeCommitment.substring(0, 10) + "...",
      });

      const txResult = await veilonSDK.submitPrivateTransfer(
        selectedCommitment.commitment, // inputCommitment
        result.outputCommitment || "", // outputCommitment
        changeCommitment, // changeCommitment
        result.nullifierHash || "",
        amount, // outputAmount
        changeAmount, // changeAmount
        result.proof,
        result.publicSignals || []
      );

      console.log("✅ Transaction submitted to blockchain!");
      console.log(`📝 Transaction hash: ${txResult.hash}`);

      // Step 3: Add to transaction history
      console.log("📝 Step 3: Adding to transaction history...");
      await transactionHistoryRN.addTransaction(activeWallet.address, {
        type: "private_transfer",
        hash: txResult.hash,
        from: activeWallet.address,
        to: "Private Recipient", // Can't reveal recipient address for privacy
        amount: amount,
        amountWei: ethers.parseUnits(amount, decimals).toString(),
        token: selectedToken,
        status: "pending",
        timestamp: Date.now(),
        nullifier: selectedCommitment.nullifier,
        isPrivate: true,
        memo: memo || undefined,
      });

      // Step 4: Generate transfer note for recipient
      console.log("📄 Step 4: Generating transfer note...");
      const note = generateTransferNote({
        amount: amount,
        secret: result.outputSecret || "",
        nullifier: result.outputNullifier || "",
        randomness: result.outputRandomness || "",
        commitment: result.outputCommitment,
        token: selectedToken,
      });

      console.log("✅ Transfer note generated!");

      // Step 5: Mark input commitment as spent locally
      console.log("💾 Step 5: Marking input commitment as spent...");
      await commitmentStoreRN.markAsSpent(
        activeWallet.address,
        selectedCommitment.nullifier // Fixed: pass nullifier, not commitment
      );

      // Save change commitment if there's any change
      if (parseFloat(changeAmount) > 0 && result.changeSecret && result.changeNullifier && result.changeRandomness) {
        console.log("💾 Saving change commitment to local storage...");
        await commitmentStoreRN.addCommitment(activeWallet.address, {
          commitment: changeCommitment,
          secret: result.changeSecret,
          nullifier: result.changeNullifier,
          randomness: result.changeRandomness,
          amount: ethers.parseUnits(changeAmount, decimals).toString(),
          token: selectedToken,
          tokenAddress: selectedCommitment.tokenAddress || ethers.ZeroAddress,
          txHash: txResult.hash,
          timestamp: Date.now(),
        });
        console.log(`✅ Change commitment saved: ${changeAmount} ${selectedToken}`);
      }

      // Add notification
      addNotification({
        type: "private_transfer",
        txHash: txResult.hash,
        amount,
        token: selectedToken,
      });

      // Step 6: Refresh private balances and commitments to reflect the transfer
      console.log("🔄 Step 6: Refreshing balances and commitments...");
      const updatedBalances = await commitmentStoreRN.getAllPrivateBalances(
        activeWallet.address
      );
      setPrivateBalances(updatedBalances);

      // Reload commitments list
      const allCommitments = await commitmentStoreRN.getUnspentCommitments(
        activeWallet.address
      );
      const tokenCommitments = allCommitments.filter(
        (c) => (c.token || "ETH") === selectedToken
      );
      setCommitments(tokenCommitments);

      // Store proof data and show transfer note
      setTransferProofData(result);
      setTransferNote(note);
      setIsTransferring(false);
      setShowTransferNote(true);
      setSelectedCommitment(null); // Clear selection

      console.log(
        "✅ Private transfer completed! Share the note with recipient."
      );
    } catch (error: any) {
      console.error("❌ Private transfer failed:", error);
      Alert.alert(
        "Transfer Failed",
        error.message || "Failed to complete private transfer"
      );
      setIsTransferring(false);
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.backgroundContainer}>
        <Image
          source={require("../assets/images/Group 1334.svg")}
          style={styles.backgroundImage}
          contentFit="cover"
        />
      </View>
      <SafeAreaView style={styles.contentContainer}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backIcon}>←</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Private Transfer</Text>
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
              <Text style={styles.shieldIcon}>🛡️</Text>
            </View>
            <View style={styles.infoBannerContent}>
              <Text style={styles.infoBannerTitle}>Private Transfer</Text>
              <Text style={styles.infoBannerText}>
                Send tokens privately between Ozk addresses. Both sender and
                recipient details remain completely hidden from the public
                blockchain.
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
                  <Image source={token.icon} style={styles.tokenIcon} />

                  <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                  <Text style={styles.tokenBalance}>{token.balance}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Available Private Balance */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Available Private Balance</Text>
            {!selectedCommitment ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📭</Text>
                <Text style={styles.emptyStateText}>
                  No private {selectedToken} balance
                </Text>
                <Pressable
                  style={styles.shieldPromptButton}
                  onPress={() => router.push("/shield-tokens")}
                >
                  <Text style={styles.shieldPromptButtonText}>
                    Shield {selectedToken} First →
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.privateBalanceCard}>
                <Text style={styles.privateBalanceAmount}>
                  {ethers.formatUnits(
                    selectedCommitment.amount,
                    selectedTokenData?.decimals || 18
                  )}{" "}
                  {selectedToken}
                </Text>
                <Text style={styles.privateBalanceLabel}>Private Balance</Text>
                {selectedCommitment.timestamp && (
                  <Text style={styles.privateBalanceDate}>
                    Last updated:{" "}
                    {new Date(selectedCommitment.timestamp).toLocaleDateString()}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* How it Works Notice */}
          <View style={styles.noticeContainer}>
            <Text style={styles.noticeIcon}>ℹ️</Text>
            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>How Private Transfers Work</Text>
              <Text style={styles.noticeText}>
                Enter the amount you want to transfer. You can transfer partial
                amounts - any remaining balance will stay in your private wallet.
                You'll receive a transfer note to share with the recipient.
              </Text>
            </View>
          </View>

          {/* Amount to Transfer */}
          {selectedCommitment && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Amount to Transfer</Text>
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
                    onPress={() => {
                      const decimals = selectedTokenData?.decimals || 18;
                      const commitmentAmount = ethers.formatUnits(
                        selectedCommitment.amount,
                        decimals
                      );
                      setAmount(commitmentAmount);
                    }}
                  >
                    <Text style={styles.maxButtonText}>MAX</Text>
                  </Pressable>
                </View>
                <View style={styles.amountFooter}>
                  <Text style={styles.amountCurrency}>{selectedToken}</Text>
                  <Text style={styles.availableBalance}>
                    Available:{" "}
                    {ethers.formatUnits(
                      selectedCommitment.amount,
                      selectedTokenData?.decimals || 18
                    )}{" "}
                    {selectedToken}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Memo (Optional) */}
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

          {/* Send Button */}
          <Pressable
            style={[
              styles.sendButton,
              selectedCommitment && parseFloat(amount || "0") > 0
                ? styles.sendButtonActive
                : styles.sendButtonDisabled,
            ]}
            onPress={handlePrivateTransfer}
            disabled={
              isTransferring ||
              !selectedCommitment ||
              parseFloat(amount || "0") === 0
            }
          >
            {isTransferring ? (
              <View style={styles.sendButtonContent}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text
                  style={[styles.sendButtonText, styles.sendButtonTextLoading]}
                >
                  Transferring...
                </Text>
              </View>
            ) : (
              <Text style={styles.sendButtonText}>
                {selectedCommitment
                  ? `Send ${ethers.formatUnits(
                      selectedCommitment.amount,
                      selectedTokenData?.decimals || 18
                    )} ${selectedToken}`
                  : "Select Commitment to Send"}
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
          subtitle="Confirm your identity for private transfer"
        />

        {/* Transfer Note Modal */}
        <TransferNoteModal
          visible={showTransferNote}
          transferNote={transferNote}
          amount={
            selectedCommitment
              ? ethers.formatUnits(
                  selectedCommitment.amount,
                  selectedTokenData?.decimals || 18
                )
              : "0"
          }
          token={selectedToken}
          onClose={handleTransferNoteClose}
        />
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  backgroundContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  backgroundImage: {
    width: "100%",
    height: "100%",
  },
  contentContainer: {
    flex: 1,
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
  shieldIcon: {
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
    borderColor: "#C8B3F0",
    backgroundColor: "#F5F0FF",
  },
  tokenIcon: {
    // fontSize: 32,
    marginBottom: 8,
    width: 35,
    height: 35,
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
  sendButtonActive: {
    backgroundColor: "#B39DDB",
  },
  sendButtonDisabled: {
    backgroundColor: "#B39DDB",
    opacity: 0.5,
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
  sectionHint: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#999999",
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 18,
  },
  noticeContainer: {
    flexDirection: "row",
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: screenWidth * 0.05,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#1565C0",
  },
  noticeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  noticeContent: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: Math.max(14, screenWidth * 0.035),
    fontWeight: "700",
    color: "#1565C0",
    marginBottom: 4,
  },
  noticeText: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#424242",
    lineHeight: 18,
  },
  balanceInfoContainer: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: screenWidth * 0.05,
    marginBottom: 16,
    alignItems: "center",
  },
  balanceLabel: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#666666",
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: Math.max(24, screenWidth * 0.06),
    fontWeight: "700",
    color: "#1565C0",
  },
  shieldPrompt: {
    marginTop: 12,
    backgroundColor: "#FFF3CD",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFE69C",
  },
  shieldPromptText: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#856404",
    fontWeight: "600",
  },
  sectionSubtitle: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#666666",
    marginBottom: 12,
    marginTop: -8,
  },
  commitmentList: {
    maxHeight: 300,
    marginTop: 8,
  },
  commitmentCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  commitmentCardSelected: {
    backgroundColor: "#E3F2FD",
    borderColor: "#1565C0",
    shadowColor: "#1565C0",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  commitmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  commitmentBadge: {
    backgroundColor: "#E0E0E0",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  commitmentBadgeText: {
    fontSize: Math.max(12, screenWidth * 0.03),
    fontWeight: "600",
    color: "#424242",
  },
  selectedBadge: {
    backgroundColor: "#1565C0",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedBadgeText: {
    fontSize: Math.max(12, screenWidth * 0.03),
    fontWeight: "600",
    color: "#FFFFFF",
  },
  commitmentBody: {
    gap: 8,
  },
  commitmentAmount: {
    fontSize: Math.max(18, screenWidth * 0.045),
    fontWeight: "700",
    color: "#000000",
  },
  commitmentDate: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#666666",
  },
  commitmentHash: {
    fontSize: Math.max(11, screenWidth * 0.028),
    color: "#999999",
    fontFamily: "monospace",
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    marginTop: 8,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#666666",
    textAlign: "center",
    marginBottom: 16,
  },
  shieldPromptButton: {
    backgroundColor: "#1565C0",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shieldPromptButtonText: {
    fontSize: Math.max(14, screenWidth * 0.035),
    fontWeight: "600",
    color: "#FFFFFF",
  },
  privateBalanceCard: {
    backgroundColor: "#E3F2FD",
    borderRadius: 16,
    padding: screenWidth * 0.06,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#90CAF9",
  },
  privateBalanceAmount: {
    fontSize: Math.max(36, screenWidth * 0.09),
    fontWeight: "700",
    color: "#1565C0",
    marginBottom: 8,
  },
  privateBalanceLabel: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#1976D2",
    fontWeight: "600",
  },
  privateBalanceDate: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#64B5F6",
    marginTop: 8,
  },
});
