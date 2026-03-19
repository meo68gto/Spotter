import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, shadows, spacing } from '../theme/design';
import { useTheme } from '../theme/provider';

export function Card({ children }: PropsWithChildren) {
  const { tokens } = useTheme();
  return <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>{children}</View>;
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
