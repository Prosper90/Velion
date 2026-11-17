import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  Alert,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TransferNoteModalProps {
  visible: boolean;
  transferNote: string;
  amount: string;
  token: string;
  onClose: () => void;
}

export default function TransferNoteModal({
  visible,
  transferNote,
  amount,
  token,
  onClose,
}: TransferNoteModalProps) {
  const [showQR, setShowQR] = useState(false);

  const handleCopyNote = async () => {
    try {
      await Clipboard.setStringAsync(transferNote);
      Alert.alert('Copied!', 'Transfer note copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
      Alert.alert('Error', 'Failed to copy transfer note');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Veilon Private Transfer\n\nAmount: ${amount} ${token}\n\nTransfer Note:\n${transferNote}\n\n⚠️ Keep this note private!`,
        title: 'Veilon Transfer Note',
      });
    } catch (error) {
      console.error('Failed to share:', error);
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
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Text style={styles.successIcon}>✅</Text>
              </View>
              <Text style={styles.title}>Transfer Note Created!</Text>
              <Text style={styles.subtitle}>
                Share this note with the recipient to complete the transfer
              </Text>
            </View>

            {/* Amount Display */}
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Amount</Text>
              <Text style={styles.amountValue}>{amount} {token}</Text>
            </View>

            {/* Warning Banner */}
            <View style={styles.warningBanner}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <View style={styles.warningContent}>
                <Text style={styles.warningTitle}>IMPORTANT</Text>
                <Text style={styles.warningText}>
                  • Only share with intended recipient{'\n'}
                  • Anyone with this note can claim funds{'\n'}
                  • Do not post publicly
                </Text>
              </View>
            </View>

            {/* Transfer Note */}
            {!showQR ? (
              <View style={styles.noteSection}>
                <Text style={styles.noteLabel}>Transfer Note</Text>
                <View style={styles.noteBox}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Text style={styles.noteText} selectable>
                      {transferNote}
                    </Text>
                  </ScrollView>
                </View>
              </View>
            ) : (
              <View style={styles.qrSection}>
                <Text style={styles.qrLabel}>Scan QR Code</Text>
                <View style={styles.qrContainer}>
                  {transferNote && transferNote.length > 0 ? (
                    <QRCode
                      value={transferNote}
                      size={screenWidth * 0.6}
                      backgroundColor="white"
                      color="black"
                    />
                  ) : (
                    <Text style={styles.errorText}>No transfer note available</Text>
                  )}
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actions}>
              <Pressable
                style={[styles.actionButton, styles.primaryButton]}
                onPress={handleCopyNote}
              >
                <Text style={styles.actionIcon}>📋</Text>
                <Text style={styles.actionButtonText}>Copy Note</Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={() => setShowQR(!showQR)}
              >
                <Text style={styles.actionIcon}>{showQR ? '📝' : '📷'}</Text>
                <Text style={styles.actionButtonText}>
                  {showQR ? 'Show Note' : 'Show QR'}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={handleShare}
              >
                <Text style={styles.actionIcon}>📤</Text>
                <Text style={styles.actionButtonText}>Share</Text>
              </Pressable>
            </View>

            {/* Instructions */}
            <View style={styles.instructions}>
              <Text style={styles.instructionsTitle}>How to send:</Text>
              <Text style={styles.instructionsText}>
                1. Copy the Transfer Note{'\n'}
                2. Send via secure messaging app{'\n'}
                   (WhatsApp, Signal, Telegram, etc.){'\n'}
                3. Recipient imports note in Veilon{'\n'}
                4. Funds added to their private balance!
              </Text>
            </View>

            {/* Close Button */}
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>Done</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: screenWidth * 0.05,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxHeight: screenHeight * 0.85,
    padding: screenWidth * 0.05,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIcon: {
    marginBottom: 12,
  },
  successIcon: {
    fontSize: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  amountSection: {
    backgroundColor: '#F5F0FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 18,
  },
  noteSection: {
    marginBottom: 16,
  },
  noteLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  noteBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  noteText: {
    fontSize: 11,
    color: '#000000',
    fontFamily: 'monospace',
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  errorText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    padding: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  primaryButton: {
    backgroundColor: '#B39DDB',
  },
  secondaryButton: {
    backgroundColor: '#F5F0FF',
    borderWidth: 1,
    borderColor: '#B39DDB',
  },
  actionIcon: {
    fontSize: 16,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  instructions: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 20,
  },
  closeButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
