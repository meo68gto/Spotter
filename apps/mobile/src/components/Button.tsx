import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { radius, spacing } from '../theme/design';
import { useTheme } from '../theme/provider';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'secondary' | 'ghost';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

export function Button({ title, onPress, disabled, loading, tone = 'primary', style, accessibilityLabel, accessibilityHint, testID }: Props) {
  const { tokens } = useTheme();
  const isDisabled = disabled || loading;
  const textColor = tone === 'secondary' || tone === 'ghost' ? tokens.text : tokens.primaryContrast;
  return (
    <Pressable
      style={[
        styles.button,
        { backgroundColor: tokens.primary },
        tone === 'secondary' ? [styles.secondary, { backgroundColor: tokens.backgroundMuted, borderColor: tokens.borderStrong }] : null,
        tone === 'ghost' ? [styles.ghost, { borderColor: tokens.borderStrong }] : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      {loading ? <ActivityIndicator size="small" color={textColor} /> : null}
      <Text style={[styles.text, { color: textColor }, loading ? styles.loadingText : null]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
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
  loadingText: {
    marginLeft: spacing.sm
  },
  disabled: {
    opacity: 0.4
  }
});
