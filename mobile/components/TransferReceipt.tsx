import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Share,
  Alert,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

const { width: screenWidth } = Dimensions.get("window");

interface TransferReceiptProps {
  type: "send" | "receive" | "private-transfer";
  transactionHash?: string;
  from: string;
  to: string;
  amount: string;
  token: string;
  timestamp: number;
  isPrivate?: boolean;
  onClose: () => void;
}

export default function TransferReceipt({
  type,
  transactionHash,
  from,
  to,
  amount,
  token,
  timestamp,
  isPrivate = false,
  onClose,
}: TransferReceiptProps) {
  // Format the QR data
  const qrData = JSON.stringify({
    type,
    hash: transactionHash,
    from,
    to,
    amount,
    token,
    timestamp,
    isPrivate,
  });

  // Format timestamp
  const formatDate = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Truncate address
  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(38)}`;
  };

  // Get title based on type
  const getTitle = () => {
    switch (type) {
      case "send":
        return isPrivate ? "Private Transfer Sent" : "Transfer Sent";
      case "receive":
        return isPrivate ? "Private Transfer Received" : "Transfer Received";
      case "private-transfer":
        return "Private Transfer";
      default:
        return "Transfer Receipt";
    }
  };

  // Get icon based on type
  const getIcon = () => {
    if (isPrivate) return "🛡️";
    switch (type) {
      case "send":
        return "📤";
      case "receive":
        return "📥";
      default:
        return "💸";
    }
  };

  // Share receipt
  const handleShare = async () => {
    try {
      console.log("📤 Sharing receipt...");
      const message = `${getTitle()}\n\n` +
        `Amount: ${amount} ${token}\n` +
        `From: ${from}\n` +
        `To: ${to}\n` +
        `Date: ${formatDate(timestamp)}\n` +
        (transactionHash ? `Transaction: ${transactionHash}\n` : "") +
        (isPrivate ? `\nThis was a private transfer using Veilon's zero-knowledge privacy protocol.\n` : "") +
        `\nView on Sepolia: https://sepolia.etherscan.io/tx/${transactionHash || "pending"}`;

      const result = await Share.share({
        message,
        title: getTitle(),
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log(`✅ Shared via ${result.activityType}`);
        } else {
          console.log("✅ Receipt shared successfully");
        }
      } else if (result.action === Share.dismissedAction) {
        console.log("❌ Share dismissed");
      }
    } catch (error: any) {
      console.error("❌ Error sharing receipt:", error);
      Alert.alert(
        "Share Failed",
        "Unable to share receipt. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with Close Button */}
      <View style={styles.topBar}>
        <Pressable onPress={onClose} style={styles.backButton}>
          <Text style={styles.backIcon}>✕</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>Receipt</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Success Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>{getIcon()}</Text>
        <Text style={styles.headerTitle}>{getTitle()}</Text>
        {isPrivate && (
          <View style={styles.privateBadge}>
            <Text style={styles.privateBadgeText}>PRIVATE</Text>
          </View>
        )}
      </View>

      {/* QR Code */}
      <View style={styles.qrContainer}>
        <View style={styles.qrWrapper}>
          <QRCode
            value={qrData}
            size={screenWidth * 0.5}
            backgroundColor="white"
            color="black"
          />
        </View>
        <Text style={styles.qrLabel}>Scan to verify transaction</Text>
      </View>

      {/* Transaction Details */}
      <View style={styles.detailsContainer}>
        {/* Amount */}
        <View style={styles.amountSection}>
          <Text style={styles.amountLabel}>Amount</Text>
          <Text style={styles.amountValue}>
            {amount} {token}
          </Text>
        </View>

        {/* Details */}
        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>From:</Text>
            <Text style={styles.detailValue}>{truncateAddress(from)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>To:</Text>
            <Text style={styles.detailValue}>{truncateAddress(to)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date:</Text>
            <Text style={styles.detailValue}>{formatDate(timestamp)}</Text>
          </View>

          {transactionHash && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tx Hash:</Text>
              <Text style={styles.detailValue}>
                {truncateAddress(transactionHash)}
              </Text>
            </View>
          )}

          {isPrivate && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Privacy:</Text>
              <Text style={styles.detailValuePrivate}>
                Zero-Knowledge Proof
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Done</Text>
        </Pressable>

        <Pressable style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareButtonIcon}>📤</Text>
          <Text style={styles.shareButtonText}>Share Receipt</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: screenWidth * 0.05,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
  },
  backIcon: {
    fontSize: 20,
    color: "#000000",
    fontWeight: "600",
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666666",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 8,
  },
  privateBadge: {
    backgroundColor: "#B39DDB",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  privateBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  qrContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  qrWrapper: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrLabel: {
    marginTop: 16,
    fontSize: 14,
    color: "#666666",
  },
  detailsContainer: {
    marginBottom: 32,
  },
  amountSection: {
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  amountLabel: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#000000",
  },
  detailsSection: {
    gap: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 14,
    color: "#666666",
  },
  detailValue: {
    fontSize: 14,
    color: "#000000",
    fontWeight: "600",
  },
  detailValuePrivate: {
    fontSize: 14,
    color: "#B39DDB",
    fontWeight: "600",
  },
  actionsContainer: {
    gap: 12,
  },
  closeButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingVertical: 16,
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F0F0",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  shareButtonIcon: {
    fontSize: 20,
  },
  shareButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
  },
});
