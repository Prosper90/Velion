import React from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Transaction, TransactionType } from '../utils/transaction-history-rn';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TransactionListItemProps {
  transaction: Transaction;
  onPress?: () => void;
}

export default function TransactionListItem({ transaction, onPress }: TransactionListItemProps) {
  // Get icon based on transaction type
  const getIcon = (type: TransactionType): string => {
    switch (type) {
      case 'shield':
        return '🛡️';
      case 'unshield':
        return '🔓';
      case 'transfer':
        return '📤';
      case 'send':
        return '↗️';
      case 'receive':
        return '↙️';
      default:
        return '📝';
    }
  };

  // Get label based on transaction type
  const getLabel = (type: TransactionType): string => {
    switch (type) {
      case 'shield':
        return 'Shielded';
      case 'unshield':
        return 'Unshielded';
      case 'transfer':
        return 'Private Transfer';
      case 'send':
        return 'Sent';
      case 'receive':
        return 'Received';
      default:
        return 'Transaction';
    }
  };

  // Get color based on transaction type
  const getColor = (type: TransactionType): string => {
    switch (type) {
      case 'shield':
        return '#4CAF50'; // Green
      case 'unshield':
        return '#2196F3'; // Blue
      case 'transfer':
        return '#9C27B0'; // Purple
      case 'send':
        return '#FF9800'; // Orange
      case 'receive':
        return '#4CAF50'; // Green
      default:
        return '#666666';
    }
  };

  // Get status badge
  const getStatusBadge = () => {
    switch (transaction.status) {
      case 'pending':
        return <View style={[styles.statusBadge, styles.statusPending]}><Text style={styles.statusText}>Pending</Text></View>;
      case 'confirmed':
        return <View style={[styles.statusBadge, styles.statusConfirmed]}><Text style={styles.statusText}>Confirmed</Text></View>;
      case 'failed':
        return <View style={[styles.statusBadge, styles.statusFailed]}><Text style={styles.statusText}>Failed</Text></View>;
      default:
        return null;
    }
  };

  // Format timestamp
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now';
    }

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }

    // Less than 1 day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }

    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }

    // Format as date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Shorten hash
  const shortenHash = (hash: string): string => {
    return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
  };

  const icon = getIcon(transaction.type);
  const label = getLabel(transaction.type);
  const color = getColor(transaction.type);

  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      android_ripple={{ color: '#EEEEEE' }}
    >
      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>

      {/* Transaction Info */}
      <View style={styles.infoContainer}>
        <View style={styles.topRow}>
          <Text style={styles.label}>{label}</Text>
          {getStatusBadge()}
        </View>
        <View style={styles.bottomRow}>
          <Text style={styles.hash}>{shortenHash(transaction.hash)}</Text>
          <Text style={styles.time}>{formatTime(transaction.timestamp)}</Text>
        </View>
      </View>

      {/* Amount */}
      <View style={styles.amountContainer}>
        <Text style={[styles.amount, { color }]}>
          {transaction.type === 'receive' ? '+' : '-'}{transaction.amount} {transaction.token}
        </Text>
        {transaction.isPrivate && (
          <View style={styles.privateBadge}>
            <Text style={styles.privateBadgeText}>🔒 Private</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: screenWidth * 0.04,
    marginBottom: screenHeight * 0.015,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 24,
  },
  infoContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: Math.max(15, screenWidth * 0.038),
    fontWeight: '600',
    color: '#000000',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusPending: {
    backgroundColor: '#FFF3E0',
  },
  statusConfirmed: {
    backgroundColor: '#E8F5E9',
  },
  statusFailed: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: Math.max(10, screenWidth * 0.025),
    fontWeight: '600',
    color: '#666666',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hash: {
    fontSize: Math.max(12, screenWidth * 0.03),
    color: '#999999',
  },
  time: {
    fontSize: Math.max(11, screenWidth * 0.028),
    color: '#BBBBBB',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: Math.max(15, screenWidth * 0.038),
    fontWeight: '700',
    marginBottom: 4,
  },
  privateBadge: {
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  privateBadgeText: {
    fontSize: Math.max(10, screenWidth * 0.025),
    color: '#9C27B0',
    fontWeight: '600',
  },
});
