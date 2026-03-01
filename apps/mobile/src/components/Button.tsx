import { Pressable, StyleSheet, Text } from 'react-native';
import { palette, radius, spacing } from '../theme/design';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'ghost';
};

export function Button({ title, onPress, disabled, tone = 'primary' }: Props) {
  return (
    <Pressable
      style={[styles.button, tone === 'secondary' ? styles.secondary : null, tone === 'ghost' ? styles.ghost : null, disabled ? styles.disabled : null]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.text, tone === 'secondary' || tone === 'ghost' ? styles.secondaryText : null]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: palette.navy600,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    alignItems: 'center'
  },
  secondary: {
    backgroundColor: palette.sky100,
    borderWidth: 1,
    borderColor: palette.sky300
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.sky300
  },
  text: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 15
  },
  secondaryText: {
    color: palette.ink900
  },
  disabled: {
    opacity: 0.4
  }
});
