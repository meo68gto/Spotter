import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Image
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { VideoSubmission, useVideoGallery, VideoSortOption } from '../hooks/useVideoGallery';
import { palette, spacing, radius, font } from '../theme/design';

interface VideoGalleryScreenProps {
  session: Session;
  onVideoPress?: (video: VideoSubmission) => void;
  onUploadPress?: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  uploaded: { label: 'Pending', color: palette.amber500 },
  processing: { label: 'Analyzing', color: palette.navy600 },
  analyzed: { label: 'Analyzed', color: palette.green500 },
  failed: { label: 'Failed', color: palette.red500 }
};

const SORT_OPTIONS: { key: VideoSortOption; label: string }[] = [
  { key: 'newest', label: 'Newest First' },
  { key: 'oldest', label: 'Oldest First' },
  { key: 'analyzed', label: 'Analyzed' },
  { key: 'pending', label: 'Pending' }
];

export function VideoGalleryScreen({
  session,
  onVideoPress,
  onUploadPress
}: VideoGalleryScreenProps) {
  const [sortOption, setSortOption] = useState<VideoSortOption>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const {
    videos,
    loading,
    error,
    hasMore,
    refresh,
    loadMore,
    deleteVideo
  } = useVideoGallery(sortOption);

  const handleDelete = useCallback((video: VideoSubmission) => {
    Alert.alert(
      'Delete Video?',
      `This will permanently delete "${video.activity?.name || 'this video'}" and its analysis.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteVideo(video.id);
            if (!success) {
              Alert.alert('Error', 'Failed to delete video. Please try again.');
            }
          }
        }
      ]
    );
  }, [deleteVideo]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderVideoItem = ({ item }: { item: VideoSubmission }) => {
    const status = STATUS_LABELS[item.status] || { label: item.status, color: palette.ink500 };
    const hasAnalysis = item.status === 'analyzed' && item.ai_analysis;

    return (
      <TouchableOpacity
        style={styles.videoItem}
        onPress={() => onVideoPress?.(item)}
        activeOpacity={0.8}
      >
        <View style={styles.thumbnailContainer}>
          <View style={styles.thumbnailPlaceholder}>
            <Text style={styles.thumbnailIcon}>🎥</Text>
            {hasAnalysis && (
              <View style={styles.analysisBadge}>
                <Text style={styles.analysisBadgeText}>AI ✓</Text>
              </View>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
            <Text style={styles.statusText}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.videoInfo}>
          <Text style={styles.videoTitle}>{item.activity?.name || 'Golf Swing'}</Text>
          <Text style={styles.videoDate}>{formatDate(item.created_at)}</Text>
          
          {hasAnalysis && item.ai_analysis?.metrics && (
            <View style={styles.metricsPreview}>
              {item.ai_analysis.metrics.slice(0, 3).map((metric) => (
                <View key={metric.key} style={styles.metricPreviewItem}>
                  <Text style={styles.metricPreviewLabel}>{metric.label}:</Text>
                  <Text style={styles.metricPreviewValue}>{metric.value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.deleteIcon}>🗑</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyCard}>
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🎬</Text>
        <Text style={styles.emptyTitle}>No videos yet</Text>
        <Text style={styles.emptySubtitle}>
          Upload your first swing video to get AI-powered analysis and coaching feedback
        </Text>
        <Button
          title="Upload Video"
          onPress={onUploadPress}
          tone="primary"
          />
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!hasMore) return null;
    
    return (
      <View style={styles.footer}>
        {loading && (
          <ActivityIndicator size="small" color={palette.navy600} />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>My Videos</Text>
            <Text style={styles.subtitle}>{videos.length} videos</Text>
          </View>
          
          <Button
            title="+ Upload"
            onPress={onUploadPress}
            tone="primary"
            />
        </View>

        {/* Sort Options */}
        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>Sort by:</Text>
          <View style={styles.sortOptions}>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.sortOption,
                  sortOption === option.key && styles.sortOptionActive
                ]}
                onPress={() => setSortOption(option.key)}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    sortOption === option.key && styles.sortOptionTextActive
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Error State */}
      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Try Again"
            onPress={refresh}
            tone="secondary"
            />
        </View>
      )}

      {/* Video List */}
      <FlatList
        data={videos}
        renderItem={renderVideoItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading && videos.length === 0}
            onRefresh={refresh}
            tintColor={palette.navy600}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={!loading ? renderEmptyState : null}
        ListFooterComponent={renderFooter}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.sky100
  },
  header: {
    padding: spacing.lg,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: palette.ink900,
    fontFamily: font.display
  },
  subtitle: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: spacing.xs
  },
  uploadButton: {
    minWidth: 100
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  sortLabel: {
    fontSize: 14,
    color: palette.ink700,
    marginRight: spacing.sm
  },
  sortOptions: {
    flexDirection: 'row',
    flex: 1
  },
  sortOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    marginRight: spacing.sm,
    backgroundColor: palette.sky100
  },
  sortOptionActive: {
    backgroundColor: palette.navy600
  },
  sortOptionText: {
    fontSize: 12,
    color: palette.ink700
  },
  sortOptionTextActive: {
    color: palette.white,
    fontWeight: '600'
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2
  },
  videoItem: {
    flexDirection: 'row',
    backgroundColor: palette.white,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    shadowColor: palette.ink900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  thumbnailContainer: {
    position: 'relative',
    marginRight: spacing.md
  },
  thumbnailPlaceholder: {
    width: 100,
    height: 75,
    backgroundColor: palette.ink900,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center'
  },
  thumbnailIcon: {
    fontSize: 24
  },
  analysisBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: palette.green500,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm
  },
  analysisBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.white
  },
  statusBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: palette.white,
    textAlign: 'center'
  },
  videoInfo: {
    flex: 1,
    justifyContent: 'center'
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.ink900,
    marginBottom: spacing.xs
  },
  videoDate: {
    fontSize: 12,
    color: palette.ink500,
    marginBottom: spacing.sm
  },
  metricsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  metricPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
    marginBottom: spacing.xs
  },
  metricPreviewLabel: {
    fontSize: 11,
    color: palette.ink500,
    marginRight: 4
  },
  metricPreviewValue: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.navy600
  },
  deleteButton: {
    justifyContent: 'center',
    paddingLeft: spacing.sm
  },
  deleteIcon: {
    fontSize: 18,
    opacity: 0.5
  },
  emptyCard: {
    margin: spacing.lg,
    padding: spacing.xl
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.md
  },
  emptySubtitle: {
    fontSize: 14,
    color: palette.ink700,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20
  },
  emptyButton: {
    minWidth: 150
  },
  errorCard: {
    margin: spacing.lg,
    padding: spacing.lg,
    alignItems: 'center'
  },
  errorText: {
    fontSize: 14,
    color: palette.red500,
    textAlign: 'center',
    marginBottom: spacing.md
  },
  retryButton: {
    minWidth: 120
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center'
  }
});
