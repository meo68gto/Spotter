import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ImageBackground, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Button } from '../../components/Button';
import { showToast } from '../../components/ToastHost';
import { stockPhotos } from '../../lib/stockPhotos';
import { invokeFunction } from '../lib/api';
import { trackEvent } from '../../lib/analytics';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/provider';

type ActivityOption = {
  id: string;
  name: string;
};

type AvailabilitySlot = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  enabled: boolean;
};

type Draft = {
  activityId: string;
  sourceScale: string;
  sourceValue: string;
  canonicalScore: number;
  skillBand: string;
  city: string;
  timezone: string;
  availabilitySlots: AvailabilitySlot[];
};

const STORAGE_KEY = 'spotter:onboarding-wizard-draft';

const SKILL_OPTIONS = [
  { label: 'Beginner', value: 'beginner', score: 30 },
  { label: 'Intermediate', value: 'intermediate', score: 55 },
  { label: 'Advanced', value: 'advanced', score: 75 },
  { label: 'Expert', value: 'expert', score: 90 }
] as const;

const defaultAvailability = (): AvailabilitySlot[] => [
  { weekday: 1, startMinute: 480, endMinute: 1080, enabled: true },
  { weekday: 2, startMinute: 480, endMinute: 1080, enabled: true },
  { weekday: 3, startMinute: 480, endMinute: 1080, enabled: true },
  { weekday: 4, startMinute: 480, endMinute: 1080, enabled: true },
  { weekday: 5, startMinute: 480, endMinute: 1080, enabled: true },
  { weekday: 6, startMinute: 480, endMinute: 1080, enabled: false },
  { weekday: 0, startMinute: 480, endMinute: 1080, enabled: false }
];

const initialDraft: Draft = {
  activityId: '',
  sourceScale: 'self_assessment',
  sourceValue: 'intermediate',
  canonicalScore: 55,
  skillBand: 'intermediate',
  city: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  availabilitySlots: defaultAvailability()
};

const stepPhotos = [
  stockPhotos.onboardingSport,
  stockPhotos.onboardingSkill,
  stockPhotos.onboardingLocation,
  stockPhotos.onboardingAvailability
];

const stepNames = ['Sport', 'Skill', 'Location', 'Availability'] as const;

