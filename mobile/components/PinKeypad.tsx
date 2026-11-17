import React from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PinKeypadProps {
  onNumberPress: (number: string) => void;
  onBackspace: () => void;
  showBiometric?: boolean;
  onBiometricPress?: () => void;
}

export default function PinKeypad({
  onNumberPress,
  onBackspace,
  showBiometric = false,
  onBiometricPress,
}: PinKeypadProps) {
  const numbers = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [showBiometric ? '👤' : '', '0', '⌫'],
  ];

  const handlePress = (value: string) => {
    if (value === '⌫') {
      onBackspace();
    } else if (value === '👤' && onBiometricPress) {
      onBiometricPress();
    } else if (value !== '') {
      onNumberPress(value);
    }
  };

  return (
    <View style={styles.container}>
      {numbers.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((number, colIndex) => (
            <Pressable
              key={colIndex}
              style={({ pressed }) => [
                styles.key,
                pressed && styles.keyPressed,
                number === '' && styles.keyEmpty,
              ]}
              onPress={() => handlePress(number)}
              disabled={number === ''}
            >
              <Text
                style={[
                  styles.keyText,
                  (number === '⌫' || number === '👤') && styles.keyTextSpecial,
                ]}
              >
                {number}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: screenWidth * 0.05,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: screenHeight * 0.02,
  },
  key: {
    width: screenWidth * 0.25,
    height: screenWidth * 0.18,
    borderRadius: screenWidth * 0.03,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  keyPressed: {
    backgroundColor: '#F0F0F0',
    transform: [{ scale: 0.95 }],
  },
  keyEmpty: {
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    elevation: 0,
  },
  keyText: {
    fontSize: Math.max(28, screenWidth * 0.07),
    fontWeight: '600',
    color: '#000000',
  },
  keyTextSpecial: {
    fontSize: Math.max(24, screenWidth * 0.06),
  },
});
