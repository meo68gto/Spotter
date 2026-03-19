import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput,
  ActivityIndicator,
  Alert 
} from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { palette, radius, spacing } from '../theme/design';

// ============================================================================
// Types
// ============================================================================

interface VouchPromptProps {
  visible: boolean;
  onClose: () => void;
  onVouch: (notes?: string) => Promise<void>;
  vouchedUserName: string;
  sharedRoundsCount: number;
  canVouch: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function VouchPrompt({
  visible,
  onClose,
  onVouch,
  vouchedUserName,
  sharedRoundsCount,
  canVouch
}: VouchPromptProps) {
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleVouch = async () => {
    if (!canVouch) return;
    
    setIsLoading(true);
    try {
      await onVouch(notes.trim() || undefined);
      Alert.alert(
        'Vouch Submitted',
        `You've vouched for ${vouchedUserName}. Your vouch will be visible to other golfers.`,
        [{ text: 'Great!', onPress: onClose }]
      );
      setNotes('');
    } catch (error) {
      Alert.alert(
        'Unable to Vouch',
        error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setNotes('');
    onClose();
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          onPress={handleClose}
          activeOpacity={1}
        />
        
        <Card style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.emoji}>🤝</Text>
            <Text style={styles.title}>Vouch for {vouchedUserName}?</Text>
            <Text style={styles.subtitle}>
              You've played {sharedRoundsCount} rounds together. 
              Vouching shows other golfers they're a reliable player.
            </Text>
          </View>

          {!canVouch ? (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>
                ⚠️ You need to play at least 3 rounds together to vouch for someone.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Add a note (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Great playing partner, always on time..."
                  placeholderTextColor={palette.ink500}
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                  editable={!isLoading}
                />
                <Text style={styles.charCount}>{notes.length}/200</Text>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>About Vouches</Text>
                <Text style={styles.infoText}>
                  • Vouches expire after 1 year{'\n'}
                  • You can give up to 5 vouches total{'\n'}
                  • Only visible to golfers in your tier
                </Text>
              </View>
            </>
          )}

          <View style={styles.actions}>
            <Button
              title={isLoading ? 'Submitting...' : 'Give Vouch'}
              onPress={handleVouch}
              tone="primary"
              disabled={!canVouch || isLoading}
            />
            {!isLoading && (
              <Button
                title="Not Now"
                onPress={handleClose}
                tone="secondary"
              />
            )}
          </View>

          {isLoading && (
            <ActivityIndicator 
              style={styles.loader} 
              color={palette.navy600}
              size="small"
            />
          )}
        </Card>
      </View>
    </Modal>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.ink900,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: palette.ink600,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  warningContainer: {
    backgroundColor: '#fef3c7',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warningText: {
    fontSize: 14,
    color: '#92400e',
    textAlign: 'center',
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink800,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.sky300,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 14,
    color: palette.ink900,
    backgroundColor: palette.sky100,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: palette.ink500,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  infoBox: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.ink800,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: 12,
    color: palette.ink600,
    lineHeight: 18,
  },
  actions: {
    gap: spacing.sm,
  },
  loader: {
    marginTop: spacing.sm,
  },
});
