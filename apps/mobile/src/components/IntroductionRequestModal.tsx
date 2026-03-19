import { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { Button } from './Button';
import { palette, radius, spacing } from '../theme/design';

interface MutualConnection {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface IntroductionRequestModalProps {
  visible: boolean;
  targetUser: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    professional?: {
      role?: string;
      company?: string;
    };
  } | null;
  mutualConnections: MutualConnection[];
  onClose: () => void;
  onRequest: (connectorId: string, message: string) => Promise<void>;
  loading?: boolean;
}

export function IntroductionRequestModal({
  visible,
  targetUser,
  mutualConnections,
  onClose,
  onRequest,
  loading = false,
}: IntroductionRequestModalProps) {
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async () => {
    if (!selectedConnector) {
      setError('Please select a mutual connection to make the introduction');
      return;
    }

    setError(null);
    try {
      await onRequest(selectedConnector, message);
      // Reset state
      setSelectedConnector(null);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSelectedConnector(null);
      setMessage('');
      setError(null);
      onClose();
    }
  };

  if (!targetUser) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Request Introduction</Text>
            <TouchableOpacity onPress={handleClose} disabled={loading}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Target User */}
            <View style={styles.targetSection}>
              <Text style={styles.sectionLabel}>To:</Text>
              <View style={styles.targetUser}>
                {targetUser.avatarUrl ? (
                  <Image source={{ uri: targetUser.avatarUrl }} style={styles.targetAvatar} />
                ) : (
                  <View style={styles.targetAvatarPlaceholder}>
                    <Text style={styles.targetAvatarInitial}>
                      {targetUser.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View>
                  <Text style={styles.targetName}>{targetUser.displayName}</Text>
                  {targetUser.professional?.role && (
                    <Text style={styles.targetRole}>
                      {targetUser.professional.role}
                      {targetUser.professional.company ? ` at ${targetUser.professional.company}` : ''}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Connector Selection */}
            <View style={styles.connectorSection}>
              <Text style={styles.sectionLabel}>Select Mutual Connection:</Text>
              
              {mutualConnections.length === 0 ? (
                <Text style={styles.noConnections}>
                  No mutual connections available
                </Text>
              ) : (
                <View style={styles.connectorsList}>
                  {mutualConnections.map((conn) => (
                    <TouchableOpacity
                      key={conn.id}
                      style={[
                        styles.connectorItem,
                        selectedConnector === conn.id && styles.selectedConnector,
                      ]}
                      onPress={() => setSelectedConnector(conn.id)}
                      disabled={loading}
                    >
                      {conn.avatarUrl ? (
                        <Image source={{ uri: conn.avatarUrl }} style={styles.connectorAvatar} />
                      ) : (
                        <View style={styles.connectorAvatarPlaceholder}>
                          <Text style={styles.connectorAvatarInitial}>
                            {conn.displayName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text style={[
                        styles.connectorName,
                        selectedConnector === conn.id && styles.selectedConnectorName,
                      ]}>
                        {conn.displayName}
                      </Text>
                      {selectedConnector === conn.id && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Message Input */}
            <View style={styles.messageSection}>
              <Text style={styles.sectionLabel}>Message (optional):</Text>
              <TextInput
                style={styles.messageInput}
                multiline
                numberOfLines={4}
                placeholder="Why would you like to connect with this person?"
                placeholderTextColor={palette.ink400}
                value={message}
                onChangeText={setMessage}
                editable={!loading}
                maxLength={500}
              />
              <Text style={styles.charCount}>{message.length}/500</Text>
              
              {/* Timeout Notice */}
              <View style={styles.timeoutNotice}>
                <Text style={styles.timeoutIcon}>⏱️</Text>
                <Text style={styles.timeoutText}>
                  Introduction requests expire after 48 hours if not accepted
                </Text>
              </View>
            </View>

            {/* Error Message */}
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button
              title={loading ? 'Sending...' : 'Request Introduction'}
              onPress={handleRequest}
              disabled={loading || !selectedConnector || mutualConnections.length === 0}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    backgroundColor: palette.white,
    borderRadius: radius.xl,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.ink100,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
  },
  closeButton: {
    fontSize: 24,
    color: palette.ink500,
    padding: spacing.sm,
  },
  content: {
    padding: spacing.lg,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink700,
    marginBottom: spacing.sm,
  },
  targetSection: {
    marginBottom: spacing.lg,
  },
  targetUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.navy50,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  targetAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
  },
  targetAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetAvatarInitial: {
    color: palette.white,
    fontSize: 20,
    fontWeight: '700',
  },
  targetName: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.ink900,
  },
  targetRole: {
    fontSize: 13,
    color: palette.ink600,
    marginTop: 2,
  },
  connectorSection: {
    marginBottom: spacing.lg,
  },
  noConnections: {
    fontSize: 14,
    color: palette.ink500,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: spacing.lg,
  },
  connectorsList: {
    gap: spacing.sm,
  },
  connectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: palette.ink200,
    backgroundColor: palette.white,
  },
  selectedConnector: {
    borderColor: palette.navy600,
    backgroundColor: palette.navy50,
  },
  connectorAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
  },
  connectorAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectorAvatarInitial: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
  },
  connectorName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: palette.ink700,
  },
  selectedConnectorName: {
    color: palette.navy700,
    fontWeight: '600',
  },
  checkmark: {
    color: palette.navy600,
    fontSize: 18,
    fontWeight: '700',
  },
  messageSection: {
    marginBottom: spacing.lg,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: palette.ink300,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    color: palette.ink900,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: palette.ink500,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  timeoutNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: palette.amber50,
    borderRadius: radius.md,
  },
  timeoutIcon: {
    fontSize: 14,
  },
  timeoutText: {
    flex: 1,
    fontSize: 12,
    color: palette.amber700,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 14,
    color: palette.red500,
    marginBottom: spacing.md,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: palette.ink100,
  },
});