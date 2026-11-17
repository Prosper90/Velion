import { useRouter } from "expo-router";
import { useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BackgroundImage from "../../components/BackgroundImage";
import CustomBanner from "../../components/CustomBanner";
import HeaderIcons from "../../components/HeaderIcons";
import AddTokenModal from "../../components/AddTokenModal";
import { useTokenStore } from "../../stores/tokenStore";
import { useWalletStore } from "../../stores/walletStore";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function DAppsTab() {
  const router = useRouter();
  const [showAddTokenModal, setShowAddTokenModal] = useState(false);

  const { fetchTokenBalances, getAllTokensForChain: getAllTokensWithCustom } =
    useTokenStore();
  const activeWallet = useWalletStore((state) => state.getActiveWallet());
  const network = useWalletStore((state) => state.network);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <BackgroundImage />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>VeilOn</Text>
        <HeaderIcons
          onSearchPress={() => console.log("Search pressed")}
          onBellPress={() => console.log("Bell pressed")}
        />
      </View>

      {/* Spacing */}
      <View style={styles.headerSpacing} />

      {/* Custom Banners */}
      <CustomBanner
        icon={require("../../assets/images/card-wallet.svg")}
        title="VeilOn DEX"
        actionText="Private and public Swaps"
        onActionPress={() => router.push("../veilon-dex")}
      />

      <CustomBanner
        icon={require("../../assets/images/shield-check.svg")}
        title="Shield Tokens"
        actionText="Make Tokens Private"
        onActionPress={() => router.push("../shield-tokens")}
      />

      <CustomBanner
        icon={require("../../assets/images/unshield-check.svg")}
        title="Unshield Tokens"
        actionText="Make Tokens Public"
        onActionPress={() => router.push("../unshield-tokens")}
      />

      <CustomBanner
        icon={require("../../assets/images/eye-off.svg")}
        title="Private Transfer"
        actionText="Send Privately"
        onActionPress={() => router.push("../private-transfer")}
      />

      <CustomBanner
        icon={require("../../assets/images/custom.svg")}
        title="Add Custom Token"
        actionText="Add ERC20 Token"
        onActionPress={() => setShowAddTokenModal(true)}
      />

      {/* <CustomBanner
        icon={require("../../assets/images/tractor.svg")}
        title="Farm"
        actionText="Earn yield"
        onActionPress={() => console.log("Farm pressed")}
      /> */}

      <CustomBanner
        icon={require("../../assets/images/tsunami.svg")}
        title="Liquidity"
        actionText="Manage DEX liquidity"
        onActionPress={() => console.log("Manage liquidity pressed")}
      />

      {/* Add Token Modal */}
      <AddTokenModal
        visible={showAddTokenModal}
        onClose={() => setShowAddTokenModal(false)}
        onTokenAdded={() => {
          // Reload tokens and balances after adding
          if (activeWallet?.address && network?.chainId) {
            fetchTokenBalances(activeWallet.address, network.chainId);
          }
        }}
        chainId={network?.chainId || 11155111}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: screenWidth * 0.05,
    paddingBottom: screenHeight * 0.025,
    zIndex: 1,
  },
  headerSpacing: {
    height: screenHeight * 0.05,
  },
  appName: {
    fontSize: Math.max(24, screenWidth * 0.06),
    fontWeight: "bold",
    color: "#000000",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: screenWidth * 0.05,
  },
  title: {
    fontSize: Math.max(28, screenWidth * 0.07),
    fontWeight: "bold",
    color: "#333333",
    marginBottom: screenHeight * 0.012,
    textAlign: "center",
  },
  subtitle: {
    fontSize: Math.max(18, screenWidth * 0.045),
    color: "#666666",
    textAlign: "center",
  },
});
