import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

interface PinInputProps {
  length?: number;
  onComplete: (pin: string) => void;
  error?: string;
  title?: string;
}

export default function PinInput({
  length = 6,
  onComplete,
  error,
  title = 'Enter PIN'
}: PinInputProps) {
  const [pin, setPin] = useState<string[]>(Array(length).fill(''));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (text: string, index: number) => {
    // Only allow single digit
    const digit = text.replace(/[^0-9]/g, '').slice(-1);

    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);

    // Auto-focus next input
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }

    // Check if complete
    if (newPin.every(d => d !== '')) {
      onComplete(newPin.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace') {
      if (pin[index] === '' && index > 0) {
        // Move to previous input
        inputRefs.current[index - 1]?.focus();
        setFocusedIndex(index - 1);
      } else {
        // Clear current input
        const newPin = [...pin];
        newPin[index] = '';
        setPin(newPin);
      }
    }
  };

  const handleClear = () => {
    setPin(Array(length).fill(''));
    inputRefs.current[0]?.focus();
    setFocusedIndex(0);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.pinContainer}>
        {Array(length).fill(0).map((_, index) => (
          <View
            key={index}
            style={[
              styles.pinBox,
              focusedIndex === index && styles.pinBoxFocused,
              error && styles.pinBoxError
            ]}
          >
            <TextInput
              ref={ref => inputRefs.current[index] = ref}
              style={styles.pinInput}
              value={pin[index]}
              onChangeText={text => handleChange(text, index)}
              onKeyPress={e => handleKeyPress(e, index)}
              onFocus={() => setFocusedIndex(index)}
              keyboardType="numeric"
              maxLength={1}
              secureTextEntry
              selectTextOnFocus
            />
          </View>
        ))}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
        <Text style={styles.clearButtonText}>Clear</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 30,
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  pinBox: {
    width: screenWidth * 0.12,
    height: screenWidth * 0.12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinBoxFocused: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  pinBoxError: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFF0F0',
  },
  pinInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    width: '100%',
    height: '100%',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 15,
    textAlign: 'center',
  },
  clearButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  clearButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
