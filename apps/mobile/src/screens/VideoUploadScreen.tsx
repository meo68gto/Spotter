import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useVideoUpload, UploadStatus } from '../hooks/useVideoUpload';
import { palette, spacing, radius, font } from '../theme/design';
import { VideoPlayer } from '../components/VideoPlayer';

interface VideoUploadScreenProps {
  session: Session;
  activityId?: string;
  sessionId?: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

const STATUS_MESSAGES: Record<UploadStatus, string> = {
  idle: 'Select a video to upload',
  picking: 'Opening camera roll...',
  compressing: 'Optimizing video...',
  presigning: 'Preparing upload...',
  uploading: 'Uploading video...',
  processing: 'Starting analysis...',
  completed: 'Upload complete!',
  failed: 'Upload failed'
};

const STATUS_COLORS: Record<UploadStatus, string> = {
  idle: palette.ink700,
  picking: palette.navy600,
  compressing: palette.navy600,
  presigning: palette.navy600,
  uploading: palette.navy600,
  processing: palette.mint500,
  completed: palette.green500,
  failed: palette.red500
};

export function VideoUploadScreen({
  session,
  activityId = 'default-activity',
  sessionId,
  onComplete,
  onCancel
}: VideoUploadScreenProps) {
  const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize?: number;
    compressedSize?: number;
    compressed: boolean;
  } | null>(null);

  const {
    status,
    progress,
    error,
    videoSubmissionId,
    pickVideo,
    recordVideo,
    uploadVideo,
    reset
  } = useVideoUpload();

  const isUploading = ['compressing', 'presigning', 'uploading', 'processing'].includes(status);
  const isComplete = status === 'completed';
  const hasFailed = status === 'failed';

  const handlePickVideo = useCallback(async () => {
    const uri = await pickVideo();
    if (uri) {
      setSelectedVideoUri(uri);
      setCompressionInfo(null);
    }
  }, [pickVideo]);

  const handleRecordVideo = useCallback(async () => {
    const uri = await recordVideo();
    if (uri) {
      setSelectedVideoUri(uri);
      setCompressionInfo(null);
    }
  }, [recordVideo]);

  const handleUpload = useCallback(async () => {
    if (!selectedVideoUri) return;

    const success = await uploadVideo(selectedVideoUri, activityId, sessionId);
    
    if (success) {
      Alert.alert(
        'Upload Complete',
        'Your video has been uploaded and is being analyzed. You\'ll be notified when the analysis is ready.',
        [
          {
            text: 'OK',
            onPress: () => onComplete?.()
          }
        ]
      );
    }
  }, [selectedVideoUri, activityId, sessionId, uploadVideo, onComplete]);

  const handleRetry = useCallback(() => {
    reset();
    setSelectedVideoUri(null);
    setCompressionInfo(null);
  }, [reset]);

