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
import { transactionHistoryRN } from "../utils/transaction-history-rn";
import { ethers } from "ethers";
import PinVerificationModal from "../components/PinVerificationModal";
import CustomAlert from "../components/CustomAlert";
import { useCustomAlert } from "../hooks/useCustomAlert";
import { getSupportedTokensForChain } from "../constants/tokens";
import { useTokenStore } from "../stores/tokenStore";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function ShieldAssets() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [selectedToken, setSelectedToken] = useState("ETH");
  const [amount, setAmount] = useState("");
  const [isShielding, setIsShielding] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [proofData, setProofData] = useState<{
    commitment: string;
    nullifier: string;
    secret: string;
    randomness: string;
  } | null>(null);

  const activeWallet = useWalletStore((state) => state.getActiveWallet());
  const network = useWalletStore((state) => state.network);
  const refreshBalances = useWalletStore((state) => state.refreshBalances);
  const { isAuthenticated, lastAuthTime, isPinSet } = useSecurityStore();
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const tokenBalances = useTokenStore((state) => state.tokenBalances);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Get actual wallet balance
  const publicBalance = activeWallet?.publicBalance || "0.00";

  // Get supported tokens from centralized config (Sepolia testnet = 11155111)
  const chainId = network?.chainId || 11155111;
  const walletAddress = activeWallet?.address || "";

  // Get token balances from store
  const walletTokenBalances = tokenBalances[walletAddress] || [];

  const TOKENS = getSupportedTokensForChain(chainId).map(token => {
    // Find balance from token store
    const tokenBalance = walletTokenBalances.find((b) => b.symbol === token.symbol);

    return {
      symbol: token.symbol,
      address: token.address,
      balance: tokenBalance?.balance || "0.00",
      icon: token.icon,
      decimals: token.decimals,
      isNative: token.isNative,
    };
  });

  const selectedTokenData = TOKENS.find((t) => t.symbol === selectedToken);

  const handleShield = async () => {
    try {
      // Validate wallet
      if (!activeWallet?.address) {
        showAlert({
          type: "warning",
          title: "No Wallet",
          message: "Please create or import a wallet first",
          actions: [{ text: "OK", style: "primary" }],
        });
        return;
      }

      // Validate amount
      if (!amount || parseFloat(amount) <= 0) {
        showAlert({
          type: "warning",
          title: "Invalid Amount",
          message: "Please enter a valid amount to shield",
          actions: [{ text: "OK", style: "primary" }],
        });
        return;
      }

      // Check if amount exceeds balance
      const tokenBalance = parseFloat(selectedTokenData?.balance || "0");
      if (parseFloat(amount) > tokenBalance) {
        showAlert({
          type: "error",
          title: "Insufficient Balance",
          message: `You only have ${tokenBalance} ${selectedToken}`,
          actions: [{ text: "OK", style: "primary" }],
        });
        return;
      }

      setIsShielding(true);

      // Step 1: Generate ZK proof via backend
      console.log(
        `🛡️ Step 1: Generating ZK proof for ${amount} ${selectedToken}...`
      );

      let result;
      if (selectedToken === "ETH") {
        result = await veilonSDK.shieldETH(amount);
      } else {
        // Shield ERC20 token
        if (!selectedTokenData) {
          throw new Error("Token not found");
        }
        result = await veilonSDK.shieldERC20(
          selectedTokenData.address,
          selectedToken,
          amount
        );

        // Check if approval is needed
        if (result.needsApproval) {
          setIsShielding(false);
          showAlert({
            type: "warning",
            title: "Approval Required",
            message: `You need to approve ${selectedToken} before shielding. Approve now?`,
            actions: [
              { text: "Cancel", style: "cancel" },
              {
                text: "Approve",
                style: "primary",
                onPress: async () => {
                  try {
                    setIsShielding(true);
                    console.log(`🔓 Approving ${selectedToken}...`);
                    const approvalTx = await veilonSDK.approveERC20(
                      selectedTokenData.address,
                      selectedToken,
                      amount
                    );
                    console.log(`⏳ Waiting for approval confirmation...`);
                    await veilonSDK.waitForTransaction(approvalTx.hash);
                    console.log(`✅ Approval confirmed!`);

                    // Now try shielding again
                    result = await veilonSDK.shieldERC20(
                      selectedTokenData.address,
                      selectedToken,
                      amount
                    );

                    if (!result.commitment) {
                      throw new Error(
                        "Failed to generate proof after approval"
                      );
                    }

                    // Continue with proof data
                    const proofDataToStore = {
                      commitment: result.commitment!,
                      nullifier: result.nullifier!,
                      secret: result.secret!,
                      randomness: result.randomness!,
                    };
                    setProofData(proofDataToStore);
                    setIsShielding(false);

                    if (isPinSet) {
                      setShowPinModal(true);
                      return;
                    }
                    await executeShield(proofDataToStore);
                  } catch (error: any) {
                    console.error("❌ Approval failed:", error);
                    showAlert({
                      type: "error",
                      title: "Approval Failed",
                      message: error.message,
                      actions: [{ text: "OK", style: "primary" }],
                    });
                    setIsShielding(false);
                  }
                },
              },
            ],
          });
          return;
        }
      }

      if (
        !result.commitment ||
        !result.nullifier ||
        !result.secret ||
        !result.randomness
      ) {
        throw new Error("Failed to generate proof data");
      }

      // Store proof data for later submission
      const proofDataToStore = {
        commitment: result.commitment,
        nullifier: result.nullifier,
        secret: result.secret,
        randomness: result.randomness,
      };

      setProofData(proofDataToStore);
      setIsShielding(false);

      console.log("✅ Proof generated successfully!");
      console.log(
        "🔐 Now requiring PIN verification before blockchain submission..."
      );

      // Step 2: ALWAYS show PIN verification modal for security
      if (isPinSet) {
        setShowPinModal(true);
        return;
      }

      // If no PIN set, submit immediately
      // Pass proof data directly since state hasn't updated yet
      await executeShield(proofDataToStore);
    } catch (error: any) {
      console.error("❌ Shield failed:", error);
      showAlert({
        type: "error",
        title: "Shield Failed",
        message: error.message || "Failed to generate shield proof. Please try again.",
        actions: [{ text: "OK", style: "primary" }],
      });
      setIsShielding(false);
      setProofData(null);
    }
  };

  const handlePinSuccess = () => {
    setShowPinModal(false);
    // Execute shield after successful PIN verification
    executeShield();
  };

  const executeShield = async (proofDataParam?: {
    commitment: string;
    nullifier: string;
    secret: string;
    randomness: string;
  }) => {
    try {
      setIsShielding(true);

      // Use parameter if provided, otherwise use state
      const dataToUse = proofDataParam || proofData;

      if (!dataToUse) {
        throw new Error("No proof data available. Please try again.");
      }

      console.log(`📤 Step 3: Submitting shield transaction to blockchain...`);

      // Submit shield transaction to blockchain
      const txResult = await veilonSDK.submitShieldTransaction(
        dataToUse.commitment,
        amount,
        selectedToken !== "ETH" ? selectedTokenData?.address : undefined,
        selectedToken !== "ETH" ? selectedToken : undefined
      );

      console.log("✅ Shield transaction submitted:", txResult.hash);

      // Add to transaction history (pending)
      await transactionHistoryRN.addTransaction(activeWallet.address, {
        type: "shield",
        hash: txResult.hash,
        from: activeWallet.address,
        amount,
        amountWei: ethers.parseEther(amount).toString(),
        token: selectedToken,
        status: "pending",
        timestamp: Date.now(),
        commitment: dataToUse.commitment,
        isPrivate: true,
      });

      console.log("⏳ Waiting for blockchain confirmation...");

      // Wait for transaction confirmation
      const confirmed = await veilonSDK.waitForTransaction(txResult.hash);

      if (confirmed) {
        // Update transaction status to confirmed
        await transactionHistoryRN.updateTransactionStatus(
          activeWallet.address,
          txResult.hash,
          "confirmed"
        );

        // Save commitment to local storage
        console.log("💾 Saving commitment to local storage...");
        await veilonSDK.saveCommitment(
          activeWallet.address,
          dataToUse.commitment,
          dataToUse.nullifier,
          dataToUse.secret,
          amount,
          txResult.hash,
          dataToUse.randomness,
          selectedToken,
          selectedTokenData?.address
        );
        console.log("✅ Commitment saved");

        // Add notification
        addNotification({
          type: "shield",
          txHash: txResult.hash,
          amount,
          token: selectedToken,
        });

        // Refresh balances
        console.log("🔄 Refreshing balances after shield...");
        await refreshBalances(activeWallet.address);
        console.log("✅ Balances refreshed");

        showAlert({
          type: "success",
          title: "Shield Successful!",
          message: `Successfully shielded ${amount} ${selectedToken}\n\nYour private balance has been updated.\n\nTx: ${txResult.hash.substring(
            0,
            10
          )}...`,
          actions: [
            {
              text: "View on Explorer",
              style: "default",
              onPress: () => {
                // TODO: Open block explorer
              },
            },
            {
              text: "Done",
              style: "primary",
              onPress: () => {
                setAmount("");
                setProofData(null);
                router.back();
              },
            },
          ],
        });
      } else {
        // Transaction failed
        await transactionHistoryRN.updateTransactionStatus(
          activeWallet.address,
          txResult.hash,
          "failed"
        );

        showAlert({
          type: "error",
          title: "Transaction Failed",
          message: "The shield transaction failed on the blockchain. Please try again.",
          actions: [{ text: "OK", style: "primary" }],
        });
      }
    } catch (error: any) {
      console.error("❌ Shield transaction failed:", error);
      showAlert({
        type: "error",
        title: "Shield Failed",
        message:
          error.message ||
          "Failed to submit shield transaction. Please try again.",
        actions: [{ text: "OK", style: "primary" }],
      });
    } finally {
      setIsShielding(false);
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
            <Text style={styles.headerTitle}>Shield Assets</Text>
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
              <Text style={styles.infoBannerTitle}>What is Shielding?</Text>
              <Text style={styles.infoBannerText}>
                Shielding moves your tokens from your public wallet to your
                private (Ozk) wallet, making them completely private. Once
                shielded, your balance and transactions become invisible to the
                public blockchain.
              </Text>
            </View>
          </View>

          {/* Select Token to Shield */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Select Token to Shield</Text>
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

          {/* Amount to Shield */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Amount to Shield</Text>
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

          {/* Privacy Benefits */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Privacy Benefits</Text>
            <View style={styles.benefitsList}>
              <View style={styles.benefitItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.benefitText}>Hidden balance amounts</Text>
              </View>
              <View style={styles.benefitItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.benefitText}>
                  Private transaction history
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.benefitText}>
                  Anonymous recipient addresses
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.benefitText}>
                  Protected from MEV attacks
                </Text>
              </View>
            </View>
          </View>

          {/* Shield Button */}
          <Pressable
            style={[
              styles.shieldButton,
              isShielding && styles.shieldButtonDisabled,
            ]}
            onPress={handleShield}
            disabled={isShielding}
          >
            {isShielding ? (
              <View style={styles.shieldButtonContent}>
                <ActivityIndicator size="small" color="#2E7D32" />
                <Text
                  style={[
                    styles.shieldButtonText,
                    styles.shieldButtonTextLoading,
                  ]}
                >
                  Shielding...
                </Text>
              </View>
            ) : (
              <Text style={styles.shieldButtonText}>Shield Assets</Text>
            )}
          </Pressable>
        </ScrollView>

        {/* PIN Verification Modal */}
        <PinVerificationModal
          visible={showPinModal}
          onSuccess={handlePinSuccess}
          onCancel={() => setShowPinModal(false)}
          title="Verify PIN"
          subtitle="Confirm your identity to shield tokens"
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
  benefitText: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#666666",
  },
  shieldButton: {
    backgroundColor: "#C8E6C9",
    borderRadius: 12,
    paddingVertical: screenHeight * 0.02,
    alignItems: "center",
    marginBottom: screenHeight * 0.03,
  },
  shieldButtonDisabled: {
    opacity: 0.6,
  },
  shieldButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shieldButtonText: {
    color: "#2E7D32",
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "700",
  },
  shieldButtonTextLoading: {
    marginLeft: 8,
  },
});
