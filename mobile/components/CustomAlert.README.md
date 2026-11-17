# CustomAlert Component

A beautiful, reusable alert modal component for the Veilon mobile app that replaces the native `Alert.alert()` with a styled, animated modal.

## Features

✅ **4 Alert Types**: Success, Error, Warning, Info
✅ **Smooth Animations**: Scale + fade animations
✅ **Backdrop Blur**: iOS native blur, Android dark overlay
✅ **Custom Actions**: Up to 3 action buttons
✅ **Type-Safe**: Full TypeScript support
✅ **Accessible**: Works with accessibility features

---

## Usage

### 1. Import the hook and component

```tsx
import CustomAlert from "../components/CustomAlert";
import { useCustomAlert } from "../hooks/useCustomAlert";
```

### 2. Initialize the hook in your component

```tsx
export default function YourScreen() {
  const { alertState, showAlert, hideAlert } = useCustomAlert();

  // Your component code...
}
```

### 3. Show alerts

```tsx
// Success Alert
showAlert({
  type: "success",
  title: "Success!",
  message: "Your transaction was successful",
  actions: [
    { text: "OK", style: "primary" }
  ],
});

// Error Alert
showAlert({
  type: "error",
  title: "Error",
  message: "Something went wrong. Please try again.",
  actions: [
    { text: "Retry", style: "primary", onPress: handleRetry },
    { text: "Cancel", style: "cancel" }
  ],
});

// Warning Alert
showAlert({
  type: "warning",
  title: "Are you sure?",
  message: "This action cannot be undone.",
  actions: [
    { text: "Cancel", style: "cancel" },
    { text: "Continue", style: "primary", onPress: handleContinue }
  ],
});

// Info Alert
showAlert({
  type: "info",
  title: "Did you know?",
  message: "You can shield tokens for complete privacy.",
  actions: [
    { text: "Learn More", style: "default", onPress: openDocs },
    { text: "Got it", style: "primary" }
  ],
});
```

### 4. Add the component to your render

```tsx
return (
  <View>
    {/* Your screen content */}

    {/* Custom Alert Modal */}
    <CustomAlert
      visible={alertState.visible}
      type={alertState.type}
      title={alertState.title}
      message={alertState.message}
      actions={alertState.actions}
      onClose={hideAlert}
    />
  </View>
);
```

---

## Alert Types

| Type | Icon | Color | Use Case |
|------|------|-------|----------|
| `success` | ✓ | Green | Successful operations |
| `error` | ✕ | Red | Failed operations, errors |
| `warning` | ! | Orange | Confirmations, cautions |
| `info` | i | Blue | General information |

---

## Action Button Styles

| Style | Appearance | Use Case |
|-------|------------|----------|
| `primary` | Colored background (based on alert type) | Main action |
| `default` | Light gray background | Secondary action |
| `cancel` | Transparent with border | Cancel/dismiss |

---

## API Reference

### `showAlert(config: AlertConfig)`

Show an alert with the given configuration.

**Parameters:**

```typescript
interface AlertConfig {
  type?: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  actions?: AlertAction[];
}

interface AlertAction {
  text: string;
  onPress?: () => void;
  style?: "default" | "primary" | "cancel";
}
```

**Example:**

```tsx
showAlert({
  type: "success",
  title: "Shield Successful!",
  message: "Your tokens are now private",
  actions: [
    { text: "View on Explorer", style: "default", onPress: openExplorer },
    { text: "Done", style: "primary", onPress: goBack }
  ],
});
```

### `hideAlert()`

Manually hide the currently visible alert.

```tsx
hideAlert();
```

---

## Migration from `Alert.alert()`

### Before (Native Alert):

```tsx
Alert.alert(
  "Shield Successful!",
  "Your tokens are now private",
  [
    { text: "View on Explorer", onPress: openExplorer },
    { text: "OK" }
  ]
);
```

### After (Custom Alert):

```tsx
showAlert({
  type: "success",
  title: "Shield Successful!",
  message: "Your tokens are now private",
  actions: [
    { text: "View on Explorer", style: "default", onPress: openExplorer },
    { text: "OK", style: "primary" }
  ],
});
```

---

## Examples

### Example 1: Shield Success with Explorer Link

```tsx
showAlert({
  type: "success",
  title: "Shield Successful!",
  message: `Successfully shielded ${amount} ${token}\n\nTx: ${txHash.substring(0, 10)}...`,
  actions: [
    {
      text: "View on Explorer",
      style: "default",
      onPress: () => {
        Linking.openURL(`https://sepolia.etherscan.io/tx/${txHash}`);
      },
    },
    {
      text: "Done",
      style: "primary",
      onPress: () => {
        router.back();
      },
    },
  ],
});
```

### Example 2: Insufficient Balance Error

```tsx
showAlert({
  type: "error",
  title: "Insufficient Balance",
  message: `You only have ${balance} ${token}`,
  actions: [
    { text: "OK", style: "primary" }
  ],
});
```

### Example 3: Delete Confirmation

```tsx
showAlert({
  type: "warning",
  title: "Delete Wallet?",
  message: "This action cannot be undone. Make sure you have backed up your seed phrase.",
  actions: [
    { text: "Cancel", style: "cancel" },
    {
      text: "Delete",
      style: "primary",
      onPress: async () => {
        await deleteWallet();
      },
    },
  ],
});
```

### Example 4: Network Switch Info

```tsx
showAlert({
  type: "info",
  title: "Switch Network",
  message: "This dApp requires Sepolia testnet. Would you like to switch now?",
  actions: [
    { text: "Later", style: "cancel" },
    {
      text: "Switch",
      style: "primary",
      onPress: () => switchNetwork("sepolia"),
    },
  ],
});
```

---

## Styling Customization

The component uses your app's existing color scheme. If you want to customize colors, edit `CustomAlert.tsx`:

```tsx
const styles = StyleSheet.create({
  // Customize colors here
  alertCard: {
    backgroundColor: "#FFFFFF", // Card background
    borderRadius: 20,           // Corner radius
    // ...
  },
  // ...
});
```

---

## Best Practices

1. **Use appropriate alert types**
   - `success` for completed actions
   - `error` for failures
   - `warning` for confirmations
   - `info` for general messages

2. **Keep messages concise**
   - Title: 2-5 words
   - Message: 1-3 sentences

3. **Limit actions to 2-3 buttons**
   - More than 3 becomes cluttered

4. **Use action styles correctly**
   - Primary action: `style: "primary"`
   - Destructive action: `style: "primary"` (with warning/error type)
   - Cancel action: `style: "cancel"`

5. **Always provide at least one action**
   - Default: `[{ text: "OK", style: "primary" }]`

---

## Integration Status

✅ **Implemented:**
- `shield-tokens.tsx` - All alerts converted

⏳ **TODO (Optional):**
- `unshield-tokens.tsx`
- `private-transfer.tsx`
- `send-tokens.tsx`
- `transfer.tsx`
- Other screens with Alert.alert() calls

---

## Troubleshooting

### Alert doesn't appear

Make sure you:
1. Added `<CustomAlert />` to your render
2. Initialized the hook: `useCustomAlert()`
3. Called `showAlert()` with valid config

### Blur not working on Android

This is expected. Android uses a dark overlay instead of native blur. To improve Android appearance, install `react-native-blur` if needed.

### Animation is choppy

Make sure `useNativeDriver: true` is set in all Animated calls (already done by default).

---

## License

Part of the Veilon privacy wallet project.
