import { useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '../Card';
import { VideoPlayer } from '../VideoPlayer';
import { invokeFunction } from '../../lib/api';
import { palette, font, spacing, radius } from '../../theme/design';

interface CommunityPost {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar_url?: string;
  content: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
}

export interface CommunityPostCardProps {
  id: string;
  score: number;
  published_at: string;
  metadata?: {
    post?: CommunityPost;
    [key: string]: unknown;
  };
  onLike?: (id: string) => void;
  onShare?: (id: string) => void;
  onComment?: (id: string) => void;
  onAuthorPress?: (authorId: string) => void;
}

export function CommunityPostCard({
  id,
  published_at,
  metadata,
  onLike,
  onShare,
  onComment,
  onAuthorPress
}: CommunityPostCardProps) {
  const post = metadata?.post;
  const [liked, setLiked] = useState(post?.is_liked ?? false);
  const [likes, setLikes] = useState(post?.likes_count ?? 0);
  const [isLiking, setIsLiking] = useState(false);

  if (!post) return null;

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

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);

    const newLiked = !liked;
    const newLikes = newLiked ? likes + 1 : likes - 1;
    setLiked(newLiked);
    setLikes(newLikes);

    try {
      await invokeFunction('community-post-like', {
        method: 'POST',
        body: { postId: post.id, action: newLiked ? 'like' : 'unlike' }
      });
      onLike?.(id);
    } catch (error) {
      setLiked(!newLiked);
      setLikes(likes);
      Alert.alert('Error', 'Failed to update like status');
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = () => {
    onShare?.(id);
  };

  const handleComment = () => {
    onComment?.(post.id);
  };

  const handleAuthorPress = () => {
    onAuthorPress?.(post.author_id);
  };

  return (
    <Card>
      {/* Author Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.authorContainer} onPress={handleAuthorPress}>
          {post.author_avatar_url ? (
            <Image source={{ uri: post.author_avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{post.author_name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{post.author_name}</Text>
            <Text style={styles.date}>{formatDate(published_at)}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Post Content */}
      <Text style={styles.content}>{post.content}</Text>

      {/* Media */}
      {post.media_url && post.media_type === 'video' && (
        <View style={styles.mediaContainer}>
          <VideoPlayer
            videoUrl={post.media_url}
            showControls={true}
            style={styles.videoPlayer}
          />
        </View>
      )}

      {post.media_url && post.media_type === 'image' && (
        <View style={styles.mediaContainer}>
          <Image
            source={{ uri: post.media_url }}
            style={styles.image}
            resizeMode="cover"
          />
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

        <TouchableOpacity style={styles.interactionButton} onPress={handleComment}>
          <Text style={styles.interactionIcon}>💬</Text>
          <Text style={styles.interactionText}>
            {post.comments_count > 0 ? `${post.comments_count} Comments` : 'Comment'}
          </Text>
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
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.navy600,
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700'
  },
  authorInfo: {
    marginLeft: spacing.sm,
    flex: 1
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink900
  },
  date: {
    fontSize: 12,
    color: palette.ink500,
    fontFamily: font.body
  },
  content: {
    fontSize: 14,
    color: palette.ink700,
    lineHeight: 20,
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
  image: {
    width: '100%',
    height: 200,
    borderRadius: radius.md
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
