import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView 
} from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { palette, radius, spacing } from '../theme/design';
import type { IncidentSeverity, IncidentCategory } from '@spotter/types';

// ============================================================================
// Types
// ============================================================================

interface IncidentReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    severity: IncidentSeverity;
    category: IncidentCategory;
    description: string;
    roundId?: string;
  }) => Promise<void>;
  reportedUserName: string;
  roundId?: string;
}

type SeverityOption = {
  value: IncidentSeverity;
  label: string;
  description: string;
  color: string;
};

type CategoryOption = {
  value: IncidentCategory;
  label: string;
  description: string;
};

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_OPTIONS: SeverityOption[] = [
  {
    value: 'minor',
    label: 'Minor',
    description: 'Small inconvenience, late by <15 min',
    color: '#eab308'
  },
  {
    value: 'moderate',
    label: 'Moderate',
    description: 'Significant disruption, late by 15-30 min',
    color: '#f97316'
  },
  {
    value: 'serious',
    label: 'Serious',
    description: 'Major issue, no-show, or safety concern',
    color: '#ef4444'
  }
];

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    value: 'no_show',
    label: 'No Show',
    description: 'Did not attend the scheduled round'
  },
  {
    value: 'late',
    label: 'Late Arrival',
    description: 'Arrived significantly late'
  },
  {
    value: 'behavior',
    label: 'Behavior',
    description: 'Inappropriate conduct during round'
  },
  {
    value: 'safety',
    label: 'Safety',
    description: 'Safety concern or reckless behavior'
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else'
  }
];

// ============================================================================
// Component
// ============================================================================

export function IncidentReportModal({
  visible,
  onClose,
  onSubmit,
  reportedUserName,
  roundId
}: IncidentReportModalProps) {
  const [severity, setSeverity] = useState<IncidentSeverity>('minor');
  const [category, setCategory] = useState<IncidentCategory>('other');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const resetForm = () => {
    setSeverity('minor');
    setCategory('other');
    setDescription('');
    setStep(1);
    setIsLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (description.length < 10) {
      Alert.alert('Please provide more details', 'Description must be at least 10 characters');
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit({
        severity,
        category,
        description: description.trim(),
        roundId
      });
      
      Alert.alert(
        'Report Submitted',
        'Thank you for your report. Our team will review this privately and take appropriate action. Your feedback helps keep the community reliable.',
        [{ 
          text: 'OK', 
          onPress: () => {
            resetForm();
            onClose();
          }
        }]
      );
    } catch (error) {
      Alert.alert(
        'Submission Failed',
        error instanceof Error ? error.message : 'Unable to submit report. Please try again.'
      );
      setIsLoading(false);
    }
  };

  const canProceed = step === 1 || description.length >= 10;

  return (
    <Modal
      animationType="slide"
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
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.header}>
              <Text style={styles.emoji}>📝</Text>
              <Text style={styles.title}>Private Report</Text>
              <Text style={styles.subtitle}>
                Report {reportedUserName} discreetly. This is only visible to our moderation team.
              </Text>
            </View>

            {step === 1 ? (
              <>
                <Text style={styles.sectionLabel}>How serious was this?*</Text>
                <View style={styles.optionsContainer}>
                  {SEVERITY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        severity === option.value && styles.optionButtonSelected,
                        severity === option.value && { borderColor: option.color }
                      ]}
                      onPress={() => setSeverity(option.value)}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.optionLabel,
                        { color: option.color }
                      ]}>
                        {option.label}
                      </Text>
                      <Text style={styles.optionDescription}>
                        {option.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.sectionLabel}>What happened?*</Text>
                <View style={styles.optionsContainer}>
                  {CATEGORY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        category === option.value && styles.optionButtonSelected,
                        category === option.value && { borderColor: palette.navy600 }
                      ]}
                      onPress={() => setCategory(option.value)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.optionLabel}>{option.label}</Text>
                      <Text style={styles.optionDescription}>{option.description}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Please describe what happened*</Text>
                <TextInput
                  style={styles.textArea}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Please provide specific details about what happened..."
                  placeholderTextColor={palette.ink500}
                  multiline
                  numberOfLines={6}
                  maxLength={500}
                  editable={!isLoading}
                  textAlignVertical="top"
                />
                
                <Text style={styles.charCount}>{description.length}/500</Text>

                <View style={styles.privacyNotice}>
                  <Text style={styles.privacyTitle}>🔒 Private Reporting</Text>
                  <Text style={styles.privacyText}>
                    • Only moderators can see this report{'\n'}
                    • {reportedUserName} will not know you reported them{'\n'}
                    • We may follow up if we need more details
                  </Text>
                </View>
              </>
            )}

            <View style={styles.actions}>
              {step === 2 && (
                <Button
                  title="Back"
                  onPress={() => setStep(1)}
                  tone="secondary"
                  disabled={isLoading}
                />
              )}
              
              {step === 1 ? (
                <Button
                  title="Continue"
                  onPress={() => setStep(2)}
                  tone="primary"
                  disabled={!canProceed}
                />
              ) : (
                <Button
                  title={isLoading ? 'Submitting...' : 'Submit Report'}
                  onPress={handleSubmit}
                  tone="primary"
                  disabled={!canProceed || isLoading}
                />
              )}
              
              <Button
                title="Cancel"
                onPress={handleClose}
                tone="ghost"
                disabled={isLoading}
              />
            </View>

            {isLoading && (
              <ActivityIndicator 
                style={styles.loader} 
                color={palette.navy600}
                size="small"
              />
            )}
          </ScrollView>
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
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.overlay,
  },
  card: {
    maxHeight: '90%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: spacing.lg,
    marginHorizontal: 0,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emoji: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.ink900,
  },
  subtitle: {
    fontSize: 14,
    color: palette.ink600,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink800,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  optionsContainer: {
    gap: spacing.xs,
  },
  optionButton: {
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: palette.sky300,
    borderRadius: radius.md,
    backgroundColor: palette.sky100,
  },
  optionButtonSelected: {
    backgroundColor: palette.white,
    borderWidth: 2,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: palette.ink600,
  },
  textArea: {
    borderWidth: 1,
    borderColor: palette.sky300,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 14,
    color: palette.ink900,
    backgroundColor: palette.sky100,
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    color: palette.ink500,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  privacyNotice: {
    backgroundColor: '#e0f2fe',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  privacyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369a1',
    marginBottom: spacing.xs,
  },
  privacyText: {
    fontSize: 12,
    color: '#0369a1',
    lineHeight: 18,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  loader: {
    marginTop: spacing.md,
  },
});
