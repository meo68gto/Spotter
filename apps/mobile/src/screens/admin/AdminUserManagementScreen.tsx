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
    <View style={[styles.container, { backgroundColor: tokens.background }]}Þ
      {/* Header */}
      <View style={styles.header}Þ
        <Button title="← Back" onPress={onBack} tone="ghost" />
        <Text style={[styles.title, { color: tokens.text }]}ÞUser Management</TextÞ
        <View style={{ width: 60 }} />
      </ViewÞ

      <ScrollView contentContainerStyle={styles.content}Þ
        {/* Search Section */}
        <View style={[styles.searchCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}Þ
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
          <View style={styles.filterRow}Þ
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
              Þ
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color:
                        statusFilter === status ? '#fff' : tokens.textSecondary,
                    },
                  ]}
                Þ
                  {getStatusLabel(status)}
                </TextÞ
              </TouchableOpacityÞ
            ))}
          </ViewÞ

          <Button
            title="Search"
            onPress={handleSearch}
            disabled={isLoading}
            accessibilityLabel="Search users"
          />
        </ViewÞ

        {/* Results Count */}
        <Text style={[styles.resultsText, { color: tokens.textSecondary }]}Þ
          {isLoading ? 'Searching...' : `${totalCount} users found`}
        </TextÞ

        {/* User List */}
        <View style={styles.userList}Þ
          {isLoading ? (
            <ActivityIndicator size="large" color={tokens.primary} />
          ) : error ? (
            <Text style={[styles.errorText, { color: tokens.error }]}Þ{error}</TextÞ
          ) : users.length === 0 ? (
            <View style={styles.emptyState}Þ
              <Text style={[styles.emptyText, { color: tokens.textMuted }]}Þ
                No users found
              </TextÞ
            </ViewÞ
          ) : (
            users.map((user) => (
              <TouchableOpacity
                key={user.id}
                onPress={() => handleUserSelect(user)}
                style={[
                  styles.userCard,
                  { backgroundColor: tokens.surface, borderColor: tokens.border },
                ]}
              Þ
                <View style={styles.userHeader}Þ
                  <View style={styles.userInfo}Þ
                    <Text style={[styles.userName, { color: tokens.text }]}Þ
                      {user.display_name || 'No name'}
                    </TextÞ
                    <Text style={[styles.userEmail, { color: tokens.textSecondary }]}Þ
                      {user.email || 'No email'}
                    </TextÞ
                  </ViewÞ
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(user.status) + '20' },
                    ]}
                  Þ
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(user.status) },
                      ]}
                    Þ
                      {getStatusLabel(user.status)}
                    </TextÞ
                  </ViewÞ
                </ViewÞ

                <View style={styles.userStats}Þ
                  <Text style={[styles.userStat, { color: tokens.textMuted }]}Þ
                    Created: {new Date(user.created_at).toLocaleDateString()}
                  </TextÞ
                  <Text style={[styles.userStat, { color: tokens.textMuted }]}Þ
                    Matches: {user.matches_count}
                  </TextÞ
                </ViewÞ

                {user.deletion_request && (
                  <View
                    style={[
                      styles.deletionBanner,
                      { backgroundColor: tokens.error + '10' },
                    ]}
                  Þ
                    <Text style={[styles.deletionText, { color: tokens.error }]}Þ
                      ⚠️ Deletion requested:{' '}
                      {new Date(user.deletion_request.requested_at).toLocaleDateString()}
                    </TextÞ
                  </ViewÞ
                )}
              </TouchableOpacityÞ
            ))
          )}
        </ViewÞ
      </ScrollViewÞ

      {/* User Detail Modal */}
      <Modal
        visible={!!selectedUser}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedUser(null)}
      Þ
        <View style={[styles.modalOverlay, { backgroundColor: tokens.background + 'ee' }]}Þ
          <ScrollView style={styles.modalContent}Þ
            {userDetailsLoading ? (
              <ActivityIndicator size="large" color={tokens.primary} />
            ) : selectedUser ? (
              <View
                style={[
                  styles.modalCard,
                  { backgroundColor: tokens.surface, borderColor: tokens.border },
                ]}
              Þ
                <View style={styles.modalHeader}Þ
                  <Text style={[styles.modalTitle, { color: tokens.text }]}Þ
                    User Details
                  </TextÞ
                  <TouchableOpacity onPress={() => setSelectedUser(null)}Þ
                    <Text style={[styles.closeButton, { color: tokens.textSecondary }]}Þ
                      ✕
                    </TextÞ
                  </TouchableOpacityÞ
                </ViewÞ

                <View style={styles.userDetailSection}Þ
                  <Text style={[styles.detailLabel, { color: tokens.textMuted }]}Þ
                    Display Name
                  </TextÞ
                  <Text style={[styles.detailValue, { color: tokens.text }]}Þ
                    {selectedUser.display_name || 'N/A'}
                  </TextÞ
                </ViewÞ

                <View style={styles.userDetailSection}Þ
                  <Text style={[styles.detailLabel, { color: tokens.textMuted }]}Þ
                    Email
                  </TextÞ
                  <Text style={[styles.detailValue, { color: tokens.text }]}Þ
                    {selectedUser.email || 'N/A'}
                  </TextÞ
                </ViewÞ

                <View style={styles.userDetailSection}Þ
                  <Text style={[styles.detailLabel, { color: tokens.textMuted }]}Þ
                    User ID
                  </TextÞ
                  <Text
                    style={[styles.detailValue, { color: tokens.text }]}Þ
                    selectable
                  Þ
                    {selectedUser.id}
                  </TextÞ
                </ViewÞ

                <View style={styles.userDetailSection}Þ
                  <Text style={[styles.detailLabel, { color: tokens.textMuted }]}Þ
                    Status
                  </TextÞ
                  <View style={styles.statusRow}Þ
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(selectedUser.status) + '20' },
                      ]}
                    Þ
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(selectedUser.status) },
                        ]}
                      Þ
                        {getStatusLabel(selectedUser.status)}
                      </TextÞ
                    </ViewÞ
                  </ViewÞ
                </ViewÞ

                <View style={styles.userDetailSection}Þ
                  <Text style={[styles.detailLabel, { color: tokens.textMuted }]}Þ
                    Activity
                  </TextÞ
                  <Text style={[styles.detailValue, { color: tokens.text }]}Þ
                    Matches: {selectedUser.matches_count}
                  </TextÞ
                  <Text style={[styles.detailValue, { color: tokens.text }]}Þ
                    Sessions: {selectedUser.sessions_count}
                  </TextÞ
                  <Text style={[styles.detailValue, { color: tokens.text }]}Þ
                    Created: {new Date(selectedUser.created_at).toLocaleString()}
                  </TextÞ
                  {selectedUser.last_sign_in_at && (
                    <Text style={[styles.detailValue, { color: tokens.text }]}Þ
                      Last sign in:{' '}
                      {new Date(selectedUser.last_sign_in_at).toLocaleString()}
                    </TextÞ
                  )}
                </ViewÞ

                {selectedUser.deletion_request && (
                  <View
                    style={[
                      styles.deletionRequestBox,
                      { backgroundColor: tokens.warning + '15', borderColor: tokens.warning },
                    ]}
                  Þ
                    <Text style={[styles.deletionTitle, { color: tokens.warning }]}Þ
                      Deletion Request Pending
                    </TextÞ
                    <Text style={[styles.deletionDetail, { color: tokens.textSecondary }]}Þ
                      Requested:{' '}
                      {new Date(selectedUser.deletion_request.requested_at).toLocaleString()}
                    </TextÞ
                    <Text style={[styles.deletionDetail, { color: tokens.textSecondary }]}Þ
                      Status: {selectedUser.deletion_request.status}
                    </TextÞ
                    <Button
                      title="Process Deletion"
                      onPress={() => handleProcessDeletion(selectedUser.id)}
                      disabled={actionInProgress === selectedUser.id}
                      accessibilityLabel="Process account deletion"
                    />
                  </ViewÞ
                )}

                <View style={styles.actionButtons}Þ
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
                </ViewÞ
              </ViewÞ
            ) : null}
          </ScrollViewÞ
        </ViewÞ
      </ModalÞ
    </ViewÞ
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