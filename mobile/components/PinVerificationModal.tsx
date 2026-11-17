import React, { useState, useEffect } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Vibration,
} from 'react-native';
import PinKeypad from './PinKeypad';
import { useSecurityStore } from '../stores/securityStore';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PinVerificationModalProps {
  visible: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
}

export default function PinVerificationModal({
  visible,
  onSuccess,
  onCancel,
  title = 'Enter PIN',
  subtitle = 'Enter your PIN to continue',
}: PinVerificationModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const { verifyPin, biometricsEnabled, authenticate } = useSecurityStore();

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setPin('');
      setError('');
    }
  }, [visible]);

  const handleNumberPress = (number: string) => {
    if (pin.length < 6) {
      const newPin = pin + number;
      setPin(newPin);
      setError('');

      // Auto-verify when PIN reaches exactly 6 digits
      if (newPin.length === 6) {
        setTimeout(() => handleVerify(newPin), 100);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleVerify = async (pinToVerify: string = pin) => {
    try {
      const isValid = await verifyPin(pinToVerify);

      if (isValid) {
        setPin('');
        setError('');
        setAttempts(0);
        onSuccess();
      } else {
        // Vibrate on error
        Vibration.vibrate([0, 100, 100, 100]);
        setError('Incorrect PIN');
        setPin('');
        setAttempts(attempts + 1);

        if (attempts >= 4) {
          setError('Too many attempts. Please try again later.');
          // TODO: Implement lockout mechanism
        }
      }
    } catch (error) {
      console.error('Failed to verify PIN:', error);
      setError('Verification failed');
      setPin('');
    }
  };

  const handleBiometricPress = async () => {
    try {
      const success = await authenticate();
      if (success) {
        setPin('');
        setError('');
        setAttempts(0);
        onSuccess();
      } else {
        setError('Biometric authentication failed');
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      setError('Authentication failed');
    }
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

  // Don't render Modal at all when not visible (Android fix)
  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {/* PIN Dots */}
          <View style={styles.pinDotsContainer}>{renderPinDots()}</View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Keypad */}
          <PinKeypad
            onNumberPress={handleNumberPress}
            onBackspace={handleBackspace}
            showBiometric={biometricsEnabled}
            onBiometricPress={handleBiometricPress}
          />

          {/* Cancel Button */}
          {onCancel && (
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#F8F8F8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: screenHeight * 0.04,
    paddingBottom: screenHeight * 0.05,
    minHeight: screenHeight * 0.65,
  },
  header: {
    alignItems: 'center',
    marginBottom: screenHeight * 0.04,
    paddingHorizontal: screenWidth * 0.05,
  },
  title: {
    fontSize: Math.max(24, screenWidth * 0.06),
    fontWeight: '700',
    color: '#000000',
    marginBottom: screenHeight * 0.01,
  },
  subtitle: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: '#666666',
    textAlign: 'center',
  },
  pinDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: screenHeight * 0.04,
    gap: 16,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  pinDotError: {
    borderColor: '#F44336',
    backgroundColor: '#F44336',
  },
  errorContainer: {
    alignItems: 'center',
    marginBottom: screenHeight * 0.02,
    paddingHorizontal: screenWidth * 0.05,
  },
  errorText: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: '#F44336',
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    alignItems: 'center',
    marginTop: screenHeight * 0.02,
    paddingVertical: screenHeight * 0.02,
  },
  cancelButtonText: {
    fontSize: Math.max(16, screenWidth * 0.04),
    color: '#666666',
    fontWeight: '600',
  },
});
