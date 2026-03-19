import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../../../components/Button';

const SLOT_OPTIONS = [
  '2026-03-08T16:00:00Z',
  '2026-03-08T19:00:00Z',
  '2026-03-09T15:30:00Z',
  '2026-03-10T20:00:00Z'
];

type Props = {
  visible: boolean;
  selected: string;
  onSelect: (slot: string) => void;
  onClose: () => void;
  onContinue: () => void;
};

export function AvailabilityCalendarSheet({ visible, selected, onSelect, onClose, onContinue }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Availability</Text>
          <ScrollView>
            {SLOT_OPTIONS.map((slot) => {
              const active = slot === selected;
              return (
                <TouchableOpacity key={slot} style={[styles.slot, active ? styles.slotActive : null]} onPress={() => onSelect(slot)}>
                  <Text style={[styles.slotLabel, active ? styles.slotLabelActive : null]}>{new Date(slot).toLocaleString()}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Button title="Continue to Booking" onPress={onContinue} disabled={!selected} />
          <Button title="Cancel" onPress={onClose} tone="secondary" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '65%'
  },
  title: { fontSize: 20, fontWeight: '800', color: '#102a43', marginBottom: 10 },
  slot: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8
  },
  slotActive: {
    borderColor: '#0b3a53',
    backgroundColor: '#eaf2f8'
  },
  slotLabel: { color: '#334e68', fontWeight: '600' },
  slotLabelActive: { color: '#0b3a53' }
});