  const handleCancel = useCallback(() => {
    if (isUploading) {
      Alert.alert(
        'Cancel Upload?',
        'Your upload will be cancelled.',
        [
          { text: 'Continue Upload', style: 'cancel' },
          { 
            text: 'Cancel',
            style: 'destructive',
            onPress: () => {
              reset();
              onCancel?.();
            }
          }
        ]
      );
    } else {
      onCancel?.();
    }
  }, [isUploading, reset, onCancel]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Upload Video</Text>
        <Text style={styles.subtitle}>
          Share your swing for AI analysis or coaching feedback
        </Text>
      </View>

      {/* Video Preview */}
      {selectedVideoUri ? (
        <Card style={styles.previewCard}>
          <View style={styles.videoContainer}>
            <VideoPlayer
              uri={selectedVideoUri}
              style={styles.videoPlayer}
              showControls={!isUploading}
              onError={(err) => Alert.alert('Video Error', err)}
            />
          </View>

          {compressionInfo && compressionInfo.compressed && (
            <View style={styles.compressionInfo}>
              <Text style={styles.compressionText}>
                Compressed: {formatFileSize(compressionInfo.originalSize || 0)} → {formatFileSize(compressionInfo.compressedSize || 0)}
              </Text>
            </View>
          )}
        </Card>
      ) : (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎥</Text>
            <Text style={styles.emptyTitle}>No video selected</Text>
            <Text style={styles.emptySubtitle}>
              Choose a video from your library or record a new one
            </Text>
          </View>
        </Card>
      )}

      {/* Status Display */}
      <View style={styles.statusContainer}>
        <Text style={[styles.statusText, { color: STATUS_COLORS[status] }]}>
          {STATUS_MESSAGES[status]}
        </Text>
        
        {isUploading && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress * 100}%` }
                ]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
          </View>
        )}

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {!selectedVideoUri ? (
          <>
            <Button
              title="Choose from Library"
              onPress={handlePickVideo}
              variant="primary"
              style={styles.actionButton}
            />
            <Button
              title="Record Video"
              onPress={handleRecordVideo}
              variant="secondary"
              style={styles.actionButton}
            />
          </>
        ) : (
          <>
            {!isComplete && !hasFailed && (
              <Button
                title={isUploading ? 'Uploading...' : 'Upload Video'}
                onPress={handleUpload}
                disabled={isUploading}
                variant="primary"
                style={styles.actionButton}
              />
            )}
            
            {hasFailed && (
              <Button
                title="Try Again"
                onPress={handleRetry}
                variant="primary"
                style={styles.actionButton}
              />
            )}
            
            <Button
              title="Select Different Video"
              onPress={handleRetry}
              variant="secondary"
              disabled={isUploading}
              style={styles.actionButton}
            />
          </>
        )}

        <Button
          title="Cancel"
          onPress={handleCancel}
          variant="ghost"
          disabled={isUploading && status !== 'failed'}
          style={styles.cancelButton}
        />
      </View>

      {/* Tips */}
      <Card style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>💡 Tips for best results:</Text>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>Film from a stable position</Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>Ensure good lighting</Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>Capture your full swing motion</Text>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipBullet}>•</Text>
          <Text style={styles.tipText}>Max file size: 500MB</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.sky100
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2
  },
  header: {
    marginBottom: spacing.lg
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.sm,
    fontFamily: font.display
  },
  subtitle: {
    fontSize: 16,
    color: palette.ink700,
    fontFamily: font.body
  },
  previewCard: {
    marginBottom: spacing.lg,
    padding: 0,
    overflow: 'hidden'
  },
  videoContainer: {
    aspectRatio: 16 / 9,
    backgroundColor: palette.ink900
  },
  videoPlayer: {
    flex: 1
  },
  compressionInfo: {
    padding: spacing.md,
    backgroundColor: palette.sky100,
    borderTopWidth: 1,
    borderTopColor: palette.sky200
  },
  compressionText: {
    fontSize: 12,
    color: palette.ink700,
    textAlign: 'center'
  },
  emptyCard: {
    marginBottom: spacing.lg,
    padding: spacing.xl
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.ink900,
    marginBottom: spacing.sm
  },
  emptySubtitle: {
    fontSize: 14,
    color: palette.ink700,
    textAlign: 'center'
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.md
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center'
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: palette.sky200,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.navy600,
    borderRadius: 4
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink700
  },
  errorText: {
    fontSize: 14,
    color: palette.red500,
    textAlign: 'center',
    marginTop: spacing.sm
  },
  actions: {
    marginBottom: spacing.lg
  },
  actionButton: {
    marginBottom: spacing.md
  },
  cancelButton: {
    marginTop: spacing.sm
  },
  tipsCard: {
    padding: spacing.lg
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.ink900,
    marginBottom: spacing.md
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm
  },
  tipBullet: {
    fontSize: 14,
    color: palette.navy600,
    marginRight: spacing.sm,
    marginTop: 2
  },
  tipText: {
    fontSize: 14,
    color: palette.ink700,
    flex: 1
  }
});
