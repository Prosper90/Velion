import { useRouter } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
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
import { Image } from 'expo-image';
import { useWalletStore } from "../stores/walletStore";
import { commitmentStoreRN } from "../utils/commitment-store-rn";
import { parseTransferNote } from "../utils/transfer-note";
import * as Clipboard from 'expo-clipboard';
import { ethers } from 'ethers';

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function ImportTransferNote() {
  const router = useRouter();
  const [noteText, setNoteText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const activeWallet = useWalletStore((state) => state.getActiveWallet());
  const refreshBalances = useWalletStore((state) => state.refreshBalances);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setNoteText(text);
      } else {
        Alert.alert("Clipboard Empty", "No text found in clipboard");
      }
    } catch (error) {
      console.error("Failed to paste:", error);
      Alert.alert("Error", "Failed to paste from clipboard");
    }
  };

  const handleImport = async () => {
    try {
      if (!noteText.trim()) {
        Alert.alert("Empty Note", "Please paste a transfer note");
        return;
      }

      if (!activeWallet?.address) {
        Alert.alert("No Wallet", "Please create or import a wallet first");
        return;
      }

      setIsImporting(true);

      console.log("📝 Parsing transfer note...");

      // Parse the transfer note
      const parsed = parseTransferNote(noteText.trim());

      if (!parsed.isValid || !parsed.data) {
        Alert.alert("Invalid Note", parsed.error || "This transfer note is invalid");
        setIsImporting(false);
        return;
      }

      const { amount, secret, nullifier, randomness, commitment, token } = parsed.data;

      console.log("✅ Transfer note valid!");
      console.log(`💰 Amount: ${amount} ${token}`);

      // Get decimals for the token
      const decimals = token === 'USDC' || token === 'USDT' ? 6 : 18;

      // Check if commitment already exists (prevent double-importing)
      const existingCommitments = await commitmentStoreRN.getAllCommitments(activeWallet.address);
      const alreadyImported = existingCommitments.some(c => c.commitment === commitment);

      if (alreadyImported) {
        Alert.alert(
          "Already Imported",
          "You have already imported this transfer note"
        );
        setIsImporting(false);
        return;
      }

      // Store commitment locally
      await commitmentStoreRN.addCommitment(activeWallet.address, {
        commitment,
        secret,
        nullifier,
        randomness,
        amount: ethers.parseUnits(amount, decimals).toString(), // Convert to smallest unit (Wei for ETH, etc.)
        token: token || 'ETH',
        tokenAddress: token === 'ETH' ? ethers.ZeroAddress : undefined,
        timestamp: Date.now(),
        spent: false,
      });

      console.log("✅ Commitment added to local storage!");

      // Refresh balances
      await refreshBalances(activeWallet.address);

      setIsImporting(false);

      // Show success message
      Alert.alert(
        "✅ Transfer Received!",
        `${amount} ${token} has been added to your private balance.\n\nYou can now:\n• Keep it shielded\n• Unshield to your public wallet\n• Transfer to someone else`,
        [
          {
            text: "View Balance",
            onPress: () => router.replace("/(tabs)/home"),
          },
        ]
      );

    } catch (error: any) {
      console.error("❌ Import failed:", error);
      Alert.alert(
        "Import Failed",
        error.message || "Failed to import transfer note"
      );
      setIsImporting(false);
    }
  };

  const handleScanQR = () => {
    Alert.alert(
      "QR Scanner",
      "QR code scanning will be implemented soon. For now, please paste the transfer note manually.",
      [{ text: "OK" }]
    );
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.backgroundContainer}>
        <Image
          source={require('../assets/images/Group 1334.svg')}
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
            <Text style={styles.headerTitle}>Import Transfer</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <View style={styles.infoBannerIcon}>
              <Text style={styles.iconEmoji}>📥</Text>
            </View>
            <View style={styles.infoBannerContent}>
              <Text style={styles.infoBannerTitle}>Receive Private Transfer</Text>
              <Text style={styles.infoBannerText}>
                Import a transfer note to claim funds sent to you privately.
                The transfer note contains encrypted information that only you
                can use to access the funds.
              </Text>
            </View>
          </View>

          {/* Transfer Note Input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Transfer Note</Text>
            <View style={styles.noteInputContainer}>
              <TextInput
                style={styles.noteInput}
                placeholder="Paste transfer note here...
veilon://transfer?v=1&a=0.1&..."
                placeholderTextColor="#CCCCCC"
                value={noteText}
                onChangeText={setNoteText}
                multiline
                numberOfLines={6}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <Pressable
                style={[styles.actionButton, styles.pasteButton]}
                onPress={handlePaste}
              >
                <Text style={styles.actionIcon}>📋</Text>
                <Text style={styles.actionButtonText}>Paste</Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, styles.scanButton]}
                onPress={handleScanQR}
              >
                <Text style={styles.actionIcon}>📷</Text>
                <Text style={styles.actionButtonText}>Scan QR</Text>
              </Pressable>
            </View>
          </View>

          {/* Instructions */}
          <View style={styles.instructions}>
            <Text style={styles.instructionsTitle}>How it works:</Text>
            <Text style={styles.instructionsText}>
              1. Get transfer note from sender{'\n'}
              2. Paste it in the box above{'\n'}
              3. Click "Import Note"{'\n'}
              4. Funds added to your private balance!{'\n'}
              {'\n'}
              The sender should have shared the note via:
              • Secure messaging app (WhatsApp, Signal){'\n'}
              • Email (encrypted){'\n'}
              • In person (QR code)
            </Text>
          </View>

          {/* Import Button */}
          <Pressable
            style={[
              styles.importButton,
              noteText.trim() ? styles.importButtonActive : styles.importButtonDisabled,
            ]}
            onPress={handleImport}
            disabled={isImporting || !noteText.trim()}
          >
            {isImporting ? (
              <View style={styles.importButtonContent}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={[styles.importButtonText, styles.importButtonTextLoading]}>
                  Importing...
                </Text>
              </View>
            ) : (
              <Text style={styles.importButtonText}>Import Note</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backgroundContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
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
  placeholder: {
    width: 40,
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
  iconEmoji: {
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
  noteInputContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: screenWidth * 0.04,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    marginBottom: 12,
  },
  noteInput: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#000000",
    minHeight: 120,
    textAlignVertical: "top",
    fontFamily: 'monospace',
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  pasteButton: {
    backgroundColor: "#F5F0FF",
    borderWidth: 1,
    borderColor: "#B39DDB",
  },
  scanButton: {
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  actionIcon: {
    fontSize: 18,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
  },
  instructions: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.03,
  },
  instructionsTitle: {
    fontSize: Math.max(14, screenWidth * 0.035),
    fontWeight: "700",
    color: "#000000",
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: Math.max(13, screenWidth * 0.033),
    color: "#666666",
    lineHeight: 20,
  },
  importButton: {
    borderRadius: 12,
    paddingVertical: screenHeight * 0.02,
    alignItems: "center",
    marginBottom: screenHeight * 0.03,
  },
  importButtonActive: {
    backgroundColor: "#B39DDB",
  },
  importButtonDisabled: {
    backgroundColor: "#B39DDB",
    opacity: 0.5,
  },
  importButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  importButtonText: {
    color: "#FFFFFF",
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "700",
  },
  importButtonTextLoading: {
    marginLeft: 8,
  },
});
