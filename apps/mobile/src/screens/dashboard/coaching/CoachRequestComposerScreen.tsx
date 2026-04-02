import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../../components/Button';
import type { CoachService } from '../../../hooks/useCoachCatalog';

export type CoachRequestDraftInput = {
  questionText: string;
  buyerNote: string;
  requestDetails: Record<string, unknown>;
};

type Props = {
  service: CoachService;
  initialValue?: CoachRequestDraftInput;
  onBack: () => void;
  onContinue: (value: CoachRequestDraftInput) => void;
};

export function CoachRequestComposerScreen({ service, initialValue, onBack, onContinue }: Props) {
  const [questionText, setQuestionText] = useState(initialValue?.questionText ?? '');
  const [buyerNote, setBuyerNote] = useState(initialValue?.buyerNote ?? '');
  const [focusAreas, setFocusAreas] = useState(String(initialValue?.requestDetails?.focusAreas ?? ''));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Request Details</Text>
      <Text style={styles.subtitle}>Give your coach enough context to deliver a strong first response.</Text>

      <View style={styles.section}>
        <Text style={styles.label}>What do you want help with?</Text>
        <TextInput
          value={questionText}
          onChangeText={setQuestionText}
          multiline
          style={styles.textarea}
          placeholder={`Example: I keep getting steep in transition and lose distance with my 7 iron.`}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Focus areas</Text>
        <TextInput
          value={focusAreas}
          onChangeText={setFocusAreas}
          style={styles.input}
          placeholder="Tempo, face control, low point, short game..."
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Extra note for the coach</Text>
        <TextInput
          value={buyerNote}
          onChangeText={setBuyerNote}
          multiline
          style={styles.textarea}
          placeholder={service.requiresVideo ? 'Mention the club, target, miss pattern, or what to watch for.' : 'Anything else the coach should know.'}
        />
      </View>

      <View style={styles.actions}>
        <Button title="Back" onPress={onBack} tone="secondary" />
        <Button
          title={service.requiresVideo ? 'Continue to Video' : 'Continue to Checkout'}
          onPress={() =>
            onContinue({
              questionText,
              buyerNote,
              requestDetails: {
                focusAreas: focusAreas
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean)
              }
            })
          }
          disabled={!questionText.trim()}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16, gap: 12 },
  title: { color: '#102a43', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#486581' },
  section: { gap: 6 },
  label: { color: '#334e68', fontWeight: '700' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e2ec', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  textarea: { minHeight: 110, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e2ec', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: 'top' },
  actions: { gap: 10, paddingBottom: 24 }
});
