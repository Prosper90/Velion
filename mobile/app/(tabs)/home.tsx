import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import * as React from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BackgroundImage from "../../components/BackgroundImage";
import HeaderIcons from "../../components/HeaderIcons";
import CustomAlert from "../../components/CustomAlert";
import { useWalletStore } from "../../stores/walletStore";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCustomAlert } from "../../hooks/useCustomAlert";
import { getAllTokensForChain, TokenMetadata, getSupportedTokensForChain, TokenWithAddress } from "../../constants/tokens";
import {
  fetchMultipleTokenPrices,
  TokenPrice,
} from "../../utils/price-fetcher";
import { commitmentStoreRN } from "../../utils/commitment-store-rn";
import { useTokenStore } from "../../stores/tokenStore";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function HomeScreen() {
  const [balanceVisible, setBalanceVisible] = React.useState(true); // Show balance by default
  const [activeTab, setActiveTab] = React.useState("crypto");
  const [refreshing, setRefreshing] = React.useState(false);
  const [balanceMode, setBalanceMode] = React.useState<"public" | "private">(
    "public"
  ); // Toggle between public and private balance
  const [tokenPrices, setTokenPrices] = React.useState<{
    [symbol: string]: TokenPrice;
  }>({});
  const [priceLoading, setPriceLoading] = React.useState(false);
  const [supportedTokens, setSupportedTokens] = React.useState<TokenMetadata[]>(
    []
  );
  const [privateBalances, setPrivateBalances] = React.useState<
    Record<string, string>
  >({}); // Multi-token private balances
  const [expandedToken, setExpandedToken] = React.useState<string | null>(null); // Track which token is expanded

  const router = useRouter();

  // Token store
  const {
    tokenBalances,
    fetchTokenBalances,
    getAllTokensForChain: getAllTokensWithCustom,
    loadCustomTokens,
  } = useTokenStore();
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const {
    address,
    publicBalance,
    privateBalance,
    isConnected,
    isLoading,
    network,
    refreshBalances: storeRefreshBalances,
  } = useWalletStore((state) => ({
    address: state.getActiveWallet()?.address || null,
    publicBalance: state.getActiveWallet()?.publicBalance || "0.00",
    privateBalance: state.getActiveWallet()?.privateBalance || "0.00",
    isConnected: state.isConnected,
    isLoading: state.isLoading,
    network: state.network,
    refreshBalances: state.refreshBalances,
  }));

  // Mock transactions for now (you can add this to store later)
  const transactions: any[] = [];
  const transactionsLoading = false;

  // Load custom tokens on mount
  React.useEffect(() => {
    loadCustomTokens();
  }, []);

  // Load supported tokens for current chain (including custom tokens)
  React.useEffect(() => {
    if (network?.chainId) {
      const tokens = getAllTokensWithCustom(network.chainId);
      setSupportedTokens(tokens);
      console.log(
        `📋 Loaded ${tokens.length} tokens for chain ${network.chainId}`
      );
    }
  }, [network?.chainId]);

  // Fetch ERC20 token balances when wallet/network changes
  React.useEffect(() => {
    if (address && network?.chainId) {
      fetchTokenBalances(address, network.chainId);
    }
  }, [address, network?.chainId]);

  // Fetch token prices from CryptoCompare API
  const fetchTokenPrices = async () => {
    try {
      if (supportedTokens.length === 0) return;

      setPriceLoading(true);
      console.log(`📡 Fetching prices for ${supportedTokens.length} tokens...`);

      const prices = await fetchMultipleTokenPrices(supportedTokens);
      setTokenPrices(prices);

      console.log(`💵 Fetched prices for ${Object.keys(prices).length} tokens`);
    } catch (error) {
      console.error("Failed to fetch token prices:", error);
      setTokenPrices({});
    } finally {
      setPriceLoading(false);
    }
  };

  // Fetch token prices when supported tokens change
  React.useEffect(() => {
    if (isConnected && supportedTokens.length > 0) {
      fetchTokenPrices();
    }
  }, [isConnected, supportedTokens]);

  // Fetch private balances when connected
  React.useEffect(() => {
    if (isConnected && address) {
      fetchPrivateBalances();
    }
  }, [isConnected, address]);

  // Refresh private balances when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (address && balanceMode === "private") {
        console.log("🔄 Home screen focused, refreshing private balances...");
        fetchPrivateBalances();
      }
    }, [address, balanceMode])
  );

  const refreshBalances = async () => {
    if (address && network?.chainId) {
      await storeRefreshBalances(address);
      // Also fetch multi-token private balances
      await fetchPrivateBalances();
      // Fetch ERC20 token balances
      await fetchTokenBalances(address, network.chainId);
    }
  };

  const fetchPrivateBalances = async () => {
    if (!address) return;
    try {
      console.log("🔍 Fetching private balances for all tokens...");
      const balances = await commitmentStoreRN.getAllPrivateBalances(address);
      setPrivateBalances(balances);
      console.log("💰 Private balances:", balances);
    } catch (error) {
      console.error("Failed to fetch private balances:", error);
      setPrivateBalances({});
    }
  };

  const refreshTransactions = async () => {};

  const toggleBalanceVisibility = () => {
    setBalanceVisible(!balanceVisible);
  };

  const toggleBalanceMode = () => {
    const newMode = balanceMode === "public" ? "private" : "public";
    setBalanceMode(newMode);
    // Fetch private balances when switching to private mode
    if (newMode === "private") {
      fetchPrivateBalances();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refreshBalances(),
      refreshTransactions(),
      fetchTokenPrices(),
    ]);
    setRefreshing(false);
  };

  // Format USD value for display
  const formatUSD = (usdValue: number) => {
    if (isNaN(usdValue)) return "$0.00";
    return (
      "$" +
      usdValue.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  // Format ETH quantity for display
  const formatETH = (ethValue: string) => {
    const num = parseFloat(ethValue);
    if (isNaN(num)) return "0.00";
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  };

  // Get balance for a specific token based on mode
  const getTokenBalance = (tokenSymbol: string, isNativeToken: boolean) => {
    if (balanceMode === "public") {
      // Public mode: use token balances from token store
      if (address) {
        const balances = tokenBalances[address] || [];
        const tokenBalance = balances.find((b) => b.symbol === tokenSymbol);
        return tokenBalance?.balance || "0.00";
      }
      return "0.00";
    } else {
      // Private mode: check privateBalances for all tokens
      return privateBalances[tokenSymbol] || "0.00";
    }
  };

  const getCryptoData = () => {
    // Get supported tokens from centralized config (Sepolia testnet = 11155111)
    const chainId = 11155111; // TODO: Get from wallet store when multi-chain support is added
    const SUPPORTED_TOKENS = getSupportedTokensForChain(chainId);

    return SUPPORTED_TOKENS.map((token, index) => {
      const balance = getTokenBalance(token.symbol, token.isNative);
      const quantity = parseFloat(balance) || 0;

      const price = tokenPrices[token.symbol];
      const priceUSD = price?.usd || 0;
      const totalValueUSD = quantity * priceUSD;

      return {
        id: index + 1,
        logo: require("../../assets/images/Group 1328.svg"),
        ticker: token.symbol,
        name: token.name,
        icon: token.icon,
        address: token.address, // Now includes token address for ERC20 balance fetching
        decimals: token.decimals,
        isNative: token.isNative,
        price: formatUSD(priceUSD),
        quantity: formatETH(balance),
        totalValue: formatUSD(totalValueUSD),
        totalValueRaw: totalValueUSD,
        change24h: price?.change24h,
        hasBalance: quantity > 0,
      };
    });
  };

  const cryptoData = getCryptoData();

  // Calculate total portfolio value
  const totalUSDValue = cryptoData.reduce((sum, token) => {
    return sum + (token.totalValueRaw || 0);
  }, 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Background Image */}
      <BackgroundImage height="70%" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>VeilOn</Text>
        <HeaderIcons
          onSearchPress={() => console.log("Search pressed")}
          onBellPress={() => router.push("/portfolio")}
        />
      </View>

      {/* Balance Section */}
      <View style={styles.balanceSection}>
        <View style={styles.walletHeaderRow}>
          <View style={styles.walletLabelContainer}>
            <Text style={styles.walletLabel}>
              {isConnected
                ? balanceMode === "public"
                  ? "Public Wallet"
                  : "Private Wallet"
                : "Not Connected"}
            </Text>
            {isConnected && (
              <Pressable
                onPress={toggleBalanceMode}
                style={styles.toggleButton}
              >
                <Text style={styles.toggleButtonText}>
                  {balanceMode === "public" ? "🔓 Public" : "🛡️ Private"}
                </Text>
                <Text style={styles.toggleArrow}>⇄</Text>
              </Pressable>
            )}
          </View>
          {network && (
            <View
              style={[
                styles.networkBadge,
                network.isTestnet && styles.networkBadgeTestnet,
              ]}
            >
              <Text style={styles.networkText}>{network.name}</Text>
            </View>
          )}
        </View>
        <View style={styles.balanceRow}>
          {isLoading || priceLoading ? (
            <ActivityIndicator size="large" color="#000000" />
          ) : (
            <>
              <Text style={styles.balanceAmount}>
                {balanceVisible ? formatUSD(totalUSDValue) : "$ •••,•••.••"}
              </Text>
              <Pressable
                onPress={toggleBalanceVisibility}
                style={styles.eyeButton}
              >
                <Image
                  source={require("../../assets/images/eye-off.svg")}
                  style={styles.eyeIcon}
                  contentFit="contain"
                />
              </Pressable>
            </>
          )}
        </View>

        {isConnected && address && (
          <View style={styles.walletAddressRow}>
            <Text style={styles.walletAddress}>
              {address.substring(0, 6)}...
              {address.substring(address.length - 4)}
            </Text>
            <Text style={styles.balanceLabel}>
              {balanceMode === "public"
                ? "Public Balance"
                : "Private Balance (Ozk)"}
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <View style={styles.actionButtonContainer}>
          <Pressable
            style={styles.actionButton}
            onPress={() => {
              // Navigate to public transfer screen (or you can use private-transfer)
              router.push("/send-tokens");
            }}
          >
            <Image
              source={require("../../assets/images/arrow-narrow-left.svg")}
              style={[styles.arrowIcon, { transform: [{ rotate: "180deg" }] }]}
              contentFit="contain"
            />
          </Pressable>
          <Text style={styles.actionButtonText}>Send</Text>
        </View>

        <View style={styles.actionButtonContainer}>
          <Pressable
            style={styles.actionButton}
            onPress={() => {
              // Navigate to swap/DEX screen
              console.log("Navigate to swap screen");
              // TODO: Create swap screen route
              router.push("/veilon-dex");
              // showAlert({
              //   type: "info",
              //   title: "Swap",
              //   message: "Veilon DEX coming soon!",
              // });
            }}
          >
            <Text style={styles.swapIcon}>🔄</Text>
          </Pressable>
          <Text style={styles.actionButtonText}>Swap</Text>
        </View>

        <View style={styles.actionButtonContainer}>
          <Pressable
            style={styles.actionButton}
            onPress={() => router.push("/add-wallet")}
          >
            <View style={styles.plusIcon}>
              <Text style={styles.plusText}>+</Text>
            </View>
          </Pressable>
          <Text style={styles.actionButtonText}>Import</Text>
        </View>

        <View style={styles.actionButtonContainer}>
          <Pressable
            style={styles.actionButton}
            onPress={async () => {
              if (address) {
                try {
                  // Copy address to clipboard
                  await Clipboard.setStringAsync(address);
                  console.log("Address copied to clipboard:", address);

                  // Show success alert
                  showAlert({
                    type: "success",
                    title: "Address Copied",
                    message: `${address.substring(0, 6)}...${address.substring(
                      38
                    )} copied to clipboard`,
                  });
                } catch (error) {
                  console.error("Failed to copy address:", error);
                  showAlert({
                    type: "error",
                    title: "Error",
                    message: "Failed to copy address to clipboard",
                  });
                }
              } else {
                showAlert({
                  type: "warning",
                  title: "No Address",
                  message: "No wallet address available to copy",
                });
              }
            }}
          >
            <Text style={styles.copyIcon}>📋</Text>
          </Pressable>
          <Text style={styles.actionButtonText}>Copy</Text>
        </View>
      </View>

      {/* Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerContent}>
          <View style={styles.iconContainer}>
            <Image
              source={require("../../assets/images/card-wallet.svg")}
              style={styles.bannerIcon}
              contentFit="contain"
            />
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>Add funds from exchange</Text>
            <Text style={styles.bannerAction}>Deposit Now →</Text>
          </View>
        </View>
        <Pressable style={styles.closeButton}>
          <Image
            source={require("../../assets/images/add-circle-outline.svg")}
            style={styles.closeIcon}
            contentFit="contain"
          />
        </Pressable>
      </View>

      {/* Content Container */}
      <View style={styles.contentContainer}>
        {/* Tabs */}
        <View style={styles.tabs}>
          <Pressable onPress={() => setActiveTab("crypto")}>
            {activeTab === "crypto" ? (
              <LinearGradient
                colors={["#FAF3C5", "#BEF4B5", "#87F2AA"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.activeTabGradient}
              >
                <Text style={[styles.tabText, styles.activeTabText]}>
                  Crypto
                </Text>
              </LinearGradient>
            ) : (
              <View style={styles.tab}>
                <Text style={styles.tabText}>Crypto</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => setActiveTab("nfts")}>
            {activeTab === "nfts" ? (
              <LinearGradient
                colors={["#FAF3C5", "#BEF4B5", "#87F2AA"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.activeTabGradient}
              >
                <Text style={[styles.tabText, styles.activeTabText]}>NFTs</Text>
              </LinearGradient>
            ) : (
              <View style={styles.tab}>
                <Text style={styles.tabText}>NFTs</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Crypto List */}
        <ScrollView
          style={styles.cryptoList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.cryptoListContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#000000"
            />
          }
        >
          {transactionsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#000000" />
              <Text style={styles.loadingText}>Loading transactions...</Text>
            </View>
          ) : cryptoData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No assets yet</Text>
              <Text style={styles.emptySubtext}>
                {isConnected
                  ? "Create or import a wallet to get started"
                  : "Connect your wallet"}
              </Text>
            </View>
          ) : (
            cryptoData.map((crypto) => (
              <Pressable
                key={crypto.id}
                style={styles.cryptoItem}
                onPress={() =>
                  router.push({
                    pathname: "/token-details",
                    params: { token: crypto.ticker },
                  })
                }
              >
                <View style={styles.tokenIconContainer}>
                  {/* <Text style={styles.tokenIconEmoji}>{crypto.icon}</Text> */}
                  <Image source={crypto.icon} style={styles.tokenIconEmoji} />
                </View>
                <View style={styles.cryptoInfo}>
                  <Text style={styles.cryptoTicker}>{crypto.ticker}</Text>
                  <Text style={styles.cryptoPrice}>{crypto.price}</Text>
                </View>
                <View style={styles.cryptoValues}>
                  <Text style={styles.cryptoQuantity}>{crypto.quantity}</Text>
                  <Text style={styles.cryptoTotal}>{crypto.totalValue}</Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>

      {/* CustomAlert Component */}
      <CustomAlert
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        actions={alertState.actions}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    zIndex: 1,
    position: "relative",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: screenWidth * 0.05,
    paddingBottom: screenHeight * 0.025,
    zIndex: 1,
  },
  appName: {
    fontSize: Math.max(24, screenWidth * 0.06),
    fontWeight: "bold",
    color: "#000000",
  },

  balanceSection: {
    paddingHorizontal: screenWidth * 0.05,
    paddingBottom: screenHeight * 0.03,
    zIndex: 1,
  },
  walletHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: screenHeight * 0.01,
  },
  walletLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  walletLabel: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#000000",
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  toggleButtonText: {
    fontSize: Math.max(12, screenWidth * 0.03),
    fontWeight: "600",
    color: "#333333",
  },
  toggleArrow: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#666666",
  },
  networkBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#4CAF50",
  },
  networkBadgeTestnet: {
    backgroundColor: "#FF9800",
  },
  networkText: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#FFFFFF",
    fontWeight: "600",
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  balanceAmount: {
    fontSize: Math.max(32, screenWidth * 0.08),
    fontWeight: "bold",
    color: "#000000",
  },
  ethQuantityLabel: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#666666",
    marginTop: 4,
  },
  eyeButton: {
    padding: screenWidth * 0.02,
  },
  eyeIcon: {
    width: Math.max(24, screenWidth * 0.06),
    height: Math.max(24, screenWidth * 0.06),
    tintColor: "#000000",
  },
  walletAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: screenHeight * 0.01,
  },
  // walletAddress: {
  //   fontSize: Math.max(12, screenWidth * 0.03),
  //   color: "#666666",
  // },
  balanceLabel: {
    fontSize: Math.max(11, screenWidth * 0.028),
    color: "#999999",
    fontStyle: "italic",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: screenWidth * 0.05,
    paddingBottom: screenHeight * 0.03,
    zIndex: 1,
  },
  actionButtonContainer: {
    alignItems: "center",
  },
  actionButton: {
    width: Math.max(60, screenWidth * 0.18),
    height: Math.max(60, screenHeight * 0.07),
    borderRadius: Math.max(20, screenWidth * 0.05),
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: screenHeight * 0.012,
  },
  plusIcon: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    width: "100%",
  },
  plusText: {
    color: "#FFFFFF",
    fontSize: Math.max(40, screenWidth * 0.1),
    fontWeight: "bold",
  },
  arrowIcon: {
    width: Math.max(35, screenWidth * 0.09),
    height: Math.max(35, screenWidth * 0.09),
    tintColor: "#FFFFFF",
  },
  copyIcon: {
    fontSize: Math.max(30, screenWidth * 0.075),
  },
  swapIcon: {
    fontSize: Math.max(30, screenWidth * 0.075),
  },
  actionButtonText: {
    color: "#000000",
    fontSize: Math.max(14, screenWidth * 0.035),
    fontWeight: "600",
  },

  banner: {
    backgroundColor: "#000000",
    marginHorizontal: screenWidth * 0.012,
    borderRadius: Math.max(20, screenWidth * 0.05),
    paddingHorizontal: screenWidth * 0.04,
    paddingVertical: screenHeight * 0.01,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: screenHeight * 0.03,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: Math.max(56, screenWidth * 0.14),
    height: Math.max(56, screenWidth * 0.14),
    borderRadius: Math.max(28, screenWidth * 0.07),
    backgroundColor: "#D9D9D952",
    alignItems: "center",
    justifyContent: "center",
    marginRight: screenWidth * 0.04,
  },
  bannerIcon: {
    width: Math.max(30, screenWidth * 0.075),
    height: Math.max(30, screenWidth * 0.075),
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    color: "#FFFFFF",
    fontSize: Math.max(14, screenWidth * 0.035),
    marginBottom: screenHeight * 0.005,
  },
  bannerAction: {
    color: "#4CAF50",
    fontSize: Math.max(14, screenWidth * 0.035),
    fontWeight: "600",
  },
  closeButton: {
    padding: screenWidth * 0.01,
    marginLeft: "auto",
  },
  closeIcon: {
    width: Math.max(40, screenWidth * 0.1),
    height: Math.max(40, screenWidth * 0.1),
    tintColor: "#FFFFFF",
  },

  contentContainer: {
    flex: 1,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: screenWidth * 0.05,
    gap: screenWidth * 0.03,
    marginBottom: screenHeight * 0.025,
  },
  tab: {
    backgroundColor: "#333333",
    paddingVertical: screenHeight * 0.015,
    paddingHorizontal: screenWidth * 0.06,
    borderRadius: Math.max(20, screenWidth * 0.05),
    borderWidth: 2,
    borderColor: "#000000",
    minHeight: Math.max(48, screenHeight * 0.06),
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: {
    backgroundColor: "#4CAF50",
  },
  tabText: {
    color: "#FFFFFF",
    fontSize: Math.max(14, screenWidth * 0.035),
    fontWeight: "600",
  },
  activeTabText: {
    color: "#000000",
  },
  activeTabGradient: {
    paddingVertical: screenHeight * 0.015,
    paddingHorizontal: screenWidth * 0.06,
    borderRadius: Math.max(20, screenWidth * 0.05),
    minHeight: Math.max(48, screenHeight * 0.06),
    alignItems: "center",
    justifyContent: "center",
  },
  cryptoList: {
    flex: 1,
    paddingHorizontal: screenWidth * 0.05,
  },
  cryptoListContent: {
    paddingBottom: screenHeight * 0.025,
  },
  cryptoItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: Math.max(12, screenWidth * 0.03),
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.015,
    flexDirection: "row",
    alignItems: "center",
  },
  cryptoLogo: {
    width: Math.max(40, screenWidth * 0.1),
    height: Math.max(40, screenWidth * 0.1),
    marginRight: screenWidth * 0.04,
  },
  tokenIconContainer: {
    width: Math.max(40, screenWidth * 0.1),
    height: Math.max(40, screenWidth * 0.1),
    marginRight: screenWidth * 0.04,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: Math.max(20, screenWidth * 0.05),
  },
  tokenIconEmoji: {
    // fontSize: Math.max(20, screenWidth * 0.05),
    width: 24,
    height: 24,
  },
  cryptoInfo: {
    flex: 1,
  },
  cryptoTicker: {
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "600",
    color: "#000000",
    marginBottom: screenHeight * 0.005,
  },
  cryptoPrice: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#666666",
  },
  cryptoValues: {
    alignItems: "flex-end",
  },
  cryptoQuantity: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#666666",
    marginBottom: screenHeight * 0.005,
  },
  cryptoTotal: {
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "600",
    color: "#000000",
  },
  walletAddress: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#666666",
    marginTop: screenHeight * 0.005,
  },
  loadingContainer: {
    paddingVertical: screenHeight * 0.05,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: screenHeight * 0.02,
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#666666",
  },
  emptyContainer: {
    paddingVertical: screenHeight * 0.08,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: Math.max(18, screenWidth * 0.045),
    fontWeight: "600",
    color: "#000000",
    marginBottom: screenHeight * 0.01,
  },
  emptySubtext: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#666666",
    textAlign: "center",
  },
  // Multi-token balance display styles
  tokenBalancesContainer: {
    marginTop: screenHeight * 0.015,
    gap: 8,
  },
  tokenBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 12,
    padding: screenWidth * 0.03,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  tokenBalanceLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  tokenIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  tokenBalanceInfo: {
    flex: 1,
  },
  tokenQuantity: {
    fontSize: Math.max(14, screenWidth * 0.035),
    fontWeight: "600",
    color: "#000000",
    marginBottom: 2,
  },
  tokenUSDValue: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#666666",
  },
  expandArrow: {
    fontSize: 12,
    color: "#999999",
    marginLeft: 8,
  },
  expandedDetails: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: screenWidth * 0.04,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
    zIndex: 10,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: "#666666",
  },
  detailValue: {
    fontSize: Math.max(12, screenWidth * 0.03),
    fontWeight: "600",
    color: "#000000",
  },
  positiveChange: {
    color: "#22C55E",
  },
  negativeChange: {
    color: "#EF4444",
  },
});
