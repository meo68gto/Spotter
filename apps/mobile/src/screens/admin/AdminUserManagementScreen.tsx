// AdminUserManagementScreen.tsx
// User search, filter, and management operations

import { useState, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Button } from '../../components/Button';
import { showToast } from '../../components/ToastHost';
import { useAdminUsers, AdminUserDetails } from '../../hooks/useAdmin';
import { useTheme } from '../../theme/provider';

interface AdminUserManagementScreenProps {
  onBack: () => void;
}

export function AdminUserManagementScreen({ onBack }: AdminUserManagementScreenProps) {
  const { tokens } = useTheme();
  const {
    users,
    isLoading,
    error,
    totalCount,
    searchUsers,
    getUserDetails,
    suspendUser,
    activateUser,
    processDeletion,
  } = useAdminUsers();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'suspended' | 'pending_deletion' | 'all'>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUserDetails | null>(null);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const handleSearch = useCallback(() => {
    searchUsers({
      query: searchQuery,
      status: statusFilter,
    });
  }, [searchQuery, statusFilter, searchUsers]);

  const handleUserSelect = useCallback(async (user: AdminUserDetails) => {
    setUserDetailsLoading(true);
    const details = await getUserDetails(user.id);
    if (details) {
      setSelectedUser(details);
    }
    setUserDetailsLoading(false);
  }, [getUserDetails]);

  const handleSuspend = useCallback((userId: string) => {
    Alert.alert(
      'Suspend User',
      'Are you sure you want to suspend this user? They will lose access to the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            setActionInProgress(userId);
            try {
              await suspendUser(userId, 'Administrative suspension');
              showToast({ type: 'success', title: 'User suspended successfully' });
              setSelectedUser(null);
              handleSearch();
            } catch (err) {
              showToast({
                type: 'error',
                title: 'Failed to suspend user',
                message: err instanceof Error ? err.message : 'Unknown error',
              });
            } finally {
              setActionInProgress(null);
            }
          },
        },
      ]
    );
  }, [suspendUser, handleSearch]);

  const handleActivate = useCallback(async (userId: string) => {
    setActionInProgress(userId);
    try {
      await activateUser(userId);
      showToast({ type: 'success', title: 'User activated successfully' });
      setSelectedUser(null);
      handleSearch();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to activate user',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setActionInProgress(null);
    }
  }, [activateUser, handleSearch]);

  const handleProcessDeletion = useCallback((userId: string) => {
    Alert.alert(
      'Process Deletion',
      'This will permanently delete the user and all their data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionInProgress(userId);
            try {
              await processDeletion(userId);
              showToast({ type: 'success', title: 'Deletion processing initiated' });
              setSelectedUser(null);
              handleSearch();
            } catch (err) {
              showToast({
                type: 'error',
                title: 'Failed to process deletion',
                message: err instanceof Error ? err.message : 'Unknown error',
              });
            } finally {
              setActionInProgress(null);
            }
          },
        },
      ]
    );
  }, [processDeletion, handleSearch]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return tokens.success;
      case 'suspended':
        return tokens.error;
      case 'pending_deletion':
        return tokens.warning;
      default:
        return tokens.textMuted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'suspended':
        return 'Suspended';
      case 'pending_deletion':
        return 'Pending Deletion';
      default:
        return status;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: tokens.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Button title="← Back" onPress={onBack} tone="ghost" />
        <Text style={[styles.title, { color: tokens.text }]}>User Management</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Search Section */}
        <View style={[styles.searchCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by email or name..."
            placeholderTextColor={tokens.textMuted}
            style={[
              styles.searchInput,
              {
                borderColor: tokens.borderStrong,
                color: tokens.text,
                backgroundColor: tokens.backgroundElevated,
              },
            ]}
          />

          {/* Status Filter */}
          <View style={styles.filterRow}>
            {(['all', 'active', 'suspended', 'pending_deletion'] as const).map((status) => (
              <TouchableOpacity
                key={status}
                onPress={() => setStatusFilter(status)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      statusFilter === status
                        ? tokens.primary
                        : tokens.backgroundElevated,
                    borderColor: tokens.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color:
                        statusFilter === status ? '#fff' : tokens.textSecondary,
                    },
                  ]}
                >
                  {getStatusLabel(status)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button
            title="Search"
            onPress={handleSearch}
            disabled={isLoading}
            accessibilityLabel="Search users"
          />
        </View>

        {/* Results Count */}
        <Text style={[styles.resultsText, { color: tokens.textSecondary }]}>
          {isLoading ? 'Searching...' : `${totalCount} users found`}
        </Text>

        {/* User List */}
        <View style={styles.userList}>
          {isLoading ? (
            <ActivityIndicator size="large" color={tokens.primary} />
          ) : error ? (
            <Text style={[styles.errorText, { color: tokens.error }]}>{error}</Text>
          ) : users.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
                No users found
              </Text>
            </View>
          ) : (
            users.map((user) => (
              <TouchableOpacity
                key={user.id}
                onPress={() => handleUserSelect(user)}
                style={[
                  styles.userCard,
                  { backgroundColor: tokens.surface, borderColor: tokens.border },
                ]}
              >
                <View style={styles.userHeader}>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: tokens.text }]}>
                      {user.display_name || 'No name'}
                    </Text>
                    <Text style={[styles.userEmail, { color: tokens.textSecondary }]}>
                      {user.email || 'No email'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(user.status) + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(user.status) },
                      ]}
                    >
                      {getStatusLabel(user.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.userStats}>
                  <Text style={[styles.userStat, { color: tokens.textMuted }]}>
                    Created: {new Date(user.created_at).toLocaleDateString()}
                  </Text>
                  <Text style={[styles.userStat, { color: tokens.textMuted }]}>
                    Matches: {user.matches_count}
                  </Text>
                </View>

                {user.deletion_request && (
                  <View
                    style={[
                      styles.deletionBanner,
                      { backgroundColor: tokens.error + '10' },
                    ]}
                  >
                    <Text style={[styles.deletionText, { color: tokens.error }]}>
                      ⚠️ Deletion requested:{' '}
                      {new Date(user.deletion_request.requested_at).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* User Detail Modal */}
      <Modal
        visible={!!selectedUser}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedUser(null)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: tokens.background + 'ee' }]}>
          <ScrollView style={styles.modalContent}>
            {userDetailsLoading ? (
              <ActivityIndicator size="large" color={tokens.primary} />
            ) : selectedUser ? (
              <View
                style={[
                  styles.modalCard,
                  { backgroundColor: tokens.surface, borderColor: tokens.border },
                ]}
              >
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: tokens.text }]}>
                    User Details
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedUser(null)}>
                    <Text style={[styles.closeButton, { color: tokens.textSecondary }]}>
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.userDetailSection}>
                  <Text style={[styles.detailLabel, { color: tokens.textMuted }]}>
                    Display Name
                  </Text>
                  <Text style={[styles.detailValue, { color: tokens.text }]}>
                    {selectedUser.display_name || 'N/A'}
                  </Text>
                </View>

                <View style={styles.userDetailSection}>
                  <Text style={[styles.detailLabel, { color: tokens.textMuted }]}>
                    Email
                  </Text>
                  <Text style={[styles.detailValue, { color: tokens.text }]}>
                    {selectedUser.email || 'N/A'}
                  </Text>
                </View>

                <View style={styles.userDetailSection}>
                  <Text style={[styles.detailLabel, { color: tokens.textMuted }]}>
                    User ID
                  </Text>
                  <Text style={[styles.detailValue, { color: tokens.text }]}>
                    {selectedUser.id}
                  </Text>
                </View>

                <View style={styles.userDetailSection}>
                  <Text style={[styles.detailLabel, { color: tokens.textMuted }]}>
                    Status
                  </Text>
                  <View style={styles.statusRow}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(selectedUser.status) + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(selectedUser.status) },
                        ]}
                      >
                        {getStatusLabel(selectedUser.status)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.userDetailSection}>
                  <Text style={[styles.detailLabel, { color: tokens.textMuted }]}>
                    Activity
                  </Text>
                  <Text style={[styles.detailValue, { color: tokens.text }]}>
                    Matches: {selectedUser.matches_count}
                  </Text>
                  <Text style={[styles.detailValue, { color: tokens.text }]}>
                    Sessions: {selectedUser.sessions_count}
                  </Text>
                  <Text style={[styles.detailValue, { color: tokens.text }]}>
                    Created: {new Date(selectedUser.created_at).toLocaleString()}
                  </Text>
                  {selectedUser.last_sign_in_at && (
                    <Text style={[styles.detailValue, { color: tokens.text }]}>
                      Last sign in:{' '}
                      {new Date(selectedUser.last_sign_in_at).toLocaleString()}
                    </Text>
                  )}
                </View>

                {selectedUser.deletion_request && (
                  <View
                    style={[
                      styles.deletionRequestBox,
                      { backgroundColor: tokens.warning + '15', borderColor: tokens.warning },
                    ]}
                  >
                    <Text style={[styles.deletionTitle, { color: tokens.warning }]}>
                      Deletion Request Pending
                    </Text>
                    <Text style={[styles.deletionDetail, { color: tokens.textSecondary }]}>
                      Requested:{' '}
                      {new Date(selectedUser.deletion_request.requested_at).toLocaleString()}
                    </Text>
                    <Text style={[styles.deletionDetail, { color: tokens.textSecondary }]}>
                      Status: {selectedUser.deletion_request.status}
                    </Text>
                    <Button
                      title="Process Deletion"
                      onPress={() => handleProcessDeletion(selectedUser.id)}
                      disabled={actionInProgress === selectedUser.id}
                      accessibilityLabel="Process account deletion"
                    />
                  </View>
                )}

                <View style={styles.actionButtons}>
                  {selectedUser.status === 'active' && (
                    <Button
                      title="Suspend User"
                      tone="secondary"
                      onPress={() => handleSuspend(selectedUser.id)}
                      disabled={actionInProgress === selectedUser.id}
                      accessibilityLabel="Suspend user account"
                    />
                  )}
                  {selectedUser.status === 'suspended' && (
                    <Button
                      title="Activate User"
                      onPress={() => handleActivate(selectedUser.id)}
                      disabled={actionInProgress === selectedUser.id}
                      accessibilityLabel="Activate user account"
                    />
                  )}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  content: {
    padding: 16,
  },
  searchCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultsText: {
    fontSize: 14,
    marginBottom: 12,
  },
  userList: {
    gap: 12,
  },
  userCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userStats: {
    flexDirection: 'row',
    gap: 16,
  },
  userStat: {
    fontSize: 13,
  },
  deletionBanner: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
  },
  deletionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    flex: 1,
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginTop: 60,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  closeButton: {
    fontSize: 24,
    padding: 4,
  },
  userDetailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deletionRequestBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginVertical: 16,
  },
  deletionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  deletionDetail: {
    fontSize: 14,
    marginBottom: 4,
  },
  actionButtons: {
    gap: 12,
    marginTop: 8,
  },
});