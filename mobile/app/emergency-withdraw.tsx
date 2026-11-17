import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { ethers } from "ethers";
import { veilonSDK } from "../services/veilon-sdk";
import { useWalletStore } from "../stores/walletStore";
import { commitmentStoreRN } from "../utils/commitment-store-rn";
import { useSecurityStore } from "../stores/securityStore";
import { useNotificationStore } from "../stores/notificationStore";
import PinVerificationModal from "../components/PinVerificationModal";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function EmergencyWithdraw() {
  const router = useRouter();
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [showPinModal, setShowPinModal] = useState(false);

  const activeWallet = useWalletStore((state) => state.getActiveWallet());
  const refreshBalances = useWalletStore((state) => state.refreshBalances);
  const { isPinSet } = useSecurityStore();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const handleEmergencyWithdraw = async () => {
    // Show warning
    Alert.alert(
      "⚠️ Emergency Withdraw",
      "This will withdraw ALL your private balances to your public wallet.\n\n" +
      "WARNING: This breaks your privacy! All commitments will be linked to your address on the blockchain.\n\n" +
      "Are you sure you want to continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Proceed",
          style: "destructive",
          onPress: () => {
            if (isPinSet) {
              setShowPinModal(true);
            } else {
              executeEmergencyWithdraw();
            }
          },
        },
      ]
    );
  };

  const handlePinSuccess = () => {
    setShowPinModal(false);
    executeEmergencyWithdraw();
  };

  const executeEmergencyWithdraw = async () => {
    if (!activeWallet?.address) {
      Alert.alert("Error", "No active wallet found");
      return;
    }

    try {
      setIsWithdrawing(true);

      console.log("🚨 Starting emergency withdrawal...");

      // Get all unspent commitments
      const commitments = await commitmentStoreRN.getUnspentCommitments(
        activeWallet.address
      );

      if (commitments.length === 0) {
        Alert.alert("No Commitments", "You have no private balance to withdraw.");
        setIsWithdrawing(false);
        return;
      }

      console.log(`Found ${commitments.length} commitment(s) to withdraw`);
      setProgress({ current: 0, total: commitments.length });

      let successCount = 0;
      let failedCount = 0;

      // Process each commitment
      for (let i = 0; i < commitments.length; i++) {
        const commitment = commitments[i];
        setProgress({ current: i + 1, total: commitments.length });

        try {
          const decimals = commitment.token === "USDC" || commitment.token === "USDT" ? 6 : 18;
          const commitmentAmount = ethers.formatUnits(commitment.amount, decimals);

          console.log(`Processing ${i + 1}/${commitments.length}: ${commitmentAmount} ${commitment.token}`);

          // Generate unshield proof (full amount, no change)
          const result = await veilonSDK.unshield(
            commitment.commitment,
            commitment.secret,
            commitment.nullifier,
            commitment.randomness || commitment.secret,
            activeWallet.address, // Send to self
            commitmentAmount,     // inputAmount (full)
            commitmentAmount      // outputAmount (full - no change!)
          );

          // Submit to blockchain
          const txResult = await veilonSDK.submitUnshieldTransaction(
            commitment.commitment,                                    // inputCommitment
            result.changeCommitment || ethers.ZeroHash,              // changeCommitment
            result.nullifierHash || "",                              // nullifierHash
            activeWallet.address,                                    // recipient
            commitmentAmount,                                        // outputAmount (full amount)
            result.changeAmount || "0",                              // changeAmount (should be "0" for emergency)
            commitment.tokenAddress || ethers.ZeroAddress,           // tokenAddress
            result.proof,                                            // proof
            result.publicSignals || []                               // publicSignals
          );

          console.log(`✅ Success: ${txResult.hash}`);

          // Mark as spent locally
          await commitmentStoreRN.markAsSpent(
            activeWallet.address,
            commitment.nullifier
          );

          // Add notification for this withdrawal
          addNotification({
            type: "unshield",
            txHash: txResult.hash,
            amount: commitmentAmount,
            token: commitment.token || "ETH",
          });

          successCount++;
        } catch (error: any) {
          console.error(`❌ Failed to process commitment ${i + 1}:`, error);
          failedCount++;
        }
      }

      setIsWithdrawing(false);
      setProgress({ current: 0, total: 0 });

      // Refresh balances after all withdrawals
      if (successCount > 0) {
        await refreshBalances(activeWallet.address);
      }

      // Show final result
      Alert.alert(
        "Emergency Withdraw Complete",
        `Successfully withdrawn: ${successCount} commitment(s)\n` +
        (failedCount > 0 ? `Failed: ${failedCount} commitment(s)` : ""),
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error("❌ Emergency withdraw error:", error);
      setIsWithdrawing(false);
      setProgress({ current: 0, total: 0 });
      Alert.alert(
        "Emergency Withdraw Failed",
        error.message || "Failed to complete emergency withdrawal"
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Emergency Withdraw</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Warning Card */}
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningTitle}>Privacy Warning</Text>
          <Text style={styles.warningText}>
            Emergency withdrawal will withdraw ALL your private balances to your public wallet.
          </Text>
          <Text style={styles.warningText}>
            This will create an on-chain link between your commitments and your address, breaking your privacy.
          </Text>
          <Text style={styles.warningText}>
            Only use this in emergency situations where you need immediate access to all funds.
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How It Works</Text>
          <Text style={styles.infoText}>
            • Retrieves all your unspent commitments{"\n"}
            • Unshields each commitment to your public wallet{"\n"}
            • Processes ETH and ERC20 tokens{"\n"}
            • Uses existing smart contract functions{"\n"}
            • May require multiple transactions and gas fees
          </Text>
        </View>

        {/* Progress Indicator */}
        {isWithdrawing && (
          <View style={styles.progressCard}>
            <ActivityIndicator size="large" color="#B39DDB" />
            <Text style={styles.progressText}>
              Processing commitment {progress.current} of {progress.total}...
            </Text>
            <Text style={styles.progressSubtext}>
              Please wait, this may take a few minutes
            </Text>
          </View>
        )}

        {/* Emergency Withdraw Button */}
        <Pressable
          style={[
            styles.withdrawButton,
            isWithdrawing && styles.withdrawButtonDisabled,
          ]}
          onPress={handleEmergencyWithdraw}
          disabled={isWithdrawing}
        >
          <Text style={styles.withdrawButtonText}>
            {isWithdrawing ? "Withdrawing..." : "Emergency Withdraw All"}
          </Text>
        </Pressable>
      </ScrollView>

      {/* PIN Verification Modal */}
      <PinVerificationModal
        visible={showPinModal}
        onSuccess={handlePinSuccess}
        onCancel={() => setShowPinModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  scrollContent: {
    padding: screenWidth * 0.05,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: screenHeight * 0.03,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 24,
    color: "#000000",
  },
  headerTitle: {
    fontSize: Math.max(20, screenWidth * 0.05),
    fontWeight: "700",
    color: "#000000",
  },
  placeholder: {
    width: 40,
  },
  warningCard: {
    backgroundColor: "#FFF3CD",
    borderRadius: 12,
    padding: screenWidth * 0.05,
    marginBottom: screenHeight * 0.02,
    borderWidth: 2,
    borderColor: "#FFC107",
  },
  warningIcon: {
    fontSize: 40,
    textAlign: "center",
    marginBottom: 10,
  },
  warningTitle: {
    fontSize: Math.max(18, screenWidth * 0.045),
    fontWeight: "700",
    color: "#856404",
    marginBottom: 10,
    textAlign: "center",
  },
  warningText: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#856404",
    lineHeight: 20,
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
    padding: screenWidth * 0.05,
    marginBottom: screenHeight * 0.02,
  },
  infoTitle: {
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "700",
    color: "#1976D2",
    marginBottom: 10,
  },
  infoText: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#1565C0",
    lineHeight: 22,
  },
  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: screenWidth * 0.05,
    marginBottom: screenHeight * 0.02,
    alignItems: "center",
  },
  progressText: {
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "600",
    color: "#000000",
    marginTop: 15,
  },
  progressSubtext: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#666666",
    marginTop: 5,
  },
  withdrawButton: {
    backgroundColor: "#F44336",
    borderRadius: 12,
    paddingVertical: screenHeight * 0.02,
    alignItems: "center",
    marginTop: screenHeight * 0.02,
  },
  withdrawButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  withdrawButtonText: {
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
