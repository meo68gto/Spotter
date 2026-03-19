// Epic 5: Post-Round Rating Modal
// Modal for submitting player ratings after a round

import { useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from './Button';
import { palette, radius, spacing } from '../theme/design';
import { RoundParticipantWithUser, RoundRatingInput } from '@spotter/types';

interface PostRoundRatingModalProps {
  visible: boolean;
  onClose: () => void;
  roundId: string;
  participants: RoundParticipantWithUser[];
  currentUserId: string;
  onSubmit: (ratings: RoundRatingInput[]) => Promise<void>;
}

const RATING_LABELS: Record<string, string> = {
  punctuality: 'Punctuality',
  golfEtiquette: 'Etiquette',
  enjoyment: 'Enjoyment',
  businessValue: 'Business Value',
};

const RATING_DESCRIPTIONS: Record<string, string> = {
  punctuality: 'Was on time, ready to play',
  golfEtiquette: 'Pace of play, course care',
  enjoyment: 'Fun to play with',
  businessValue: 'Valuable connection',
};

export function PostRoundRatingModal({
  visible,
  onClose,
  roundId,
  participants,
  currentUserId,
  onSubmit,
}: PostRoundRatingModalProps) {
  const [ratings, setRatings] = useState<Record<string, RoundRatingInput>>({});
  const [submitting, setSubmitting] = useState(false);

  // Filter out current user from participants to rate
  const playersToRate = participants.filter(p => p.userId !== currentUserId);

  const updateRating = (userId: string, field: keyof RoundRatingInput, value: any) => {
    setRatings(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        rateeId: userId,
        [field]: value,
      } as RoundRatingInput,
    }));
  };

  const getRating = (userId: string, field: keyof RoundRatingInput): any => {
    return ratings[userId]?.[field];
  };

  const isRatingComplete = (userId: string): boolean => {
    const r = ratings[userId];
    return !!(
      r?.punctuality &&
      r?.golfEtiquette &&
      r?.enjoyment &&
      r?.playAgain !== undefined
    );
  };

  const allRatingsComplete = (): boolean => {
    return playersToRate.every(p => isRatingComplete(p.userId));
  };

  const handleSubmit = async () => {
    if (!allRatingsComplete()) return;

    setSubmitting(true);
    try {
      const ratingsArray = Object.values(ratings).filter(r => r.rateeId);
      await onSubmit(ratingsArray);
      setRatings({});
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    setRatings({});
    onClose();
  };

  const StarRating = ({
    userId,
    field,
    value,
  }: {
    userId: string;
    field: keyof RoundRatingInput;
    value?: number;
  }) => (
    <View style={styles.starContainer}>
      {[1, 2, 3, 4, 5].map(star => (
        <TouchableOpacity
          key={star}
          onPress={() => updateRating(userId, field, star)}
          style={styles.starButton}
        >
          <Text
            style={[
              styles.star,
              value && star <= value ? styles.starFilled : styles.starEmpty,
            ]}
          >
            ★
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Rate Your Round</Text>
            <Text style={styles.subtitle}>
              Help build trust in the community
            </Text>
          </View>

          <ScrollView style={styles.content}>
            {playersToRate.map(participant => (
              <View key={participant.userId} style={styles.playerSection}>
                <View style={styles.playerHeader}>
                  <View style={styles.avatar}>
                    {participant.user.avatarUrl ? (
                      <Image
                        source={{ uri: participant.user.avatarUrl }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <Text style={styles.avatarInitial}>
                        {participant.user.displayName.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View>
                    <Text style={styles.playerName}>
                      {participant.user.displayName}
                    </Text>
                    <Text style={styles.playerHandicap}>
                      {participant.user.currentHandicap
                        ? `Handicap: ${participant.user.currentHandicap}`
                        : 'Handicap: N/A'}
                    </Text>
                  </View>
                  {isRatingComplete(participant.userId) && (
                    <View style={styles.completeBadge}>
                      <Text style={styles.completeBadgeText}>✓</Text>
                    </View>
                  )}
                </View>

                <View style={styles.ratingsGrid}>
                  {(['punctuality', 'golfEtiquette', 'enjoyment'] as const).map(
                    field => (
                      <View key={field} style={styles.ratingRow}>
                        <View style={styles.ratingLabel}>
                          <Text style={styles.ratingTitle}>
                            {RATING_LABELS[field]}
                          </Text>
                          <Text style={styles.ratingDescription}>
                            {RATING_DESCRIPTIONS[field]}
                          </Text>
                        </View>
                        <StarRating
                          userId={participant.userId}
                          field={field}
                          value={getRating(participant.userId, field)}
                        />
                      </View>
                    )
                  )}
                </View>

                <View style={styles.binarySection}>
                  <Text style={styles.binaryTitle}>Would you play again?</Text>
                  <View style={styles.binaryButtons}>
                    <TouchableOpacity
                      style={[
                        styles.binaryButton,
                        getRating(participant.userId, 'playAgain') === true &&
                          styles.binaryButtonActive,
                      ]}
                      onPress={() =>
                        updateRating(participant.userId, 'playAgain', true)
                      }
                    >
                      <Text
                        style={[
                          styles.binaryButtonText,
                          getRating(participant.userId, 'playAgain') === true &&
                            styles.binaryButtonTextActive,
                        ]}
                      >
                        👍 Yes
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.binaryButton,
                        getRating(participant.userId, 'playAgain') === false &&
                          styles.binaryButtonInactive,
                      ]}
                      onPress={() =>
                        updateRating(participant.userId, 'playAgain', false)
                      }
                    >
                      <Text
                        style={[
                          styles.binaryButtonText,
                          getRating(participant.userId, 'playAgain') === false &&
                            styles.binaryButtonTextInactive,
                        ]}
                      >
                        👎 No
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.notesSection}>
                  <Text style={styles.notesLabel}>
                    Public compliment (optional)
                  </Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Say something nice..."
                    value={getRating(participant.userId, 'publicCompliment') || ''}
                    onChangeText={text =>
                      updateRating(participant.userId, 'publicCompliment', text)
                    }
                    maxLength={280}
                    multiline
                  />
                  <Text style={styles.charCount}>
                    {(getRating(participant.userId, 'publicCompliment') || '').length}/280
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title={submitting ? 'Submitting...' : 'Submit Ratings'}
              onPress={handleSubmit}
              disabled={!allRatingsComplete() || submitting}
            />
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
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
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: palette.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '90%',
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.ink900,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: palette.ink500,
    textAlign: 'center',
    marginTop: 4,
  },
  content: {
    padding: spacing.md,
  },
  playerSection: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarInitial: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.ink900,
  },
  playerHandicap: {
    fontSize: 12,
    color: palette.ink500,
  },
  completeBadge: {
    marginLeft: 'auto',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBadgeText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '700',
  },
  ratingsGrid: {
    gap: spacing.md,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingLabel: {
    flex: 1,
  },
  ratingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  ratingDescription: {
    fontSize: 12,
    color: palette.ink500,
  },
  starContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 24,
  },
  starFilled: {
    color: '#FBBF24',
  },
  starEmpty: {
    color: palette.sky300,
  },
  binarySection: {
    marginTop: spacing.lg,
  },
  binaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
    marginBottom: spacing.sm,
  },
  binaryButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  binaryButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: palette.sky100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  binaryButtonActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  binaryButtonInactive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  binaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink700,
  },
  binaryButtonTextActive: {
    color: '#1E40AF',
  },
  binaryButtonTextInactive: {
    color: '#991B1B',
  },
  notesSection: {
    marginTop: spacing.lg,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
    marginBottom: spacing.sm,
  },
  notesInput: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 14,
    color: palette.ink900,
    borderWidth: 1,
    borderColor: palette.sky200,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: palette.ink400,
    textAlign: 'right',
    marginTop: 4,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
    gap: spacing.sm,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 14,
    color: palette.ink500,
  },
});
