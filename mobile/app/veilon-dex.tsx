import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function VeilOnDEXScreen() {
  const router = useRouter();
  const [selectedFromToken, setSelectedFromToken] = useState("ETH");
  const [selectedToToken, setSelectedToToken] = useState("USDT");
  const [isPrivate, setIsPrivate] = useState(true);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [slippage, setSlippage] = useState("0.6%");

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Area */}
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <Text style={styles.appName}>VeilOn DEX</Text>
            <Text style={styles.boldAppName}>VeilOn DEX</Text>
            <Text style={styles.subtitle}>
              Private and public DEX aggregator
            </Text>
          </View>
          <View style={styles.modeToggle}>
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
          </View>
        </View>

        {/* Private Mode Info Banner */}
        {isPrivate && (
          <View style={styles.infoBanner}>
            <View style={styles.infoBannerIcon}>
              <Text style={styles.shieldIcon}>🛡️</Text>
            </View>
            <Text style={styles.infoBannerText}>
              Private mode hides swap amounts and tokens from on-chain observers
            </Text>
          </View>
        )}

        {/* From Section */}
        <View style={styles.swapSection}>
          <Text style={styles.sectionLabel}>From</Text>
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputField}
                placeholder="0.00"
                placeholderTextColor="#CCCCCC"
                keyboardType="numeric"
                value={fromAmount}
                onChangeText={setFromAmount}
              />
              <Pressable style={styles.maxButton}>
                <Text style={styles.maxButtonText}>MAX</Text>
              </Pressable>
            </View>
            <View style={styles.tokenRow}>
              <Pressable
                style={styles.tokenButton}
                onPress={() => router.push("/token-selection")}
              >
                <Text style={styles.tokenButtonText}>{selectedFromToken}</Text>
                <Text style={styles.chevron}>▼</Text>
              </Pressable>
              <Text style={styles.balanceText}>Available: 1.2341 ETH</Text>
            </View>
          </View>
          {isPrivate && (
            <Text style={styles.walletTypeText}>(Private Wallet)</Text>
          )}
        </View>

        {/* Swap Direction Button */}
        <View style={styles.swapButtonContainer}>
          <Pressable style={styles.swapDirectionButton}>
            <Text style={styles.swapDirectionIcon}>↓</Text>
          </Pressable>
        </View>

        {/* To Section */}
        <View style={styles.swapSection}>
          <Text style={styles.sectionLabel}>To</Text>
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputField}
                placeholder="0.00"
                placeholderTextColor="#CCCCCC"
                keyboardType="numeric"
                value={toAmount}
                onChangeText={setToAmount}
              />
            </View>
            <View style={styles.tokenRow}>
              <Pressable
                style={styles.tokenButton}
                onPress={() => router.push("/token-selection")}
              >
                <Text style={styles.tokenButtonText}>{selectedToToken}</Text>
                <Text style={styles.chevron}>▼</Text>
              </Pressable>
              <Text style={styles.balanceText}>1 ETH = 2560.5000 USDT</Text>
            </View>
          </View>
        </View>

        {/* Slippage Tolerance */}
        <View style={styles.slippageSection}>
          <Text style={styles.slippageLabel}>Slippage Tolerance</Text>
          <View style={styles.slippageOptions}>
            {["0.1%", "0.6%", "1.0%", "2.0%"].map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.slippageButton,
                  slippage === option && styles.slippageButtonActive,
                ]}
                onPress={() => setSlippage(option)}
              >
                <Text
                  style={[
                    styles.slippageButtonText,
                    slippage === option && styles.slippageButtonTextActive,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Privacy Features Active */}
        {isPrivate && (
          <View style={styles.privacyFeatures}>
            <Text style={styles.privacyFeaturesTitle}>
              Privacy Features Active
            </Text>
            <View style={styles.featureItem}>
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.featureText}>Swap amounts hidden</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.featureText}>Token types encrypted</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.featureText}>MEV protection enabled</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.featureText}>Zero-knowledge proofs</Text>
            </View>
          </View>
        )}

        {/* Private Swap Button */}
        <Pressable style={styles.swapButton}>
          <Text style={styles.swapButtonText}>
            {isPrivate ? "Private Swap" : "Public Swap"}
          </Text>
        </Pressable>
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
    paddingHorizontal: screenWidth * 0.05,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: screenHeight * 0.02,
    paddingTop: screenHeight * 0.01,
  },
  titleSection: {
    flex: 1,
    paddingRight: 20,
  },
  appName: {
    fontSize: Math.max(24, screenWidth * 0.06),
    fontWeight: "bold",
    color: "#000000",
    marginBottom: screenHeight * 0.01,
  },
  boldAppName: {
    fontSize: Math.max(32, screenWidth * 0.08),
    fontWeight: "900",
    color: "#000000",
    marginBottom: 0,
  },
  subtitle: {
    fontSize: Math.max(16, screenWidth * 0.04),
    color: "#666666",
    fontWeight: "500",
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
    padding: 4,
  },
  toggleButton: {
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenHeight * 0.015,
    borderRadius: 16,
  },
  toggleButtonActive: {
    backgroundColor: "#000000",
  },
  toggleButtonText: {
    fontSize: Math.max(14, screenWidth * 0.035),
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
    marginBottom: screenHeight * 0.02,
    alignItems: "center",
  },
  infoBannerIcon: {
    marginRight: 12,
  },
  shieldIcon: {
    fontSize: 20,
  },
  infoBannerText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: Math.max(13, screenWidth * 0.033),
    lineHeight: 18,
  },
  swapSection: {
    marginBottom: screenHeight * 0.02,
  },
  sectionLabel: {
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "600",
    color: "#000000",
    marginBottom: 12,
  },
  inputContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: screenWidth * 0.04,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  inputField: {
    flex: 1,
    fontSize: Math.max(24, screenWidth * 0.06),
    color: "#000000",
    fontWeight: "500",
  },
  maxButton: {
    backgroundColor: "#000000",
    paddingHorizontal: screenWidth * 0.03,
    paddingVertical: screenHeight * 0.01,
    borderRadius: 8,
  },
  maxButtonText: {
    color: "#FFFFFF",
    fontSize: Math.max(12, screenWidth * 0.03),
    fontWeight: "600",
  },
  tokenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tokenButton: {
    backgroundColor: "#000000",
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenHeight * 0.015,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tokenButtonText: {
    color: "#FFFFFF",
    fontSize: Math.max(14, screenWidth * 0.035),
    fontWeight: "600",
  },
  chevron: {
    color: "#FFFFFF",
    fontSize: Math.max(12, screenWidth * 0.03),
    fontWeight: "bold",
  },
  balanceText: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#999999",
  },
  walletTypeText: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#9966FF",
    marginTop: 8,
    fontWeight: "500",
  },
  swapButtonContainer: {
    alignItems: "center",
    marginVertical: screenHeight * 0.01,
  },
  swapDirectionButton: {
    backgroundColor: "#000000",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  swapDirectionIcon: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  slippageSection: {
    marginBottom: screenHeight * 0.02,
  },
  slippageLabel: {
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "600",
    color: "#000000",
    marginBottom: 12,
  },
  slippageOptions: {
    flexDirection: "row",
    gap: 12,
  },
  slippageButton: {
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenHeight * 0.015,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  slippageButtonActive: {
    backgroundColor: "#000000",
    borderColor: "#000000",
  },
  slippageButtonText: {
    fontSize: Math.max(14, screenWidth * 0.035),
    fontWeight: "600",
    color: "#666666",
  },
  slippageButtonTextActive: {
    color: "#FFFFFF",
  },
  privacyFeatures: {
    marginBottom: screenHeight * 0.02,
  },
  privacyFeaturesTitle: {
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "600",
    color: "#000000",
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  checkmark: {
    color: "#4CAF50",
    fontSize: 16,
    marginRight: 8,
  },
  featureText: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#666666",
  },
  swapButton: {
    backgroundColor: "#B39DDB",
    borderRadius: 12,
    paddingVertical: screenHeight * 0.02,
    alignItems: "center",
    marginBottom: screenHeight * 0.03,
  },
  swapButtonText: {
    color: "#FFFFFF",
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "700",
  },
});
