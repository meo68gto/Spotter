// Organizer Event Create Screen
// Form to create new golf tournaments/events

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../../components/Button';
import { invokeFunction } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { font, isWeb, palette, radius, spacing } from '../../../theme/design';

// Types defined locally following project pattern
type EventType = 'tournament' | 'scramble' | 'charity' | 'corporate' | 'social';
type OrganizerTier = 'bronze' | 'silver' | 'gold';

interface OrganizerEvent {
  id: string;
  title: string;
  description?: string;
  type: EventType;
  status: string;
  courseId: string;
  courseName: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  price: number;
  isPublic: boolean;
}

// Golf-only event types (no pickleball/tennis residue)
const GOLF_EVENT_TYPES: { value: EventType; label: string; description: string }[] = [
  { value: 'tournament', label: 'Tournament', description: 'Competitive tournament with scoring and leaderboards' },
  { value: 'scramble', label: 'Scramble', description: 'Team scramble format event' },
  { value: 'charity', label: 'Charity Event', description: 'Fundraising golf event' },
  { value: 'corporate', label: 'Corporate Outing', description: 'Company team building or client entertainment' },
  { value: 'social', label: 'Social Event', description: 'Casual social gathering on the course' }
];

const TIER_OPTIONS: { value: OrganizerTier; label: string }[] = [
  { value: 'bronze', label: 'Bronze' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' }
];

type Props = {
  session: Session;
  onComplete: () => void;
  onCancel: () => void;
};

export function OrganizerEventCreateScreen({ session, onComplete, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [fetchingCourses, setFetchingCourses] = useState(true);
  const [organizerId, setOrganizerId] = useState<string | null>(null);
  const [courses, setCourses] = useState<Array<{ id: string; name: string; city: string; state?: string }>>([]);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<EventType>('tournament');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('32');
  const [entryFee, setEntryFee] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [targetTiers, setTargetTiers] = useState<OrganizerTier[]>(['bronze', 'silver', 'gold']);

  // Fetch organizer membership and courses
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Get organizer ID
        const { data: membership } = await supabase
          .from('organizer_members')
          .select('organizer_id')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (membership) {
          setOrganizerId(membership.organizer_id);
        }

        // Fetch golf courses
        const { data: coursesData } = await supabase
          .from('courses')
          .select('id, name, city, state')
          .eq('sport', 'golf')
          .order('name');

        if (coursesData) {
          setCourses(coursesData);
          if (coursesData.length > 0) {
            setSelectedCourseId(coursesData[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
        Alert.alert('Error', 'Failed to load courses');
      } finally {
        setFetchingCourses(false);
      }
    };

    loadInitialData();
  }, [session.user.id]);

  const toggleTier = (tier: OrganizerTier) => {
    setTargetTiers(prev => 
      prev.includes(tier) 
        ? prev.filter(t => t !== tier)
        : [...prev, tier]
    );
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter an event title');
      return false;
    }
    if (!selectedCourseId) {
      Alert.alert('Validation Error', 'Please select a golf course');
      return false;
    }
    if (!startDate) {
      Alert.alert('Validation Error', 'Please select an event date');
      return false;
    }
    if (!maxParticipants || parseInt(maxParticipants) < 1) {
      Alert.alert('Validation Error', 'Please enter a valid maximum number of participants');
      return false;
    }
    if (targetTiers.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one target tier');
      return false;
    }
    return true;
  };

  const handleCreateEvent = async () => {
    if (!validateForm() || !organizerId) return;

    setLoading(true);
    try {
      const startDateTime = `${startDate}T${startTime}:00.000Z`;
      const endDateTime = `${startDate}T${endTime}:00.000Z`;

      const response = await invokeFunction<{ data: OrganizerEvent }>('organizer-events/create', {
        method: 'POST',
        body: {
          organizerId,
          name: title.trim(),
          description: description.trim() || undefined,
          location: courses.find(c => c.id === selectedCourseId)?.name || 'Unknown Course',
          eventDate: startDateTime,
          registrationDeadline: registrationDeadline ? `${registrationDeadline}T23:59:59.000Z` : undefined,
          maxRegistrations: parseInt(maxParticipants),
          targetTiers,
          price: entryFee ? parseInt(entryFee) * 100 : 0, // Convert to cents
          isPrivate: !isPublic,
          requiresApproval
        }
      });

      Alert.alert(
        'Event Created',
        'Your golf event has been created successfully.',
        [
          { text: 'Create Another', onPress: () => resetForm() },
          { text: 'Done', onPress: onComplete }
        ]
      );
    } catch (err) {
      console.error('Error creating event:', err);
      Alert.alert(
        'Create Failed',
        err instanceof Error ? err.message : 'Failed to create event. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setEventType('tournament');
    setStartDate('');
    setStartTime('09:00');
    setEndTime('13:00');
    setRegistrationDeadline('');
    setMaxParticipants('32');
    setEntryFee('');
    setIsPublic(true);
    setRequiresApproval(false);
    setTargetTiers(['bronze', 'silver', 'gold']);
  };

  if (fetchingCourses) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.navy600} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Golf Event</Text>
        <Text style={styles.subtitle}>Set up a new tournament or outing</Text>
      </View>

      {/* Basic Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Event Details</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Event Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Spring Golf Classic"
            placeholderTextColor={palette.ink500}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your event..."
            placeholderTextColor={palette.ink500}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Event Type *</Text>
          <View style={styles.typeGrid}>
            {GOLF_EVENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.typeButton,
                  eventType === type.value && styles.typeButtonActive
                ]}
                onPress={() => setEventType(type.value)}
              >
                <Text style={[
                  styles.typeButtonText,
                  eventType === type.value && styles.typeButtonTextActive
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Location & Date */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location & Date</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Golf Course *</Text>
          <View style={styles.courseList}>
            {courses.map((course) => (
              <TouchableOpacity
                key={course.id}
                style={[
                  styles.courseButton,
                  selectedCourseId === course.id && styles.courseButtonActive
                ]}
                onPress={() => setSelectedCourseId(course.id)}
              >
                <Text style={[
                  styles.courseButtonText,
                  selectedCourseId === course.id && styles.courseButtonTextActive
                ]}>
                  {course.name}
                </Text>
                <Text style={styles.courseLocation}>
                  {course.city}{course.state ? `, ${course.state}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.flex1]}>
            <Text style={styles.label}>Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2026-04-15"
              placeholderTextColor={palette.ink500}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.flex1]}>
            <Text style={styles.label}>Start Time</Text>
            <TextInput
              style={styles.input}
              value={startTime}
              onChangeText={setStartTime}
              placeholder="09:00"
              placeholderTextColor={palette.ink500}
            />
          </View>
          <View style={[styles.inputGroup, styles.flex1]}>
            <Text style={styles.label}>End Time</Text>
            <TextInput
              style={styles.input}
              value={endTime}
              onChangeText={setEndTime}
              placeholder="13:00"
              placeholderTextColor={palette.ink500}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Registration Deadline (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={registrationDeadline}
            onChangeText={setRegistrationDeadline}
            placeholder="2026-04-14"
            placeholderTextColor={palette.ink500}
          />
        </View>
      </View>

      {/* Capacity & Pricing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Capacity & Pricing</Text>
        
        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.flex1]}>
            <Text style={styles.label}>Max Participants *</Text>
            <TextInput
              style={styles.input}
              value={maxParticipants}
              onChangeText={setMaxParticipants}
              keyboardType="number-pad"
              placeholder="32"
              placeholderTextColor={palette.ink500}
            />
          </View>
          <View style={[styles.inputGroup, styles.flex1]}>
            <Text style={styles.label}>Entry Fee ($)</Text>
            <TextInput
              style={styles.input}
              value={entryFee}
              onChangeText={setEntryFee}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={palette.ink500}
            />
          </View>
        </View>
      </View>

      {/* Visibility & Tiers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Visibility & Access</Text>
        
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.switchTitle}>Public Event</Text>
            <Text style={styles.switchDescription}>Visible to all Spotter members</Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: palette.sky300, true: palette.navy600 }}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.switchTitle}>Require Approval</Text>
            <Text style={styles.switchDescription}>Manually approve each registration</Text>
          </View>
          <Switch
            value={requiresApproval}
            onValueChange={setRequiresApproval}
            trackColor={{ false: palette.sky300, true: palette.navy600 }}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Target Member Tiers</Text>
          <Text style={styles.helperText}>Select which membership tiers can see and register for this event</Text>
          <View style={styles.tierGrid}>
            {TIER_OPTIONS.map((tier) => (
              <TouchableOpacity
                key={tier.value}
                style={[
                  styles.tierButton,
                  targetTiers.includes(tier.value) && styles.tierButtonActive
                ]}
                onPress={() => toggleTier(tier.value)}
              >
                <Text style={[
                  styles.tierButtonText,
                  targetTiers.includes(tier.value) && styles.tierButtonTextActive
                ]}>
                  {tier.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={loading ? 'Creating...' : 'Create Event'}
          onPress={handleCreateEvent}
          disabled={loading || !title.trim() || !selectedCourseId || !startDate}
        />
        <Button
          title="Cancel"
          onPress={onCancel}
          tone="secondary"
          disabled={loading}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.sky100
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.sky100
  },
  header: {
    marginBottom: spacing.lg
  },
  title: {
    fontSize: 24,
    fontFamily: font.display,
    fontWeight: '800',
    color: palette.ink900
  },
  subtitle: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: spacing.xs
  },
  loadingText: {
    marginTop: spacing.md,
    color: palette.ink700
  },
  section: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.sky300
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.md
  },
  inputGroup: {
    marginBottom: spacing.md
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
    marginBottom: spacing.xs
  },
  input: {
    backgroundColor: palette.sky100,
    borderWidth: 1,
    borderColor: palette.sky300,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: palette.ink900
  },
  textArea: {
    height: 100,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md
  },
  flex1: {
    flex: 1
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  typeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.sky300,
    backgroundColor: palette.white
  },
  typeButtonActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink900
  },
  typeButtonTextActive: {
    color: palette.white
  },
  courseList: {
    gap: spacing.sm
  },
  courseButton: {
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.sky300,
    backgroundColor: palette.white
  },
  courseButtonActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600
  },
  courseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900
  },
  courseButtonTextActive: {
    color: palette.white
  },
  courseLocation: {
    fontSize: 12,
    color: palette.ink700,
    marginTop: 2
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200
  },
  switchLabel: {
    flex: 1
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900
  },
  switchDescription: {
    fontSize: 12,
    color: palette.ink700,
    marginTop: 2
  },
  helperText: {
    fontSize: 12,
    color: palette.ink700,
    marginBottom: spacing.sm
  },
  tierGrid: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  tierButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.sky300,
    backgroundColor: palette.white,
    alignItems: 'center'
  },
  tierButtonActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600
  },
  tierButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink900
  },
  tierButtonTextActive: {
    color: palette.white
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md
  }
});
