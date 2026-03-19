import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { VideoPlayer } from '../components/VideoPlayer';
import { VideoSubmission } from '../hooks/useVideoGallery';
import { useVideoAnalysis } from '../hooks/useVideoAnalysis';
import { palette, spacing, radius, font } from '../theme/design';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VideoAnalysisScreenProps {
  session: Session;
  video: VideoSubmission;
  onBack?: () => void;
  onShare?: () => void;
}

export function VideoAnalysisScreen({
  session,
  video,
  onBack,
  onShare
}: VideoAnalysisScreenProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(true);

  const {
    analysis,
    currentFrame,
    isPlaying,
    selectedMetric,
    setCurrentFrame,
    setIsPlaying,
    togglePlay,
    selectMetric,
    getMetricValue,
    getAnnotationsAtTime,
    getMetricColor,
    getMetricGrade
  } = useVideoAnalysis(video);

  // Get signed URL for video
  React.useEffect(() => {
    const getUrl = async () => {
      try {
        // Use existing supabase client from lib/supabase
        const { supabase } = await import('../lib/supabase');
        
        const { data: urlData } = await supabase
          .storage
          .from('videos-raw')
          .createSignedUrl(video.storage_path, 3600);
        
        if (urlData?.signedUrl) {
          setVideoUrl(urlData.signedUrl);
        }
      } catch (err) {
        console.error('Failed to get video URL:', err);
      } finally {
        setUrlLoading(false);
      }
    };

    getUrl();
  }, [video.storage_path]);

  const handleProgress = useCallback((progress: { currentTime: number; duration: number }) => {
    setCurrentFrame(Math.floor(progress.currentTime * 1000));
  }, [setCurrentFrame]);

  const currentAnnotations = getAnnotationsAtTime(currentFrame);

  const renderMetricCard = (metric: { key: string; label: string; value: number; unit?: string }) => {
    const isSelected = selectedMetric === metric.key;
    const color = getMetricColor(metric.value, metric.key);
    const grade = getMetricGrade(metric.value);

    return (
      <TouchableOpacity
        key={metric.key}
        style={[
          styles.metricCard,
          isSelected && styles.metricCardSelected
        ]}
        onPress={() => selectMetric(isSelected ? null : metric.key)}
        activeOpacity={0.8}
      >
        <View style={styles.metricHeader}>
          <Text style={styles.metricLabel}>{metric.label}</Text>
          <View style={[styles.gradeBadge, { backgroundColor: color }]} >
            <Text style={styles.gradeText}>{grade}</Text>
          </View>
        </View>
        
        <View style={styles.metricValueContainer}>
          <Text style={[styles.metricValue, { color }]} >
            {metric.value}
            {metric.unit && <Text style={styles.metricUnit}>{metric.unit}</Text>}
          </Text>
        </View>

        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${metric.value}%`, backgroundColor: color }
              ]}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const formatTimestamp = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backArrow}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Swing Analysis</Text>
        <Text style={styles.subtitle}>
          {video.activity?.name || 'Golf'} • {new Date(video.created_at).toLocaleDateString()}
        </Text>
      </View>

      {/* Video Player */}
      <Card style={styles.videoCard}>
        {urlLoading ? (
          <View style={styles.videoLoading}>
            <ActivityIndicator size="large" color={palette.navy600} />
          </View>
        ) : videoUrl ? (
          <VideoPlayer
            uri={videoUrl}
            style={styles.videoPlayer}
            onProgress={handleProgress}
            showControls={true}
          />
        ) : (
          <View style={styles.videoError}>
            <Text style={styles.videoErrorText}>Failed to load video</Text>
          </View>
        )}
      </Card>

      {/* Current Annotations */}
      {currentAnnotations.length > 0 && (
        <Card style={styles.annotationsCard}>
          <Text style={styles.annotationsTitle}>💡 At {formatTimestamp(currentFrame)}:</Text>
          {currentAnnotations.map((annotation, index) => (
            <View key={index} style={styles.annotationItem}>
              <Text style={styles.annotationBullet}>•</Text>
              <Text style={styles.annotationText}>{annotation}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* AI Summary */}
      {analysis?.summary && (
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>🤖 AI Analysis Summary</Text>
          <Text style={styles.summaryText}>{analysis.summary}</Text>
          <Text style={styles.summaryMeta}>
            Analyzed by {analysis.provider} • {new Date(analysis.ingestedAt).toLocaleDateString()}
          </Text>
        </Card>
      )}

      {/* Metrics Grid */}
      {analysis?.metrics && analysis.metrics.length > 0 && (
        <View style={styles.metricsSection}>
          <Text style={styles.sectionTitle}>Swing Metrics</Text>
          <View style={styles.metricsGrid}>
            {analysis.metrics.map(renderMetricCard)}
          </View>
        </View>
      )}

      {/* All Annotations Timeline */}
      {analysis?.annotations && analysis.annotations.length > 0 && (
        <Card style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>📍 Key Moments</Text>
          {analysis.annotations.map((annotation, index) => (
            <TouchableOpacity
              key={index}
              style={styles.timelineItem}
              onPress={() => {
                // Seek to this timestamp would require video ref access
                // This is a placeholder for frame-by-frame navigation
              }}
            >
              <View style={styles.timelineTimestamp}>
                <Text style={styles.timelineTime}>{formatTimestamp(annotation.tsMs)}</Text>
              </View>
              <Text style={styles.timelineNote}>{annotation.note}</Text>
            </TouchableOpacity>
          ))}
        </Card>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Share Analysis"
          onPress={onShare}
          variant="secondary"
          style={styles.actionButton}
        />
        <Button
          title="Back to Gallery"
          onPress={onBack}
          variant="ghost"
          style={styles.actionButton}
        />
      </View>
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
  backButton: {
    marginBottom: spacing.md
  },
  backArrow: {
    fontSize: 16,
    color: palette.navy600,
    fontWeight: '600'
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.sm,
    fontFamily: font.display
  },
  subtitle: {
    fontSize: 14,
    color: palette.ink700,
    fontFamily: font.body
  },
  videoCard: {
    marginBottom: spacing.lg,
    padding: 0,
    overflow: 'hidden'
  },
  videoPlayer: {
    aspectRatio: 16 / 9
  },
  videoLoading: {
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.ink900
  },
  videoError: {
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.ink900
  },
  videoErrorText: {
    color: palette.red500,
    fontSize: 16
  },
  annotationsCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: palette.navy600 + '10'
  },
  annotationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.ink900,
    marginBottom: spacing.md
  },
  annotationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm
  },
  annotationBullet: {
    fontSize: 14,
    color: palette.navy600,
    marginRight: spacing.sm,
    marginTop: 2
  },
  annotationText: {
    fontSize: 14,
    color: palette.ink700,
    flex: 1
  },
  summaryCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.md
  },
  summaryText: {
    fontSize: 15,
    color: palette.ink700,
    lineHeight: 22,
    marginBottom: spacing.md
  },
  summaryMeta: {
    fontSize: 12,
    color: palette.ink500,
    fontStyle: 'italic'
  },
  metricsSection: {
    marginBottom: spacing.lg
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.md
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md
  },
  metricCard: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: palette.sky200
  },
  metricCardSelected: {
    borderColor: palette.navy600
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink700
  },
  gradeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm
  },
  gradeText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.white
  },
  metricValueContainer: {
    marginBottom: spacing.sm
  },
  metricValue: {
    fontSize: 32,
    fontWeight: '700'
  },
  metricUnit: {
    fontSize: 16,
    fontWeight: '500'
  },
  progressBarContainer: {
    height: 6
  },
  progressBarBackground: {
    flex: 1,
    backgroundColor: palette.sky200,
    borderRadius: 3,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3
  },
  timelineCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  timelineTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.md
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200
  },
  timelineTimestamp: {
    backgroundColor: palette.navy600,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginRight: spacing.md,
    minWidth: 50
  },
  timelineTime: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center'
  },
  timelineNote: {
    flex: 1,
    fontSize: 14,
    color: palette.ink700
  },
  actions: {
    marginTop: spacing.lg
  },
  actionButton: {
    marginBottom: spacing.md
  }
});
