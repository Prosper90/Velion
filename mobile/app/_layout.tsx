// NOTE: global-setup is now loaded in index.js (main entry point)
// This ensures polyfills are available before ANY module loads
import "../utils/crypto-setup";
import "react-native-url-polyfill/auto";

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { useColorScheme } from "../hooks/useColorScheme";
import { useWalletStore } from "../stores/walletStore";
import { useSecurityStore } from "../stores/securityStore";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const initializeWallet = useWalletStore((state) => state.initializeWallet);
  const initializeSecurity = useSecurityStore((state) => state.initialize);

  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Initialize wallet and security on app start
  useEffect(() => {
    if (loaded) {
      // Initialize both stores
      initializeSecurity();
      initializeWallet();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding-start" />
        <Stack.Screen name="onboarding-brand" />
        <Stack.Screen name="onboarding-get-started" />
        <Stack.Screen name="onboarding-link-wallet" />
        <Stack.Screen name="add-wallet" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      {/* <StatusBar style="auto" /> */}
    </ThemeProvider>
  );
}
