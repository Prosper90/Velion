import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWalletStore } from "../stores/walletStore";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { parseTransferNote } from "../utils/transfer-note";
import { commitmentStoreRN } from "../utils/commitment-store-rn";
import { ethers } from "ethers";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function Receive() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const token = params.token as string || "ETH";
  const [isPrivate, setIsPrivate] = useState(false);
  const [transferNote, setTransferNote] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const activeWallet = useWalletStore((state) => state.getActiveWallet());

  // Get addresses
  const publicAddress = activeWallet?.address || "";

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (!isPrivate) {
      await Clipboard.setStringAsync(publicAddress);
      Alert.alert("Copied!", "Public address copied to clipboard");
    }
  };

  // Handle paste transfer note from clipboard
  const handlePaste = async () => {
    try {
      const clipboardContent = await Clipboard.getStringAsync();
      if (clipboardContent) {
        setTransferNote(clipboardContent);
      }
    } catch (error) {
      console.error('Failed to paste:', error);
    }
  };

  // Import transfer note and add to private balance
  const handleImportNote = async () => {
    if (!transferNote || !activeWallet) {
      Alert.alert("Error", "Please enter a transfer note");
      return;
    }

    try {
      setIsImporting(true);

      // Parse the transfer note
      const parsed = parseTransferNote(transferNote);

      console.log('📝 Parsed transfer note:', parsed);

      // Check if parsing was successful
      if (!parsed.isValid || !parsed.data) {
        throw new Error(parsed.error || "Invalid transfer note format");
      }

      const { amount, secret, nullifier, randomness, commitment, token } = parsed.data;

      // Check if this commitment already exists (prevent duplicates)
      const existingCommitments = await commitmentStoreRN.getCommitments(activeWallet.address);
      const duplicate = existingCommitments.find(c => c.commitment === commitment);

      if (duplicate) {
        throw new Error("This transfer note has already been imported");
      }

      // Calculate amount in wei for storage
      const amountWei = ethers.parseEther(amount).toString();

      console.log(`💰 Importing commitment: ${amount} ${token || 'ETH'} (${amountWei} wei)`);

      // Store as new commitment in local storage
      await commitmentStoreRN.addCommitment(activeWallet.address, {
        commitment: commitment,
        secret: secret,
        nullifier: nullifier,
        randomness: randomness,
        amount: amountWei,
        token: token || 'ETH',
        spent: false,
        timestamp: Date.now(),
        leafIndex: 0, // Dummy value - not used for imported commitments
        blockNumber: 0, // Dummy value
        txHash: 'imported', // Mark as imported
      });

      console.log('✅ Commitment imported successfully!');

      Alert.alert(
        "Success!",
        `${amount} ${token || 'ETH'} has been added to your private balance`,
        [
          {
            text: "OK",
            onPress: () => {
              setTransferNote("");
              router.back();
            }
          }
        ]
      );

    } catch (error: any) {
      console.error('Failed to import transfer note:', error);
      Alert.alert(
        "Import Failed",
        error.message || "Invalid transfer note format"
      );
    } finally {
      setIsImporting(false);
    }
  };

  // Truncate address for display
  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Receive {token}</Text>
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
          <Text style={styles.infoBannerIcon}>{isPrivate ? "🛡️" : "📥"}</Text>
          <View style={styles.infoBannerContent}>
            <Text style={styles.infoBannerTitle}>
              {isPrivate ? "Import Transfer Note" : "Public Address"}
            </Text>
            <Text style={styles.infoBannerText}>
              {isPrivate
                ? "Paste the transfer note you received from the sender. The funds will be added to your private balance."
                : "Share this address to receive public transfers. Transactions will be visible on the blockchain."}
            </Text>
          </View>
        </View>

        {/* Conditional Content: QR Code for Public, Transfer Note Input for Private */}
        {!isPrivate ? (
          <>
            {/* QR Code */}
            <View style={styles.qrSection}>
              <View style={styles.qrWrapper}>
                <QRCode
                  value={publicAddress || "No address"}
                  size={screenWidth * 0.6}
                  backgroundColor="white"
                  color="black"
                />
              </View>
              <Text style={styles.qrLabel}>
                Scan QR code to receive public {token}
              </Text>
            </View>

            {/* Address Display */}
            <View style={styles.addressSection}>
              <Text style={styles.addressLabel}>Public Address</Text>
              <View style={styles.addressContainer}>
                <View style={styles.addressBox}>
                  <Text style={styles.addressText}>{publicAddress || "No address available"}</Text>
                </View>
                <Pressable style={styles.copyButton} onPress={handleCopy}>
                  <Text style={styles.copyButtonIcon}>📋</Text>
                  <Text style={styles.copyButtonText}>Copy</Text>
                </Pressable>
              </View>

              {/* Truncated Display */}
              <View style={styles.truncatedDisplay}>
                <Text style={styles.truncatedText}>
                  {truncateAddress(publicAddress)}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Transfer Note Input */}
            <View style={styles.transferNoteSection}>
              <Text style={styles.transferNoteLabel}>Transfer Note</Text>
              <TextInput
                style={styles.transferNoteInput}
                placeholder="Paste transfer note here..."
                placeholderTextColor="#999999"
                value={transferNote}
                onChangeText={setTransferNote}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              {/* Paste and Import Buttons */}
              <View style={styles.noteActions}>
                <Pressable
                  style={[styles.noteActionButton, styles.pasteButton]}
                  onPress={handlePaste}
                >
                  <Text style={styles.noteActionIcon}>📋</Text>
                  <Text style={styles.noteActionText}>Paste</Text>
                </Pressable>

                <Pressable
                  style={[styles.noteActionButton, styles.importButton]}
                  onPress={handleImportNote}
                  disabled={isImporting || !transferNote}
                >
                  {isImporting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text style={styles.noteActionIcon}>✅</Text>
                      <Text style={[styles.noteActionText, { color: "#FFFFFF" }]}>Import</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* Instructions */}
        <View style={styles.instructionsSection}>
          <Text style={styles.instructionsTitle}>
            How to receive {isPrivate ? "private" : "public"} {token}
          </Text>
          <View style={styles.instructionsList}>
            {!isPrivate ? (
              <>
                <View style={styles.instructionItem}>
                  <Text style={styles.instructionNumber}>1</Text>
                  <Text style={styles.instructionText}>
                    Share your public address or QR code with the sender
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={styles.instructionNumber}>2</Text>
                  <Text style={styles.instructionText}>
                    Wait for the sender to complete the transaction
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={styles.instructionNumber}>3</Text>
                  <Text style={styles.instructionText}>
                    Funds will appear in your public balance
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.instructionItem}>
                  <Text style={styles.instructionNumber}>1</Text>
                  <Text style={styles.instructionText}>
                    Sender creates a private transfer and shares the transfer note with you
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={styles.instructionNumber}>2</Text>
                  <Text style={styles.instructionText}>
                    Copy the transfer note they sent you
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={styles.instructionNumber}>3</Text>
                  <Text style={styles.instructionText}>
                    Paste it above and click "Import"
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={styles.instructionNumber}>4</Text>
                  <Text style={styles.instructionText}>
                    Funds will be added to your private balance!
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>
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
  },
  scrollContent: {
    paddingHorizontal: screenWidth * 0.05,
    paddingBottom: screenHeight * 0.05,
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
    fontSize: 24,
    marginRight: 12,
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
  qrSection: {
    alignItems: "center",
    marginBottom: screenHeight * 0.04,
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
    marginBottom: 16,
  },
  qrLabel: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
  },
  addressSection: {
    marginBottom: screenHeight * 0.03,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 12,
  },
  addressContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  addressBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: screenWidth * 0.04,
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  addressText: {
    fontSize: 12,
    color: "#000000",
    fontFamily: "monospace",
  },
  copyButton: {
    backgroundColor: "#000000",
    borderRadius: 12,
    paddingHorizontal: screenWidth * 0.04,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 80,
  },
  copyButtonIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  copyButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  truncatedDisplay: {
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  truncatedText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "monospace",
  },
  warningBanner: {
    flexDirection: "row",
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.03,
    borderLeftWidth: 4,
    borderLeftColor: "#FF9800",
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: "#E65100",
    lineHeight: 20,
  },
  instructionsSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: screenWidth * 0.05,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 16,
  },
  instructionsList: {
    gap: 16,
  },
  instructionItem: {
    flexDirection: "row",
    gap: 12,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    backgroundColor: "#000000",
    borderRadius: 14,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 28,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: "#666666",
    lineHeight: 20,
  },
  transferNoteSection: {
    marginBottom: screenHeight * 0.03,
  },
  transferNoteLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 12,
  },
  transferNoteInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: screenWidth * 0.04,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    fontSize: 12,
    color: "#000000",
    fontFamily: "monospace",
    minHeight: 120,
    marginBottom: 12,
  },
  noteActions: {
    flexDirection: "row",
    gap: 12,
  },
  noteActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  pasteButton: {
    backgroundColor: "#F5F0FF",
    borderWidth: 1,
    borderColor: "#B39DDB",
  },
  importButton: {
    backgroundColor: "#000000",
  },
  noteActionIcon: {
    fontSize: 18,
  },
  noteActionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
  },
});
