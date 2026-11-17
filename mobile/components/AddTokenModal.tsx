import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Alert,
} from "react-native";
import { ethers } from "ethers";
import { getTokenMetadata, isValidERC20Token } from "../utils/erc20-balance";
import { veilonSDK } from "../services/veilon-sdk";
import { useTokenStore } from "../stores/tokenStore";

const { width: screenWidth } = Dimensions.get("window");

interface AddTokenModalProps {
  visible: boolean;
  onClose: () => void;
  onTokenAdded?: () => void;
  chainId: number;
}

export default function AddTokenModal({
  visible,
  onClose,
  onTokenAdded,
  chainId,
}: AddTokenModalProps) {
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenData, setTokenData] = useState<{
    name: string;
    symbol: string;
    decimals: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const addCustomToken = useTokenStore((state) => state.addCustomToken);

  const handleFetchTokenInfo = async () => {
    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      setError("Invalid address");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      setTokenData(null);

      const provider = veilonSDK.getProvider();
      if (!provider) {
        throw new Error("Provider not initialized");
      }

      // Check if it's a valid ERC20 token
      const isValid = await isValidERC20Token(tokenAddress, provider);
      if (!isValid) {
        throw new Error("Not a valid ERC20 token contract");
      }

      // Fetch token metadata
      const metadata = await getTokenMetadata(tokenAddress, provider);
      if (!metadata) {
        throw new Error("Failed to fetch token information");
      }

      setTokenData({
        name: metadata.name,
        symbol: metadata.symbol,
        decimals: metadata.decimals,
      });

      setIsLoading(false);
    } catch (err: any) {
      console.error("Failed to fetch token info:", err);
      setError(err.message || "Failed to fetch token information");
      setIsLoading(false);
    }
  };

  const handleAddToken = async () => {
    if (!tokenData) return;

    try {
      setIsLoading(true);

      await addCustomToken({
        address: tokenAddress,
        symbol: tokenData.symbol,
        name: tokenData.name,
        decimals: tokenData.decimals,
        chainId: chainId,
      });

      Alert.alert(
        "Token Added",
        `${tokenData.symbol} has been added to your token list`
      );

      // Reset and close
      setTokenAddress("");
      setTokenData(null);
      setError("");
      setIsLoading(false);

      if (onTokenAdded) {
        onTokenAdded();
      }

      onClose();
    } catch (err: any) {
      console.error("Failed to add token:", err);
      Alert.alert("Error", err.message || "Failed to add token");
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setTokenAddress("");
    setTokenData(null);
    setError("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add Custom Token</Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.label}>Token Contract Address</Text>
            <TextInput
              style={styles.input}
              placeholder="0x..."
              placeholderTextColor="#999"
              value={tokenAddress}
              onChangeText={(text) => {
                setTokenAddress(text);
                setError("");
                setTokenData(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Fetch Token Info Button */}
            {!tokenData && (
              <Pressable
                style={[
                  styles.button,
                  (!tokenAddress || isLoading) && styles.buttonDisabled,
                ]}
                onPress={handleFetchTokenInfo}
                disabled={!tokenAddress || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Fetch Token Info</Text>
                )}
              </Pressable>
            )}

            {/* Token Info Display */}
            {tokenData && (
              <View style={styles.tokenInfo}>
                <Text style={styles.infoTitle}>Token Information</Text>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Name:</Text>
                  <Text style={styles.infoValue}>{tokenData.name}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Symbol:</Text>
                  <Text style={styles.infoValue}>{tokenData.symbol}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Decimals:</Text>
                  <Text style={styles.infoValue}>{tokenData.decimals}</Text>
                </View>

                {/* Add Token Button */}
                <Pressable
                  style={[styles.button, styles.addButton]}
                  onPress={handleAddToken}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.buttonText}>Add Token</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    width: screenWidth * 0.9,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: "#666",
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#000",
    marginBottom: 12,
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 12,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  buttonDisabled: {
    backgroundColor: "#CCC",
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  tokenInfo: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    color: "#000",
    fontWeight: "600",
  },
  addButton: {
    marginTop: 16,
    backgroundColor: "#34C759",
  },
});
