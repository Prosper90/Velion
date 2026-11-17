/**
 * Test Wallet Creation
 *
 * Run this to verify that wallet creation works with react-native-quick-crypto
 */

import { ethers } from 'ethers';

export async function testWalletCreation() {
  console.log('🧪 Testing wallet creation...');

  try {
    const startTime = Date.now();

    // Create a random wallet
    const wallet = ethers.Wallet.createRandom();

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('✅ Wallet created successfully!');
    console.log('⏱️  Time taken:', duration, 'ms');
    console.log('📍 Address:', wallet.address);
    console.log('🔑 Has private key:', wallet.privateKey ? 'Yes' : 'No');
    console.log('📝 Has mnemonic:', wallet.mnemonic ? 'Yes' : 'No');

    if (duration < 1000) {
      console.log('🚀 EXCELLENT! Wallet creation is fast (< 1 second)');
    } else if (duration < 5000) {
      console.log('✅ GOOD! Wallet creation is reasonable (< 5 seconds)');
    } else {
      console.log('⚠️  WARNING! Wallet creation is slow (> 5 seconds)');
      console.log('   Make sure react-native-quick-crypto is properly configured');
    }

    return {
      success: true,
      duration,
      address: wallet.address,
    };
  } catch (error: any) {
    console.error('❌ Wallet creation failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}
