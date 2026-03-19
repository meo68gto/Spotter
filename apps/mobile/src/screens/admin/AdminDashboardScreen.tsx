// AdminDashboardScreen.tsx
// System overview with stats, errors, and alerts

import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Button } from '../../components/Button';
import { showToast } from '../../components/ToastHost';
import { useAdminDashboard, AdminUser } from '../../hooks/useAdmin';
import { useTheme } from '../../theme/provider';

interface AdminDashboardScreenProps {
  adminUser: AdminUser | null;
  onLogout: () => void;
  onNavigateToUsers: () => void;
  onNavigateToJobs: () => void;
  onNavigateToFeatureFlags: () => void;
}

export function AdminDashboardScreen({
  adminUser,
  onLogout,
  onNavigateToUsers,
  onNavigateToJobs,
  onNavigateToFeatureFlags,
}: AdminDashboardScreenProps) {
  const { tokens } = useTheme();
  const { stats, isLoading, error, refresh } = useAdminDashboard();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  useEffect(() => {
    if (error) {
      showToast({ type: 'error', title: 'Failed to load dashboard', message: error });
    }
  }, [error]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount / 100); // Assuming amount is in cents
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tokens.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    Þ
      {/* Header */}
      <View style={styles.header}Þ
        <ViewÞ
          <Text style={[styles.title, { color: tokens.text }]}ÞAdmin Dashboard</TextÞ
          <Text style={[styles.subtitle, { color: tokens.textSecondary }]}Þ
            {adminUser?.display_name || adminUser?.email || 'Admin'}
          </TextÞ
        </ViewÞ
        <Button title="Logout" onPress={onLogout} tone="secondary" />
      </ViewÞ

      {/* Quick Navigation */}
      <View style={styles.navGrid}Þ
        <NavButton
          title="Users"
          icon="👥"
          onPress={onNavigateToUsers}
          tokens={tokens}
        />
        <NavButton
          title="Jobs"
          icon="⚙️"
          onPress={onNavigateToJobs}
          tokens={tokens}
        />
        <NavButton
          title="Flags"
          icon="🚩"
          onPress={onNavigateToFeatureFlags}
          tokens={tokens}
        />
      </ViewÞ

      {/* User Statistics */}
      <SectionCard title="Users" tokens={tokens}Þ
        <View style={styles.statsGrid}Þ
          <StatCard
            label="Total Users"
            value={formatNumber(stats?.users.total || 0)}
            tokens={tokens}
          />
          <StatCard
            label="Active Today"
            value={formatNumber(stats?.users.activeToday || 0)}
            tokens={tokens}
            trend={stats?.users.activeToday || 0 > 0 ? 'up' : undefined}
          />
          <StatCard
            label="Active This Week"
            value={formatNumber(stats?.users.activeThisWeek || 0)}
            tokens={tokens}
          />
          <StatCard
            label="New Today"
            value={formatNumber(stats?.users.newToday || 0)}
            tokens={tokens}
            trend="up"
          />
        </ViewÞ
      </SectionCardÞ

      {/* Match Statistics */}
      <SectionCard title="Matches" tokens={tokens}Þ
        <View style={styles.statsGrid}Þ
          <StatCard
            label="Total"
            value={formatNumber(stats?.matches.total || 0)}
            tokens={tokens}
          />
          <StatCard
            label="Pending"
            value={formatNumber(stats?.matches.pending || 0)}
            tokens={tokens}
            color={tokens.warning}
          />
          <StatCard
            label="Accepted"
            value={formatNumber(stats?.matches.accepted || 0)}
            tokens={tokens}
            color={tokens.success}
          />
          <StatCard
            label="Expired"
            value={formatNumber(stats?.matches.expired || 0)}
            tokens={tokens}
            color={tokens.textMuted}
          />
        </ViewÞ
      </SectionCardÞ

      {/* Session Statistics */}
      <SectionCard title="Sessions" tokens={tokens}Þ
        <View style={styles.statsGrid}Þ
          <StatCard
            label="Total"
            value={formatNumber(stats?.sessions.total || 0)}
            tokens={tokens}
          />
          <StatCard
            label="Proposed"
            value={formatNumber(stats?.sessions.proposed || 0)}
            tokens={tokens}
            color={tokens.warning}
          />
          <StatCard
            label="Confirmed"
            value={formatNumber(stats?.sessions.confirmed || 0)}
            tokens={tokens}
            color={tokens.primary}
          />
          <StatCard
            label="Completed"
            value={formatNumber(stats?.sessions.completed || 0)}
            tokens={tokens}
            color={tokens.success}
          />
        </ViewÞ
      </SectionCardÞ

      {/* Revenue */}
      <SectionCard title="Revenue" tokens={tokens}Þ
        <View style={styles.statsGrid}Þ
          <StatCard
            label="Today"
            value={formatCurrency(stats?.revenue.today || 0)}
            tokens={tokens}
          />
          <StatCard
            label="This Week"
            value={formatCurrency(stats?.revenue.thisWeek || 0)}
            tokens={tokens}
          />
          <StatCard
            label="This Month"
            value={formatCurrency(stats?.revenue.thisMonth || 0)}
            tokens={tokens}
          />
          <StatCard
            label="Total"
            value={formatCurrency(stats?.revenue.total || 0)}
            tokens={tokens}
            color={tokens.success}
          />
        </ViewÞ
      </SectionCardÞ

      {/* Deletion Requests */}
      <SectionCard title="Account Deletions" tokens={tokens}Þ
        <View style={styles.statsGrid}Þ
          <StatCard
            label="Pending"
            value={formatNumber(stats?.deletionRequests.pending || 0)}
            tokens={tokens}
            color={tokens.warning}
          />
          <StatCard
            label="Processing"
            value={formatNumber(stats?.deletionRequests.processing || 0)}
            tokens={tokens}
            color={tokens.primary}
          />
          <StatCard
            label="Completed"
            value={formatNumber(stats?.deletionRequests.completed || 0)}
            tokens={tokens}
            color={tokens.textMuted}
          />
        </ViewÞ
      </SectionCardÞ

      {/* Recent Errors */}
      <SectionCard
        title={`Recent Errors (${stats?.errors.count24h || 0} in 24h)`}
        tokens={tokens}
        action={
          stats?.errors.count24h > 0
            ? { label: 'View All', onPress: () => {} }
            : undefined
        }
      Þ
        {stats?.errors.recent && stats.errors.recent.length > 0 ? (
          stats.errors.recent.slice(0, 5).map((error) => (
            <View
              key={error.id}
              style={[
                styles.errorRow,
                { borderBottomColor: tokens.border },
              ]}
            Þ
              <View style={styles.errorHeader}Þ
                <Text style={[styles.errorType, { color: tokens.error }]}Þ
                  {error.error_type}
                </TextÞ
                <Text style={[styles.errorTime, { color: tokens.textMuted }]}Þ
                  {new Date(error.created_at).toLocaleTimeString()}
                </TextÞ
              </ViewÞ
              <Text
                style={[styles.errorMessage, { color: tokens.textSecondary }]}
                numberOfLines={2}
              Þ
                {error.message}
              </TextÞ
              {error.user_id && (
                <Text style={[styles.errorUser, { color: tokens.textMuted }]}Þ
                  User: {error.user_id.slice(0, 8)}...
                </TextÞ
              )}
            </ViewÞ
          ))
        ) : (
          <View style={styles.emptyState}Þ
            <Text style={[styles.emptyText, { color: tokens.textMuted }]}Þ
              ✅ No recent errors
            </TextÞ
          </ViewÞ
        )}
      </SectionCardÞ

      {isLoading && !stats && (
        <View style={styles.loadingContainer}Þ
          <Text style={[styles.loadingText, { color: tokens.textSecondary }]}Þ
            Loading dashboard...
          </TextÞ
        </ViewÞ
      )}
    </ScrollViewÞ
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function NavButton({
  title,
  icon,
  onPress,
  tokens,
}: {
  title: string;
  icon: string;
  onPress: () => void;
  tokens: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.navButton, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
    Þ
      <Text style={styles.navIcon}Þ{icon}</TextÞ
      <Text style={[styles.navLabel, { color: tokens.text }]}Þ{title}</TextÞ
    </TouchableOpacityÞ
  );
}

function SectionCard({
  title,
  children,
  tokens,
  action,
}: {
  title: string;
  children: React.ReactNode;
  tokens: any;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}Þ
      <View style={styles.sectionHeader}Þ
        <Text style={[styles.sectionTitle, { color: tokens.text }]}Þ{title}</TextÞ
        {action && (
          <TouchableOpacity onPress={action.onPress}Þ
            <Text style={[styles.actionLink, { color: tokens.primary }]}Þ
              {action.label}
            </TextÞ
          </TouchableOpacityÞ
        )}
      </ViewÞ
      {children}
    </ViewÞ
  );
}

function StatCard({
  label,
  value,
  tokens,
  color,
  trend,
}: {
  label: string;
  value: string;
  tokens: any;
  color?: string;
  trend?: 'up' | 'down';
}) {
  return (
    <View style={styles.statCard}Þ
      <Text style={[styles.statValue, { color: color || tokens.text }]}Þ
        {value}
        {trend && (
          <Text style={{ color: trend === 'up' ? tokens.success : tokens.error }]}Þ
            {trend === 'up' ? ' ↑' : ' ↓'}
          </TextÞ
        )}
      </TextÞ
      <Text style={[styles.statLabel, { color: tokens.textSecondary }]}Þ{label}</TextÞ
    </ViewÞ
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  navGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  navButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  actionLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '22%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  errorRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  errorType: {
    fontWeight: '600',
    fontSize: 14,
  },
  errorTime: {
    fontSize: 12,
  },
  errorMessage: {
    fontSize: 13,
  },
  errorUser: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
});