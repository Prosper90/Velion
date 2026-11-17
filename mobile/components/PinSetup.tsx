import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackgroundImage from './BackgroundImage';
import PinInput from './PinInput';
import { PinSecurityService } from '../services/pin-security';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PinSetupProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export default function PinSetup({ onComplete, onSkip }: PinSetupProps) {
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFirstPinComplete = (pin: string) => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    setFirstPin(pin);
    setError('');
    setStep('confirm');
  };

  const handleConfirmPinComplete = async (pin: string) => {
    if (pin !== firstPin) {
      setError('PINs do not match. Try again.');
      setTimeout(() => {
        setError('');
        setStep('create');
        setFirstPin('');
      }, 2000);
      return;
    }

    try {
      setIsLoading(true);
      await PinSecurityService.setupPin(pin);

      Alert.alert(
        'PIN Set Up Successfully!',
        'Your wallet is now protected with a PIN. You will need to enter this PIN for sensitive operations.',
        [
          {
            text: 'OK',
            onPress: onComplete
          }
        ]
      );
    } catch (error: any) {
      setError(error.message || 'Failed to set up PIN');
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <BackgroundImage />
      <SafeAreaView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Set Up PIN</Text>
          <Text style={styles.subtitle}>
            {step === 'create'
              ? 'Create a 4-6 digit PIN to secure your wallet'
              : 'Confirm your PIN'}
          </Text>
        </View>

        <View style={styles.pinSection}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Setting up PIN...</Text>
            </View>
          ) : (
            <PinInput
              length={6}
              onComplete={step === 'create' ? handleFirstPinComplete : handleConfirmPinComplete}
              error={error}
              title={step === 'create' ? 'Create PIN' : 'Confirm PIN'}
            />
          )}
        </View>

        {step === 'create' && (
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>PIN Requirements:</Text>
            <Text style={styles.infoText}>• 4-6 digits</Text>
            <Text style={styles.infoText}>• Avoid obvious PINs (1234, 0000, etc.)</Text>
            <Text style={styles.infoText}>• You'll need this to access your wallet</Text>
          </View>
        )}

        {onSkip && step === 'create' && (
          <Text style={styles.skipText} onPress={onSkip}>
            Skip for now
          </Text>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    paddingHorizontal: screenWidth * 0.05,
  },
  header: {
    marginTop: screenHeight * 0.05,
    marginBottom: screenHeight * 0.05,
  },
  title: {
    fontSize: Math.max(28, screenWidth * 0.07),
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: Math.max(16, screenWidth * 0.04),
    color: '#666666',
    textAlign: 'center',
  },
  pinSection: {
    flex: 1,
    justifyContent: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666666',
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    marginVertical: 3,
  },
  skipText: {
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
});
