// Organizer Dashboard Screen
// Entry point for tournament organizers - lists events and shows stats

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
type OrganizerTier = 'bronze' | 'silver' | 'gold';

interface DashboardEvent {
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
  currentRegistrations: number;
  price: number;
  isPublic: boolean;
}

interface DashboardStats {
  totalEvents: number;
  activeEvents: number;
  totalRegistrations: number;
  upcomingEvents: number;
}

interface OrganizerQuotaInfo {
  tier: OrganizerTier;
  eventsUsed: number;
  eventsLimit: number | null;
  registrationsUsed: number;
  registrationsLimit: number | null;
}

type Props = {
  session: Session;
  onNavigateToEventCreate: () => void;
  onNavigateToEventDetail: (eventId: string) => void;
  onNavigateToRegistrations: () => void;
};

export function OrganizerDashboardScreen({ session, onNavigateToEventCreate, onNavigateToEventDetail, onNavigateToRegistrations }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [organizerId, setOrganizerId] = useState<string | null>(null);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<OrganizerQuotaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch organizer membership for current user
  const fetchOrganizerId = useCallback(async () => {
    try {
      const { data: membership, error: membershipError } = await supabase
        .from('organizer_members')
        .select('organizer_id')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (membershipError) {
        console.error('Error fetching organizer membership:', membershipError);
        setError('Failed to load organizer account');
        return null;
      }

      if (!membership) {
        setError('You are not a member of any organizer account');
        return null;
      }

      return membership.organizer_id;
    } catch (err) {
      console.error('Error in fetchOrganizerId:', err);
      setError('Failed to load organizer account');
      return null;
    }
  }, [session.user.id]);

  // Fetch events list
  const fetchEvents = useCallback(async (orgId: string) => {
    try {
      const response = await invokeFunction<{
        data: DashboardEvent[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>('organizer-events', {
        method: 'GET',
        params: { organizerId: orgId, limit: '50' }
      });

      return response.data || [];
    } catch (err) {
      console.error('Error fetching events:', err);
      throw err;
    }
  }, []);

  // Fetch dashboard stats
  const fetchStats = useCallback(async (orgId: string) => {
    try {
      const response = await invokeFunction<{
        data: {
          summary: {
            totalEvents: number;
            publishedEvents: number;
            completedEvents: number;
            totalRegistrations: number;
            confirmedRegistrations: number;
          };
        };
      }>('organizer-analytics', {
        method: 'GET',
        params: { organizerId: orgId, range: '30d' }
      });

      return {
        totalEvents: response.data?.summary?.totalEvents || 0,
        activeEvents: response.data?.summary?.publishedEvents || 0,
        totalRegistrations: response.data?.summary?.totalRegistrations || 0,
        upcomingEvents: response.data?.summary?.totalEvents - response.data?.summary?.completedEvents || 0
      };
    } catch (err) {
      console.error('Error fetching stats:', err);
      throw err;
    }
  }, []);

  // Load all dashboard data
  const loadDashboardData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      const orgId = await fetchOrganizerId();
      if (!orgId) {
        setLoading(false);
        return;
      }

      setOrganizerId(orgId);

      const [eventsData, statsData] = await Promise.all([
        fetchEvents(orgId),
        fetchStats(orgId)
      ]);

      setEvents(eventsData);
      setStats(statsData);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchOrganizerId, fetchEvents, fetchStats]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData(false);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.navy600} />
        <Text style={styles.loadingText}>Loading organizer dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Unable to Load Dashboard</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Try Again" onPress={() => loadDashboardData()} tone="secondary" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Organizer Portal</Text>
        <Text style={styles.subtitle}>Manage your golf tournaments and events</Text>
      </View>

      {/* Stats Cards */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statsCard}>
            <Text style={styles.statsNumber}>{stats.totalEvents}</Text>
            <Text style={styles.statsLabel}>Total Events</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsNumber}>{stats.activeEvents}</Text>
            <Text style={styles.statsLabel}>Active</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsNumber}>{stats.totalRegistrations}</Text>
            <Text style={styles.statsLabel}>Registrations</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsNumber}>{stats.upcomingEvents}</Text>
            <Text style={styles.statsLabel}>Upcoming</Text>
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={onNavigateToEventCreate}>
            <View style={[styles.actionIcon, { backgroundColor: palette.green500 }]}>
              <Text style={styles.actionIconText}>+</Text>
            </View>
            <Text style={styles.actionText}>Create Event</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onNavigateToRegistrations}>
            <View style={[styles.actionIcon, { backgroundColor: palette.navy600 }]}>
              <Text style={styles.actionIconText}>#</Text>
            </View>
            <Text style={styles.actionText}>View Registrations</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Events List */}
      <View style={styles.eventsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Events</Text>
          <Button
            title="Create New"
            onPress={onNavigateToEventCreate}
            tone="secondary"
          />
        </View>

        {events.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptyText}>Create your first golf tournament to get started</Text>
            <Button title="Create Event" onPress={onNavigateToEventCreate} />
          </View>
        ) : (
          <View style={styles.eventsList}>
            {events.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                onPress={() => onNavigateToEventDetail(event.id)}
              >
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(event.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(event.status) }]}>
                      {getStatusLabel(event.status)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.eventMeta}>
                  {formatDate(event.startTime)} • {event.courseName}
                </Text>
                <View style={styles.eventStats}>
                  <Text style={styles.eventStat}>
                    {event.currentRegistrations} / {event.maxParticipants} registered
                  </Text>
                  {event.price > 0 && (
                    <Text style={styles.eventPrice}>${(event.price / 100).toFixed(2)}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
    gap: spacing.lg
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: palette.sky100
  },
  header: {
    marginBottom: spacing.sm
  },
  title: {
    fontSize: 28,
    fontFamily: font.display,
    fontWeight: '800',
    color: palette.ink900
  },
  subtitle: {
    fontSize: 16,
    color: palette.ink700,
    marginTop: spacing.xs
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
  statsContainer: {
    flexDirection: isWeb ? 'row' : 'row',
    flexWrap: 'wrap',
    gap: spacing.md
  },
  statsCard: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.sky300,
    flex: 1,
    minWidth: isWeb ? 120 : 80,
    alignItems: 'center'
  },
  statsNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.navy600
  },
  statsLabel: {
    fontSize: 12,
    color: palette.ink700,
    marginTop: spacing.xs
  },
  actionsContainer: {
    marginTop: spacing.sm
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.md
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  actionButton: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.sky300,
    alignItems: 'center'
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  actionIconText: {
    color: palette.white,
    fontSize: 24,
    fontWeight: '700'
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900
  },
  eventsSection: {
    marginTop: spacing.sm
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  eventsList: {
    gap: spacing.md
  },
  eventCard: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.sky300
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
    flex: 1,
    marginRight: spacing.sm
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600'
  },
  eventMeta: {
    fontSize: 14,
    color: palette.ink700,
    marginBottom: spacing.sm
  },
  eventStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  eventStat: {
    fontSize: 13,
    color: palette.ink700
  },
  eventPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.navy600
  },
  emptyState: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: palette.sky300,
    alignItems: 'center'
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.xs
  },
  emptyText: {
    fontSize: 14,
    color: palette.ink700,
    marginBottom: spacing.lg,
    textAlign: 'center'
  }
});
