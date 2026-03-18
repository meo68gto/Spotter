import { Pressable, StyleSheet, Text } from 'react-native';
import { radius, spacing } from '../theme/design';
import { useTheme } from '../theme/provider';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'ghost';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

export function Button({ title, onPress, disabled, tone = 'primary', accessibilityLabel, accessibilityHint, testID }: Props) {
  const { tokens } = useTheme();
  return (
    <Pressable
      style={[
        styles.button,
        { backgroundColor: tokens.primary },
        tone === 'secondary' ? [styles.secondary, { backgroundColor: tokens.backgroundMuted, borderColor: tokens.borderStrong }] : null,
        tone === 'ghost' ? [styles.ghost, { borderColor: tokens.borderStrong }] : null,
        disabled ? styles.disabled : null
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      <Text style={[styles.text, { color: tokens.primaryContrast }, tone === 'secondary' || tone === 'ghost' ? { color: tokens.text } : null]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    alignItems: 'center'
  },
  secondary: {
    borderWidth: 1,
    borderColor: '#00000000'
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00000000'
  },
  text: {
    fontWeight: '700',
    fontSize: 15
  },
  disabled: {
    opacity: 0.4
  }
});
