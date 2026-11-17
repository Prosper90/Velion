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
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { veilonSDK } from "../services/veilon-sdk";
import { useWalletStore } from "../stores/walletStore";
import { useSecurityStore } from "../stores/securityStore";
import { useNotificationStore } from "../stores/notificationStore";
import { commitmentStoreRN } from "../utils/commitment-store-rn";
import { transactionHistoryRN } from "../utils/transaction-history-rn";
import { ethers } from "ethers";
import PinVerificationModal from "../components/PinVerificationModal";
import CustomAlert from "../components/CustomAlert";
import { useCustomAlert } from "../hooks/useCustomAlert";
import { getSupportedTokensForChain } from "../constants/tokens";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function UnshieldAssets() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [selectedToken, setSelectedToken] = useState("ETH");
  const [amount, setAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [isUnshielding, setIsUnshielding] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [availableCommitments, setAvailableCommitments] = useState<any[]>([]);
  const [selectedCommitmentIndex, setSelectedCommitmentIndex] = useState<
    number | null
  >(null);
  const [proofData, setProofData] = useState<{
    proof: any;
    publicSignals: string[];
    nullifierHash: string;
    selectedCommitment: any;
    finalRecipient: string;
  } | null>(null);

  const activeWallet = useWalletStore((state) => state.getActiveWallet());
  const refreshBalances = useWalletStore((state) => state.refreshBalances);
  const { isAuthenticated, lastAuthTime, isPinSet } = useSecurityStore();
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Multi-token private balances
  const [privateBalances, setPrivateBalances] = useState<
    Record<string, string>
  >({});

  // Fetch private balances for all tokens
  useEffect(() => {
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

  // Fetch available commitments when token changes
  useEffect(() => {
    const fetchCommitments = async () => {
      if (activeWallet?.address) {
        try {
          const allCommitments = await commitmentStoreRN.getUnspentCommitments(
            activeWallet.address
          );
          // Filter by selected token
          const tokenCommitments = allCommitments.filter(
            (c) => (c.token || "ETH") === selectedToken
          );
          setAvailableCommitments(tokenCommitments);

          // Auto-select the first (latest) commitment
          if (tokenCommitments.length > 0) {
            setSelectedCommitmentIndex(0);
          } else {
            setSelectedCommitmentIndex(null);
          }
          setAmount("");
        } catch (error) {
          console.error("Failed to fetch commitments:", error);
          setAvailableCommitments([]);
          setSelectedCommitmentIndex(null);
        }
      }
    };
    fetchCommitments();
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

  const handleUnshield = async () => {
    try {
      setIsUnshielding(true);

      // Validate wallet
      if (!activeWallet?.address) {
        showAlert({
          type: "warning",
          title: "No Wallet",
          message: "Please create or import a wallet first",
          actions: [{ text: "OK", style: "primary" }],
        });
        setIsUnshielding(false);
        return;
      }

      // Validate commitment selection
      if (selectedCommitmentIndex === null) {
        showAlert({
          type: "warning",
          title: "No Commitment Selected",
          message: "Please select a commitment to unshield",
          actions: [{ text: "OK", style: "primary" }],
        });
        setIsUnshielding(false);
        return;
      }

      const selectedCommitment = availableCommitments[selectedCommitmentIndex];
      if (!selectedCommitment) {
        showAlert({
          type: "error",
          title: "Invalid Selection",
          message: "Selected commitment not found",
          actions: [{ text: "OK", style: "primary" }],
        });
        setIsUnshielding(false);
        return;
      }

      // Validate amount
      if (!amount || parseFloat(amount) <= 0) {
        showAlert({
          type: "warning",
          title: "Invalid Amount",
          message: "Please enter a valid amount to unshield",
          actions: [{ text: "OK", style: "primary" }],
        });
        setIsUnshielding(false);
        return;
      }

      const decimals = selectedTokenData?.decimals || 18;
      const commitmentAmount = ethers.formatUnits(
        selectedCommitment.amount,
        decimals
      );

      // Validate amount doesn't exceed commitment
      if (parseFloat(amount) > parseFloat(commitmentAmount)) {
        showAlert({
          type: "error",
          title: "Amount Too Large",
          message: `Cannot unshield ${amount} ${selectedToken}. Maximum available: ${commitmentAmount} ${selectedToken}`,
          actions: [{ text: "OK", style: "primary" }],
        });
        setIsUnshielding(false);
        return;
      }

      // Validate recipient address (default to own address if empty)
      const finalRecipient = recipientAddress || activeWallet.address;
      if (!finalRecipient.match(/^0x[a-fA-F0-9]{40}$/)) {
        showAlert({
          type: "error",
          title: "Invalid Address",
          message: "Please enter a valid Ethereum address",
          actions: [{ text: "OK", style: "primary" }],
        });
        setIsUnshielding(false);
        return;
      }

      console.log(
        `🔓 Starting unshield process: ${amount} ${selectedToken} from ${commitmentAmount} ${selectedToken} commitment to ${finalRecipient}...`
      );
      console.log("📂 Step 1: Using selected commitment:", {
        inputAmount: commitmentAmount,
        outputAmount: amount,
        token: selectedToken,
        commitment: selectedCommitment.commitment.substring(0, 10) + "...",
      });

      // Step 2: Generate ZK proof via backend relayer
      console.log("🔐 Step 2: Generating zero-knowledge proof via relayer...");
      const result = await veilonSDK.unshield(
        selectedCommitment.commitment,
        selectedCommitment.secret,
        selectedCommitment.nullifier,
        selectedCommitment.randomness || selectedCommitment.secret,
        finalRecipient,
        commitmentAmount, // inputAmount (full commitment)
        amount, // outputAmount (what user wants to unshield)
        selectedToken, // token symbol
        selectedCommitment.tokenAddress // token address
      );

      if (!result.proof || !result.nullifierHash) {
        throw new Error("Failed to generate proof data");
      }

      // Store proof data for later submission
      const proofDataToStore = {
        proof: result.proof,
        publicSignals: result.publicSignals || [],
        nullifierHash: result.nullifierHash,
        changeCommitment: result.changeCommitment,
        changeSecret: result.changeSecret,
        changeNullifier: result.changeNullifier,
        changeRandomness: result.changeRandomness,
        changeAmount: result.changeAmount,
        selectedCommitment,
        finalRecipient,
      };

      setProofData(proofDataToStore);
      setIsUnshielding(false);

      console.log("✅ Proof generated successfully!");
      console.log(
        "🔐 Now requiring PIN verification before blockchain submission..."
      );

      // Step 4: ALWAYS show PIN verification modal for security
      if (isPinSet) {
        setShowPinModal(true);
        return;
      }

      // If no PIN set, submit immediately
      await executeUnshield(proofDataToStore);
    } catch (error: any) {
      console.error("❌ Unshield failed:", error);
      showAlert({
        type: "error",
        title: "Unshield Failed",
        message: error.message || "Failed to generate unshield proof. Please try again.",
        actions: [{ text: "OK", style: "primary" }],
      });
      setIsUnshielding(false);
      setProofData(null);
    }
  };

  const handlePinSuccess = () => {
    setShowPinModal(false);
    // Execute unshield after successful PIN verification
    executeUnshield();
  };

  const executeUnshield = async (proofDataParam?: typeof proofData) => {
    try {
      setIsUnshielding(true);

      // Use parameter if provided, otherwise use state
      const dataToUse = proofDataParam || proofData;

      if (!dataToUse) {
        throw new Error("No proof data available. Please try again.");
      }

      console.log(
        `📤 Step 3: Submitting unshield transaction to blockchain...`
      );

      // Get amounts
      const decimals = selectedTokenData?.decimals || 18;
      const outputAmount = amount; // User-specified amount to unshield
      const changeAmount = dataToUse.changeAmount || "0"; // Change amount returned from SDK
      const changeCommitment = dataToUse.changeCommitment || ethers.ZeroHash; // Change commitment from SDK

      console.log("📊 Transaction details:", {
        outputAmount,
        changeAmount,
        changeCommitment: changeCommitment.substring(0, 10) + "...",
      });

      // Submit unshield transaction to blockchain
      const txResult = await veilonSDK.submitUnshieldTransaction(
        dataToUse.selectedCommitment.commitment, // inputCommitment
        changeCommitment, // changeCommitment
        dataToUse.nullifierHash,
        dataToUse.finalRecipient,
        outputAmount, // outputAmount
        changeAmount, // changeAmount
        dataToUse.selectedCommitment.tokenAddress ||
          "0x0000000000000000000000000000000000000000", // token
        dataToUse.proof,
        dataToUse.publicSignals
      );

      console.log("✅ Unshield transaction submitted:", txResult.hash);

      // Add to transaction history (pending)
      await transactionHistoryRN.addTransaction(activeWallet!.address, {
        type: "unshield",
        hash: txResult.hash,
        from: activeWallet!.address,
        to: dataToUse.finalRecipient,
        amount,
        amountWei: ethers.parseEther(amount).toString(),
        token: selectedToken,
        status: "pending",
        timestamp: Date.now(),
        nullifier: dataToUse.selectedCommitment.nullifier,
        isPrivate: true,
      });

      console.log("⏳ Waiting for blockchain confirmation...");

      // Wait for transaction confirmation
      const confirmed = await veilonSDK.waitForTransaction(txResult.hash);

      if (confirmed) {
        // Update transaction status to confirmed
        await transactionHistoryRN.updateTransactionStatus(
          activeWallet!.address,
          txResult.hash,
          "confirmed"
        );

        // Mark input commitment as spent in local storage
        console.log("💾 Marking input commitment as spent...");
        await commitmentStoreRN.markAsSpent(
          activeWallet!.address,
          dataToUse.selectedCommitment.nullifier
        );

        // Save change commitment if there's any change
        if (parseFloat(changeAmount) > 0 && dataToUse.changeSecret && dataToUse.changeNullifier && dataToUse.changeRandomness) {
          console.log("💾 Saving change commitment to local storage...");
          await commitmentStoreRN.addCommitment(activeWallet!.address, {
            commitment: changeCommitment,
            secret: dataToUse.changeSecret,
            nullifier: dataToUse.changeNullifier,
            randomness: dataToUse.changeRandomness,
            amount: ethers.parseUnits(changeAmount, decimals).toString(),
            token: selectedToken,
            tokenAddress: dataToUse.selectedCommitment.tokenAddress || ethers.ZeroAddress,
            txHash: txResult.hash,
            timestamp: Date.now(),
          });
          console.log(`✅ Change commitment saved: ${changeAmount} ${selectedToken}`);
        }

        // Add notification
        addNotification({
          type: "unshield",
          txHash: txResult.hash,
          amount,
          token: selectedToken,
        });

        // Refresh balances
        console.log("🔄 Refreshing balances...");
        await refreshBalances(activeWallet!.address);

        showAlert({
          type: "success",
          title: "Unshield Successful!",
          message: `Successfully unshielded ${amount} ${selectedToken} to ${
            dataToUse.finalRecipient === activeWallet!.address
              ? "your wallet"
              : "recipient"
          }.\n\nYour balances have been updated.\n\nTx: ${txResult.hash.substring(
            0,
            10
          )}...`,
          actions: [
            {
              text: "View on Explorer",
              style: "default",
              onPress: () => {
                console.log("Open tx:", txResult.hash);
              },
            },
            {
              text: "Done",
              style: "primary",
              onPress: () => {
                setAmount("");
                setRecipientAddress("");
                setProofData(null);
                router.back();
              },
            },
          ],
        });
      } else {
        throw new Error("Transaction failed or was reverted");
      }
    } catch (error: any) {
      console.error("❌ Unshield transaction submission failed:", error);
      showAlert({
        type: "error",
        title: "Unshield Failed",
        message:
          error.message ||
          "Failed to submit unshield transaction. Please try again.",
        actions: [{ text: "OK", style: "primary" }],
      });
    } finally {
      setIsUnshielding(false);
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
            <Text style={styles.headerTitle}>Unshield Assets</Text>
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
              <Text style={styles.shieldIcon}>🔓</Text>
            </View>
            <View style={styles.infoBannerContent}>
              <Text style={styles.infoBannerTitle}>What is Unshielding?</Text>
              <Text style={styles.infoBannerText}>
                Unshielding moves your tokens from your private (Ozk) wallet
                back to your public wallet, making them visible on the
                blockchain again. This process uses zero-knowledge proofs to
                maintain privacy until the final withdrawal.
              </Text>
            </View>
          </View>

          {/* Select Token to Unshield */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Select Token to Unshield</Text>
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
            {availableCommitments.length === 0 ? (
              <View style={styles.emptyCommitments}>
                <Text style={styles.emptyText}>
                  No private {selectedToken} balance
                </Text>
                <Text style={styles.emptySubtext}>
                  Shield some {selectedToken} first to create a private balance
                </Text>
              </View>
            ) : (
              <View style={styles.balanceCard}>
                <Text style={styles.balanceAmount}>
                  {ethers.formatUnits(
                    availableCommitments[0].amount,
                    selectedTokenData?.decimals || 18
                  )}{" "}
                  {selectedToken}
                </Text>
                <Text style={styles.balanceLabel}>Private Balance</Text>
                {availableCommitments[0].timestamp && (
                  <Text style={styles.balanceDate}>
                    Last updated:{" "}
                    {new Date(availableCommitments[0].timestamp).toLocaleDateString()}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Amount to Unshield */}
          {selectedCommitmentIndex !== null && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Amount to Unshield</Text>
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
                      const selectedCommitment = availableCommitments[selectedCommitmentIndex];
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
                      availableCommitments[selectedCommitmentIndex].amount,
                      selectedTokenData?.decimals || 18
                    )}{" "}
                    {selectedToken}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Recipient Address */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Recipient Address (Optional - defaults to your wallet)
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.addressInput}
                placeholder="0x... (leave empty to use your own wallet)"
                placeholderTextColor="#CCCCCC"
                value={recipientAddress}
                onChangeText={setRecipientAddress}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Privacy Notice */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Important Notice</Text>
            <View style={styles.benefitsList}>
              <View style={styles.benefitItem}>
                <Text style={styles.warningMark}>⚠️</Text>
                <Text style={styles.benefitText}>
                  Unshielded tokens become publicly visible
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.benefitText}>
                  Your identity remains private during withdrawal
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.benefitText}>
                  ZK proof ensures only you can unshield your tokens
                </Text>
              </View>
            </View>
          </View>

          {/* Unshield Button */}
          <Pressable
            style={[
              styles.unshieldButton,
              isUnshielding && styles.unshieldButtonDisabled,
            ]}
            onPress={handleUnshield}
            disabled={isUnshielding}
          >
            {isUnshielding ? (
              <View style={styles.unshieldButtonContent}>
                <ActivityIndicator size="small" color="#1565C0" />
                <Text
                  style={[
                    styles.unshieldButtonText,
                    styles.unshieldButtonTextLoading,
                  ]}
                >
                  Unshielding...
                </Text>
              </View>
            ) : (
              <Text style={styles.unshieldButtonText}>Unshield Assets</Text>
            )}
          </Pressable>
        </ScrollView>

        {/* PIN Verification Modal */}
        <PinVerificationModal
          visible={showPinModal}
          onSuccess={handlePinSuccess}
          onCancel={() => setShowPinModal(false)}
          title="Verify PIN"
          subtitle="Confirm your identity to unshield tokens"
        />

        {/* Custom Alert Modal */}
        <CustomAlert
          visible={alertState.visible}
          type={alertState.type}
          title={alertState.title}
          message={alertState.message}
          actions={alertState.actions}
          onClose={hideAlert}
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
    backgroundColor: "#1565C0",
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
    color: "#BBDEFB",
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
    borderColor: "#90CAF9",
    backgroundColor: "#E3F2FD",
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
  inputContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: screenWidth * 0.04,
  },
  addressInput: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#000000",
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkmark: {
    color: "#4CAF50",
    fontSize: 18,
    marginRight: 12,
    fontWeight: "bold",
  },
  warningMark: {
    fontSize: 18,
    marginRight: 12,
  },
  benefitText: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#666666",
  },
  unshieldButton: {
    backgroundColor: "#BBDEFB",
    borderRadius: 12,
    paddingVertical: screenHeight * 0.02,
    alignItems: "center",
    marginBottom: screenHeight * 0.03,
  },
  unshieldButtonDisabled: {
    opacity: 0.6,
  },
  unshieldButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unshieldButtonText: {
    color: "#1565C0",
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "700",
  },
  unshieldButtonTextLoading: {
    marginLeft: 8,
  },
  sectionHint: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#999999",
    marginTop: 4,
    marginBottom: 12,
  },
  emptyCommitments: {
    padding: 24,
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    marginTop: 8,
  },
  emptyText: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#666666",
    fontWeight: "600",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#999999",
    textAlign: "center",
  },
  commitmentsContainer: {
    gap: 12,
    marginTop: 8,
  },
  commitmentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  commitmentCardActive: {
    borderColor: "#1565C0",
    backgroundColor: "#E3F2FD",
  },
  commitmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  commitmentRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#1565C0",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  commitmentRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1565C0",
  },
  commitmentAmount: {
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "700",
    color: "#000000",
  },
  commitmentHash: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#666666",
    fontFamily: "monospace",
    marginBottom: 4,
  },
  commitmentTx: {
    fontSize: Math.max(11, screenWidth * 0.028),
    color: "#999999",
  },
  balanceCard: {
    backgroundColor: "#E3F2FD",
    borderRadius: 16,
    padding: screenWidth * 0.06,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#90CAF9",
  },
  balanceAmount: {
    fontSize: Math.max(36, screenWidth * 0.09),
    fontWeight: "700",
    color: "#1565C0",
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#1976D2",
    fontWeight: "600",
  },
  balanceDate: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#64B5F6",
    marginTop: 8,
  },
});
