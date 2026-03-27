// Epic 5: Standing Foursomes Screen
// List and manage standing foursomes

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { StandingFoursomeCard } from '../../components/StandingFoursomeCard';
import { Button } from '../../components/Button';
import { invokeFunction } from '../lib/api';
import { palette, spacing } from '../theme/design';
import { StandingFoursomeWithMembers } from '@spotter/types';

interface StandingFoursomesScreenProps {
  session: Session;
  onCreatePress: () => void;
  onFoursomePress: (foursome: StandingFoursomeWithMembers) => void;
  onSchedulePress: (foursome: StandingFoursomeWithMembers) => void;
}

export function StandingFoursomesScreen({
  session,
  onCreatePress,
  onFoursomePress,
  onSchedulePress,
}: StandingFoursomesScreenProps) {
  const [foursomes, setFoursomes] = useState<StandingFoursomeWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFoursomes = async () => {
    try {
      setError(null);
      const response = await invokeFunction<{ data: StandingFoursomeWithMembers[] }>(
        'standing-foursomes-list',
        { method: 'GET' }
      );
      setFoursomes(response.data);
    } catch (err) {
      console.error('Error fetching foursomes:', err);
      setError('Failed to load standing foursomes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFoursomes();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFoursomes();
  };

  const handlePauseFoursome = (foursome: StandingFoursomeWithMembers) => {
    Alert.alert(
      'Pause Group',
      `Pause "${foursome.name}"? You can reactivate it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pause',
          style: 'destructive',
          onPress: async () => {
            try {
              await invokeFunction('standing-foursomes-pause', {
                method: 'POST',
                body: { foursomeId: foursome.id },
              });
              Alert.alert('Success', 'Group paused');
              fetchFoursomes();
            } catch {
              Alert.alert('Error', 'Failed to pause group');
            }
          },
        },
      ]
    );
  };

  const renderFoursome = ({ item }: { item: StandingFoursomeWithMembers }) => (
    <View style={styles.cardContainer}>
      <StandingFoursomeCard
        foursome={item}
        onPress={() => onFoursomePress(item)}
        onSchedulePress={() => onSchedulePress(item)}
      />
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No Standing Foursomes</Text>
      <Text style={styles.emptyText}>
        Create a standing foursome to easily schedule recurring rounds with your regular playing partners.
      </Text>
      <Button title="Create Group" onPress={onCreatePress} style={styles.emptyButton} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.navy600} />
        <Text style={styles.loadingText}>Loading groups...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Try Again" onPress={fetchFoursomes} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Standing Foursomes</Text>
        <Text style={styles.subtitle}>
          Your regular playing groups
        </Text>
      </View>

      {foursomes.length > 0 && (
        <View style={styles.createButtonContainer}>
          <Button
            title="Create New Group"
            onPress={onCreatePress}
            tone="secondary"
          />
        </View>
      )}

      <FlatList
        data={foursomes}
        renderItem={renderFoursome}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.navy600}
          />
        }
        ListEmptyComponent={renderEmpty}
      />
    </View>
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
  createButtonContainer: {
    padding: spacing.md,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  listContent: {
    padding: spacing.md,
    flexGrow: 1,
  },
  cardContainer: {
    marginBottom: spacing.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.sky100,
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: palette.ink500,
  },
  errorText: {
    fontSize: 16,
    color: palette.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: palette.ink500,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  emptyButton: {
    minWidth: 200,
  },
});
