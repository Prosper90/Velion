import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useWalletStore } from "../stores/walletStore";
import { useSecurityStore } from "../stores/securityStore";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const [isChecking, setIsChecking] = useState(true);
  const { wallets, isLoading: isWalletLoading } = useWalletStore();
  const { isPinSet, isLoading: isSecurityLoading } = useSecurityStore();

  useEffect(() => {
    // Wait for both wallet and security initialization to complete
    if (!isWalletLoading && !isSecurityLoading) {
      setIsChecking(false);
    }
  }, [isWalletLoading, isSecurityLoading]);

  // Show loading while checking for wallets and security
  if (isChecking) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F5F5F5",
        }}
      >
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  // If wallet exists but PIN not set, go to PIN setup
  if (wallets.length > 0 && !isPinSet) {
    console.log("📍 Wallet exists but no PIN set, routing to PIN setup");
    return <Redirect href="/onboarding/setup-pin" />;
  }

  // If wallet exists and PIN is set, go to home
  if (wallets.length > 0 && isPinSet) {
    console.log("📍 Wallet and PIN exist, routing to home");
    return <Redirect href="/(tabs)/home" />;
  }

  // No wallet, show onboarding
  console.log("📍 No wallet found, routing to onboarding");
  return <Redirect href="/onboarding-start" />;
}
