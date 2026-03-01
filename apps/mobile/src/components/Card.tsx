import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { palette, radius, shadows, spacing } from '../theme/design';

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.sky200,
    ...shadows.card
  }
});
