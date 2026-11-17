import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AddressBook from "../../components/AddressBook";
import BlackBanner from "../../components/BlackBanner";
import HeaderIcons from "../../components/HeaderIcons";
import NetworksRPCs from "../../components/NetworksRPCs";
import PendingBalances from "../../components/PendingBalances";
import WalletPage from "../../components/WalletPage";
import { commitmentStoreRN } from "../../utils/commitment-store-rn";
import { transactionHistoryRN } from "../../utils/transaction-history-rn";
import { useWalletStore } from "../../stores/walletStore";
import { veilonSDK } from "../../services/veilon-sdk";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function SettingsTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showWalletOverlay, setShowWalletOverlay] = useState(false);
  const [showPendingBalances, setShowPendingBalances] = useState(false);
  const [showAddressBook, setShowAddressBook] = useState(false);
  const [showNetworksRPCs, setShowNetworksRPCs] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { getActiveWallet, refreshBalances, wallets, activeWalletAddress } =
    useWalletStore();
  const activeWallet = getActiveWallet();

  // Debug logging
  console.log("📱 Settings Tab - Wallet State:");
  console.log("  - Total wallets:", wallets?.length || 0);
  console.log("  - Active wallet address:", activeWalletAddress);
  console.log("  - Active wallet object:", activeWallet);

  const handleSyncPrivateData = async () => {
    console.log("🔍 handleSyncPrivateData called");
    console.log("🔍 activeWallet:", activeWallet);

    if (!activeWallet) {
      console.log("❌ No active wallet found!");
      Alert.alert("Error", "No active wallet found");
      return;
    }

    console.log("✅ Active wallet address:", activeWallet.address);

    Alert.alert(
      "Sync Private Data",
      "This will sync your local commitments with the blockchain to update which ones have been spent. This is safe and won't delete any unspent commitments.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sync Now",
          onPress: async () => {
            try {
              setIsSyncing(true);
              console.log("🔄 Starting sync process...");

              const result = await veilonSDK.syncCommitments(
                activeWallet.address
              );

              console.log("📊 Sync results:", result);

              // Refresh balances after sync
              await refreshBalances(activeWallet.address);

              Alert.alert(
                "Sync Complete",
                `Total commitments: ${result.totalCommitments}\n` +
                  `Marked as spent: ${result.markedAsSpent}\n` +
                  `Still unspent: ${result.stillUnspent}\n\n` +
                  "Your private balance has been updated."
              );
            } catch (error: any) {
              console.error("❌ Sync error:", error);
              Alert.alert(
                "Sync Failed",
                error.message || "Failed to sync commitments"
              );
            } finally {
              setIsSyncing(false);
            }
          },
        },
      ]
    );
  };

  const handleClearPrivateData = () => {
    if (!activeWallet) {
      Alert.alert("Error", "No active wallet found");
      return;
    }

    // Get current balance to show in warning
    commitmentStoreRN
      .getPrivateBalance(activeWallet.address)
      .then((balance) => {
        Alert.alert(
          "⚠️ WARNING: Clear All Private Data",
          `This will DELETE ALL your shielded commitments!\n\n` +
            `Current private balance: ${balance} ETH\n\n` +
            `⚠️ YOU WILL LOSE ACCESS TO THESE FUNDS FOREVER!\n\n` +
            `Are you absolutely sure? Consider using "Sync Private Data" instead to safely update spent commitments.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Yes, DELETE Everything",
              style: "destructive",
              onPress: async () => {
                try {
                  await commitmentStoreRN.clearCommitments(
                    activeWallet.address
                  );
                  await refreshBalances(activeWallet.address);
                  Alert.alert(
                    "Data Cleared",
                    "All private data has been deleted. Your private balance is now 0."
                  );
                } catch (error: any) {
                  Alert.alert("Error", error.message);
                }
              },
            },
          ]
        );
      });
  };

  const handleClearAllAppData = () => {
    Alert.alert(
      "🚨 DANGER: Clear ALL App Data",
      `This will DELETE EVERYTHING:\n\n` +
        `✗ All commitments (private balances)\n` +
        `✗ Transaction history\n` +
        `✗ Cached data\n\n` +
        `⚠️ USE THIS AFTER DEPLOYING NEW CONTRACTS\n\n` +
        `Your wallet keys are safe (stored in secure storage).\n\n` +
        `Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "🗑️ Clear Everything",
          style: "destructive",
          onPress: async () => {
            try {
              console.log("🗑️ Starting to clear all app data...");

              // Clear commitments for all wallets
              for (const wallet of wallets) {
                console.log(`🗑️ Clearing commitments for ${wallet.address}...`);
                await commitmentStoreRN.clearCommitments(wallet.address);
                console.log(
                  `🗑️ Clearing transactions for ${wallet.address}...`
                );
                await transactionHistoryRN.clearTransactions(wallet.address);
              }

              // Clear any other AsyncStorage data (except wallet keys)
              console.log("🗑️ Getting all AsyncStorage keys...");
              const allKeys = await AsyncStorage.getAllKeys();
              console.log(`📋 Found ${allKeys.length} keys in storage`);

              // Filter out wallet-related keys (we want to keep those!)
              const keysToDelete = allKeys.filter(
                (key) =>
                  !key.includes("wallet") &&
                  !key.includes("secure") &&
                  !key.includes("pin") &&
                  !key.includes("biometric")
              );

              console.log(
                `🗑️ Deleting ${keysToDelete.length} non-wallet keys...`
              );
              if (keysToDelete.length > 0) {
                await AsyncStorage.multiRemove(keysToDelete);
              }

              // Refresh balances for active wallet
              if (activeWallet) {
                await refreshBalances(activeWallet.address);
              }

              console.log("✅ All app data cleared successfully!");

              Alert.alert(
                "✅ Data Cleared",
                "All app data has been cleared successfully!\n\n" +
                  "Your wallets are still intact.\n" +
                  "You can now shield tokens with the new contract.",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      // Optionally navigate to home
                      console.log("App data cleared, user acknowledged");
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error("❌ Error clearing app data:", error);
              Alert.alert("Error", error.message || "Failed to clear app data");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Temporarily commented out to test scrolling */}
      {/* <BackgroundImage /> */}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>VeilOn</Text>
        <HeaderIcons />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={true}
        scrollEnabled={true}
        contentInsetAdjustmentBehavior="automatic"
        contentInset={{ bottom: insets.bottom }}
      >
        <View style={styles.textContainer}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Black Banner */}
        <BlackBanner
          header="Broadcasters"
          subtitle="Connecting to public broadcasters"
          icon={require("../../assets/images/Ellipse 207.svg")}
        />

        <View style={styles.manageContainer}>
          <View style={styles.textContainer}>
            <Text style={styles.title2}>MANAGE</Text>
          </View>
        </View>

        {/* Additional Black Banners */}
        <BlackBanner
          header="Wallets"
          subtitle="Manage your available wallets"
          icon={require("../../assets/images/_.svg")}
          onPress={() => setShowWalletOverlay(true)}
        />

        <BlackBanner
          header="Pending balances"
          subtitle="View pending shields and other balances"
          icon={require("../../assets/images/_.svg")}
          onPress={() => setShowPendingBalances(true)}
        />

        <BlackBanner
          header="Networks & RPCs"
          subtitle="Customize network RPCs"
          icon={require("../../assets/images/_.svg")}
          onPress={() => setShowNetworksRPCs(true)}
        />

        <BlackBanner
          header="Address Book"
          subtitle="Manage saved addresses"
          icon={require("../../assets/images/_.svg")}
          onPress={() => setShowAddressBook(true)}
        />

        <BlackBanner
          header="Default Settings"
          subtitle="Set currency for balances"
          icon={require("../../assets/images/_.svg")}
        />

        {/* <BlackBanner
          header="Set PIN"
          subtitle="Secure your wallets with a PIN"
          icon={require("../../assets/images/_.svg")}
        /> */}

        <BlackBanner
          header="Sync Private Data"
          subtitle="Update commitment spent status from blockchain"
          icon={require("../../assets/images/_.svg")}
          onPress={handleSyncPrivateData}
        />

        <BlackBanner
          header="🚨 Emergency Withdraw"
          subtitle="Withdraw ALL private funds to public wallet"
          icon={require("../../assets/images/_.svg")}
          onPress={() => router.push("/emergency-withdraw")}
        />

        {/* <BlackBanner
          header="Clear Private Data"
          subtitle="⚠️ DANGER: Delete all commitments permanently"
          icon={require("../../assets/images/_.svg")}
          onPress={handleClearPrivateData}
        /> */}

        {/* <BlackBanner
          header="Clear ALL App Data"
          subtitle="🚨 Nuclear option: Clear everything (for new contract)"
          icon={require("../../assets/images/_.svg")}
          onPress={handleClearAllAppData}
        /> */}

        {/* HELP Section */}
        <View style={styles.helpContainer}>
          <View style={styles.textContainer}>
            <Text style={styles.helpTitle}>HELP</Text>
          </View>
        </View>

        {/* Help Black Banners */}
        <BlackBanner
          header="Support"
          subtitle="Get help and contact support"
          icon={require("../../assets/images/_.svg")}
        />

        <BlackBanner
          header="FAQ"
          subtitle="Frequently asked questions"
          icon={require("../../assets/images/_.svg")}
        />

        <BlackBanner
          header="Documentation"
          subtitle="User guides and tutorials"
          icon={require("../../assets/images/_.svg")}
        />

        {/* Bottom spacer to ensure scrollable content */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Wallet Page - Slides in on top of settings */}
      {showWalletOverlay && (
        <WalletPage onBack={() => setShowWalletOverlay(false)} />
      )}

      {/* Pending Balances - Slides in on top of settings */}
      {showPendingBalances && (
        <PendingBalances onBack={() => setShowPendingBalances(false)} />
      )}

      {/* Address Book - Slides in on top of settings */}
      {showAddressBook && (
        <AddressBook onBack={() => setShowAddressBook(false)} />
      )}

      {/* Networks & RPCs - Slides in on top of settings */}
      {showNetworksRPCs && (
        <NetworksRPCs onBack={() => setShowNetworksRPCs(false)} />
      )}

      {/* Loading overlay during sync */}
      {isSyncing && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Syncing with blockchain...</Text>
            <Text style={styles.loadingSubtext}>This may take a moment</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    zIndex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: screenWidth * 0.05,
    paddingTop: screenHeight * 0.02,
    paddingBottom: 0,
  },
  appName: {
    fontSize: Math.max(24, screenWidth * 0.06),
    fontWeight: "bold",
    color: "#000000",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: screenWidth * 0.05,
  },
  content: {
    padding: screenWidth * 0.05,
  },
  manageContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  helpContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  textContainer: {
    marginTop: 0,
  },
  title: {
    fontSize: Math.max(28, screenWidth * 0.07),
    fontWeight: "bold",
    color: "#333333",
    textAlign: "left",
    paddingBottom: screenHeight * 0.01,
  },
  title2: {
    fontSize: Math.max(22, screenWidth * 0.05),
    fontWeight: "bold",
    color: "#333333",
    textAlign: "left",
    paddingBottom: screenHeight * 0.01,
  },
  helpTitle: {
    fontSize: Math.max(22, screenWidth * 0.05),
    fontWeight: "bold",
    color: "#333333",
    textAlign: "left",
    paddingBottom: screenHeight * 0.01,
  },
  bottomSpacer: {
    height: screenHeight * 0.1,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  loadingContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#333333",
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#666666",
  },
});
