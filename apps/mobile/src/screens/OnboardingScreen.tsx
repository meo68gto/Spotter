import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../components/Button';
import { trackEvent } from '../lib/analytics';
import { invokeFunction } from '../lib/api';
import { supabase } from '../lib/supabase';
import { font, palette, radius, spacing } from '../theme/design';

const STORAGE_KEY = 'spotter:onboarding-draft';

type ActivityOption = {
  id: string;
  name: string;
  slug: string;
};

type Draft = {
  activityId: string;
  sourceScale: string;
  sourceValue: string;
  canonicalScore: string;
  skillBand: string;
};

const initialDraft: Draft = {
  activityId: '',
  sourceScale: 'self_assessment',
  sourceValue: 'intermediate',
  canonicalScore: '55',
  skillBand: 'intermediate'
};

const SKILL_OPTIONS = [
  { label: 'Beginner', value: 'beginner', score: '30' },
  { label: 'Intermediate', value: 'intermediate', score: '55' },
  { label: 'Advanced', value: 'advanced', score: '75' },
  { label: 'Expert', value: 'expert', score: '90' }
];

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [activities, setActivities] = useState<ActivityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string>('');

  const loadDraftAndActivities = async () => {
      setActivityLoading(true);
      setActivityError('');
      const value = await AsyncStorage.getItem(STORAGE_KEY);
      if (value) setDraft(JSON.parse(value));

      const { data, error } = await supabase
        .from('activities')
        .select('id,name,slug')
        .order('name', { ascending: true });

      if (error) {
        setActivityError(error.message);
        setActivityLoading(false);
        return;
      }

      const options = (data ?? []) as ActivityOption[];
      setActivities(options);

      if (!value && options.length) {
        setDraft((prev) => ({ ...prev, activityId: options[0].id }));
      }
      setActivityLoading(false);
    };

  useEffect(() => {
    loadDraftAndActivities();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const selectedSkill = useMemo(
    () => SKILL_OPTIONS.find((opt) => opt.value === draft.skillBand),
    [draft.skillBand]
  );

  const submit = async () => {
    if (!draft.activityId) {
      Alert.alert('Select an activity', 'Choose an activity before continuing.');
      return;
    }

    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setLoading(false);
      Alert.alert('Session missing', 'Please sign in again.');
      return;
    }

    try {
      await invokeFunction('onboarding-profile', {
        method: 'POST',
        body: {
          ...draft,
          canonicalScore: Number(draft.canonicalScore),
          availabilitySlots: [
            { weekday: 1, startMinute: 480, endMinute: 1080 },
            { weekday: 2, startMinute: 480, endMinute: 1080 },
            { weekday: 3, startMinute: 480, endMinute: 1080 },
            { weekday: 4, startMinute: 480, endMinute: 1080 },
            { weekday: 5, startMinute: 480, endMinute: 1080 }
          ]
        }
      });
    } catch (error) {
      setLoading(false);
      Alert.alert('Onboarding failed', error instanceof Error ? error.message : 'Unknown error');
      return;
    }

    setLoading(false);

    const authUser = (await supabase.auth.getUser()).data.user;
    if (authUser) {
      await trackEvent('onboarding_completed', authUser.id, {
        activity_id: draft.activityId,
        skill_band: draft.skillBand
      });
    }

    await AsyncStorage.removeItem(STORAGE_KEY);
    onComplete();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Set Up Your Spotter Profile</Text>
      <Text style={styles.note}>This is optimized to complete in under 90 seconds.</Text>

      <Text style={styles.section}>Choose your activity</Text>
      {activityLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator />
          <Text style={styles.loaderText}>Loading activities...</Text>
        </View>
      ) : null}
      {activityError ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>Could not load activities: {activityError}</Text>
          <Button title="Retry" onPress={loadDraftAndActivities} />
        </View>
      ) : null}
      {!activityLoading && !activityError && activities.length === 0 ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>No activities available yet.</Text>
        </View>
      ) : null}
      <View style={styles.grid}>
        {activities.map((activity) => {
          const active = draft.activityId === activity.id;
          return (
            <TouchableOpacity
              key={activity.id}
              onPress={() => setDraft((prev) => ({ ...prev, activityId: activity.id }))}
              style={[styles.option, active ? styles.optionActive : null]}
            >
              <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>
                {activity.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.section}>Select current skill level</Text>
      <View style={styles.grid}>
        {SKILL_OPTIONS.map((skill) => {
          const active = draft.skillBand === skill.value;
          return (
            <TouchableOpacity
              key={skill.value}
              onPress={() =>
                setDraft((prev) => ({
                  ...prev,
                  skillBand: skill.value,
                  sourceValue: skill.value,
                  canonicalScore: skill.score
                }))
              }
              style={[styles.option, active ? styles.optionActive : null]}
            >
              <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>
                {skill.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>Selected level</Text>
        <Text style={styles.summaryValue}>{selectedSkill?.label ?? 'Not selected'}</Text>
      </View>

      <Button title={loading ? 'Saving...' : 'Continue to Dashboard'} onPress={submit} disabled={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.sky100
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xl
  },
  title: {
    fontSize: 30,
    fontFamily: font.display,
    fontWeight: '800',
    color: palette.ink900
  },
  note: {
    color: palette.ink500,
    marginTop: 8,
    marginBottom: spacing.lg
  },
  section: {
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink700,
    textTransform: 'uppercase',
    letterSpacing: 0.7
  },
  loaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  loaderText: {
    marginLeft: 8,
    color: palette.ink700
  },
  errorWrap: {
    marginBottom: 10
  },
  errorText: {
    color: palette.red500,
    marginBottom: 8
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16
  },
  option: {
    backgroundColor: palette.white,
    borderColor: palette.sky300,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8
  },
  optionActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600
  },
  optionText: {
    color: palette.ink700,
    fontWeight: '700'
  },
  optionTextActive: {
    color: '#ffffff'
  },
  summaryBox: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky300,
    padding: 12,
    marginBottom: 12
  },
  summaryLabel: {
    color: palette.ink500,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  summaryValue: {
    marginTop: 4,
    color: palette.ink900,
    fontSize: 18,
    fontWeight: '700'
  }
});
