import { Image } from "expo-image";
import * as React from "react";
import { Dimensions, Pressable, StyleSheet, View, Text } from "react-native";
import { useNotificationStore } from "../stores/notificationStore";

const { width: screenWidth } = Dimensions.get("window");

interface HeaderIconsProps {
  onSearchPress?: () => void;
  onBellPress?: () => void;
}

export default function HeaderIcons({
  onSearchPress,
  onBellPress,
}: HeaderIconsProps) {
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  // Debug logging
  React.useEffect(() => {
    console.log("🔔 [HeaderIcons] Unread count updated:", unreadCount);
  }, [unreadCount]);

  return (
    <View style={styles.headerIcons}>
      <Pressable style={styles.iconButton} onPress={onSearchPress}>
        <Image
          source={require("../assets/images/Ellipse 41.svg")}
          style={styles.iconBackground}
          contentFit="contain"
        />
        <Image
          source={require("../assets/images/search-outline.svg")}
          style={styles.headerIcon}
          contentFit="contain"
        />
      </Pressable>
      <Pressable style={styles.iconButton} onPress={onBellPress}>
        <Image
          source={require("../assets/images/Ellipse 41.svg")}
          style={styles.iconBackground}
          contentFit="contain"
        />
        <Image
          source={require("../assets/images/bell.svg")}
          style={styles.headerIcon}
          contentFit="contain"
        />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  headerIcons: {
    flexDirection: "row",
    gap: Math.max(8, screenWidth * 0.02),
  },
  iconButton: {
    width: Math.max(40, screenWidth * 0.1),
    height: Math.max(40, screenWidth * 0.1),
    position: "relative",
    marginHorizontal: Math.max(4, screenWidth * 0.01),
  },
  iconBackground: {
    width: Math.max(40, screenWidth * 0.1),
    height: Math.max(40, screenWidth * 0.1),
    position: "absolute",
    top: 0,
    left: 0,
  },
  headerIcon: {
    width: Math.max(20, screenWidth * 0.05),
    height: Math.max(20, screenWidth * 0.05),
    tintColor: "#000000",
    position: "absolute",
    top: Math.max(10, screenWidth * 0.025),
    left: Math.max(10, screenWidth * 0.025),
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
});
