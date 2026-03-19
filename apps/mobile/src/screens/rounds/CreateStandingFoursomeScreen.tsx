// Epic 5: Create Standing Foursome Screen
// Create a new standing foursome group

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
  CreateStandingFoursomeInput,
  FOURSOME_CADENCE_OPTIONS,
  StandingFoursomeWithMembers,
} from '@spotter/types';

interface Connection {
  id: string;
  displayName: string;
  avatarUrl?: string;
  currentHandicap?: number;
}

interface CreateStandingFoursomeScreenProps {
  session: Session;
  onComplete: (foursome: StandingFoursomeWithMembers) => void;
  onCancel: () => void;
}

export function CreateStandingFoursomeScreen({
  session,
  onComplete,
  onCancel,
}: CreateStandingFoursomeScreenProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Connection[]>([]);
  const [cadence, setCadence] = useState<keyof typeof FOURSOME_CADENCE_OPTIONS>('flexible');
  const [preferredDay, setPreferredDay] = useState<'weekday' | 'weekend' | 'flexible'>('flexible');
  const [preferredTime, setPreferredTime] = useState<'morning' | 'midday' | 'afternoon' | 'flexible'>('flexible');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Connection[]>([]);
  const [creating, setCreating] = useState(false);

  // Mock search - in real implementation, this would call the API
  const searchConnections = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    // TODO: Implement actual search
    // For now, return empty
    setSearchResults([]);
  };

  const toggleMember = (connection: Connection) => {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m.id === connection.id);
      if (exists) {
        return prev.filter(m => m.id !== connection.id);
      }
      if (prev.length >= 3) {
        Alert.alert('Limit Reached', 'A foursome can have maximum 4 members (including you)');
        return prev;
      }
      return [...prev, connection];
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (selectedMembers.length < 2) {
      Alert.alert('Error', 'Please select at least 2 other members');
      return;
    }

    setCreating(true);
    try {
      const input: CreateStandingFoursomeInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        memberIds: selectedMembers.map(m => m.id),
        cadence,
        preferredDay,
        preferredTime,
      };

      const response = await invokeFunction<{ data: StandingFoursomeWithMembers }>(
        'standing-foursomes-create',
        { method: 'POST', body: input }
      );

      Alert.alert('Success', 'Standing foursome created!', [
        { text: 'OK', onPress: () => onComplete(response.data) },
      ]);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create foursome'
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Create Standing Foursome</Text>
        <Text style={styles.subtitle}>Build your regular playing group</Text>
      </View>

      <View style={styles.content}>
        {/* Group Name */}
        <Card>
          <Text style={styles.sectionTitle}>Group Name</Text>
          <TextInput
            style={styles.nameInput}
            placeholder="e.g., Thursday Morning Regulars"
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
          <Text style={styles.charCount}>{name.length}/50</Text>
        </Card>

        {/* Description */}
        <Card>
          <Text style={styles.sectionTitle}>Description (Optional)</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="What makes this group special?"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={280}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}/280</Text>
        </Card>

        {/* Member Selection */}
        <Card>
          <Text style={styles.sectionTitle}>Members (2-3 others)</Text>
          <Text style={styles.sectionDescription}>
            Select from your connections. All members must be in your tier.
          </Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Search connections..."
            value={searchQuery}
            onChangeText={text => {
              setSearchQuery(text);
              searchConnections(text);
            }}
          />

          {/* Selected Members */}
          {selectedMembers.length > 0 && (
            <View style={styles.selectedMembers}>
              <Text style={styles.selectedLabel}>Selected ({selectedMembers.length}/3):</Text>
              <View style={styles.memberChips}>
                {selectedMembers.map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={styles.memberChip}
                    onPress={() => toggleMember(member)}
                  >
                    <Text style={styles.memberChipText}>{member.displayName}</Text>
                    <Text style={styles.removeIcon}> ×</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map(connection => (
                <TouchableOpacity
                  key={connection.id}
                  style={styles.connectionItem}
                  onPress={() => toggleMember(connection)}
                >
                  <View style={styles.connectionInfo}>
                    <Text style={styles.connectionName}>
                      {connection.displayName}
                    </Text>
                    {connection.currentHandicap && (
                      <Text style={styles.connectionHandicap}>
                        Handicap: {connection.currentHandicap}
                      </Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      selectedMembers.find(m => m.id === connection.id) &&
                        styles.checkboxChecked,
                    ]}
                  >
                    {selectedMembers.find(m => m.id === connection.id) && (
                      <Text style={styles.checkboxCheck}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>

        {/* Cadence */}
        <Card>
          <Text style={styles.sectionTitle}>How Often?</Text>
          <View style={styles.optionsGrid}>
            {(Object.keys(FOURSOME_CADENCE_OPTIONS) as Array<keyof typeof FOURSOME_CADENCE_OPTIONS>).map(
              option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    cadence === option && styles.optionButtonActive,
                  ]}
                  onPress={() => setCadence(option)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      cadence === option && styles.optionTextActive,
                    ]}
                  >
                    {FOURSOME_CADENCE_OPTIONS[option].label}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
        </Card>

        {/* Preferred Day */}
        <Card>
          <Text style={styles.sectionTitle}>Preferred Day</Text>
          <View style={styles.optionsRow}>
            {['weekday', 'weekend', 'flexible'].map(day => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.optionButton,
                  preferredDay === day && styles.optionButtonActive,
                ]}
                onPress={() => setPreferredDay(day as typeof preferredDay)}
              >
                <Text
                  style={[
                    styles.optionText,
                    preferredDay === day && styles.optionTextActive,
                  ]}
                >
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Preferred Time */}
        <Card>
          <Text style={styles.sectionTitle}>Preferred Time</Text>
          <View style={styles.optionsRow}>
            {['morning', 'midday', 'afternoon', 'flexible'].map(time => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.optionButton,
                  preferredTime === time && styles.optionButtonActive,
                ]}
                onPress={() => setPreferredTime(time as typeof preferredTime)}
              >
                <Text
                  style={[
                    styles.optionText,
                    preferredTime === time && styles.optionTextActive,
                  ]}
                >
                  {time.charAt(0).toUpperCase() + time.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title={creating ? 'Creating...' : 'Create Foursome'}
            onPress={handleCreate}
            disabled={!name.trim() || selectedMembers.length < 2 || creating}
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
    color: palette.ink500,
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
  sectionDescription: {
    fontSize: 13,
    color: palette.ink500,
    marginBottom: spacing.md,
  },
  nameInput: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: palette.ink900,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  descriptionInput: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: palette.ink900,
    borderWidth: 1,
    borderColor: palette.sky200,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: palette.ink400,
    textAlign: 'right',
    marginTop: 4,
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
  selectedMembers: {
    marginTop: spacing.md,
  },
  selectedLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink700,
    marginBottom: spacing.xs,
  },
  memberChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.navy600,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  memberChipText: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '500',
  },
  removeIcon: {
    color: palette.white,
    fontSize: 16,
    marginLeft: 4,
  },
  searchResults: {
    marginTop: spacing.md,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky200,
    maxHeight: 200,
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  connectionHandicap: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.sky300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600,
  },
  checkboxCheck: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '700',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optionButton: {
    flex: 1,
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.sky200,
    minWidth: 80,
  },
  optionButtonActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  optionTextActive: {
    color: palette.white,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});
