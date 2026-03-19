// Epic 5: Golf Rounds Create Screen (Updated)
// Handles creating new golf rounds with same-tier enforcement, free tier limits, and network invites

import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { UpgradeModal } from '../../components/UpgradeModal';
import { invokeFunction } from '../../lib/api';
import { palette, radius, spacing } from '../../theme/design';
import {
  CartPreference,
  CART_PREFERENCE_OPTIONS,
  VALID_MAX_PLAYERS,
  TIER_DEFINITIONS,
} from '@spotter/types';

interface Course {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface NetworkUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
  currentHandicap?: number;
  connectionType: string;
  mutualCount: number;
}

interface UserTierInfo {
  slug: 'free' | 'select' | 'summit';
  monthlyRoundsCount: number;
  maxRoundsPerMonth: number | null;
  canCreateRounds: boolean;
  tierStatus: string;
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
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [cartPreference, setCartPreference] = useState<CartPreference>('either');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Epic 5: Network invitation state
  const [enableNetworkInvites, setEnableNetworkInvites] = useState(false);
  const [networkUsers, setNetworkUsers] = useState<NetworkUser[]>([]);
  const [selectedInvitees, setSelectedInvitees] = useState<Set<string>>(new Set());

  // Epic 7: Tier enforcement state
  const [userTier, setUserTier] = useState<UserTierInfo | null>(null);
  const [loadingTier, setLoadingTier] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Date/time input states
  const [dateInput, setDateInput] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [timeInput, setTimeInput] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  // Fetch user tier info on mount
  useEffect(() => {
    fetchUserTier();
  }, []);

  // Fetch network users when toggle is enabled
  useEffect(() => {
    if (enableNetworkInvites && networkUsers.length === 0) {
      fetchNetworkUsers();
    }
  }, [enableNetworkInvites]);

  const fetchUserTier = async () => {
    try {
      const response = await invokeFunction<{
        user: {
          tier: { slug: 'free' | 'select' | 'summit' } | null;
          tierStatus: { status: string; isActive: boolean };
        };
        computed: {
          monthlyRoundsCount: number;
          maxRoundsPerMonth: number | null;
          canCreateRounds: boolean;
        };
      }>('user-with-tier', {
        method: 'GET',
      });

      setUserTier({
        slug: response.user.tier?.slug || 'free',
        monthlyRoundsCount: response.computed.monthlyRoundsCount || 0,
        maxRoundsPerMonth: response.computed.maxRoundsPerMonth,
        canCreateRounds: response.computed.canCreateRounds,
        tierStatus: response.user.tierStatus.status,
      });
    } catch (error) {
      console.error('Error fetching tier:', error);
      // Default to free tier on error - free users cannot create rounds
      setUserTier({
        slug: 'free',
        monthlyRoundsCount: 0,
        maxRoundsPerMonth: 0,
        canCreateRounds: false,
        tierStatus: 'active',
      });
    } finally {
      setLoadingTier(false);
    }
  };

  const fetchNetworkUsers = async () => {
    try {
      const response = await invokeFunction<{
        data: Array<{
          id: string;
          member: {
            id: string;
            displayName: string;
            avatarUrl?: string;
            golf?: { handicap?: number };
          };
          relationshipState: string;
          strengthScore: number;
        }>;
      }>('network-connections', {
        method: 'GET',
      });

      const users: NetworkUser[] = response.data
        .filter((conn) => conn.member)
        .map((conn) => ({
          id: conn.member.id,
          displayName: conn.member.displayName,
          avatarUrl: conn.member.avatarUrl,
          currentHandicap: conn.member.golf?.handicap,
          connectionType: conn.relationshipState || 'connection',
          mutualCount: conn.strengthScore || 0,
        }));

      setNetworkUsers(users);
    } catch (error) {
      console.error('Error fetching network users:', error);
      setNetworkUsers([]);
    }
  };

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

