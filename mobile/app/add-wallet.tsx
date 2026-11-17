import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useWalletStore } from "../stores/walletStore";
import { useSecurityStore } from "../stores/securityStore";
import * as Clipboard from "expo-clipboard";
import { useCustomAlert } from "../hooks/useCustomAlert";
import CustomAlert from "../components/CustomAlert";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function AddWallet() {
  const router = useRouter();
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const createWallet = useWalletStore((state) => state.createWallet);
  const importWallet = useWalletStore((state) => state.importWallet);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [mode, setMode] = useState<"choose" | "create" | "confirm" | "import">(
    "choose"
  );
  const [loading, setLoading] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState<"mnemonic" | "privatekey">(
    "mnemonic"
  );
  const [generatedMnemonic, setGeneratedMnemonic] = useState("");
  const [verificationWords, setVerificationWords] = useState<
    Array<{ index: number; word: string }>
  >([]);
  const [userAnswers, setUserAnswers] = useState<string[]>(["", "", ""]);

  // Fade in animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleCreateWallet = async () => {
    try {
      setLoading(true);
      const mnemonic = await createWallet();
      setGeneratedMnemonic(mnemonic);
      setMode("create");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create wallet");
    } finally {
      setLoading(false);
    }
  };

  const handleImportWallet = async () => {
    if (!importText.trim()) {
      // Alert.alert("Error", "Please enter your private key or recovery phrase");
      showAlert({
        type: "warning",
        title: "Enter proper  details",
        message: "Please enter your private key or recovery phrase",
        actions: [{ text: "OK", style: "primary" }],
      });
      return;
    }

    try {
      setLoading(true);
      await importWallet(importText.trim());

      // Check if PIN is already set
      const { isPinSet } = useSecurityStore.getState();

      // Alert.alert("Success", "Wallet imported successfully!", [
      //   {
      //     text: "OK",
      //     onPress: () => {
      //       if (isPinSet) {
      //         router.replace("/(tabs)/home");
      //       } else {
      //         router.push("/onboarding/setup-pin");
      //       }
      //     }
      //   },
      // ]);

      showAlert({
        type: "success",
        title: "Wallet",
        message: `Wallet imported successfully!`,
        actions: [
          {
            text: "OK",
            style: "default",
            onPress: () => {
              if (isPinSet) {
                router.replace("/(tabs)/home");
              } else {
                router.push("/onboarding/setup-pin");
              }
            },
          },
        ],
      });
    } catch (error: any) {
      // Alert.alert("Error", error.message || "Failed to import wallet");
      showAlert({
        type: "error",
        title: "Something went wrong",
        message: error.message || "Failed to import wallet",
        actions: [{ text: "OK", style: "primary" }],
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(generatedMnemonic);
    // Alert.alert("Copied!", "Recovery phrase copied to clipboard");
    showAlert({
      type: "success",
      title: "Copied",
      message: `Recovery phrase copied to clipboard`,
    });
  };

  const proceedToConfirmation = () => {
    // Select 3 random words for verification
    const words = generatedMnemonic.split(" ");
    const randomIndices: number[] = [];

    while (randomIndices.length < 3) {
      const randomIndex = Math.floor(Math.random() * words.length);
      if (!randomIndices.includes(randomIndex)) {
        randomIndices.push(randomIndex);
      }
    }

    randomIndices.sort((a, b) => a - b);

    const wordsToVerify = randomIndices.map((index) => ({
      index: index + 1,
      word: words[index],
    }));

    setVerificationWords(wordsToVerify);
    setUserAnswers(["", "", ""]);
    setMode("confirm");
  };

  const verifyAndComplete = () => {
    // Check if all answers are correct
    const allCorrect = verificationWords.every(
      (item, idx) =>
        userAnswers[idx].trim().toLowerCase() === item.word.toLowerCase()
    );

    if (!allCorrect) {
      // Alert.alert(
      //   "Incorrect",
      //   "One or more words don't match. Please try again.",
      //   [{ text: "OK" }]
      // );
      showAlert({
        type: "warning",
        title: "Incorrect",
        message: "One or more words don't match. Please try again.",
        actions: [{ text: "OK", style: "primary" }],
      });
      return;
    }

    // Check if PIN is already set
    const { isPinSet } = useSecurityStore.getState();

    // All correct! Navigate to PIN setup or home
    // Alert.alert("Success!", "Your wallet has been created successfully!", [
    //   {
    //     text: "Continue",
    //     onPress: () => {
    //       if (isPinSet) {
    //         router.replace("/(tabs)/home");
    //       } else {
    //         router.push("/onboarding/setup-pin");
    //       }
    //     },
    //   },
    // ]);

    showAlert({
      type: "success",
      title: "Wallet",
      message: `Your wallet has been created successfully!`,
      actions: [
        {
          text: "Continue",
          style: "default",
          onPress: () => {
            if (isPinSet) {
              router.replace("/(tabs)/home");
            } else {
              router.push("/onboarding/setup-pin");
            }
          },
        },
      ],
    });
  };

  // Choose Mode Screen
  if (mode === "choose") {
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
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Add Wallet</Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.subtitle}>Choose how to add your wallet</Text>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleCreateWallet}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.optionIcon}>+</Text>
                  <Text style={styles.optionTitle}>Create New Wallet</Text>
                  <Text style={styles.optionDesc}>
                    Generate a new wallet with a 12-word recovery phrase
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionButton, styles.secondaryButton]}
              onPress={() => setMode("import")}
              disabled={loading}
            >
              <Text style={styles.optionIcon}>📥</Text>
              <Text style={styles.optionTitle}>Import Wallet</Text>
              <Text style={styles.optionDesc}>
                Import an existing wallet using private key or recovery phrase
              </Text>
            </TouchableOpacity>
          </View>

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

  // Create Wallet Screen (Show Mnemonic)
  if (mode === "create" && generatedMnemonic) {
    const words = generatedMnemonic.split(" ");

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                setMode("choose");
                setGeneratedMnemonic("");
              }}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Backup Recovery Phrase</Text>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>⚠️ IMPORTANT</Text>
            <Text style={styles.warningText}>
              Write down these 12 words in order and keep them safe. This is the
              ONLY way to recover your wallet!
            </Text>
            <Text style={styles.warningText}>
              • Never share your recovery phrase
            </Text>
            <Text style={styles.warningText}>
              • Store it offline in a secure location
            </Text>
            <Text style={styles.warningText}>
              • If you lose it, you lose access to your funds
            </Text>
          </View>

          <View style={styles.mnemonicContainer}>
            {words.map((word, index) => (
              <View key={index} style={styles.mnemonicItem}>
                <Text style={styles.mnemonicIndex}>{index + 1}</Text>
                <Text style={styles.mnemonicWord}>{word}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
            <Text style={styles.copyButtonText}>📋 Copy to Clipboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={proceedToConfirmation}
          >
            <Text style={styles.continueButtonText}>
              Continue to Verification
            </Text>
          </TouchableOpacity>

          <CustomAlert
            visible={alertState.visible}
            type={alertState.type}
            title={alertState.title}
            message={alertState.message}
            actions={alertState.actions}
            onClose={hideAlert}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Confirmation Screen (Verify 3 words)
  if (mode === "confirm" && verificationWords.length === 3) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                setMode("create");
                setUserAnswers(["", "", ""]);
              }}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Verify Recovery Phrase</Text>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>🔒 Security Check</Text>
            <Text style={styles.warningText}>
              To ensure you've saved your recovery phrase, please enter the
              following words from your phrase:
            </Text>
          </View>

          {verificationWords.map((item, idx) => (
            <View key={idx} style={styles.verificationItem}>
              <Text style={styles.verificationLabel}>Word #{item.index}</Text>
              <TextInput
                style={styles.verificationInput}
                placeholder={`Enter word #${item.index}`}
                placeholderTextColor="#999"
                value={userAnswers[idx]}
                onChangeText={(text) => {
                  const newAnswers = [...userAnswers];
                  newAnswers[idx] = text;
                  setUserAnswers(newAnswers);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ))}

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 Tip: Enter the words exactly as shown in your recovery phrase.
              They are case-insensitive.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.continueButton,
              userAnswers.some((a) => !a.trim()) && styles.buttonDisabled,
            ]}
            onPress={verifyAndComplete}
            disabled={userAnswers.some((a) => !a.trim())}
          >
            <Text style={styles.continueButtonText}>Verify & Complete</Text>
          </TouchableOpacity>

          <CustomAlert
            visible={alertState.visible}
            type={alertState.type}
            title={alertState.title}
            message={alertState.message}
            actions={alertState.actions}
            onClose={hideAlert}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Import Wallet Screen
  if (mode === "import") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setMode("choose")}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Import Wallet</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.subtitle}>Choose import method</Text>

          {/* Import Method Selector */}
          <View style={styles.importMethodContainer}>
            <TouchableOpacity
              style={[
                styles.importMethodButton,
                importMode === "mnemonic" && styles.importMethodButtonActive,
              ]}
              onPress={() => setImportMode("mnemonic")}
            >
              <Text
                style={[
                  styles.importMethodText,
                  importMode === "mnemonic" && styles.importMethodTextActive,
                ]}
              >
                Recovery Phrase
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.importMethodButton,
                importMode === "privatekey" && styles.importMethodButtonActive,
              ]}
              onPress={() => setImportMode("privatekey")}
            >
              <Text
                style={[
                  styles.importMethodText,
                  importMode === "privatekey" && styles.importMethodTextActive,
                ]}
              >
                Private Key
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>
            {importMode === "mnemonic"
              ? "Recovery Phrase (12 or 24 words):"
              : "Private Key:"}
          </Text>
          <TextInput
            style={styles.textArea}
            multiline={importMode === "mnemonic"}
            numberOfLines={importMode === "mnemonic" ? 6 : 3}
            placeholder={
              importMode === "mnemonic"
                ? "Enter your 12 or 24-word recovery phrase..."
                : "Enter your private key (starts with 0x)..."
            }
            placeholderTextColor="#999"
            value={importText}
            onChangeText={setImportText}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={importMode === "privatekey"}
          />

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              {importMode === "mnemonic"
                ? "💡 Tip: Enter 12 or 24 words separated by spaces. Make sure they are in the correct order."
                : "💡 Tip: Your private key is a hexadecimal string starting with 0x. Keep it secure!"}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.importButton, loading && styles.buttonDisabled]}
            onPress={handleImportWallet}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.importButtonText}>Import Wallet</Text>
            )}
          </TouchableOpacity>

          <CustomAlert
            visible={alertState.visible}
            type={alertState.type}
            title={alertState.title}
            message={alertState.message}
            actions={alertState.actions}
            onClose={hideAlert}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  backgroundContainer: {
    position: "absolute",
    top: screenHeight * -0.235,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  backgroundImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  contentContainer: {
    flex: 1,
    zIndex: 2,
  },
  scrollContent: {
    padding: screenWidth * 0.05,
  },
  content: {
    flex: 1,
    padding: screenWidth * 0.05,
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: screenWidth * 0.05,
    paddingVertical: screenHeight * 0.02,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 18,
    color: "#4CAF50",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000000",
  },
  subtitle: {
    fontSize: 16,
    color: "#666666",
    marginBottom: 30,
    textAlign: "center",
  },
  optionButton: {
    backgroundColor: "#000000",
    padding: screenWidth * 0.05,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "center",
    minHeight: 140,
    justifyContent: "center",
  },
  secondaryButton: {
    backgroundColor: "#4CAF50",
  },
  optionIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  optionTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  optionDesc: {
    color: "#CCCCCC",
    fontSize: 14,
    textAlign: "center",
  },
  warningBox: {
    backgroundColor: "#FFF3CD",
    padding: screenWidth * 0.04,
    borderRadius: 12,
    marginVertical: 20,
    borderWidth: 2,
    borderColor: "#FFC107",
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#856404",
    marginBottom: 10,
  },
  warningText: {
    color: "#856404",
    fontSize: 14,
    marginBottom: 6,
  },
  mnemonicContainer: {
    backgroundColor: "#FFFFFF",
    padding: screenWidth * 0.04,
    borderRadius: 12,
    marginBottom: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  mnemonicItem: {
    width: "48%",
    backgroundColor: "#F5F5F5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  mnemonicIndex: {
    fontSize: 12,
    color: "#999999",
    marginRight: 8,
    minWidth: 20,
  },
  mnemonicWord: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
  },
  copyButton: {
    backgroundColor: "#2196F3",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  copyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  continueButton: {
    backgroundColor: "#4CAF50",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  importMethodContainer: {
    flexDirection: "row",
    backgroundColor: "#E0E0E0",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  importMethodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  importMethodButtonActive: {
    backgroundColor: "#4CAF50",
  },
  importMethodText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666666",
  },
  importMethodTextActive: {
    color: "#FFFFFF",
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 8,
    marginTop: 20,
  },
  textArea: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#000000",
    textAlignVertical: "top",
    minHeight: 150,
  },
  infoBox: {
    backgroundColor: "#E3F2FD",
    padding: screenWidth * 0.04,
    borderRadius: 12,
    marginVertical: 20,
  },
  infoText: {
    color: "#1976D2",
    fontSize: 14,
  },
  importButton: {
    backgroundColor: "#4CAF50",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  importButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  verificationItem: {
    marginBottom: 20,
  },
  verificationLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 8,
  },
  verificationInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#4CAF50",
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: "#000000",
    fontWeight: "600",
  },
});
