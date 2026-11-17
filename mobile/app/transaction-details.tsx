import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Linking,
  Share,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { transactionHistoryRN } from "../utils/transaction-history-rn";
import { useWalletStore } from "../stores/walletStore";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function TransactionDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const txHash = params.txHash as string;

  const activeWallet = useWalletStore((state) => state.getActiveWallet());
  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransaction();
  }, [txHash]);

  const loadTransaction = async () => {
    try {
      if (!activeWallet?.address) return;

      const allTxs = await transactionHistoryRN.getTransactions(
        activeWallet.address
      );
      const tx = allTxs.find((t) => t.hash === txHash);
      setTransaction(tx);
    } catch (error) {
      console.error("Failed to load transaction:", error);
    } finally {
      setLoading(false);
    }
  };

  const openInExplorer = () => {
    if (transaction?.hash) {
      const explorerUrl = `https://sepolia.etherscan.io/tx/${transaction.hash}`;
      Linking.openURL(explorerUrl);
    }
  };

  const handleShare = async () => {
    if (!transaction) return;

    try {
      console.log("📤 Sharing transaction details...");
      const typeConfig = getTypeConfig(transaction.type);
      const message =
        `${typeConfig.title}\n\n` +
        `Amount: ${transaction.amount} ${transaction.token || "ETH"}\n` +
        `Status: ${transaction.status}\n` +
        `Date: ${new Date(transaction.timestamp).toLocaleString()}\n` +
        (transaction.from ? `From: ${transaction.from}\n` : "") +
        (transaction.to ? `To: ${transaction.to}\n` : "") +
        `Transaction: ${transaction.hash}\n` +
        (transaction.isPrivate
          ? `\nThis was a private transfer using Veilon's zero-knowledge privacy protocol.\n`
          : "") +
        `\nView on Sepolia: https://sepolia.etherscan.io/tx/${transaction.hash}`;

      const result = await Share.share({
        message,
        title: typeConfig.title,
      });

      if (result.action === Share.sharedAction) {
        console.log("✅ Transaction shared successfully");
      }
    } catch (error: any) {
      console.error("❌ Error sharing transaction:", error);
      Alert.alert(
        "Share Failed",
        "Unable to share transaction. Please try again."
      );
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case "shield":
        return {
          icon: "🛡️",
          title: "Shield Transaction",
          color: "#4CAF50",
          bgColor: "#E8F5E9",
        };
      case "unshield":
        return {
          icon: "🔓",
          title: "Unshield Transaction",
          color: "#2196F3",
          bgColor: "#E3F2FD",
        };
      case "private_transfer":
        return {
          icon: "🔄",
          title: "Private Transfer",
          color: "#9C27B0",
          bgColor: "#F3E5F5",
        };
      case "public_transfer":
        return {
          icon: "📤",
          title: "Public Transfer",
          color: "#FF9800",
          bgColor: "#FFF3E0",
        };
      case "receive":
        return {
          icon: "📥",
          title: "Received",
          color: "#4CAF50",
          bgColor: "#E8F5E9",
        };
      default:
        return {
          icon: "📝",
          title: "Transaction",
          color: "#757575",
          bgColor: "#F5F5F5",
        };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "confirmed":
        return {
          text: "Confirmed",
          color: "#4CAF50",
          bgColor: "#E8F5E9",
        };
      case "pending":
        return {
          text: "Pending",
          color: "#FF9800",
          bgColor: "#FFF3E0",
        };
      case "failed":
        return {
          text: "Failed",
          color: "#F44336",
          bgColor: "#FFEBEE",
        };
      default:
        return {
          text: "Unknown",
          color: "#757575",
          bgColor: "#F5F5F5",
        };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading transaction...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!transaction) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Transaction Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Transaction not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const typeConfig = getTypeConfig(transaction.type);
  const statusConfig = getStatusConfig(transaction.status);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backgroundContainer}>
        <Image
          source={require("../assets/images/Group 1334.svg")}
          style={styles.backgroundImage}
          contentFit="cover"
        />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Transaction Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Transaction Type Banner */}
        <View
          style={[styles.typeBanner, { backgroundColor: typeConfig.bgColor }]}
        >
          <Text style={styles.typeIcon}>{typeConfig.icon}</Text>
          <Text style={[styles.typeTitle, { color: typeConfig.color }]}>
            {typeConfig.title}
          </Text>
        </View>

        {/* Amount Card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount</Text>
          <Text style={styles.amountValue}>
            {transaction.amount} {transaction.token || "ETH"}
          </Text>
          {transaction.isPrivate && (
            <View style={styles.privateBadge}>
              <Text style={styles.privateBadgeText}>🛡️ Private</Text>
            </View>
          )}
        </View>

        {/* Transaction Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Transaction Information</Text>

          {/* Status */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusConfig.bgColor },
              ]}
            >
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.text}
              </Text>
            </View>
          </View>

          {/* Date */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>
              {new Date(transaction.timestamp).toLocaleString()}
            </Text>
          </View>

          {/* From */}
          {transaction.from && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>From</Text>
              <Text style={styles.detailValueMono} numberOfLines={1}>
                {transaction.from}
              </Text>
            </View>
          )}

          {/* To */}
          {transaction.to && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>To</Text>
              <Text style={styles.detailValueMono} numberOfLines={1}>
                {transaction.to}
              </Text>
            </View>
          )}

          {/* Transaction Hash */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tx Hash</Text>
            <Text style={styles.detailValueMono} numberOfLines={1}>
              {transaction.hash}
            </Text>
          </View>

          {/* Commitment */}
          {transaction.commitment && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Commitment</Text>
              <Text style={styles.detailValueMono} numberOfLines={1}>
                {transaction.commitment}
              </Text>
            </View>
          )}

          {/* Nullifier */}
          {transaction.nullifier && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Nullifier</Text>
              <Text style={styles.detailValueMono} numberOfLines={1}>
                {transaction.nullifier}
              </Text>
            </View>
          )}

          {/* Memo */}
          {transaction.memo && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Memo</Text>
              <Text style={styles.detailValue}>{transaction.memo}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Pressable style={styles.actionButton} onPress={openInExplorer}>
            <Text style={styles.actionButtonIcon}>🔍</Text>
            <Text style={styles.actionButtonText}>View on Explorer</Text>
          </Pressable>

          <Pressable style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.actionButtonIcon}>📤</Text>
            <Text style={styles.shareButtonText}>Share Transaction</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: screenWidth * 0.05,
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
    fontSize: Math.max(18, screenWidth * 0.045),
    fontWeight: "700",
    color: "#000000",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenWidth * 0.05,
    paddingBottom: screenHeight * 0.03,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#666666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#F44336",
  },
  typeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  typeIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  typeTitle: {
    fontSize: Math.max(20, screenWidth * 0.05),
    fontWeight: "700",
  },
  amountCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  amountLabel: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
  },
  amountValue: {
    fontSize: Math.max(32, screenWidth * 0.08),
    fontWeight: "700",
    color: "#000000",
    marginBottom: 12,
  },
  privateBadge: {
    backgroundColor: "#F3E5F5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  privateBadgeText: {
    fontSize: 12,
    color: "#9C27B0",
    fontWeight: "600",
  },
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "700",
    color: "#000000",
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: "#666666",
    fontWeight: "600",
    width: "30%",
  },
  detailValue: {
    fontSize: 14,
    color: "#000000",
    flex: 1,
    textAlign: "right",
  },
  detailValueMono: {
    fontSize: 12,
    color: "#000000",
    fontFamily: "monospace",
    flex: 1,
    textAlign: "right",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonIcon: {
    fontSize: 20,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F0F0",
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  shareButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },
});
