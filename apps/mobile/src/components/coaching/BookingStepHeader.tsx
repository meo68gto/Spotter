import { StyleSheet, Text, View } from 'react-native';

type Props = {
  step: 1 | 2 | 3;
};

const LABELS = ['Session', 'Payment', 'Confirm'];

export function BookingStepHeader({ step }: Props) {
  return (
    <View style={styles.container}>
      {LABELS.map((label, index) => {
        const active = index + 1 === step;
        return (
          <View key={label} style={styles.item}>
            <View style={[styles.dot, active ? styles.dotActive : null]}>
              <Text style={[styles.dotText, active ? styles.dotTextActive : null]}>{index + 1}</Text>
            </View>
            <Text style={[styles.label, active ? styles.labelActive : null]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  item: { alignItems: 'center' },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bcccdc',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff'
  },
  dotActive: {
    borderColor: '#0b3a53',
    backgroundColor: '#0b3a53'
  },
  dotText: { color: '#627d98', fontWeight: '700' },
  dotTextActive: { color: '#fff' },
  label: { color: '#627d98', marginTop: 6, fontWeight: '600', fontSize: 12 },
  labelActive: { color: '#0b3a53' }
});
