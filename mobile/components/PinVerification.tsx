import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackgroundImage from './BackgroundImage';
import PinInput from './PinInput';
import { PinSecurityService } from '../services/pin-security';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PinVerificationProps {
  onSuccess: () => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
}

export default function PinVerification({
  onSuccess,
  onCancel,
  title = 'Enter PIN',
  subtitle = 'Enter your PIN to continue'
}: PinVerificationProps) {
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 5;

  const handlePinComplete = async (pin: string) => {
    try {
      const isValid = await PinSecurityService.verifyPin(pin);

      if (isValid) {
        setError('');
        onSuccess();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= maxAttempts) {
          setError('Too many failed attempts. Please restart the app.');
          // Could add lockout timer here
        } else {
          setError(`Incorrect PIN. ${maxAttempts - newAttempts} attempts remaining.`);
        }
      }
    } catch (error: any) {
      setError(error.message || 'Failed to verify PIN');
    }
  };

  return (
    <Animated.View style={styles.overlay}>
      <BackgroundImage />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.pinSection}>
            <PinInput
              length={6}
              onComplete={handlePinComplete}
              error={error}
              title=""
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
    elevation: 9999,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: screenWidth * 0.9,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#999999',
    fontWeight: 'bold',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  lockIcon: {
    fontSize: 50,
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  pinSection: {
    marginVertical: 20,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});
