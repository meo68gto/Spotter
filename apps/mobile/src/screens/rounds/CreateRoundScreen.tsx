import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { invokeFunction } from '../../lib/api';
import { palette, radius, spacing } from '../../theme/design';
import {
  CartPreference,
  CART_PREFERENCE_OPTIONS,
  VALID_MAX_PLAYERS,
} from '@spotter/types';

interface Course {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface CreateRoundScreenProps {
  session: Session;
  onComplete: () => void;
  onCancel: () => void;
}

export function CreateRoundScreen({ session, onComplete, onCancel }: CreateRoundScreenProps) {
  const [courseSearch, setCourseSearch] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [scheduledAt, setScheduledAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [cartPreference, setCartPreference] = useState<CartPreference>('either');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Date/time input states
  const [dateInput, setDateInput] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
  });
  const [timeInput, setTimeInput] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  const searchCourses = async (query: string) => {
    if (!query || query.length < 2) {
      setCourses([]);
      return;
    }
    try {
      const response = await invokeFunction<{ courses: Course[] }>('courses-search', {
        method: 'POST',
        body: { query, limit: 10 },
      });
      setCourses(response.courses);
    } catch {
      setCourses([]);
    }
  };

  const handleCreateRound = async () => {
    if (!selectedCourse) {
      Alert.alert('Error', 'Please select a course');
      return;
    }

    // Parse date and time
    const [year, month, day] = dateInput.split('-').map(Number);
    const [hours, minutes] = timeInput.split(':').map(Number);
    const scheduledDateTime = new Date(year, month - 1, day, hours, minutes);

    if (scheduledDateTime < new Date()) {
      Alert.alert('Error', 'Please select a future date and time');
      return;
    }

    setCreating(true);
    try {
      await invokeFunction('rounds-create', {
        method: 'POST',
        body: {
          courseId: selectedCourse.id,
          scheduledAt: scheduledDateTime.toISOString(),
          maxPlayers,
          cartPreference,
          notes: notes || undefined,
        },
      });

      Alert.alert('Success', 'Round created successfully!', [
        { text: 'OK', onPress: onComplete },
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create round');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Create Round</Text>
        <Text style={styles.subtitle}>Schedule a new golf round</Text>
      </View>

      <View style={styles.content}>
        <Card>
          <Text style={styles.sectionTitle}>Course</Text>
          {selectedCourse ? (
            <View style={styles.selectedCourse}>
              <Text style={styles.selectedCourseName}>{selectedCourse.name}</Text>
              <Text style={styles.selectedCourseLocation}>
                {selectedCourse.city}, {selectedCourse.state}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedCourse(null);
                  setCourseSearch('');
                }}
                style={styles.changeButton}
              >
                <Text style={styles.changeButtonText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a golf course..."
                value={courseSearch}
                onChangeText={(text) => {
                  setCourseSearch(text);
                  searchCourses(text);
                }}
                autoCapitalize="words"
              />
              {courses.length > 0 && (
                <View style={styles.courseList}>
                  {courses.map((course) => (
                    <TouchableOpacity
                      key={course.id}
                      style={styles.courseItem}
                      onPress={() => {
                        setSelectedCourse(course);
                        setCourses([]);
                      }}
                    >
                      <Text style={styles.courseItemName}>{course.name}</Text>
                      <Text style={styles.courseItemLocation}>
                        {course.city}, {course.state}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Date & Time</Text>
          
          <View style={styles.dateTimeContainer}>
            <View style={styles.dateTimeField}>
              <Text style={styles.dateTimeLabel}>Date</Text>
              <TextInput
                style={styles.dateTimeInput}
                value={dateInput}
                onChangeText={setDateInput}
                placeholder="YYYY-MM-DD"
                keyboardType="default"
              />
              <Text style={styles.dateTimePreview}>{formatDate(dateInput)}</Text>
            </View>

            <View style={styles.dateTimeField}>
              <Text style={styles.dateTimeLabel}>Time</Text>
              <TextInput
                style={styles.dateTimeInput}
                value={timeInput}
                onChangeText={setTimeInput}
                placeholder="HH:MM"
                keyboardType="default"
              />
              <Text style={styles.dateTimePreview}>{formatTime(timeInput)}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Group Size</Text>
          <View style={styles.groupSizeContainer}>
            {VALID_MAX_PLAYERS.map((size) => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.groupSizeButton,
                  maxPlayers === size && styles.groupSizeButtonActive,
                ]}
                onPress={() => setMaxPlayers(size)}
              >
                <Text
                  style={[
                    styles.groupSizeText,
                    maxPlayers === size && styles.groupSizeTextActive,
                  ]}
                >
                  {size} players
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Cart Preference</Text>
          <View style={styles.cartContainer}>
            {(Object.keys(CART_PREFERENCE_OPTIONS) as CartPreference[]).map((pref) => (
              <TouchableOpacity
                key={pref}
                style={[
                  styles.cartButton,
                  cartPreference === pref && styles.cartButtonActive,
                ]}
                onPress={() => setCartPreference(pref)}
              >
                <Text
                  style={[
                    styles.cartButtonTitle,
                    cartPreference === pref && styles.cartButtonTextActive,
                  ]}
                >
                  {CART_PREFERENCE_OPTIONS[pref].label}
                </Text>
                <Text
                  style={[
                    styles.cartButtonDescription,
                    cartPreference === pref && styles.cartButtonTextActive,
                  ]}
                >
                  {CART_PREFERENCE_OPTIONS[pref].description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add any details about the round..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </Card>

        <View style={styles.actions}>
          <Button
            title={creating ? 'Creating...' : 'Create Round'}
            onPress={handleCreateRound}
            disabled={!selectedCourse || creating}
          />
          <Button title="Cancel" onPress={onCancel} tone="secondary" />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.sky100,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.ink900,
  },
  subtitle: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: 4,
  },
  content: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.sm,
  },
  searchInput: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: palette.ink900,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  courseList: {
    marginTop: spacing.sm,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky200,
    maxHeight: 200,
  },
  courseItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  courseItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  courseItemLocation: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: 2,
  },
  selectedCourse: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  selectedCourseName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  selectedCourseLocation: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: 4,
  },
  changeButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  changeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.navy600,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dateTimeField: {
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: 14,
    color: palette.ink700,
    marginBottom: spacing.xs,
  },
  dateTimeInput: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: palette.ink900,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  dateTimePreview: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: 4,
  },
  groupSizeContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  groupSizeButton: {
    flex: 1,
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  groupSizeButtonActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600,
  },
  groupSizeText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  groupSizeTextActive: {
    color: palette.white,
  },
  cartContainer: {
    gap: spacing.sm,
  },
  cartButton: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  cartButtonActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600,
  },
  cartButtonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  cartButtonDescription: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: 2,
  },
  cartButtonTextActive: {
    color: palette.white,
  },
  notesInput: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: palette.ink900,
    borderWidth: 1,
    borderColor: palette.sky200,
    minHeight: 80,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});
