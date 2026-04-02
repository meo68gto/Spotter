import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { radius, shadows, spacing } from '../theme/design';
import { useTheme } from '../theme/provider';

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { tokens } = useTheme();
  return <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#00000000',
    ...shadows.card
  }
});
