import { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Audio } from 'expo-av';
import { Card } from '../Card';
import { VideoPlayer } from '../VideoPlayer';
import { invokeFunction } from '../../lib/api';
import { palette, font, spacing, radius } from '../../theme/design';

interface EngagementRequest {
  id: string;
  question_text: string;
  engagement_mode: string;
  moderation_status: string;
  public_opt_in: boolean;
  completed_at: string | null;
  coach_id: string | null;
}

interface EngagementResponse {
  response_text: string | null;
  audio_url: string | null;
  video_url: string | null;
  transcript: string | null;
  submitted_at: string;
}

export interface EngagementCardProps {
  id: string;
  score: number;
  published_at: string;
  metadata?: Record<string, unknown>;
  engagement_requests: {
    id: string;
    question_text: string;
    engagement_mode: string;
    moderation_status: string;
    public_opt_in: boolean;
    completed_at: string | null;
    coach_id: string | null;
    engagement_responses: EngagementResponse[];
  } | null;
  onLike?: (id: string) => void;
  onShare?: (id: string) => void;
  onRespond?: (id: string) => void;
  isLiked?: boolean;
  likesCount?: number;
}

export function EngagementCard({
  id,
  score,
  published_at,
  engagement_requests,
  onLike,
  onShare,
  onRespond,
  isLiked = false,
  likesCount = 0
}: EngagementCardProps) {
  const [liked, setLiked] = useState(isLiked);
  const [likes, setLikes] = useState(likesCount);
  const [isLiking, setIsLiking] = useState(false);
  
  // Audio playback state
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPosition, setAudioPosition] = useState(0);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  if (!engagement_requests) return null;

  const {
    question_text,
    engagement_mode,
    engagement_responses,
    moderation_status,
    public_opt_in
  } = engagement_requests;

  // Only show if public or moderated
  if (moderation_status !== 'approved' && !public_opt_in) return null;

  const hasResponse = engagement_responses && engagement_responses.length > 0;
  const firstResponse = hasResponse ? engagement_responses[0] : null;
  const hasVideo = firstResponse?.video_url;
  const hasAudio = firstResponse?.audio_url;
  const hasText = firstResponse?.response_text;
  const hasTranscript = firstResponse?.transcript;

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getModeLabel = (mode: string): string => {
    const labels: Record<string, string> = {
      'text_answer': 'Text Response',
      'video_answer': 'Video Response',
      'audio_answer': 'Audio Response',
      'text_chat': 'Chat Session',
      'video_call': 'Video Call'
    };
    return labels[mode] || mode.replace('_', ' ');
  };

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);

    // Optimistic update
    const newLiked = !liked;
    const newLikes = newLiked ? likes + 1 : likes - 1;
    setLiked(newLiked);
    setLikes(newLikes);

    try {
      await invokeFunction('engagement-like', {
        method: 'POST',
        body: { engagementRequestId: engagement_requests.id, action: newLiked ? 'like' : 'unlike' }
      });
      onLike?.(id);
    } catch (error) {
      // Rollback on error
      setLiked(!newLiked);
      setLikes(likes);
      Alert.alert('Error', 'Failed to update like status');
    } finally {
      setIsLiking(false);
    }
  };

  // Audio playback functions
  const loadAudio = useCallback(async (audioUrl: string) => {
    try {
      setIsAudioLoading(true);
      setAudioError(null);
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      
      setSound(newSound);
      const status = await newSound.getStatusAsync();
      if (status.isLoaded) {
        setAudioDuration(status.durationMillis || 0);
      }
    } catch (err) {
      setAudioError('Failed to load audio');
      console.error('Audio load error:', err);
    } finally {
      setIsAudioLoading(false);
    }
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: Audio.PlaybackStatus) => {
    if (status.isLoaded) {
      setAudioPosition(status.positionMillis);
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setAudioPosition(0);
      }
    }
  }, []);

  const toggleAudioPlayback = async () => {
    if (!sound) return;
    
    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (err) {
      setAudioError('Playback error');
      console.error('Audio playback error:', err);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Load audio when component mounts and audio URL is available
  useEffect(() => {
    if (hasAudio && firstResponse?.audio_url && !sound) {
      loadAudio(firstResponse.audio_url);
    }
    
    return () => {
      // Cleanup audio on unmount
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [hasAudio, firstResponse?.audio_url, loadAudio, sound]);

  const handleShare = () => {
    // Implement share functionality
    if (onShare) {
      onShare(id);
    } else {
      // Default share behavior
      Alert.alert('Share', 'Share functionality coming soon!');
    }
  };

  const handleRespond = () => {
    onRespond?.(engagement_requests.id);
  };

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.modeBadge}>{getModeLabel(engagement_mode)}</Text>
        </View>
        <Text style={styles.date}>{formatDate(published_at)}</Text>
      </View>

      <Text style={styles.question}>{question_text}</Text>

      {/* Response Content */}
      {hasVideo && firstResponse?.video_url && (
        <View style={styles.mediaContainer}>
          <VideoPlayer
            videoUrl={firstResponse.video_url}
            showControls={true}
            style={styles.videoPlayer}
          />
        </View>
      )}

      {hasAudio && firstResponse?.audio_url && !hasVideo && (
        <View style={styles.audioContainer}>
          <Text style={styles.audioLabel}>🎧 Audio Response</Text>
          
          {audioError ? (
            <View style={styles.audioErrorContainer}>
              <Text style={styles.audioErrorText}>⚠️ {audioError}</Text>
            </View>
          ) : (
            <View style={styles.audioPlayer}>
              <TouchableOpacity
                style={styles.playButton}
                onPress={toggleAudioPlayback}
                disabled={isAudioLoading || !sound}
              >
                {isAudioLoading ? (
                  <ActivityIndicator size="small" color={palette.navy600} />
                ) : (
                  <Text style={styles.playButtonIcon}>
                    {isPlaying ? '⏸️' : '▶️'}
                  </Text>
                )}
              </TouchableOpacity>
              
              <View style={styles.audioProgress}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill,
                      { 
                        width: audioDuration > 0 
                          ? `${(audioPosition / audioDuration) * 100}%` 
                          : '0%' 
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.durationText}>
                  {formatDuration(audioPosition)} / {formatDuration(audioDuration)}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {(hasText || hasTranscript) && (
        <View style={styles.responseContainer}>
          <Text style={styles.responseLabel}>Response:</Text>
          <Text style={styles.responseText}>
            {firstResponse?.response_text || firstResponse?.transcript}
          </Text>
        </View>
      )}

      {/* Interaction Bar */}
      <View style={styles.interactionBar}>
        <TouchableOpacity
          style={[styles.interactionButton, liked && styles.interactionButtonActive]}
          onPress={handleLike}
          disabled={isLiking}
        >
          {isLiking ? (
            <ActivityIndicator size="small" color={liked ? palette.red500 : palette.ink700} />
          ) : (
            <>
              <Text style={[styles.interactionIcon, liked && styles.interactionIconActive]}>
                {liked ? '❤️' : '🤍'}
              </Text>
              <Text style={[styles.interactionText, liked && styles.interactionTextActive]}>
                {likes > 0 ? likes : 'Like'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.interactionButton} onPress={handleRespond}>
          <Text style={styles.interactionIcon}>💬</Text>
          <Text style={styles.interactionText}>Respond</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.interactionButton} onPress={handleShare}>
          <Text style={styles.interactionIcon}>↗️</Text>
          <Text style={styles.interactionText}>Share</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  modeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.navy600,
    backgroundColor: palette.sky100,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  date: {
    fontSize: 12,
    color: palette.ink500,
    fontFamily: font.body
  },
  question: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
    lineHeight: 22,
    marginBottom: spacing.md
  },
  mediaContainer: {
    marginBottom: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden'
  },
  videoPlayer: {
    borderRadius: radius.md
  },
  audioContainer: {
    backgroundColor: palette.sky100,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  audioLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink700,
    marginBottom: spacing.sm
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.navy600,
    justifyContent: 'center',
    alignItems: 'center'
  },
  playButtonIcon: {
    fontSize: 20
  },
  audioProgress: {
    flex: 1,
    marginLeft: spacing.sm
  },
  progressBar: {
    height: 4,
    backgroundColor: palette.sky200,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.xs
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.navy600,
    borderRadius: 2
  },
  durationText: {
    fontSize: 11,
    color: palette.ink500,
    fontFamily: font.body
  },
  audioErrorContainer: {
    padding: spacing.sm,
    backgroundColor: palette.sky200,
    borderRadius: radius.sm
  },
  audioErrorText: {
    fontSize: 12,
    color: palette.red500,
    textAlign: 'center'
  },
  responseContainer: {
    backgroundColor: palette.sky100,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.ink700,
    marginBottom: spacing.xs
  },
  responseText: {
    fontSize: 14,
    color: palette.ink700,
    lineHeight: 20
  },
  interactionBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
    paddingTop: spacing.sm,
    marginTop: spacing.xs
  },
  interactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm
  },
  interactionButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: radius.sm
  },
  interactionIcon: {
    fontSize: 18,
    marginRight: 4
  },
  interactionIconActive: {
    color: palette.red500
  },
  interactionText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink700
  },
  interactionTextActive: {
    color: palette.red500
  }
});
