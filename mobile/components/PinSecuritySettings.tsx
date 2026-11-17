import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackgroundImage from './BackgroundImage';
import PinSetup from './PinSetup';
import PinVerification from './PinVerification';
import { PinSecurityService } from '../services/pin-security';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PinSecuritySettingsProps {
  onBack: () => void;
}

export default function PinSecuritySettings({ onBack }: PinSecuritySettingsProps) {
  const [isPinSet, setIsPinSet] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showPinVerification, setShowPinVerification] = useState(false);
  const [verificationAction, setVerificationAction] = useState<'change' | 'remove' | null>(null);

  useEffect(() => {
    checkPinStatus();
  }, []);

  const checkPinStatus = async () => {
    const pinSet = await PinSecurityService.isPinSet();
    setIsPinSet(pinSet);
  };

  const handleSetupPin = () => {
    setShowPinSetup(true);
  };

  const handleChangePin = () => {
    setVerificationAction('change');
    setShowPinVerification(true);
  };

  const handleRemovePin = () => {
    setVerificationAction('remove');
    setShowPinVerification(true);
  };

  const handleVerificationSuccess = () => {
    setShowPinVerification(false);

    if (verificationAction === 'change') {
      setShowPinSetup(true);
    } else if (verificationAction === 'remove') {
      removePin();
    }
  };

  const removePin = async () => {
    try {
      // PIN already verified, so we can remove it directly
      await PinSecurityService.removePin('000000'); // Dummy value since already verified
      setIsPinSet(false);
      Alert.alert('Success', 'PIN removed successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to remove PIN');
    }
  };

  const handlePinSetupComplete = () => {
    setShowPinSetup(false);
    checkPinStatus();
  };

  if (showPinSetup) {
    return <PinSetup onComplete={handlePinSetupComplete} />;
  }

  return (
    <View style={styles.container}>
      <BackgroundImage />
      <SafeAreaView style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>PIN Security</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security Status</Text>

          <View style={styles.statusCard}>
            <Text style={styles.statusIcon}>{isPinSet ? '🔒' : '🔓'}</Text>
            <Text style={styles.statusText}>
              {isPinSet ? 'PIN is enabled' : 'PIN is not set'}
            </Text>
            <Text style={styles.statusSubtext}>
              {isPinSet
                ? 'Your wallet is protected with a PIN'
                : 'Set up a PIN to add an extra layer of security'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PIN Actions</Text>

          {!isPinSet ? (
            <TouchableOpacity style={styles.actionButton} onPress={handleSetupPin}>
              <Text style={styles.actionButtonIcon}>🔐</Text>
              <View style={styles.actionButtonContent}>
                <Text style={styles.actionButtonTitle}>Set Up PIN</Text>
                <Text style={styles.actionButtonSubtitle}>
                  Add a PIN to secure your wallet
                </Text>
              </View>
              <Text style={styles.actionButtonArrow}>›</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.actionButton} onPress={handleChangePin}>
                <Text style={styles.actionButtonIcon}>🔄</Text>
                <View style={styles.actionButtonContent}>
                  <Text style={styles.actionButtonTitle}>Change PIN</Text>
                  <Text style={styles.actionButtonSubtitle}>
                    Update your existing PIN
                  </Text>
                </View>
                <Text style={styles.actionButtonArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.dangerButton]}
                onPress={handleRemovePin}
              >
                <Text style={styles.actionButtonIcon}>🗑️</Text>
                <View style={styles.actionButtonContent}>
                  <Text style={[styles.actionButtonTitle, styles.dangerText]}>Remove PIN</Text>
                  <Text style={styles.actionButtonSubtitle}>
                    Disable PIN protection
                  </Text>
                </View>
                <Text style={[styles.actionButtonArrow, styles.dangerText]}>›</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>About PIN Security</Text>
          <Text style={styles.infoText}>
            • Your PIN is stored securely using hardware encryption
          </Text>
          <Text style={styles.infoText}>
            • You'll need your PIN to access sensitive operations
          </Text>
          <Text style={styles.infoText}>
            • If you forget your PIN, you'll need to restore your wallet using your seed phrase
          </Text>
        </View>
      </SafeAreaView>

      {showPinVerification && (
        <PinVerification
          onSuccess={handleVerificationSuccess}
          onCancel={() => {
            setShowPinVerification(false);
            setVerificationAction(null);
          }}
          title="Verify PIN"
          subtitle={`Enter your current PIN to ${verificationAction === 'change' ? 'change it' : 'remove it'}`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F5F5F5',
    zIndex: 1000,
    elevation: 1000,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenWidth * 0.05,
    paddingVertical: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 28,
    color: '#000000',
    fontWeight: 'bold',
  },
  title: {
    fontSize: Math.max(24, screenWidth * 0.06),
    fontWeight: 'bold',
    color: '#000000',
  },
  placeholder: {
    width: 40,
  },
  section: {
    paddingHorizontal: screenWidth * 0.05,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 5,
  },
  statusSubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonIcon: {
    fontSize: 30,
    marginRight: 15,
  },
  actionButtonContent: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  actionButtonSubtitle: {
    fontSize: 13,
    color: '#666666',
  },
  actionButtonArrow: {
    fontSize: 28,
    color: '#999999',
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  dangerText: {
    color: '#FF3B30',
  },
  infoSection: {
    margin: screenWidth * 0.05,
    marginTop: 30,
    padding: 20,
    backgroundColor: '#FFF9E6',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFE066',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 13,
    color: '#666666',
    marginVertical: 3,
  },
});
