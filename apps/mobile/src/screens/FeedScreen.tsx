import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { EngagementCard, CommunityPostCard } from '../components/feed';
import { invokeFunction } from '../lib/api';
import { palette, font, spacing } from '../theme/design';

interface FeedItem {
  id: string;
  score: number;
  published_at: string;
  metadata?: Record<string, unknown>;
  item_type?: 'engagement' | 'community_post';
  engagement_requests: {
    id: string;
    question_text: string;
    engagement_mode: string;
    moderation_status: string;
    public_opt_in: boolean;
    completed_at: string | null;
    coach_id: string | null;
    engagement_responses: Array<{
      response_text: string | null;
      audio_url: string | null;
      video_url: string | null;
      transcript: string | null;
      submitted_at: string;
    }>;
  } | null;
}

interface FeedResponse {
  data: FeedItem[];
  nextCursor?: string | null;
  hasMore?: boolean;
}

interface FeedScreenProps {
  session: Session;
  onNavigate?: (target: string) => void;
}

const ITEMS_PER_PAGE = 20;

export function FeedScreen({ session, onNavigate }: FeedScreenProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [newContentCount, setNewContentCount] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const fetchFeed = useCallback(async (isRefresh = false, cursor?: string | null) => {
    try {
      setError(null);
      
      const params: Record<string, string> = {
        limit: String(ITEMS_PER_PAGE)
      };
      
      if (cursor && !isRefresh) {
        params.cursor = cursor;
      }

      const response = await invokeFunction<FeedResponse>('feed-home', {
        method: 'GET',
        params
      });

      const feedData = response.data ?? [];
      const hasMoreItems = response.hasMore ?? feedData.length === ITEMS_PER_PAGE;
      const newCursor = response.nextCursor ?? null;

      if (isRefresh) {
        setItems(feedData);
        setNewContentCount(0);
      } else if (cursor) {
        setItems(prev => [...prev, ...feedData]);
      } else {
        setItems(feedData);
      }

      setHasMore(hasMoreItems);
      setNextCursor(newCursor);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load feed';
      setError(message);
      console.error('Feed load error:', err);
    }
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    await fetchFeed(false, null);
    setLoading(false);
  }, [fetchFeed]);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    await fetchFeed(true, null);
    setRefreshing(false);
  }, [fetchFeed, refreshing]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || items.length === 0) return;
    
    setLoadingMore(true);
    await fetchFeed(false, nextCursor);
    setLoadingMore(false);
  }, [fetchFeed, hasMore, items.length, loadingMore, nextCursor]);

  // Initial load
  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Poll for new content every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await invokeFunction<FeedResponse>('feed-home', {
          method: 'GET',
          params: { limit: '1', since: items[0]?.published_at }
        });
        
        const newItems = response.data ?? [];
        if (newItems.length > 0 && newItems[0].id !== items[0]?.id) {
          setNewContentCount(prev => prev + newItems.length);
        }
      } catch {
        // Silently fail polling errors
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [items]);

  const handleLoadNewContent = () => {
    onRefresh();
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handleLike = (id: string) => {
    // Update local state optimistically
    setItems(prev => prev.map(item => 
      item.id === id 
        ? { ...item, is_liked: !item.is_liked }
        : item
    ));
  };

  const handleShare = (id: string) => {
    // Implement share functionality
    Alert.alert('Share', 'Share functionality coming soon!');
  };

  const handleRespond = (engagementId: string) => {
    onNavigate?.('ask');
  };

  const handleComment = (postId: string) => {
    Alert.alert('Comment', 'Comment functionality coming soon!');
  };

  const handleAuthorPress = (authorId: string) => {
    onNavigate?.('profile');
  };

  const renderItem = ({ item }: { item: FeedItem }) => {
    // Determine item type based on data structure
    const isCommunityPost = item.item_type === 'community_post' || 
                           (item.metadata?.post && !item.engagement_requests);

    if (isCommunityPost) {
      return (
        <CommunityPostCard
          id={item.id}
          score={item.score}
          published_at={item.published_at}
          metadata={item.metadata}
          onLike={handleLike}
          onShare={handleShare}
          onComment={handleComment}
          onAuthorPress={handleAuthorPress}
        />
      );
    }

    return (
      <EngagementCard
        id={item.id}
        score={item.score}
        published_at={item.published_at}
        metadata={item.metadata}
        engagement_requests={item.engagement_requests}
        onLike={handleLike}
        onShare={handleShare}
        onRespond={handleRespond}
      />
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={palette.navy600} />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No content yet</Text>
        <Text style={styles.emptyText}>
          Check back later for questions, responses, and community updates.
        </Text>
        <TouchableOpacity style={styles.emptyButton} onPress={onRefresh}>
          <Text style={styles.emptyButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading && items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Feed</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.navy600} />
          <Text style={styles.loadingText}>Loading feed...</Text>
        </View>
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Feed</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Failed to load feed</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadInitial}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
        <Text style={styles.subtitle}>Discover questions, responses, and community posts</Text>
      </View>

      {newContentCount > 0 && (
        <TouchableOpacity style={styles.newContentBanner} onPress={handleLoadNewContent}>
          <Text style={styles.newContentText}>
            {newContentCount} new {newContentCount === 1 ? 'item' : 'items'}
          </Text>
          <Text style={styles.newContentAction}>Tap to load</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={flatListRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.navy600}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.ink900,
    fontFamily: font.display
  },
  subtitle: {
    fontSize: 14,
    color: palette.ink500,
    marginTop: spacing.xs,
    fontFamily: font.body
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.md
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg
  },
  loadingText: {
    marginTop: spacing.md,
    color: palette.ink500,
    fontSize: 14
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.sm
  },
  errorText: {
    fontSize: 14,
    color: palette.ink500,
    textAlign: 'center',
    marginBottom: spacing.lg
  },
  retryButton: {
    backgroundColor: palette.navy600,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8
  },
  retryText: {
    color: palette.white,
    fontWeight: '600',
    fontSize: 14
  },
  newContentBanner: {
    backgroundColor: palette.navy600,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  newContentText: {
    color: palette.white,
    fontWeight: '600',
    fontSize: 14
  },
  newContentAction: {
    color: palette.mint500,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: spacing.sm
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center'
  },
  footerText: {
    marginTop: spacing.sm,
    color: palette.ink500,
    fontSize: 12
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.sm
  },
  emptyText: {
    fontSize: 14,
    color: palette.ink500,
    textAlign: 'center',
    marginBottom: spacing.lg
  },
  emptyButton: {
    backgroundColor: palette.navy600,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8
  },
  emptyButtonText: {
    color: palette.white,
    fontWeight: '600',
    fontSize: 14
  }
});