export function OnboardingWizardScreen({ onComplete }: { onComplete: () => void }) {
  const { tokens } = useTheme();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityOption[]>([]);
  const [draft, setDraft] = useState<Draft>(initialDraft);

  useEffect(() => {
    const load = async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setDraft({ ...initialDraft, ...JSON.parse(saved) });
      }

      const { data } = await supabase.from('activities').select('id,name').order('name', { ascending: true });
      const list = ((data ?? []) as ActivityOption[]).slice(0, 24);
      setActivities(list);
      if (list.length && !(saved && JSON.parse(saved).activityId)) {
        setDraft((prev) => ({ ...prev, activityId: list[0].id }));
      }
    };
    load();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft)).catch(() => {
      // No-op: keep onboarding resilient when persistence fails.
    });
  }, [draft]);

  const stepProgress = useMemo(() => `${step + 1}/4`, [step]);

  const validateStep = (): boolean => {
    if (step === 0 && !draft.activityId) {
      Alert.alert('Select a sport', 'Choose one sport to continue.');
      return false;
    }
    if (step === 1 && !draft.skillBand) {
      Alert.alert('Select a skill level', 'Pick your current level to continue.');
      return false;
    }
    if (step === 2 && !draft.city.trim()) {
      Alert.alert('Add location', 'Enter your city to continue.');
      return false;
    }
    if (step === 3 && !draft.availabilitySlots.some((slot) => slot.enabled)) {
      Alert.alert('Add availability', 'Enable at least one day.');
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!validateStep()) return;
    setLoading(true);
    try {
      await invokeFunction('onboarding-profile', {
        method: 'POST',
        body: {
          activityId: draft.activityId,
          sourceScale: draft.sourceScale,
          sourceValue: draft.sourceValue,
          canonicalScore: draft.canonicalScore,
          skillBand: draft.skillBand,
          availabilitySlots: draft.availabilitySlots
            .filter((slot) => slot.enabled)
            .map((slot) => ({
              weekday: slot.weekday,
              startMinute: slot.startMinute,
              endMinute: slot.endMinute
            }))
        }
      });

      const authUser = (await supabase.auth.getUser()).data.user;
      if (authUser) {
        await trackEvent('onboarding_completed', authUser.id, {
          activity_id: draft.activityId,
          skill_band: draft.skillBand,
          city: draft.city
        });
      }

      await AsyncStorage.removeItem(STORAGE_KEY);
      showToast({ type: 'success', title: 'Onboarding complete' });
      onComplete();
    } catch (error) {
      Alert.alert('Onboarding failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    if (!validateStep()) return;
    setStep((prev) => Math.min(prev + 1, stepNames.length - 1));
  };

  const back = () => setStep((prev) => Math.max(0, prev - 1));

  return (
    <ImageBackground source={{ uri: stepPhotos[step] }} style={styles.bg} imageStyle={styles.bgImage}>
      <View style={styles.overlay}>
        {/* @ts-expect-error TypeScript 5.7+ compatibility with react-native-reanimated */}
        <Animated.View entering={FadeInRight.duration(220)} style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}> 
          <Text style={[styles.progress, { color: tokens.textMuted }]}>Step {stepProgress}</Text>
          <Text style={[styles.title, { color: tokens.text }]}>{stepNames[step]}</Text>

          {step === 0 ? (
            <ScrollView style={styles.panel}>
              {activities.map((activity) => {
                const active = draft.activityId === activity.id;
                return (
                  <TouchableOpacity
                    key={activity.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Select sport ${activity.name}`}
                    style={[
                      styles.row,
                      { borderColor: tokens.border, backgroundColor: active ? tokens.backgroundMuted : tokens.surface }
                    ]}
                    onPress={() => setDraft((prev) => ({ ...prev, activityId: activity.id }))}
                  >
                    <Text style={[styles.rowText, { color: tokens.text }]}>{activity.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}

          {step === 1 ? (
            <View style={styles.panel}>
              {SKILL_OPTIONS.map((skill) => {
                const active = draft.skillBand === skill.value;
                return (
                  <TouchableOpacity
                    key={skill.value}
                    accessibilityRole="button"
                    accessibilityLabel={`Select skill level ${skill.label}`}
                    style={[
                      styles.row,
                      { borderColor: tokens.border, backgroundColor: active ? tokens.backgroundMuted : tokens.surface }
                    ]}
                    onPress={() =>
                      setDraft((prev) => ({
                        ...prev,
                        skillBand: skill.value,
                        sourceValue: skill.value,
                        canonicalScore: skill.score
                      }))
                    }
                  >
                    <Text style={[styles.rowText, { color: tokens.text }]}>{skill.label}</Text>
                    <Text style={[styles.score, { color: tokens.textMuted }]}>Score {skill.score}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.panel}>
              <Text style={[styles.label, { color: tokens.textSecondary }]}>City</Text>
              <TextInput
                value={draft.city}
                onChangeText={(city) => setDraft((prev) => ({ ...prev, city }))}
                placeholder="Phoenix"
                accessibilityLabel="City"
                placeholderTextColor={tokens.textMuted}
                style={[styles.input, { borderColor: tokens.borderStrong, color: tokens.text, backgroundColor: tokens.backgroundElevated }]}
              />

              <Text style={[styles.label, { color: tokens.textSecondary }]}>Timezone</Text>
              <TextInput
                value={draft.timezone}
                onChangeText={(timezone) => setDraft((prev) => ({ ...prev, timezone }))}
                placeholder="America/Phoenix"
                accessibilityLabel="Timezone"
                placeholderTextColor={tokens.textMuted}
                style={[styles.input, { borderColor: tokens.borderStrong, color: tokens.text, backgroundColor: tokens.backgroundElevated }]}
              />
            </View>
          ) : null}

          {step === 3 ? (
            <ScrollView style={styles.panel}>
              {draft.availabilitySlots.map((slot, index) => (
                <View key={slot.weekday} style={[styles.row, styles.availabilityRow, { borderColor: tokens.border }]}> 
                  <TouchableOpacity
                    style={[styles.dayChip, { backgroundColor: slot.enabled ? tokens.primary : tokens.backgroundMuted }]}
                    accessibilityRole="switch"
                    accessibilityLabel={`Toggle ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][slot.weekday]} availability`}
                    accessibilityState={{ checked: slot.enabled }}
                    onPress={() =>
                      setDraft((prev) => {
                        const nextDraft = [...prev.availabilitySlots];
                        nextDraft[index] = { ...slot, enabled: !slot.enabled };
                        return { ...prev, availabilitySlots: nextDraft };
                      })
                    }
                  >
                    <Text style={[styles.dayChipText, { color: slot.enabled ? tokens.primaryContrast : tokens.textSecondary }]}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][slot.weekday]}
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.slotText, { color: tokens.textSecondary }]}> 
                    {Math.floor(slot.startMinute / 60)}:00 - {Math.floor(slot.endMinute / 60)}:00
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.actions}>
            <Button title="Back" accessibilityLabel="Go to previous onboarding step" onPress={back} tone="secondary" disabled={step === 0 || loading} />
            {step < 3 ? (
              <Button title="Next" accessibilityLabel="Go to next onboarding step" onPress={next} disabled={loading} />
            ) : (
              <Button title={loading ? 'Saving...' : 'Finish'} accessibilityLabel="Finish onboarding" onPress={submit} disabled={loading} />
            )}
          </View>
        </Animated.View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1
  },
  bgImage: {
    resizeMode: 'cover'
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 10, 15, 0.42)',
    padding: 16,
    justifyContent: 'flex-end'
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    maxHeight: '86%'
  },
  progress: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6
  },
  title: {
    fontSize: 28,
    fontWeight: '900'
  },
  panel: {
    marginTop: 12,
    marginBottom: 6
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8
  },
  rowText: {
    fontWeight: '700',
    fontSize: 15
  },
  score: {
    marginTop: 4,
    fontSize: 12
  },
  label: {
    marginBottom: 6,
    fontWeight: '700'
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  dayChip: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  dayChipText: {
    fontWeight: '700'
  },
  slotText: {
    fontSize: 13
  },
  actions: {
    marginTop: 4,
    marginBottom: 4
  }
});
