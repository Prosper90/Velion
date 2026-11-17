import React, { useState, useCallback } from 'react';
import { Dimensions, StyleSheet, Text, View, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import BackgroundImage from '../../components/BackgroundImage';
import HeaderIcons from '../../components/HeaderIcons';
import TransactionListItem from '../../components/TransactionListItem';
import { useWalletStore } from '../../stores/walletStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { transactionHistoryRN, Transaction } from '../../utils/transaction-history-rn';
import { veilonSDK } from '../../services/veilon-sdk';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function ActivityTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'private' | 'public'>('all');

  const router = useRouter();
  const activeWallet = useWalletStore((state) => state.getActiveWallet());
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);

  // Load transactions
  const loadTransactions = async (scanBlockchain: boolean = false) => {
    try {
      if (!activeWallet?.address) {
        console.log('⚠️ No active wallet, skipping transaction load');
        setTransactions([]);
        return;
      }

      console.log('📥 Loading transactions for:', activeWallet.address);

      // Optionally scan blockchain for new incoming transactions
      if (scanBlockchain) {
        try {
          const provider = await veilonSDK.getProvider();
          if (provider) {
            console.log('🔍 Scanning blockchain for incoming transactions...');
            const newCount = await transactionHistoryRN.scanForIncomingTransactions(
              activeWallet.address,
              provider
            );
            if (newCount > 0) {
              console.log(`✅ Found ${newCount} new incoming transaction(s)`);
            }
          }
        } catch (scanError) {
          console.warn('⚠️ Failed to scan blockchain:', scanError);
          // Continue loading even if scan fails
        }
      }

      const txs = await transactionHistoryRN.getTransactions(activeWallet.address);
      console.log('✅ Loaded', txs.length, 'transaction(s)');
      setTransactions(txs);
    } catch (error) {
      console.error('❌ Failed to load transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Load transactions when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 Portfolio screen focused, loading transactions...');
      setLoading(true);
      loadTransactions();
      // Clear notification badge when viewing transaction history
      markAllAsRead();
    }, [activeWallet?.address])
  );

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions(true); // Scan blockchain on refresh
    setRefreshing(false);
  };

  // Filter transactions
  const getFilteredTransactions = () => {
    if (filter === 'all') return transactions;
    if (filter === 'private') return transactions.filter(tx => tx.isPrivate);
    if (filter === 'public') return transactions.filter(tx => !tx.isPrivate);
    return transactions;
  };

  const filteredTransactions = getFilteredTransactions();

  // Group transactions by date
  const groupTransactionsByDate = (txs: Transaction[]) => {
    const groups: { title: string; data: Transaction[] }[] = [];
    const now = new Date();

    const today: Transaction[] = [];
    const yesterday: Transaction[] = [];
    const thisWeek: Transaction[] = [];
    const older: Transaction[] = [];

    txs.forEach(tx => {
      const txDate = new Date(tx.timestamp);
      const diffTime = now.getTime() - txDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        today.push(tx);
      } else if (diffDays === 1) {
        yesterday.push(tx);
      } else if (diffDays < 7) {
        thisWeek.push(tx);
      } else {
        older.push(tx);
      }
    });

    if (today.length > 0) groups.push({ title: 'Today', data: today });
    if (yesterday.length > 0) groups.push({ title: 'Yesterday', data: yesterday });
    if (thisWeek.length > 0) groups.push({ title: 'This Week', data: thisWeek });
    if (older.length > 0) groups.push({ title: 'Older', data: older });

    return groups;
  };

  const groupedTransactions = groupTransactionsByDate(filteredTransactions);

  return (
    <SafeAreaView style={styles.container}>
      <BackgroundImage />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>VeilOn</Text>
        <HeaderIcons />
      </View>

      {/* Title and Filter */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Transactions</Text>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <Pressable
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All ({transactions.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, filter === 'private' && styles.filterButtonActive]}
          onPress={() => setFilter('private')}
        >
          <Text style={[styles.filterText, filter === 'private' && styles.filterTextActive]}>
            🔒 Private ({transactions.filter(tx => tx.isPrivate).length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, filter === 'public' && styles.filterButtonActive]}
          onPress={() => setFilter('public')}
        >
          <Text style={[styles.filterText, filter === 'public' && styles.filterTextActive]}>
            🔓 Public ({transactions.filter(tx => !tx.isPrivate).length})
          </Text>
        </Pressable>
      </View>

      {/* Transaction List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000000" />
        }
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#000000" />
            <Text style={styles.loadingText}>Loading transactions...</Text>
          </View>
        ) : filteredTransactions.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all'
                ? 'Your transaction history will appear here'
                : `No ${filter} transactions found`}
            </Text>
          </View>
        ) : (
          groupedTransactions.map((group, groupIndex) => (
            <View key={groupIndex} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              {group.data.map((transaction) => (
                <TransactionListItem
                  key={transaction.id}
                  transaction={transaction}
                  onPress={() => router.push({
                    pathname: '/transaction-details',
                    params: { txHash: transaction.hash }
                  })}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenWidth * 0.05,
    paddingTop: screenHeight * 0.02,
    paddingBottom: screenHeight * 0.02,
  },
  appName: {
    fontSize: Math.max(24, screenWidth * 0.06),
    fontWeight: 'bold',
    color: '#000000',
  },
  titleContainer: {
    paddingHorizontal: screenWidth * 0.05,
    marginBottom: screenHeight * 0.02,
  },
  title: {
    fontSize: Math.max(28, screenWidth * 0.07),
    fontWeight: 'bold',
    color: '#333333',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: screenWidth * 0.05,
    gap: 8,
    marginBottom: screenHeight * 0.02,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EEEEEE',
  },
  filterButtonActive: {
    backgroundColor: '#000000',
  },
  filterText: {
    fontSize: Math.max(13, screenWidth * 0.033),
    fontWeight: '600',
    color: '#666666',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenWidth * 0.05,
    paddingBottom: screenHeight * 0.03,
  },
  group: {
    marginBottom: screenHeight * 0.025,
  },
  groupTitle: {
    fontSize: Math.max(16, screenWidth * 0.04),
    fontWeight: '700',
    color: '#000000',
    marginBottom: screenHeight * 0.015,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: screenHeight * 0.1,
  },
  loadingText: {
    marginTop: screenHeight * 0.02,
    fontSize: Math.max(14, screenWidth * 0.035),
    color: '#666666',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: screenHeight * 0.02,
  },
  emptyTitle: {
    fontSize: Math.max(20, screenWidth * 0.05),
    fontWeight: '600',
    color: '#333333',
    marginBottom: screenHeight * 0.01,
  },
  emptySubtitle: {
    fontSize: Math.max(14, screenWidth * 0.035),
    color: '#999999',
    textAlign: 'center',
    paddingHorizontal: screenWidth * 0.1,
  },
});
