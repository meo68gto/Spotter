import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

// m-6: Added variant and style props to Button
type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, disabled, variant = 'primary', style }: Props) {
  return (
    <Pressable
      style={[
        styles.button,
        variant === 'secondary' ? styles.secondary : null,
        variant === 'ghost' ? styles.ghost : null,
        disabled ? styles.disabled : null,
        style
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.text,
          variant === 'secondary' ? styles.secondaryText : null,
          variant === 'ghost' ? styles.ghostText : null
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#0b3a53',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 8,
    alignItems: 'center'
  },
  secondary: {
    backgroundColor: '#e4e7eb'
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#0b3a53'
  },
  text: {
    color: '#fff',
    fontWeight: '600'
  },
  secondaryText: {
    color: '#243b53'
  },
  ghostText: {
    color: '#0b3a53'
  },
  disabled: {
    opacity: 0.4
  }
});
