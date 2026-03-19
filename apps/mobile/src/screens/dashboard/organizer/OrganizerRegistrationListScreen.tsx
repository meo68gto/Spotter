// Organizer Registration List Screen
// View all registrations with filtering and export

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../../components/Button';
import { invokeFunction } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { font, isWeb, palette, radius, spacing } from '../../../theme/design';
import type { RegistrationWithUser, RegistrationStatus } from '../../../../../packages/types/src/organizer';

interface RegistrationData {
  data: RegistrationWithUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type FilterStatus = 'all' | RegistrationStatus;

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'registered', label: 'Registered' },
  { value: 'waitlisted', label: 'Waitlisted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'no_show', label: 'No Show' },
  { value: 'cancelled', label: 'Cancelled' }
];

type Props = {
  session: Session;
  eventId?: string; // If provided, show only registrations for this event
  onBack: () => void;
};

export function OrganizerRegistrationListScreen({ session, eventId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registrations, setRegistrations] = useState<RegistrationWithUser[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<RegistrationWithUser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [organizerEvents, setOrganizerEvents] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(eventId);

  // Fetch organizer events for filter dropdown
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data: membership } = await supabase
          .from('organizer_members')
          .select('organizer_id')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (membership?.organizer_id) {
          const response = await invokeFunction<{
            data: Array<{ id: string; title: string }>;
          }>('organizer-events/list', {
            method: 'GET',
            params: { organizerId: membership.organizer_id, limit: '100' }
          });
          setOrganizerEvents(response.data || []);
        }
      } catch (err) {
        console.error('Error fetching events:', err);
      }
    };

    fetchEvents();
  }, [session.user.id]);

  const fetchRegistrations = useCallback(async () => {
    if (!selectedEventId) return;

    try {
      const response = await invokeFunction<RegistrationData>('organizer-registrations', {
        method: 'GET',
        params: { 
          eventId: selectedEventId,
          limit: '100'
        }
      });

      setRegistrations(response.data || []);
      setTotalCount(response.pagination?.total || 0);
    } catch (err) {
      console.error('Error fetching registrations:', err);
      throw err;
    }
  }, [selectedEventId]);

  const loadData = useCallback(async (showLoading = true) => {
    if (!selectedEventId) {
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);

    try {
      await fetchRegistrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load registrations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchRegistrations, selectedEventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter registrations based on status and search
  useEffect(() => {
    let filtered = registrations;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        (r.displayName?.toLowerCase().includes(query)) ||
        (r.email?.toLowerCase().includes(query))
      );
    }

    setFilteredRegistrations(filtered);
  }, [registrations, filterStatus, searchQuery]);

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

      // Update local state
      setRegistrations(prev => 
        prev.map(r => 
          r.id === registrationId 
            ? { ...r, status: 'checked_in' as RegistrationStatus, checkedInAt: new Date().toISOString() }
            : r
        )
      );

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

  const handleExport = async () => {
    if (!selectedEventId) return;

    try {
      // Get organizer ID
      const { data: membership } = await supabase
        .from('organizer_members')
        .select('organizer_id')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!membership?.organizer_id) {
        Alert.alert('Error', 'Organizer not found');
        return;
      }

      // For now, create a simple CSV export
      const csvContent = generateCSV(registrations);
      
      // In a real app, this would download the file or share it
      // For now, we'll just show the data
      Alert.alert(
        'Export Ready',
        `CSV export generated with ${registrations.length} registrations.`,
        [{ text: 'OK' }]
      );
    } catch (err) {
      console.error('Error exporting:', err);
      Alert.alert('Export Failed', err instanceof Error ? err.message : 'Failed to export data');
    }
  };

  const generateCSV = (data: RegistrationWithUser[]): string => {
    const headers = ['Name', 'Email', 'Status', 'Registered At', 'Checked In At', 'Payment Status'];
    const rows = data.map(r => [
      r.displayName || 'N/A',
      r.email || 'N/A',
      r.status,
      new Date(r.registeredAt).toLocaleString(),
      r.checkedInAt ? new Date(r.checkedInAt).toLocaleString() : 'N/A',
      r.paymentStatus || 'N/A'
    ]);
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  };

  const getStatusColor = (status: RegistrationStatus) => {
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
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.navy600} />
        <Text style={styles.loadingText}>Loading registrations...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Unable to Load Registrations</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Go Back" onPress={onBack} tone="secondary" />
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
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Registrations</Text>
        <Text style={styles.subtitle}>{totalCount} total registrations</Text>
      </View>

      {/* Event Selector (if no specific event provided) */}
      {!eventId && organizerEvents.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>Select Event</Text>
          <View style={styles.eventSelector}>
            {organizerEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={[
                  styles.eventButton,
                  selectedEventId === event.id && styles.eventButtonActive
                ]}
                onPress={() => setSelectedEventId(event.id)}
              >
                <Text style={[
                  styles.eventButtonText,
                  selectedEventId === event.id && styles.eventButtonTextActive
                ]}>
                  {event.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Filters */}
      {selectedEventId && (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>Filter by Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterRow}>
                {STATUS_FILTERS.map((filter) => (
                  <TouchableOpacity
                    key={filter.value}
                    style={[
                      styles.filterButton,
                      filterStatus === filter.value && styles.filterButtonActive
                    ]}
                    onPress={() => setFilterStatus(filter.value)}
                  >
                    <Text style={[
                      styles.filterButtonText,
                      filterStatus === filter.value && styles.filterButtonTextActive
                    ]}>
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={[styles.label, { marginTop: spacing.md }]}>Search</Text>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name or email..."
              placeholderTextColor={palette.ink500}
            />
          </View>

          {/* Stats Summary */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{filteredRegistrations.length}</Text>
              <Text style={styles.statLabel}>Showing</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {registrations.filter(r => r.status === 'confirmed' || r.status === 'checked_in').length}
              </Text>
              <Text style={styles.statLabel}>Confirmed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {registrations.filter(r => r.status === 'checked_in').length}
              </Text>
              <Text style={styles.statLabel}>Checked In</Text>
            </View>
          </View>

          {/* Export Button */}
          <View style={styles.exportSection}>
            <Button
              title="Export to CSV"
              onPress={handleExport}
              tone="secondary"
              disabled={registrations.length === 0}
            />
          </View>

          {/* Registrations List */}
          <View style={styles.registrationsSection}>
            {filteredRegistrations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No registrations found</Text>
                <Text style={styles.emptyText}>
                  {searchQuery || filterStatus !== 'all' 
                    ? 'Try adjusting your filters'
                    : 'No one has registered for this event yet'}
                </Text>
              </View>
            ) : (
              <View style={styles.registrationsList}>
                {filteredRegistrations.map((registration) => (
                  <View key={registration.id} style={styles.registrationCard}>
                    <View style={styles.registrationHeader}>
                      <View style={styles.registrationInfo}>
                        <Text style={styles.registrationName}>
                          {registration.displayName || 'Unknown'}
                        </Text>
                        {registration.email && (
                          <Text style={styles.registrationEmail}>{registration.email}</Text>
                        )}
                      </View>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(registration.status) + '20' }
                      ]}>
                        <Text style={[
                          styles.statusText,
                          { color: getStatusColor(registration.status) }
                        ]}>
                          {registration.status.replace('_', ' ').toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.registrationDetails}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Registered:</Text>
                        <Text style={styles.detailValue}>{formatDate(registration.registeredAt)}</Text>
                      </View>
                      
                      {registration.checkedInAt && (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Checked In:</Text>
                          <Text style={styles.detailValue}>{formatDate(registration.checkedInAt)}</Text>
                        </View>
                      )}
                      
                      {registration.paymentStatus && (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Payment:</Text>
                          <Text style={styles.detailValue}>
                            {registration.paymentStatus.replace('_', ' ').toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>

                    {registration.status === 'confirmed' && !registration.checkedInAt && (
                      <Button
                        title="Check In"
                        onPress={() => handleCheckIn(registration.id)}
                        disabled={actioningId === registration.id}
                        tone="secondary"
                      />
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}

      {!selectedEventId && !eventId && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Select an Event</Text>
          <Text style={styles.emptyText}>Choose an event above to view its registrations</Text>
        </View>
      )}
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
    color: palette.ink900
  },
  subtitle: {
    fontSize: 14,
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
  section: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.sky300
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
    marginBottom: spacing.sm
  },
  eventSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  eventButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.sky300,
    backgroundColor: palette.white
  },
  eventButtonActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600
  },
  eventButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink900
  },
  eventButtonTextActive: {
    color: palette.white
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.sky300,
    backgroundColor: palette.white
  },
  filterButtonActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink900
  },
  filterButtonTextActive: {
    color: palette.white
  },
  searchInput: {
    backgroundColor: palette.sky100,
    borderWidth: 1,
    borderColor: palette.sky300,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: palette.ink900
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md
  },
  statCard: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.sky300,
    alignItems: 'center'
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
  exportSection: {
    marginBottom: spacing.md
  },
  registrationsSection: {
    marginTop: spacing.sm
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
    textAlign: 'center'
  },
  registrationsList: {
    gap: spacing.md
  },
  registrationCard: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.sky300
  },
  registrationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm
  },
  registrationInfo: {
    flex: 1,
    marginRight: spacing.sm
  },
  registrationName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900
  },
  registrationEmail: {
    fontSize: 13,
    color: palette.ink700,
    marginTop: 2
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700'
  },
  registrationDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.sm
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  detailLabel: {
    fontSize: 12,
    color: palette.ink700
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.ink900
  }
});
