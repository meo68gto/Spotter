// Organizer Event Detail Screen
// View event details, registrations, and check-in functionality

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../../components/Button';
import { invokeFunction } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { font, isWeb, palette, radius, spacing } from '../../../theme/design';

// Types defined locally following project pattern
type EventType = 'tournament' | 'scramble' | 'charity' | 'corporate' | 'social';
type EventStatus = 'draft' | 'published' | 'registration_open' | 'full' | 'in_progress' | 'completed' | 'cancelled';
type RegistrationStatus = 'registered' | 'waitlisted' | 'confirmed' | 'checked_in' | 'no_show' | 'cancelled';

interface OrganizerEvent {
  id: string;
  title: string;
  description?: string;
  type: EventType;
  status: EventStatus;
  courseId: string;
  courseName: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  price: number;
  isPublic: boolean;
}

interface RegistrationWithUser {
  id: string;
  eventId: string;
  userId?: string;
  displayName?: string;
  email?: string;
  status: RegistrationStatus;
  registeredAt: string;
  checkedInAt?: string;
  paymentStatus?: string;
}

interface EventDetailData {
  event: OrganizerEvent;
  registrations: RegistrationWithUser[];
  analytics: {
    totalRegistrations: number;
    confirmed: number;
    checkedIn: number;
    attendanceRate: number;
    totalRevenue: number;
  };
}

type Props = {
  session: Session;
  eventId: string;
  onBack: () => void;
  onNavigateToRegistrations: () => void;
};

