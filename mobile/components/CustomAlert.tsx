import React, { useEffect, useRef } from "react";
import {
  Modal,
  StyleSheet,
  View,
  Text,
  Pressable,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export type AlertType = "success" | "error" | "warning" | "info";

interface AlertAction {
  text: string;
  onPress?: () => void;
  style?: "default" | "primary" | "cancel";
}

interface CustomAlertProps {
  visible: boolean;
  type?: AlertType;
  title: string;
  message: string;
  actions?: AlertAction[];
  onClose?: () => void;
}

export default function CustomAlert({
  visible,
  type = "info",
  title,
  message,
  actions = [{ text: "OK", style: "primary" }],
  onClose,
}: CustomAlertProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getAlertConfig = () => {
    switch (type) {
      case "success":
        return {
          iconBg: "#4CAF50",
          iconBgLight: "rgba(76, 175, 80, 0.1)",
          icon: "✓",
          accentColor: "#2E7D32",
          borderColor: "#C8E6C9",
        };
      case "error":
        return {
          iconBg: "#F44336",
          iconBgLight: "rgba(244, 67, 54, 0.1)",
          icon: "✕",
          accentColor: "#C62828",
          borderColor: "#FFCDD2",
        };
      case "warning":
        return {
          iconBg: "#FF9800",
          iconBgLight: "rgba(255, 152, 0, 0.1)",
          icon: "!",
          accentColor: "#E65100",
          borderColor: "#FFE0B2",
        };
      case "info":
      default:
        return {
          iconBg: "#2196F3",
          iconBgLight: "rgba(33, 150, 243, 0.1)",
          icon: "i",
          accentColor: "#1565C0",
          borderColor: "#BBDEFB",
        };
    }
  };

  const config = getAlertConfig();

  const handleActionPress = (action: AlertAction) => {
    if (action.onPress) {
      action.onPress();
    }
    if (onClose) {
      onClose();
    }
  };

  // Don't render Modal at all when not visible (Android fix)
  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        {Platform.OS === "ios" ? (
          <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
        ) : (
          <View style={styles.androidBlur} />
        )}

        <Animated.View
          style={[
            styles.alertContainer,
            {
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Alert Card */}
          <View
            style={[
              styles.alertCard,
              { borderTopColor: config.borderColor, borderTopWidth: 4 },
            ]}
          >
            {/* Icon */}
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: config.iconBgLight },
              ]}
            >
              <View
                style={[styles.iconCircle, { backgroundColor: config.iconBg }]}
              >
                <Text style={styles.iconText}>{config.icon}</Text>
              </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Message */}
            <Text style={styles.message}>{message}</Text>

            {/* Actions */}
            <View style={styles.actionsContainer}>
              {actions.map((action, index) => {
                const isPrimary = action.style === "primary";
                const isCancel = action.style === "cancel";

                return (
                  <Pressable
                    key={index}
                    style={({ pressed }) => [
                      styles.actionButton,
                      isPrimary && [
                        styles.primaryButton,
                        { backgroundColor: config.accentColor },
                      ],
                      isCancel && styles.cancelButton,
                      pressed && styles.actionButtonPressed,
                      actions.length === 1 && styles.actionButtonFull,
                    ]}
                    onPress={() => handleActionPress(action)}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        isPrimary && styles.primaryButtonText,
                        isCancel && styles.cancelButtonText,
                      ]}
                    >
                      {action.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  androidBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  alertContainer: {
    width: screenWidth * 0.85,
    maxWidth: 400,
  },
  alertCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  iconText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000000",
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonFull: {
    flex: 1,
  },
  actionButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  primaryButton: {
    backgroundColor: "#2E7D32",
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
  },
  primaryButtonText: {
    color: "#FFFFFF",
  },
  cancelButtonText: {
    color: "#666666",
  },
});
