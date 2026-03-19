// Epic 6: Profile Trust Section
// Combines TrustSummary with vouch and report actions

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { TrustSummary } from './TrustSummary';
import { VouchPrompt } from './VouchPrompt';
import { IncidentReportModal } from './IncidentReportModal';
import { useTrust, useVouch, useReportIncident } from '../hooks/useTrust';
import { TrustBadge } from '@spotter/types';
import { palette, radius, spacing } from '../theme/design';

// ============================================================================
// Types
// ============================================================================

interface ProfileTrustSectionProps {
  userId: string;
  displayName: string;
  isOwnProfile?: boolean;
  showReportButton?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ProfileTrustSection({
  userId,
  displayName,
  isOwnProfile = false,
  showReportButton = true,
}: ProfileTrustSectionProps) {
  const [showVouchModal, setShowVouchModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Fetch trust data
  const {
    reliability,
    badges,
    vouchesReceived,
    canVouch,
    sharedRoundsCount,
    isLoading,
    refetch,
  } = useTrust({ userId, enabled: !!userId });

  // Vouch mutation
  const { vouch, isLoading: isVouching } = useVouch();

  // Report mutation
  const { report, isLoading: isReporting } = useReportIncident();

  // Transform reliability data for TrustSummary
  const trustData = reliability ? {
    reliabilityScore: reliability.reliabilityScore,
    reliabilityLabel: reliability.reliabilityLabel,
    showRate: reliability.showRate,
    punctualityRate: reliability.punctualityRate,
    roundsCompleted: reliability.roundsCompleted,
    roundsScheduled: reliability.roundsScheduled,
    vouchesReceived,
    badges,
  } : null;

  // Handle vouch submission
  const handleVouch = async (notes?: string) => {
    try {
      await vouch(userId, notes);
      await refetch();
      setShowVouchModal(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  // Handle report submission
  const handleReport = async (data: {
    severity: 'minor' | 'moderate' | 'serious';
    category: 'no_show' | 'late' | 'behavior' | 'safety' | 'other';
    description: string;
    roundId?: string;
  }) => {
    try {
      await report({
        reportedUserId: userId,
        severity: data.severity,
        category: data.category,
        description: data.description,
        roundId: data.roundId,
      });
      await refetch();
      setShowReportModal(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  // Confirm report action
  const handleReportPress = () => {
    Alert.alert(
      'Report Member',
      `You are about to submit a private report about ${displayName}. This will only be visible to moderators.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => setShowReportModal(true) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Trust Summary */}
      <TrustSummary
        data={trustData}
        loading={isLoading}
        size="full"
        showVouchButton={!isOwnProfile}
        onVouchPress={() => setShowVouchModal(true)}
        canVouch={canVouch}
        sharedRoundsCount={sharedRoundsCount}
      />

      {/* Report Button - only show for other users */}
      {!isOwnProfile && showReportButton && (
        <TouchableOpacity
          style={styles.reportButton}
          onPress={handleReportPress}
        >
          <Text style={styles.reportIcon}>📝</Text>
          <Text style={styles.reportText}>Report Issue</Text>
          <Text style={styles.reportSubtext}>Private • Only moderators see this</Text>
        </TouchableOpacity>
      )}

      {/* Vouch Modal */}
      <VouchPrompt
        visible={showVouchModal}
        onClose={() => setShowVouchModal(false)}
        onVouch={handleVouch}
        vouchedUserName={displayName}
        sharedRoundsCount={sharedRoundsCount}
        canVouch={canVouch}
      />

      {/* Report Modal */}
      <IncidentReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        reportedUserName={displayName}
      />
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  reportIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  reportText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink700,
  },
  reportSubtext: {
    fontSize: 12,
    color: palette.ink500,
  },
});
