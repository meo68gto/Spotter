import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type VideoSortOption = 'newest' | 'oldest' | 'analyzed' | 'pending';

export interface VideoSubmission {
  id: string;
  user_id: string;
  activity_id: string;
  session_id: string | null;
  storage_path: string;
  status: 'uploaded' | 'processing' | 'analyzed' | 'failed';
  ai_analysis: AIAnalysis | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  activity?: {
    name: string;
    slug: string;
  };
}

export interface AIAnalysis {
  provider: string;
  summary: string;
  metrics: AnalysisMetric[];
  annotations: AnalysisAnnotation[];
  ingestedAt: string;
}

export interface AnalysisMetric {
  key: string;
  label: string;
  value: number;
  unit?: string;
}

export interface AnalysisAnnotation {
  tsMs: number;
  note: string;
}

export interface VideoGalleryState {
  videos: VideoSubmission[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
}

const PAGE_SIZE = 20;

export function useVideoGallery(sortOption: VideoSortOption = 'newest') {
  const [state, setState] = useState<VideoGalleryState>({
    videos: [],
    loading: true,
    error: null,
    hasMore: true
  });

  const fetchVideos = useCallback(async (cursor?: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      let query = supabase
        .from('video_submissions')
        .select(`
          *,
          activity:activities(name, slug)
        `)
        .limit(PAGE_SIZE);

      // Apply sorting
      switch (sortOption) {
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'analyzed':
          query = query.eq('status', 'analyzed').order('updated_at', { ascending: false });
          break;
        case 'pending':
          query = query.in('status', ['uploaded', 'processing']).order('created_at', { ascending: false });
          break;
      }

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const { data, error } = await query;

      if (error) throw error;

      const videos = (data || []) as VideoSubmission[];
      
      setState(prev => ({
        videos: cursor ? [...prev.videos, ...videos] : videos,
        loading: false,
        error: null,
        hasMore: videos.length === PAGE_SIZE
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load videos';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
    }
  }, [sortOption]);

  const refresh = useCallback(() => {
    setState(prev => ({ ...prev, videos: [], hasMore: true }));
    fetchVideos();
  }, [fetchVideos]);

  const loadMore = useCallback(() => {
    if (!state.loading && state.hasMore && state.videos.length > 0) {
      const lastVideo = state.videos[state.videos.length - 1];
      fetchVideos(lastVideo.created_at);
    }
  }, [state.loading, state.hasMore, state.videos, fetchVideos]);

  const deleteVideo = useCallback(async (videoId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('video_submissions')
        .delete()
        .eq('id', videoId);

      if (error) throw error;

      setState(prev => ({
        ...prev,
        videos: prev.videos.filter(v => v.id !== videoId)
      }));

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete video';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, []);

  const getVideoUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .storage
        .from('videos-raw')
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      if (error || !data) return null;
      return data.signedUrl;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  return {
    ...state,
    refresh,
    loadMore,
    deleteVideo,
    getVideoUrl
  };
}
