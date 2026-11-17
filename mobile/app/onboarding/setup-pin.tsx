import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
  Vibration,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PinKeypad from "../../components/PinKeypad";
import { useSecurityStore } from "../../stores/securityStore";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function SetupPinScreen() {
  const router = useRouter();
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState("");

  const { setupPin, biometricsAvailable, enableBiometrics } =
    useSecurityStore();

  const handleNumberPress = (number: string) => {
    if (pin.length < 6) {
      const newPin = pin + number;
      setPin(newPin);
      setError("");

      // Auto-advance when PIN reaches 4-6 digits
      if (newPin.length >= 4 && newPin.length <= 6) {
        // Allow user to press more digits or proceed
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError("");
  };

  const handleContinue = async () => {
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits");
      Vibration.vibrate(100);
      return;
    }

    if (pin.length > 6) {
      setError("PIN must be at most 6 digits");
      Vibration.vibrate(100);
      return;
    }

    if (step === "enter") {
      // Move to confirmation step
      setFirstPin(pin);
      setPin("");
      setStep("confirm");
      setError("");
    } else {
      // Confirm PIN matches
      if (pin !== firstPin) {
        setError("PINs do not match. Please try again.");
        Vibration.vibrate([0, 100, 100, 100]);
        setPin("");
        setFirstPin("");
        setStep("enter");
        return;
      }

      try {
        // Set up PIN
        await setupPin(pin);

        // Ask about biometrics if available
        if (biometricsAvailable) {
          Alert.alert(
            "Enable Biometric Authentication?",
            "Use Face ID or fingerprint to unlock VeilOn faster",
            [
              {
                text: "Not Now",
                style: "cancel",
                onPress: () => router.replace("/(tabs)/home"),
              },
              {
                text: "Enable",
                onPress: async () => {
                  try {
                    await enableBiometrics();
                    Alert.alert("Success!", "Biometric authentication enabled");
                    router.replace("/(tabs)/home");
                  } catch (error: any) {
                    Alert.alert("Error", error.message);
                    router.replace("/(tabs)/home");
                  }
                },
              },
            ]
          );
        } else {
          Alert.alert("Success!", "PIN set up successfully", [
            { text: "OK", onPress: () => router.replace("/(tabs)/home") },
          ]);
        }
      } catch (error: any) {
        setError(error.message || "Failed to setup PIN");
        Vibration.vibrate(100);
      }
    }
  };

  const handleSkip = () => {
    Alert.alert(
      "Skip PIN Setup?",
      "Setting up a PIN protects your wallet from unauthorized access. Are you sure you want to skip?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Skip",
          style: "destructive",
          onPress: () => router.replace("/(tabs)/home"),
        },
      ]
    );
  };

  // Render PIN dots
  const renderPinDots = () => {
    const dots = [];
    for (let i = 0; i < 6; i++) {
      dots.push(
        <View
          key={i}
          style={[
            styles.pinDot,
            i < pin.length && styles.pinDotFilled,
            error && styles.pinDotError,
          ]}
        />
      );
    }
    return dots;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {step === "enter" ? "Create a PIN" : "Confirm your PIN"}
        </Text>
        <Text style={styles.subtitle}>
          {step === "enter"
            ? "Choose a 4-6 digit PIN to secure your wallet"
            : "Re-enter your PIN to confirm"}
        </Text>
      </View>

      {/* Security Icon */}
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🔒</Text>
      </View>

      {/* PIN Dots */}
      <View style={styles.pinDotsContainer}>{renderPinDots()}</View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Info */}
      {!error && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            {pin.length > 0
              ? `${pin.length} digit${pin.length > 1 ? "s" : ""} entered`
              : "Enter at least 4 digits"}
          </Text>
        </View>
      )}

      {/* Keypad */}
      <View style={styles.keypadContainer}>
        <PinKeypad
          onNumberPress={handleNumberPress}
          onBackspace={handleBackspace}
        />
      </View>

      {/* Continue Button */}
      <Pressable
        style={[
          styles.continueButton,
          pin.length < 4 && styles.continueButtonDisabled,
        ]}
        onPress={handleContinue}
        disabled={pin.length < 4}
      >
        <Text style={styles.continueButtonText}>
          {step === "enter" ? "Continue" : "Confirm"}
        </Text>
      </Pressable>

      {/* Skip Button */}
      {step === "enter" && (
        <Pressable style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
    paddingHorizontal: screenWidth * 0.05,
  },
  header: {
    alignItems: "center",
    marginTop: screenHeight * 0.01,
    marginBottom: screenHeight * 0.01,
  },
  title: {
    fontSize: Math.max(28, screenWidth * 0.07),
    fontWeight: "700",
    color: "#000000",
    marginBottom: screenHeight * 0.01,
    textAlign: "center",
  },
  subtitle: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#666666",
    textAlign: "center",
    paddingHorizontal: screenWidth * 0.05,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: screenHeight * 0.01,
  },
  icon: {
    fontSize: 55,
  },
  pinDotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: screenHeight * 0.01,
    gap: 16,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CCCCCC",
    backgroundColor: "transparent",
  },
  pinDotFilled: {
    backgroundColor: "#000000",
    borderColor: "#000000",
  },
  pinDotError: {
    borderColor: "#F44336",
    backgroundColor: "#F44336",
  },
  errorContainer: {
    alignItems: "center",
    marginBottom: screenHeight * 0.01,
    minHeight: 24,
  },
  errorText: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#F44336",
    fontWeight: "600",
    textAlign: "center",
  },
  infoContainer: {
    alignItems: "center",
    marginBottom: screenHeight * 0.02,
    minHeight: 24,
  },
  infoText: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#999999",
    textAlign: "center",
  },
  keypadContainer: {
    flex: 1,
    justifyContent: "center",
  },
  continueButton: {
    backgroundColor: "#000000",
    borderRadius: 12,
    paddingVertical: screenHeight * 0.02,
    alignItems: "center",
    marginBottom: screenHeight * 0.01,
  },
  continueButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: "700",
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: screenHeight * 0.015,
    marginBottom: screenHeight * 0.001,
  },
  skipButtonText: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: "#666666",
    fontWeight: "600",
  },
});
