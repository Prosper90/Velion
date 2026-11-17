import React from "react";
import { Modal, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import TransferReceipt from "./TransferReceipt";

interface TransferReceiptModalProps {
  visible: boolean;
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

export default function TransferReceiptModal({
  visible,
  type,
  transactionHash,
  from,
  to,
  amount,
  token,
  timestamp,
  isPrivate = false,
  onClose,
}: TransferReceiptModalProps) {
  // Don't render Modal at all when not visible (Android fix)
  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <TransferReceipt
          type={type}
          transactionHash={transactionHash}
          from={from}
          to={to}
          amount={amount}
          token={token}
          timestamp={timestamp}
          isPrivate={isPrivate}
          onClose={onClose}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});
