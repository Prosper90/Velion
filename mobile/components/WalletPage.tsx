import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Animated, BackHandler, Dimensions, Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import BackgroundImage from './BackgroundImage';
import CustomBanner3 from './CustomBanner3';
import HeaderIcons from './HeaderIcons';
import WalletSettings from './WalletSettings';
import { useWalletStore } from '../stores/walletStore';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface WalletPageProps {
  onBack: () => void;
}

export default function WalletPage({ onBack }: WalletPageProps) {
  const router = useRouter();
  const { wallets, activeWalletAddress } = useWalletStore();
  const [showWalletSettings, setShowWalletSettings] = useState(false);
  const [selectedWalletAddress, setSelectedWalletAddress] = useState('');

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, [onBack]);

  // Handle iOS back gesture and navigation back
  useFocusEffect(
    React.useCallback(() => {
      // This will be called when the screen comes into focus
      // iOS back gesture is handled automatically by React Navigation
      return () => {
        // This will be called when the screen goes out of focus
      };
    }, [])
  );

  const handleWalletPress = (walletAddress: string) => {
    setSelectedWalletAddress(walletAddress);
    setShowWalletSettings(true);
  };

  const handleBackFromSettings = () => {
    setShowWalletSettings(false);
  };

  // Helper to truncate address
  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.substring(0, 6)}....${address.substring(address.length - 4)}`;
  };

  return (
    <Animated.View style={styles.walletPage}>
      <BackgroundImage />
      <SafeAreaView style={styles.walletPageContainer}>
        {showWalletSettings ? (
          <WalletSettings
            onBack={handleBackFromSettings}
            walletTitle={wallets.find(w => w.address === selectedWalletAddress)?.name || ''}
          />
        ) : (
          <>
            {/* Wallet Page Header */}
            <View style={styles.walletPageHeader}>
              <Pressable onPress={onBack} style={styles.backButton}>
                <Text style={styles.backIcon}>←</Text>
              </Pressable>
              <Text style={styles.walletPageTitle}>Wallets</Text>
              <HeaderIcons />
            </View>

            {/* Wallet List */}
            <ScrollView style={styles.walletList} showsVerticalScrollIndicator={false}>
              {wallets.map((wallet) => (
                <CustomBanner3
                  key={wallet.address}
                  icon={require('../assets/images/card-wallet.svg')}
                  title={wallet.name}
                  actionText={`Public EVM: ${truncateAddress(wallet.address)}`}
                  secondSubtitle={`Balance: ${wallet.publicBalance} ETH`}
                  rightImage={require('../assets/images/_.svg')}
                  showCheckmark={wallet.address === activeWalletAddress}
                  onPress={() => handleWalletPress(wallet.address)}
                />
              ))}

              {wallets.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No wallets found</Text>
                  <Text style={styles.emptyStateSubtext}>Create or import a wallet to get started</Text>
                </View>
              )}
            </ScrollView>
          </>
        )}
      </SafeAreaView>
      
      {/* New Wallet Button - Fixed at Bottom */}
      {!showWalletSettings && (
        <View style={styles.bottomButtonContainer}>
          <Pressable
            style={styles.gradientButton}
            onPress={() => {
              onBack(); // Close wallet page first
              setTimeout(() => router.push('/add-wallet'), 100); // Then navigate
            }}
          >
            <LinearGradient
              colors={['#62615B', '#222220']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientOverlay}
            >
              <Text style={styles.gradientButtonText}>New Wallet</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  walletPage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F5F5F5',
    zIndex: 1000,
    elevation: 1000, // For Android
  },
  walletPageContainer: {
    flex: 1,
  },
  walletPageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenWidth * 0.05,
    paddingTop: 0,
    paddingBottom: screenHeight * 0.02,
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
  walletPageTitle: {
    fontSize: Math.max(24, screenWidth * 0.06),
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    flex: 1,
  },
  walletList: {
    flex: 1,
    paddingBottom: screenHeight * 0.15,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: screenHeight * 0.1,
    paddingHorizontal: screenWidth * 0.1,
  },
  emptyStateText: {
    fontSize: Math.max(18, screenWidth * 0.045),
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: '#999',
    textAlign: 'center',
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: screenHeight * 0.05,
    backgroundColor: 'transparent',
  },
  gradientButton: {
    borderRadius: 16,
    marginHorizontal: screenWidth * 0.05,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gradientOverlay: {
    paddingVertical: screenHeight * 0.025,
    paddingHorizontal: screenWidth * 0.1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientButtonText: {
    fontSize: Math.max(18, screenWidth * 0.045),
    fontWeight: 'bold',
    color: '#FFFFFF',
  }
});
