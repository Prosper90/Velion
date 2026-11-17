import React, { useEffect, useState } from 'react';
import { Animated, BackHandler, Dimensions, ScrollView, StyleSheet, Text, View, Alert, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BackgroundImage from './BackgroundImage';
import BlackBanner from './BlackBanner';
import DualImageBanner from './DualImageBanner';
import HeaderIcons from './HeaderIcons';
import PrivateKeyModal from './PrivateKeyModal';
import ShowSeedPhrase from './ShowSeedPhrase';
import ShowViewingKey from './ShowViewingKey';
import { useWalletStore } from '../stores/walletStore';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface WalletSettingsProps {
  onBack: () => void;
  walletTitle: string;
}

export default function WalletSettings({ onBack, walletTitle }: WalletSettingsProps) {
  const insets = useSafeAreaInsets();
  const { wallets, activeWalletAddress, setActiveWallet, deleteWallet } = useWalletStore();
  const [showVeilOnModal, setShowVeilOnModal] = useState(false);
  const [showPublicModal, setShowPublicModal] = useState(false);
  const [showViewingKey, setShowViewingKey] = useState(false);
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);

  // Find current wallet
  const currentWallet = wallets.find(w => w.name === walletTitle);
  const isActive = currentWallet?.address === activeWalletAddress;
  

  
  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, [onBack]);

  // Handle switching active wallet
  const handleSetActiveWallet = async () => {
    if (currentWallet && !isActive) {
      try {
        await setActiveWallet(currentWallet.address);
        Alert.alert('Success', `${currentWallet.name} is now active`);
        onBack(); // Go back to wallet list after switching
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to switch wallet');
      }
    }
  };

  // Handle wallet deletion
  const handleDeleteWallet = () => {
    if (!currentWallet) return;

    Alert.alert(
      'Delete Wallet',
      `Are you sure you want to remove "${currentWallet.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWallet(currentWallet.address);
              Alert.alert('Success', 'Wallet deleted successfully');
              onBack(); // Go back to wallet list
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete wallet');
            }
          },
        },
      ]
    );
  };

  return (
    <Animated.View 
      style={styles.walletSettings}
      pointerEvents="box-none"
    >
      <BackgroundImage />
      <SafeAreaView style={styles.walletSettingsContainer}>
        {showViewingKey ? (
          <ShowViewingKey
            onBack={() => setShowViewingKey(false)}
            viewingKey="0zk1qykj4r5uw7ad2wtups9e0p7lfq7bhuqdnhfm8zkwenz5klvyyz9neqegtl32qaywkjmaehw22dg72mt866hmcqz"
          />
        ) : showSeedPhrase ? (
          <ShowSeedPhrase
            onBack={() => setShowSeedPhrase(false)}
          />
        ) : (
          <>
            {/* Wallet Settings Header */}
            <View style={styles.walletSettingsHeader}>
              <Pressable onPress={onBack} style={styles.backButton}>
                <Text style={styles.backIcon}>←</Text>
              </Pressable>
              <Text style={styles.walletSettingsTitle}>{walletTitle}</Text>
              <HeaderIcons />
            </View>
        
        {/* Scrollable Content */}
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 80 } // 80px for nav bar + safe area
          ]}
        >
          {/* Wallet Active/Inactive Banner */}
          <View style={styles.bannerContainer}>
            {isActive ? (
              <BlackBanner
                header="Wallet is Active"
                subtitle="This wallet is being used for balances and transactions"
                icon={require('../assets/images/check.svg')}
              />
            ) : (
              <BlackBanner
                header="Make Active Wallet"
                subtitle="Tap to use this wallet for transactions"
                icon={require('../assets/images/check.svg')}
                onPress={handleSetActiveWallet}
              />
            )}
          </View>
          
          {/* WALLET DETAILS Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>WALLET DETAILS</Text>
          </View>
          
          {/* Name Banner */}
          <View style={styles.bannerContainer}>
            <BlackBanner
              header="Name"
              subtitle={walletTitle}
              icon={require('../assets/images/pencil.svg')}
            />
          </View>
          
          {/* VEILON: All chains Banner */}
          <View style={styles.bannerContainer}>
            <DualImageBanner
              leftIcon={require('../assets/images/shield-check.svg')}
              rightIcon={require('../assets/images/_.svg')}
              header="VEILON: All chains"
              subtitle="0zlu9fr8bfux......"
              onPress={() => setShowVeilOnModal(true)}
            />
          </View>
          
          {/* PUBLIC: All chains Banner */}
          <View style={styles.bannerContainer}>
            <DualImageBanner
              leftIcon={require('../assets/images/Icon.svg')}
              rightIcon={require('../assets/images/_.svg')}
              header="PUBLIC: All chains"
              subtitle={currentWallet ? `${currentWallet.address.substring(0, 10)}......${currentWallet.address.substring(currentWallet.address.length - 6)}` : "N/A"}
              onPress={() => setShowPublicModal(true)}
            />
          </View>
          
          {/* SHARING OPTIONS Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>SHARING OPTIONS</Text>
          </View>
          
                        {/* Show Viewing Key Banner */}
              <View style={styles.bannerContainer}>
                <BlackBanner
                  header="Show Viewing Key"
                  subtitle="The private Key can be used ..."
                  icon={require('../assets/images/_.svg')}
                  onPress={() => setShowViewingKey(true)}
                />
              </View>
          
          {/* BACKUP OPTIONS Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>BACKUP OPTIONS</Text>
          </View>
          
                        {/* Show Seed Phrase Banner */}
              <View style={styles.bannerContainer}>
                <BlackBanner
                  header="Show Seed Phrase"
                  subtitle="if you lose access to this device, your..."
                  icon={require('../assets/images/_.svg')}
                  onPress={() => setShowSeedPhrase(true)}
                />
              </View>
          
          {/* DELETE WALLET Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>DELETE WALLET</Text>
          </View>
          
          {/* Thin Line Separator */}
          <View style={styles.separatorLine} />

          {/* Remove This Wallet Button */}
          <Pressable style={styles.deleteContainer} onPress={handleDeleteWallet}>
            <Text style={styles.deleteText}>REMOVE THIS WALLET</Text>
          </Pressable>
          

                 </ScrollView>
           </>
         )}
         
         {/* VEILON Private Key Modal */}
        <PrivateKeyModal
          visible={showVeilOnModal}
          onClose={() => setShowVeilOnModal(false)}
          privateKey="0zk1qykj4r5uw7ad2wtups9e0p7lfq7bhuqdnhfm 8zkwenz5klvcwyyf0rrv7j6fe3z53lu7prpsgm5jsk e52ra7yyz9neqegtl32qaywkjmaehw22dg72mt8 66hmcqz"
          title="VEILON: All chains"
        />
        
        {/* PUBLIC Private Key Modal */}
        <PrivateKeyModal
          visible={showPublicModal}
          onClose={() => setShowPublicModal(false)}
          privateKey={currentWallet?.address || "N/A"}
          title="PUBLIC: All chains"
        />
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  walletSettings: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
    elevation: 1000, // For Android
  },
  walletSettingsContainer: {
    flex: 1,
  },
  walletSettingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenWidth * 0.05,
    paddingTop: 0,
    paddingBottom: 0,
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
  walletSettingsTitle: {
    fontSize: Math.max(24, screenWidth * 0.06),
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    flex: 1,
  },
  walletSettingsContent: {
    flex: 1,
    paddingHorizontal: screenWidth * 0.05,
    paddingTop: screenHeight * 0.02,
  },
  bannerContainer: {
    paddingHorizontal: screenWidth * 0.05,
    marginBottom: screenHeight * 0.02,
  },
  sectionContainer: {
    paddingHorizontal: screenWidth * 0.05,
    marginBottom: screenHeight * 0.01,
  },
  sectionTitle: {
    fontSize: Math.max(18, screenWidth * 0.045),
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'left',
  },
  placeholderText: {
    fontSize: Math.max(16, screenWidth * 0.04),
    color: '#666666',
    textAlign: 'center',
    marginTop: screenHeight * 0.1,
  },

  bottomSpacer: {
    height: screenHeight * 0.05,
  },
  separatorLine: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: screenWidth * 0.05,
    marginVertical: screenHeight * 0.02,
  },
  deleteContainer: {
    paddingHorizontal: screenWidth * 0.05,
    marginBottom: screenHeight * 0.02,
  },
  deleteText: {
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: '600',
    color: '#FF0000',
    textAlign: 'left',
  },
  scrollView: {
    flex: 1,
    height: '100%', // Explicit height for mobile devices
  },
  scrollContent: {
    // paddingBottom removed - now calculated dynamically with safe area insets
  },
});