  const toggleInvitee = (userId: string) => {
    setSelectedInvitees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        // Check max players limit
        if (newSet.size >= maxPlayers - 1) {
          Alert.alert('Limit Reached', `Maximum ${maxPlayers} players including you`);
          return prev;
        }
        newSet.add(userId);
      }
      return newSet;
    });
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

    // Epic 7: Check tier permissions
    if (!userTier?.canCreateRounds) {
      setShowUpgradeModal(true);
      return;
    }

    // Epic 7: Check Select tier monthly limit
    if (userTier?.maxRoundsPerMonth !== null) {
      if (userTier.monthlyRoundsCount >= userTier.maxRoundsPerMonth) {
        Alert.alert(
          'Monthly Limit Reached',
          `You've reached your limit of ${userTier.maxRoundsPerMonth} rounds per month. Upgrade to Summit for unlimited rounds.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: () => setShowUpgradeModal(true) },
          ]
        );
        return;
      }
    }

    setCreating(true);
    try {
      const body: any = {
        courseId: selectedCourse.id,
        scheduledAt: scheduledDateTime.toISOString(),
        maxPlayers,
        cartPreference,
        notes: notes || undefined,
        sourceType: enableNetworkInvites ? 'network_invite' : 'direct',
      };

      // Add network invitees if enabled
      if (enableNetworkInvites && selectedInvitees.size > 0) {
        body.inviteeIds = Array.from(selectedInvitees);
        body.networkContext = {
          referralSource: 'network_invite_toggle',
        };
      }

      await invokeFunction('rounds-create', {
        method: 'POST',
        body,
      });

      Alert.alert('Success', 'Round created successfully!', [
        { text: 'OK', onPress: onComplete },
      ]);
    } catch (error: any) {
      // Handle specific error codes
      if (error?.code === 'free_tier_round_limit_reached') {
        Alert.alert(
          'Free Tier Limit Reached',
          error.message || 'You have reached your monthly round limit.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: () => {
              // Navigate to upgrade
            }},
          ]
        );
      } else {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create round');
      }
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

  // Epic 7: Updated tier warning component
  const TierWarning = () => {
    if (!userTier || userTier.canCreateRounds === false) return null;

    // Free tier warning (cannot create rounds)
    if (!userTier.canCreateRounds) {
      return (
        <Card>
          <View style={styles.tierWarningContainer}>
            <Text style={styles.tierWarningTitle}>Upgrade Required</Text>
            <Text style={styles.tierWarningText}>
              Free users cannot create rounds. Upgrade to Select to start creating rounds.
            </Text>
            <TouchableOpacity 
              style={styles.upgradeButton}
              onPress={() => setShowUpgradeModal(true)}
            >
              <Text style={styles.upgradeButtonText}>Upgrade to Select →</Text>
            </TouchableOpacity>
          </View>
        </Card>
      );
    }

    // Select tier limit warning
    if (userTier.maxRoundsPerMonth !== null) {
      const remaining = userTier.maxRoundsPerMonth - userTier.monthlyRoundsCount;

      if (remaining <= 0) {
        return (
          <Card>
            <View style={styles.tierWarningContainer}>
              <Text style={styles.tierWarningTitle}>Monthly Limit Reached</Text>
              <Text style={styles.tierWarningText}>
                You've used all {userTier.maxRoundsPerMonth} rounds this month.
              </Text>
              <TouchableOpacity 
                style={styles.upgradeButton}
                onPress={() => setShowUpgradeModal(true)}
              >
                <Text style={styles.upgradeButtonText}>Upgrade to Summit →</Text>
              </TouchableOpacity>
            </View>
          </Card>
        );
      }

      if (remaining <= 2) {
        return (
          <Card>
            <View style={styles.tierWarningContainer}>
              <Text style={styles.tierWarningTitle}>Select Tier</Text>
              <Text style={styles.tierWarningText}>
                You have {remaining} of {userTier.maxRoundsPerMonth} rounds remaining this month.
              </Text>
            </View>
          </Card>
        );
      }
    }

    return null;
  };

  return (
    <>
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Create Round</Text>
        <Text style={styles.subtitle}>Schedule a new golf round</Text>
      </View>

      <View style={styles.content}>
        {/* Epic 7: Tier Warning */}
        <TierWarning />

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
                onPress={() => {
                  setMaxPlayers(size);
                  // Clear selected invitees if max is reduced
                  if (size <= selectedInvitees.size + 1) {
                    setSelectedInvitees(new Set());
                  }
                }}
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

        {/* Epic 5: Network Invitation Toggle */}
        <Card>
          <View style={styles.networkToggleHeader}>
            <View>
              <Text style={styles.sectionTitle}>Invite from Network</Text>
              <Text style={styles.networkToggleDescription}>
                Invite connections to join this round
              </Text>
            </View>
            <Switch
              value={enableNetworkInvites}
              onValueChange={setEnableNetworkInvites}
              trackColor={{ false: palette.sky300, true: palette.navy600 }}
              thumbColor={palette.white}
            />
          </View>

          {enableNetworkInvites && (
            <View style={styles.networkSection}>
              {networkUsers.length === 0 ? (
                <Text style={styles.networkEmpty}>
                  No eligible network users found. Build your network to invite connections.
                </Text>
              ) : (
                <View>
                  <Text style={styles.networkCount}>
                    Select up to {maxPlayers - 1} players ({selectedInvitees.size} selected)
                  </Text>
                  <View style={styles.networkList}>
                    {networkUsers.map((user) => (
                      <TouchableOpacity
                        key={user.id}
                        style={[
                          styles.networkUser,
                          selectedInvitees.has(user.id) && styles.networkUserSelected,
                        ]}
                        onPress={() => toggleInvitee(user.id)}
                      >
                        <View style={styles.networkUserInfo}>
                          {user.avatarUrl ? (
                            <Image source={{ uri: user.avatarUrl }} style={styles.networkAvatar} />
                          ) : (
                            <View style={[styles.networkAvatar, styles.networkAvatarFallback]}>
                              <Text style={styles.networkAvatarInitial}>
                                {user.displayName.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View>
                            <Text style={styles.networkUserName}>{user.displayName}</Text>
                            <Text style={styles.networkUserMeta}>
                              {user.currentHandicap && `Handicap: ${user.currentHandicap} • `}
                              {user.connectionType}
                            </Text>
                          </View>
                        </View>
                        <View
                          style={[
                            styles.networkCheckbox,
                            selectedInvitees.has(user.id) && styles.networkCheckboxChecked,
                          ]}
                        >
                          {selectedInvitees.has(user.id) && (
                            <Text style={styles.networkCheckboxText}>✓</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
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
    <UpgradeModal
      visible={showUpgradeModal}
      onClose={() => setShowUpgradeModal(false)}
      currentTier={userTier?.slug || 'free'}
    />
    </>
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
  // Tier warning styles
  tierWarningContainer: {
    gap: spacing.sm,
  },
  tierWarningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  tierWarningText: {
    fontSize: 13,
    color: '#92400E',
    opacity: 0.8,
  },
  upgradeButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  upgradeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  // Existing styles
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
  // Network section styles
  networkToggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  networkToggleDescription: {
    fontSize: 13,
    color: palette.ink500,
    marginTop: 2,
  },
  networkSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
  },
  networkEmpty: {
    fontSize: 14,
    color: palette.ink500,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  networkCount: {
    fontSize: 13,
    color: palette.ink500,
    marginBottom: spacing.sm,
  },
  networkList: {
    gap: spacing.sm,
  },
  networkUser: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  networkUserSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  networkUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  networkAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  networkAvatarFallback: {
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkAvatarInitial: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '700',
  },
  networkUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  networkUserMeta: {
    fontSize: 12,
    color: palette.ink500,
  },
  networkCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.sky300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkCheckboxChecked: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600,
  },
  networkCheckboxText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '700',
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
