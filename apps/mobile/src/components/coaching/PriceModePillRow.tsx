import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BookingMode } from '../../hooks/useBookingFlow';

type Props = {
  mode: BookingMode;
  onChange: (next: BookingMode) => void;
};

const OPTIONS: Array<{ mode: BookingMode; label: string }> = [
  { mode: 'text_answer', label: 'Text' },
  { mode: 'video_answer', label: 'Video' },
  { mode: 'video_call', label: 'Live Call' }
];

export function PriceModePillRow({ mode, onChange }: Props) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((item) => {
        const active = item.mode === mode;
        return (
          <TouchableOpacity key={item.mode} onPress={() => onChange(item.mode)} style={[styles.pill, active ? styles.activePill : null]}>
            <Text style={[styles.label, active ? styles.activeLabel : null]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bcccdc',
    backgroundColor: '#fff'
  },
  activePill: {
    borderColor: '#0b3a53',
    backgroundColor: '#eaf2f8'
  },
  label: { color: '#334e68', fontWeight: '600' },
  activeLabel: { color: '#0b3a53' }
});