export function OrganizerEventDetailScreen({ session, eventId, onBack, onNavigateToRegistrations }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eventData, setEventData] = useState<EventDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchEventDetail = useCallback(async () => {
    try {
      const response = await invokeFunction<{
        data: {
          event: OrganizerEvent;
          registrations: RegistrationWithUser[];
          analytics: {
            totalRegistrations: number;
            confirmed: number;
            checkedIn: number;
            attendanceRate: number;
            totalRevenue: number;
          };
        };
      }>(`organizer-events/get/${eventId}`, {
        method: 'GET'
      });

      setEventData(response.data);
    } catch (err) {
      console.error('Error fetching event detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to load event details');
    }
  }, [eventId]);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      await fetchEventDetail();
    } catch (err) {
      // Error already handled in fetchEventDetail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchEventDetail]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  const handleCheckIn = async (registrationId: string) => {
    setActioningId(registrationId);
    try {
      await invokeFunction('organizer-registrations/check-in', {
        method: 'POST',
        body: { registrationId }
      });

      // Refresh data after check-in
      await fetchEventDetail();
      
      Alert.alert('Success', 'Participant checked in successfully');
    } catch (err) {
      console.error('Error checking in:', err);
      Alert.alert(
        'Check-in Failed',
        err instanceof Error ? err.message : 'Failed to check in participant'
      );
    } finally {
      setActioningId(null);
    }
  };

  const handlePublishEvent = async () => {
    Alert.alert(
      'Publish Event',
      'Are you sure you want to publish this event? It will be visible to members.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          style: 'default',
          onPress: async () => {
            setLoading(true);
            try {
              await invokeFunction('organizer-events/publish', {
                method: 'POST',
                body: { eventId }
              });
              await loadData();
              Alert.alert('Success', 'Event published successfully');
            } catch (err) {
              Alert.alert(
                'Publish Failed',
                err instanceof Error ? err.message : 'Failed to publish event'
              );
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCancelEvent = async () => {
    Alert.alert(
      'Cancel Event',
      'Are you sure you want to cancel this event? This action cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await invokeFunction('organizer-events/cancel', {
                method: 'POST',
                body: { eventId, reason: 'Cancelled by organizer' }
              });
              await loadData();
              Alert.alert('Success', 'Event cancelled successfully');
            } catch (err) {
              Alert.alert(
                'Cancel Failed',
                err instanceof Error ? err.message : 'Failed to cancel event'
              );
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
      case 'registration_open':
        return palette.green500;
      case 'draft':
        return palette.ink500;
      case 'completed':
        return palette.navy600;
      case 'cancelled':
        return palette.red500;
      case 'full':
        return palette.amber500;
      default:
        return palette.ink500;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'published': return 'Published';
      case 'registration_open': return 'Registration Open';
      case 'full': return 'Full';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const getRegistrationStatusColor = (status: RegistrationStatus) => {
    switch (status) {
      case 'confirmed':
      case 'checked_in':
        return palette.green500;
      case 'registered':
        return palette.navy600;
      case 'waitlisted':
        return palette.amber500;
      case 'cancelled':
      case 'no_show':
        return palette.red500;
      default:
        return palette.ink500;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.navy600} />
        <Text style={styles.loadingText}>Loading event details...</Text>
      </View>
    );
  }

  if (error || !eventData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Unable to Load Event</Text>
        <Text style={styles.errorText}>{error || 'Event not found'}</Text>
        <Button title="Go Back" onPress={onBack} tone="secondary" />
      </View>
    );
  }

  const { event, registrations, analytics } = eventData;
  const confirmedRegistrations = registrations.filter(r => r.status === 'confirmed' || r.status === 'checked_in');
  const canPublish = event.status === 'draft';
  const canCancel = event.status !== 'cancelled' && event.status !== 'completed';
  const isEventDay = new Date(event.startTime).toDateString() === new Date().toDateString();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{event.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(event.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(event.status) }]}>
            {getStatusLabel(event.status)}
          </Text>
        </View>
      </View>

      {/* Event Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Event Details</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Date:</Text>
          <Text style={styles.infoValue}>{formatDate(event.startTime)}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Time:</Text>
          <Text style={styles.infoValue}>{formatTime(event.startTime)} - {formatTime(event.endTime)}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Location:</Text>
          <Text style={styles.infoValue}>{event.courseName}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Type:</Text>
          <Text style={styles.infoValue}>{event.type.charAt(0).toUpperCase() + event.type.slice(1)}</Text>
        </View>

        {event.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.infoLabel}>Description:</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        )}
      </View>

      {/* Analytics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Registration Stats</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{analytics.totalRegistrations}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{analytics.confirmed}</Text>
            <Text style={styles.statLabel}>Confirmed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{analytics.checkedIn}</Text>
            <Text style={styles.statLabel}>Checked In</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{analytics.attendanceRate}%</Text>
            <Text style={styles.statLabel}>Attendance</Text>
          </View>
        </View>

        <View style={styles.capacityBar}>
          <View style={styles.capacityFill} >
            <View 
              style={[
                styles.capacityProgress, 
                { 
                  width: `${Math.min((analytics.confirmed / event.maxParticipants) * 100, 100)}%`,
                  backgroundColor: analytics.confirmed >= event.maxParticipants ? palette.red500 : palette.green500
                }
              ]} 
            />
          </View>
          <Text style={styles.capacityText}>
            {analytics.confirmed} / {event.maxParticipants} spots filled
          </Text>
        </View>
      </View>

      {/* Registrations List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Registrations</Text>
          <Button
            title="View All"
            onPress={onNavigateToRegistrations}
            tone="secondary"
          />
        </View>

        {registrations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No registrations yet</Text>
          </View>
        ) : (
          <View style={styles.registrationsList}>
            {registrations.slice(0, 10).map((registration) => (
              <View key={registration.id} style={styles.registrationCard}>
                <View style={styles.registrationInfo}>
                  <Text style={styles.registrationName}>
                    {registration.displayName || registration.email || 'Unknown'}
                  </Text>
                  <View style={styles.registrationMeta}>
                    <Text style={[
                      styles.registrationStatus,
                      { color: getRegistrationStatusColor(registration.status) }
                    ]}>
                      {registration.status.replace('_', ' ').toUpperCase()}
                    </Text>
                    {registration.checkedInAt && (
                      <Text style={styles.checkedInBadge}>✓ Checked In</Text>
                    )}
                  </View>
                </View>

                {registration.status === 'confirmed' && isEventDay && !registration.checkedInAt && (
                  <Button
                    title="Check In"
                    onPress={() => handleCheckIn(registration.id)}
                    disabled={actioningId === registration.id}
                    tone="secondary"
                  />
                )}
              </View>
            ))}
            
            {registrations.length > 10 && (
              <TouchableOpacity style={styles.viewMoreButton} onPress={onNavigateToRegistrations}>
                <Text style={styles.viewMoreText}>View {registrations.length - 10} more registrations →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        {canPublish && (
          <Button
            title="Publish Event"
            onPress={handlePublishEvent}
            disabled={loading}
          />
        )}
        
        {canCancel && (
          <Button
            title="Cancel Event"
            onPress={handleCancelEvent}
            tone="secondary"
            disabled={loading}
          />
        )}
        
        <Button
          title="Back to Dashboard"
          onPress={onBack}
          tone="ghost"
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
    padding: spacing.lg,
    backgroundColor: palette.sky100
  },
  header: {
    marginBottom: spacing.lg
  },
  backButton: {
    marginBottom: spacing.sm
  },
  backButtonText: {
    fontSize: 16,
    color: palette.navy600,
    fontWeight: '600'
  },
  title: {
    fontSize: 24,
    fontFamily: font.display,
    fontWeight: '800',
    color: palette.ink900,
    marginBottom: spacing.sm
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  loadingText: {
    marginTop: spacing.md,
    color: palette.ink700,
    fontSize: 16
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.sm
  },
  errorText: {
    fontSize: 14,
    color: palette.ink700,
    marginBottom: spacing.lg,
    textAlign: 'center'
  },
  section: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.sky300
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink700,
    width: 80
  },
  infoValue: {
    fontSize: 14,
    color: palette.ink900,
    flex: 1
  },
  descriptionContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.sky200
  },
  description: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: spacing.xs,
    lineHeight: 20
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md
  },
  statCard: {
    flex: 1,
    minWidth: 70,
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: palette.sky100,
    borderRadius: radius.sm
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.navy600
  },
  statLabel: {
    fontSize: 12,
    color: palette.ink700,
    marginTop: spacing.xs
  },
  capacityBar: {
    marginTop: spacing.sm
  },
  capacityFill: {
    height: 8,
    backgroundColor: palette.sky200,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: spacing.xs
  },
  capacityProgress: {
    height: '100%',
    borderRadius: radius.pill
  },
  capacityText: {
    fontSize: 12,
    color: palette.ink700,
    textAlign: 'center'
  },
  emptyState: {
    padding: spacing.lg,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 14,
    color: palette.ink700
  },
  registrationsList: {
    gap: spacing.sm
  },
  registrationCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: palette.sky100,
    borderRadius: radius.sm
  },
  registrationInfo: {
    flex: 1
  },
  registrationName: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900
  },
  registrationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2
  },
  registrationStatus: {
    fontSize: 11,
    fontWeight: '700'
  },
  checkedInBadge: {
    fontSize: 11,
    color: palette.green500,
    fontWeight: '600'
  },
  viewMoreButton: {
    padding: spacing.md,
    alignItems: 'center'
  },
  viewMoreText: {
    fontSize: 14,
    color: palette.navy600,
    fontWeight: '600'
  },
  actionsSection: {
    gap: spacing.sm,
    marginTop: spacing.md
  }
});
