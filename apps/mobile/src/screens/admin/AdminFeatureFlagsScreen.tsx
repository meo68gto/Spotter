// AdminFeatureFlagsScreen.tsx
// List, toggle, and manage feature flags with usage stats

import { useState, useCallback, useEffect } from 'react';
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
import { useAdminFeatureFlags, FeatureFlag } from '../../hooks/useAdmin';
import { useTheme } from '../../theme/provider';

interface AdminFeatureFlagsScreenProps {
  onBack: () => void;
}

export function AdminFeatureFlagsScreen({ onBack }: AdminFeatureFlagsScreenProps) {
  const { tokens } = useTheme();
  const {
    flags,
    isLoading,
    error,
    refresh,
    createFlag,
    updateFlag,
    deleteFlag,
    toggleFlag,
  } = useAdminFeatureFlags();

  const [environmentFilter, setEnvironmentFilter] = useState<'local' | 'staging' | 'production' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  // Form state for creating new flag
  const [newFlag, setNewFlag] = useState({
    key: '',
    environment: 'local',
    value: false,
    payload: '',
  });

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredFlags = flags.filter((flag) => {
    const matchesEnv = environmentFilter === 'all' || flag.environment === environmentFilter;
    const matchesSearch =
      searchQuery === '' ||
      flag.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      flag.environment.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesEnv && matchesSearch;
  });

  const handleCreateFlag = useCallback(async () => {
    if (!newFlag.key.trim()) {
      showToast({ type: 'error', title: 'Flag key is required' });
      return;
    }

    setActionInProgress(true);
    try {
      let payload = {};
      if (newFlag.payload.trim()) {
        try {
          payload = JSON.parse(newFlag.payload);
        } catch {
          showToast({ type: 'error', title: 'Invalid JSON payload' });
          setActionInProgress(false);
          return;
        }
      }

      await createFlag({
        key: newFlag.key.trim(),
        environment: newFlag.environment,
        value: newFlag.value,
        payload,
      });

      showToast({ type: 'success', title: 'Feature flag created' });
      setShowCreateModal(false);
      setNewFlag({ key: '', environment: 'local', value: false, payload: '' });
      await refresh();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to create flag',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setActionInProgress(false);
    }
  }, [newFlag, createFlag, refresh]);

  const handleToggleFlag = useCallback(async (flag: FeatureFlag) => {
    setActionInProgress(true);
    try {
      await toggleFlag(flag.id, flag.value);
      showToast({
        type: 'success',
        title: `Flag "${flag.key}" ${flag.value ? 'disabled' : 'enabled'}`,
      });
      await refresh();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to toggle flag',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setActionInProgress(false);
    }
  }, [toggleFlag, refresh]);

  const handleDeleteFlag = useCallback((flag: FeatureFlag) => {
    Alert.alert(
      'Delete Feature Flag',
      `Are you sure you want to delete "${flag.key}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionInProgress(true);
            try {
              await deleteFlag(flag.id);
              showToast({ type: 'success', title: 'Feature flag deleted' });
              await refresh();
            } catch (err) {
              showToast({
                type: 'error',
                title: 'Failed to delete flag',
                message: err instanceof Error ? err.message : 'Unknown error',
              });
            } finally {
              setActionInProgress(false);
            }
          },
        },
      ]
    );
  }, [deleteFlag, refresh]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingFlag) return;

    setActionInProgress(true);
    try {
      let payload = editingFlag.payload;
      await updateFlag(editingFlag.id, { value: editingFlag.value, payload });
      showToast({ type: 'success', title: 'Feature flag updated' });
      setEditingFlag(null);
      await refresh();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to update flag',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setActionInProgress(false);
    }
  }, [editingFlag, updateFlag, refresh]);

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case 'production':
        return tokens.error;
      case 'staging':
        return tokens.warning;
      case 'local':
        return tokens.success;
      default:
        return tokens.textMuted;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: tokens.background }]}Þ
      {/* Header */}
      <View style={styles.header}Þ
        <Button title="← Back" onPress={onBack} tone="ghost" />
        <Text style={[styles.title, { color: tokens.text }]}ÞFeature Flags</TextÞ
        <TouchableOpacity onPress={refresh} disabled={isLoading}Þ
          <Text style={[styles.refreshButton, { color: tokens.primary }]}Þ
            {isLoading ? '⟳' : '↻'}
          </TextÞ
        </TouchableOpacityÞ
      </ViewÞ

      <ScrollView contentContainerStyle={styles.content}Þ
        {/* Controls */}
        <View style={[styles.controlsCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}Þ
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search flags..."
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

          <View style={styles.filterRow}Þ
            {(['all', 'local', 'staging', 'production'] as const).map((env) => (
              <TouchableOpacity
                key={env}
                onPress={() => setEnvironmentFilter(env)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      environmentFilter === env ? tokens.primary : tokens.backgroundElevated,
                    borderColor: tokens.border,
                  },
                ]}
              Þ
                <Text
                  style={[
                    styles.filterChipText,
                    { color: environmentFilter === env ? '#fff' : tokens.textSecondary },
                  ]}
                Þ
                  {env.charAt(0).toUpperCase() + env.slice(1)}
                </TextÞ
              </TouchableOpacityÞ
            ))}
          </ViewÞ

          <Button
            title="+ Create New Flag"
            onPress={() => setShowCreateModal(true)}
            accessibilityLabel="Create new feature flag"
          />
        </ViewÞ

        {/* Flags List */}
        <Text style={[styles.countText, { color: tokens.textSecondary }]}Þ
          {isLoading ? 'Loading...' : `${filteredFlags.length} flags`}
        </TextÞ

        {isLoading ? (
          <ActivityIndicator size="large" color={tokens.primary} />
        ) : error ? (
          <Text style={[styles.errorText, { color: tokens.error }]}Þ{error}</TextÞ
        ) : (
          <View style={styles.flagsList}Þ
            {filteredFlags.map((flag) => (
              <View
                key={flag.id}
                style={[
                  styles.flagCard,
                  { backgroundColor: tokens.surface, borderColor: tokens.border },
                ]}
              Þ
                <View style={styles.flagHeader}Þ
                  <View style={styles.flagInfo}Þ
                    <Text style={[styles.flagKey, { color: tokens.text }]}Þ{flag.key}</TextÞ
                    <View style={styles.flagMeta}Þ
                      <View
                        style={[
                          styles.envBadge,
                          { backgroundColor: getEnvironmentColor(flag.environment) + '20' },
                        ]}
                      Þ
                        <Text
                          style={[
                            styles.envText,
                            { color: getEnvironmentColor(flag.environment) },
                          ]}
                        Þ
                          {flag.environment}
                        </TextÞ
                      </ViewÞ
                      <Text style={[styles.updatedText, { color: tokens.textMuted }]}Þ
                        Updated: {new Date(flag.updated_at).toLocaleDateString()}
                      </TextÞ
                    </ViewÞ
                  </ViewÞ

                  <TouchableOpacity
                    onPress={() => handleToggleFlag(flag)}
                    disabled={actionInProgress}
                    style={[
                      styles.toggle,
                      {
                        backgroundColor: flag.value ? tokens.success : tokens.textMuted,
                      },
                    ]}
                  Þ
                    <View
                      style={[
                        styles.toggleKnob,
                        {
                          backgroundColor: '#fff',
                          transform: [{ translateX: flag.value ? 20 : 0 }],
                        },
                      ]}
                    />
                  </TouchableOpacityÞ
                </ViewÞ

                {/* Usage Stats */}
                {flag.usage_stats && (
                  <View style={styles.statsRow}Þ
                    <StatItem
                      label="Enabled"
                      value={flag.usage_stats.enabled_count}
                      tokens={tokens}
                    />
                    <StatItem
                      label="Total Requests"
                      value={flag.usage_stats.total_requests}
                      tokens={tokens}
                    />
                    <StatItem
                      label="Last 7d"
                      value={flag.usage_stats.last_7d_requests}
                      tokens={tokens}
                    />
                  </ViewÞ
                )}

                {/* Payload Preview */}
                {Object.keys(flag.payload || {}).length > 0 && (
                  <View style={styles.payloadBox}Þ
                    <Text style={[styles.payloadLabel, { color: tokens.textMuted }]}Þ
                      Payload:
                    </TextÞ
                    <Text
                      style={[styles.payloadText, { color: tokens.textSecondary }]}
                      numberOfLines={2}
                    Þ
                      {JSON.stringify(flag.payload)}
                    </TextÞ
                  </ViewÞ
                )}

                {/* Actions */}
                <View style={styles.flagActions}Þ
                  <Button
                    title="Edit"
                    tone="secondary"
                    onPress={() => setEditingFlag(flag)}
                    accessibilityLabel={`Edit ${flag.key}`}
                  />
                  <Button
                    title="Delete"
                    tone="ghost"
                    onPress={() => handleDeleteFlag(flag)}
                    accessibilityLabel={`Delete ${flag.key}`}
                  />
                </ViewÞ
              </ViewÞ
            ))}

            {filteredFlags.length === 0 && (
              <View style={styles.emptyState}Þ
                <Text style={[styles.emptyText, { color: tokens.textMuted }]}Þ
                  No feature flags found
                </TextÞ
              </ViewÞ
            )}
          </ViewÞ
        )}
      </ScrollViewÞ

      {/* Create Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      Þ
        <View style={[styles.modalOverlay, { backgroundColor: tokens.background + 'ee' }]}Þ
          <View style={[styles.modalCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}Þ
            <Text style={[styles.modalTitle, { color: tokens.text }]}Þ
              Create Feature Flag
            </TextÞ

            <Text style={[styles.inputLabel, { color: tokens.textSecondary }]}ÞKey</TextÞ
            <TextInput
              value={newFlag.key}
              onChangeText={(text) => setNewFlag({ ...newFlag, key: text })}
              placeholder="e.g., new_feature_v2"
              placeholderTextColor={tokens.textMuted}
              style={[
                styles.modalInput,
                {
                  borderColor: tokens.borderStrong,
                  color: tokens.text,
                  backgroundColor: tokens.backgroundElevated,
                },
              ]}
            />

            <Text style={[styles.inputLabel, { color: tokens.textSecondary }]}ÞEnvironment</TextÞ
            <View style={styles.envSelector}Þ
              {(['local', 'staging', 'production'] as const).map((env) => (
                <TouchableOpacity
                  key={env}
                  onPress={() => setNewFlag({ ...newFlag, environment: env })}
                  style={[
                    styles.envOption,
                    {
                      backgroundColor:
                        newFlag.environment === env ? tokens.primary : tokens.backgroundElevated,
                      borderColor: tokens.border,
                    },
                  ]}
                Þ
                  <Text
                    style={[
                      styles.envOptionText,
                      { color: newFlag.environment === env ? '#fff' : tokens.textSecondary },
                    ]}
                  Þ
                    {env.charAt(0).toUpperCase() + env.slice(1)}
                  </TextÞ
                </TouchableOpacityÞ
              ))}
            </ViewÞ

            <Text style={[styles.inputLabel, { color: tokens.textSecondary }]}ÞPayload (JSON)</TextÞ
            <TextInput
              value={newFlag.payload}
              onChangeText={(text) => setNewFlag({ ...newFlag, payload: text })}
              placeholder='{"rollout_percentage": 10}'
              placeholderTextColor={tokens.textMuted}
              multiline
              style={[
                styles.modalInput,
                styles.modalTextArea,
                {
                  borderColor: tokens.borderStrong,
                  color: tokens.text,
                  backgroundColor: tokens.backgroundElevated,
                },
              ]}
            />

            <View style={styles.modalActions}Þ
              <Button
                title="Cancel"
                tone="secondary"
                onPress={() => setShowCreateModal(false)}
              />
              <Button
                title={actionInProgress ? 'Creating...' : 'Create'}
                disabled={actionInProgress || !newFlag.key.trim()}
                onPress={handleCreateFlag}
              />
            </ViewÞ
          </ViewÞ
        </ViewÞ
      </ModalÞ

      {/* Edit Modal */}
      <Modal
        visible={!!editingFlag}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingFlag(null)}
      Þ
        <View style={[styles.modalOverlay, { backgroundColor: tokens.background + 'ee' }]}Þ
          <View style={[styles.modalCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}Þ
            <Text style={[styles.modalTitle, { color: tokens.text }]}Þ
              Edit Feature Flag
            </TextÞ

            {editingFlag && (
              <>
                <Text style={[styles.readOnlyLabel, { color: tokens.textMuted }]}ÞKey</TextÞ
                <Text style={[styles.readOnlyValue, { color: tokens.text }]}Þ
                  {editingFlag.key}
                </TextÞ

                <Text style={[styles.readOnlyLabel, { color: tokens.textMuted }]}ÞEnvironment</TextÞ
                <Text style={[styles.readOnlyValue, { color: tokens.text }]}Þ
                  {editingFlag.environment}
                </TextÞ

                <Text style={[styles.inputLabel, { color: tokens.textSecondary }]}ÞValue</TextÞ
                <View style={styles.editValueRow}Þ
                  <TouchableOpacity
                    onPress={() => setEditingFlag({ ...editingFlag, value: true })}
                    style={[
                      styles.valueOption,
                      {
                        backgroundColor: editingFlag.value ? tokens.success : tokens.backgroundElevated,
                        borderColor: editingFlag.value ? tokens.success : tokens.border,
                      },
                    ]}
                  Þ
                    <Text style={{ color: editingFlag.value ? '#fff' : tokens.text }}ÞON</TextÞ
                  </TouchableOpacityÞ
                  <TouchableOpacity
                    onPress={() => setEditingFlag({ ...editingFlag, value: false })}
                    style={[
                      styles.valueOption,
                      {
                        backgroundColor: !editingFlag.value ? tokens.textMuted : tokens.backgroundElevated,
                        borderColor: !editingFlag.value ? tokens.textMuted : tokens.border,
                      },
                    ]}
                  Þ
                    <Text style={{ color: !editingFlag.value ? '#fff' : tokens.text }}ÞOFF</TextÞ
                  </TouchableOpacityÞ
                </ViewÞ

                <View style={styles.modalActions}Þ
                  <Button
                    title="Cancel"
                    tone="secondary"
                    onPress={() => setEditingFlag(null)}
                  />
                  <Button
                    title={actionInProgress ? 'Saving...' : 'Save'}
                    disabled={actionInProgress}
                    onPress={handleSaveEdit}
                  />
                </ViewÞ
              </>
            )}
          </ViewÞ
        </ViewÞ
      </ModalÞ
    </ViewÞ
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatItem({
  label,
  value,
  tokens,
}: {
  label: string;
  value: number;
  tokens: any;
}) {
  return (
    <View style={styles.statItem}Þ
      <Text style={[styles.statValue, { color: tokens.text }]}Þ
        {value.toLocaleString()}
      </TextÞ
      <Text style={[styles.statLabel, { color: tokens.textMuted }]}Þ{label}</TextÞ
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
  refreshButton: {
    fontSize: 20,
    padding: 4,
  },
  content: {
    padding: 16,
  },
  controlsCard: {
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
  countText: {
    fontSize: 14,
    marginBottom: 12,
  },
  flagsList: {
    gap: 12,
  },
  flagCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  flagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  flagInfo: {
    flex: 1,
  },
  flagKey: {
    fontSize: 16,
    fontWeight: '700',
  },
  flagMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  envBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  envText: {
    fontSize: 11,
    fontWeight: '700',
  },
  updatedText: {
    fontSize: 12,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    padding: 2,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
  },
  payloadBox: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  payloadLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  payloadText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  flagActions: {
    flexDirection: 'row',
    gap: 8,
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
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  envSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  envOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  envOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  readOnlyLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  readOnlyValue: {
    fontSize: 16,
    marginBottom: 16,
  },
  editValueRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  valueOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
});