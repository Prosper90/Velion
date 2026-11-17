import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWalletStore } from "../stores/walletStore";
import { Image } from "expo-image";
import { getAllTokensForChain, TokenMetadata } from "../constants/tokens";
import { fetchTokenPrice, TokenPrice } from "../utils/price-fetcher";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function TokenDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Get token from params
  const tokenSymbol = (params.token as string) || "ETH";

  const activeWallet = useWalletStore((state) => state.getActiveWallet());
  const network = useWalletStore((state) => state.network);

  // For now, only the native token (first token in the list) has actual balance
  // ERC20 token balances will be implemented later
  const [publicBalance, setPublicBalance] = useState("0.00");
  const [privateBalance, setPrivateBalance] = useState("0.00");

  const [tokenMetadata, setTokenMetadata] = useState<TokenMetadata | null>(
    null
  );
  const [tokenPrice, setTokenPrice] = useState<TokenPrice | null>(null);
  const [loading, setLoading] = useState(true);

  // Load token metadata and price
  useEffect(() => {
    const loadTokenData = async () => {
      try {
        setLoading(true);

        // Get all tokens for current chain
        const chainId = network?.chainId || 11155111; // Default to Sepolia
        const tokens = getAllTokensForChain(chainId);

        // Find the selected token
        const selectedToken = tokens.find((t) => t.symbol === tokenSymbol);
        const isNativeToken = selectedToken && selectedToken === tokens[0];

        if (selectedToken) {
          setTokenMetadata(selectedToken);

          // Fetch current price
          const price = await fetchTokenPrice(selectedToken);
          setTokenPrice(price);

          // Set balances
          // Only native token has balance for now (ETH, MATIC, BNB, etc.)
          // ERC20 tokens will show 0.00 until we implement token balance fetching
          if (isNativeToken) {
            setPublicBalance(activeWallet?.publicBalance || "0.00");
            setPrivateBalance(activeWallet?.privateBalance || "0.00");
          } else {
            // ERC20 tokens - TODO: Fetch actual ERC20 balances
            setPublicBalance("0.00");
            setPrivateBalance("0.00");
          }
        } else {
          // Default to first token (native token) if not found
          setTokenMetadata(tokens[0]);
          const price = await fetchTokenPrice(tokens[0]);
          setTokenPrice(price);
          setPublicBalance(activeWallet?.publicBalance || "0.00");
          setPrivateBalance(activeWallet?.privateBalance || "0.00");
        }
      } catch (error) {
        console.error("Failed to load token data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTokenData();
  }, [
    tokenSymbol,
    network?.chainId,
    activeWallet?.publicBalance,
    activeWallet?.privateBalance,
  ]);

  // Calculate total value using real price
  const priceUSD = tokenPrice?.usd || 0;
  const totalPublic = parseFloat(publicBalance) * priceUSD;
  const totalPrivate = parseFloat(privateBalance) * priceUSD;
  const totalValue = totalPublic + totalPrivate;

  // Default values while loading
  const currentToken = {
    name: tokenMetadata?.name || tokenSymbol,
    symbol: tokenMetadata?.symbol || tokenSymbol,
    icon: tokenMetadata?.icon || "💎",
    price: tokenPrice
      ? `$${priceUSD.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "$0.00",
    logo: require("../assets/images/ic_eth.svg"),
    publicBalance: publicBalance,
    privateBalance: privateBalance,
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{currentToken.name}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Token Icon and Symbol */}
        <View style={styles.tokenHeader}>
          {loading ? (
            <ActivityIndicator size="large" color="#000000" />
          ) : (
            <View style={styles.tokenIconContainer}>
              {/* <Text style={styles.tokenIconEmoji}>{currentToken.icon}</Text> */}
              <Image source={currentToken.icon} style={styles.tokenIconEmoji} />
            </View>
          )}
          <Text style={styles.tokenSymbol}>{currentToken.symbol}</Text>
        </View>

        {/* Current Price */}
        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Current Price</Text>
          <Text style={styles.priceValue}>{currentToken.price}</Text>
        </View>

        {/* Balance Cards */}
        <View style={styles.balancesContainer}>
          {/* Total Balance */}
          <View style={styles.totalBalanceCard}>
            <Text style={styles.totalBalanceLabel}>Total Balance</Text>
            <Text style={styles.totalBalanceValue}>
              {(parseFloat(publicBalance) + parseFloat(privateBalance)).toFixed(
                4
              )}{" "}
              {currentToken.symbol}
            </Text>
            <Text style={styles.totalBalanceUSD}>
              ${totalValue.toFixed(2)} USD
            </Text>
          </View>

          {/* Public Balance */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceCardHeader}>
              <Text style={styles.balanceCardLabel}>Public Balance</Text>
              <Text style={styles.publicBadge}>PUBLIC</Text>
            </View>
            <Text style={styles.balanceCardValue}>
              {publicBalance} {currentToken.symbol}
            </Text>
            <Text style={styles.balanceCardUSD}>
              ${totalPublic.toFixed(2)} USD
            </Text>
          </View>

          {/* Private Balance */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceCardHeader}>
              <Text style={styles.balanceCardLabel}>Private Balance</Text>
              <Text style={styles.privateBadge}>PRIVATE</Text>
            </View>
            <Text style={styles.balanceCardValue}>
              {privateBalance} {currentToken.symbol}
            </Text>
            <Text style={styles.balanceCardUSD}>
              ${totalPrivate.toFixed(2)} USD
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Pressable
            style={styles.actionButton}
            onPress={() =>
              router.push({
                pathname: "/transfer",
                params: { token: tokenSymbol },
              })
            }
          >
            <Text style={styles.actionButtonIcon}>📤</Text>
            <Text style={styles.actionButtonText}>Send</Text>
          </Pressable>

          <Pressable
            style={styles.actionButton}
            onPress={() =>
              router.push({
                pathname: "/receive",
                params: { token: tokenSymbol },
              })
            }
          >
            <Text style={styles.actionButtonIcon}>📥</Text>
            <Text style={styles.actionButtonText}>Receive</Text>
          </Pressable>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable
            style={styles.quickActionCard}
            onPress={() => router.push("/shield-tokens")}
          >
            <Text style={styles.quickActionIcon}>🛡️</Text>
            <Text style={styles.quickActionLabel}>Shield</Text>
            <Text style={styles.quickActionDesc}>Make private</Text>
          </Pressable>

          <Pressable
            style={styles.quickActionCard}
            onPress={() => router.push("/unshield-tokens")}
          >
            <Text style={styles.quickActionIcon}>🔓</Text>
            <Text style={styles.quickActionLabel}>Unshield</Text>
            <Text style={styles.quickActionDesc}>Make public</Text>
          </Pressable>
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
  headerSpacer: {
    width: 40,
  },
  tokenHeader: {
    alignItems: "center",
    marginVertical: screenHeight * 0.03,
  },
  tokenLogo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  tokenIconContainer: {
    width: 80,
    height: 80,
    marginBottom: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 40,
  },
  tokenIconEmoji: {
    // fontSize: 48,
    width: 70,
    height: 70,
  },
  tokenSymbol: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000000",
  },
  priceSection: {
    alignItems: "center",
    marginBottom: screenHeight * 0.04,
  },
  priceLabel: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
  },
  priceValue: {
    fontSize: 36,
    fontWeight: "700",
    color: "#000000",
  },
  balancesContainer: {
    gap: 16,
    marginBottom: screenHeight * 0.03,
  },
  totalBalanceCard: {
    backgroundColor: "#000000",
    borderRadius: 16,
    padding: screenWidth * 0.05,
    alignItems: "center",
  },
  totalBalanceLabel: {
    fontSize: 14,
    color: "#FFFFFF",
    marginBottom: 12,
  },
  totalBalanceValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  totalBalanceUSD: {
    fontSize: 16,
    color: "#CCCCCC",
  },
  balanceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: screenWidth * 0.05,
  },
  balanceCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  balanceCardLabel: {
    fontSize: 14,
    color: "#666666",
  },
  balanceCardValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 8,
  },
  balanceCardUSD: {
    fontSize: 16,
    color: "#999999",
  },
  publicBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4CAF50",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  privateBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B39DDB",
    backgroundColor: "#F5F0FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 16,
    marginBottom: screenHeight * 0.03,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#000000",
    borderRadius: 16,
    paddingVertical: screenHeight * 0.025,
    alignItems: "center",
    gap: 8,
  },
  actionButtonIcon: {
    fontSize: 32,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  quickActions: {
    flexDirection: "row",
    gap: 16,
    marginBottom: screenHeight * 0.03,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: screenWidth * 0.04,
    alignItems: "center",
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 4,
  },
  quickActionDesc: {
    fontSize: 12,
    color: "#666666",
  },
});
