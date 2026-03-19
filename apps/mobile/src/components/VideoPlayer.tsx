import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { invokeFunction } from '../../lib/api';
import { palette, font, spacing, radius } from '../../theme/design';

interface VideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string;
  autoPlay?: boolean;
  showControls?: boolean;
  onPlaybackStatusUpdate?: (status: { isPlaying: boolean; durationMillis: number; positionMillis: number }) => void;
  onError?: (error: Error) => void;
  onLoad?: () => void;
  style?: object;
  fullscreen?: boolean;
  onFullscreenToggle?: (isFullscreen: boolean) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function VideoPlayer({
  videoUrl,
  thumbnailUrl,
  autoPlay = false,
  showControls = true,
  onPlaybackStatusUpdate,
  onError,
  onLoad,
  style,
  fullscreen: initialFullscreen = false,
  onFullscreenToggle
}: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(initialFullscreen);
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Check if videoUrl needs presigning (Supabase storage URLs)
  const needsPresigning = videoUrl.includes('supabase.co') || videoUrl.includes('supabase.in');

  useEffect(() => {
    if (needsPresigning) {
      fetchPresignedUrl();
    } else {
      setPresignedUrl(videoUrl);
      setIsLoading(false);
    }
  }, [videoUrl, needsPresigning]);

  const fetchPresignedUrl = async () => {
    try {
      // Extract path from storage URL if it's a Supabase URL
      const urlPath = extractStoragePath(videoUrl);
      if (!urlPath) {
        // If we can't extract the path, try using the URL directly
        setPresignedUrl(videoUrl);
        setIsLoading(false);
        return;
      }

      // Get presigned URL from the video presign endpoint
      const result = await invokeFunction<{ presignedUrl: string; expiresAt: string }>('videos-presign', {
        method: 'POST',
        body: { videoPath: urlPath }
      });

      if (result.presignedUrl) {
        setPresignedUrl(result.presignedUrl);
      } else {
        // Fallback to original URL
        setPresignedUrl(videoUrl);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to get presigned URL:', error);
      // Fallback to original URL
      setPresignedUrl(videoUrl);
      setIsLoading(false);
    }
  };

  const extractStoragePath = (url: string): string | null => {
    try {
      // Handle different Supabase storage URL formats
      // Format 1: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
      // Format 2: https://{project}.supabase.co/storage/v1/object/sign/{bucket}/{path}?token=...
      const publicMatch = url.match(/\/object\/public\/[^/]+\/(.+)$/);
      if (publicMatch) return publicMatch[1];

      const signMatch = url.match(/\/object\/sign\/[^/]+\/([^?]+)/);
      if (signMatch) return signMatch[1];

      return null;
    } catch {
      return null;
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = (error: Error) => {
    setIsLoading(false);
    setHasError(true);
    onError?.(error);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
    onPlaybackStatusUpdate?.({
      isPlaying: !isPlaying,
      durationMillis: 0,
      positionMillis: 0
    });
  };

  const toggleFullscreen = () => {
    const newFullscreen = !isFullscreen;
    setIsFullscreen(newFullscreen);
    onFullscreenToggle?.(newFullscreen);
  };

  const handleOpenVideo = () => {
    if (presignedUrl) {
      // Open video in external player
      Alert.alert(
        'Video Playback',
        'Open video in external player?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open', 
            onPress: () => {
              // In a real implementation, you'd use Linking.openURL
              // For now, just toggle play state
              togglePlayPause();
            }
          }
        ]
      );
    }
  };

  if (hasError) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <Text style={styles.errorText}>Failed to load video</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchPresignedUrl}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <ActivityIndicator color={palette.navy600} />
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      isFullscreen && styles.fullscreenContainer,
      style
    ]}>
      {/* Video Thumbnail / Placeholder */}
      <TouchableOpacity 
        style={styles.videoPlaceholder}
        onPress={handleOpenVideo}
        activeOpacity={0.8}
      >
        <View style={styles.playButton}>
          <Text style={styles.playButtonText}>{isPlaying ? '⏸' : '▶'}</Text>
        </View>
        
        <Text style={styles.videoLabel}>Tap to play video</Text>
      </TouchableOpacity>

      {/* Controls */}
      {showControls && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton} onPress={togglePlayPause}>
            <Text style={styles.controlText}>{isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: isPlaying ? '60%' : '0%' }]} />
            </View>
            <Text style={styles.timeText}>{isPlaying ? '0:30 / 1:00' : '0:00 / --:--'}</Text>
          </View>

          <TouchableOpacity style={styles.controlButton} onPress={toggleFullscreen}>
            <Text style={styles.controlText}>{isFullscreen ? '⤓' : '⤢'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.ink900,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
    aspectRatio: 16 / 9,
    width: '100%'
  },
  fullscreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    aspectRatio: undefined,
    borderRadius: 0
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.ink900
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  playButtonText: {
    fontSize: 28,
    color: palette.navy600
  },
  videoLabel: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)'
  },
  controlButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  controlText: {
    color: palette.white,
    fontSize: 20
  },
  progressContainer: {
    flex: 1,
    marginHorizontal: spacing.sm
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginBottom: 4
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.mint500,
    borderRadius: 2
  },
  timeText: {
    color: palette.white,
    fontSize: 11,
    fontFamily: font.body
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.sky100,
    borderWidth: 1,
    borderColor: palette.red500
  },
  errorText: {
    color: palette.red500,
    fontWeight: '600',
    marginBottom: spacing.sm
  },
  retryButton: {
    backgroundColor: palette.navy600,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm
  },
  retryText: {
    color: palette.white,
    fontWeight: '600'
  }
});
