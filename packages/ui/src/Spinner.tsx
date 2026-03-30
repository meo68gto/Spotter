import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

interface SpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  fullScreen?: boolean;
}

/**
 * Shared loading spinner.
 */
export function Spinner({ size = 'large', color, fullScreen = false }: SpinnerProps) {
  const content = (
    <ActivityIndicator size={size} color={color} />
  );

  if (fullScreen) {
    return (
      <View style={styles.fullScreen}>
        {content}
      </View>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
