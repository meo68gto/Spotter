import React, { useState, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { VideoGalleryScreen } from './VideoGalleryScreen';
import { VideoUploadScreen } from './VideoUploadScreen';
import { VideoAnalysisScreen } from './VideoAnalysisScreen';
import { VideoSubmission } from '../hooks/useVideoGallery';

type VideoView = 'gallery' | 'upload' | 'analysis';

interface VideoScreenProps {
  session: Session;
  initialView?: VideoView;
  initialVideo?: VideoSubmission;
  activityId?: string;
  sessionId?: string;
}

export function VideoScreen({
  session,
  initialView = 'gallery',
  initialVideo,
  activityId,
  sessionId
}: VideoScreenProps) {
  const [currentView, setCurrentView] = useState<VideoView>(initialView);
  const [selectedVideo, setSelectedVideo] = useState<VideoSubmission | null>(initialVideo || null);

  const handleVideoPress = useCallback((video: VideoSubmission) => {
    setSelectedVideo(video);
    setCurrentView('analysis');
  }, []);

  const handleUploadPress = useCallback(() => {
    setCurrentView('upload');
  }, []);

  const handleUploadComplete = useCallback(() => {
    setCurrentView('gallery');
  }, []);

  const handleUploadCancel = useCallback(() => {
    setCurrentView('gallery');
  }, []);

  const handleBackToGallery = useCallback(() => {
    setSelectedVideo(null);
    setCurrentView('gallery');
  }, []);

  const handleShare = useCallback(() => {
    // TODO: Implement share functionality
    console.log('Share video analysis:', selectedVideo?.id);
  }, [selectedVideo]);

  switch (currentView) {
    case 'upload':
      return (
        <VideoUploadScreen
          session={session}
          activityId={activityId}
          sessionId={sessionId}
          onComplete={handleUploadComplete}
          onCancel={handleUploadCancel}
        />
      );

    case 'analysis':
      if (!selectedVideo) {
        // Fallback to gallery if no video selected
        return (
          <VideoGalleryScreen
            session={session}
            onVideoPress={handleVideoPress}
            onUploadPress={handleUploadPress}
          />
        );
      }
      return (
        <VideoAnalysisScreen
          session={session}
          video={selectedVideo}
          onBack={handleBackToGallery}
          onShare={handleShare}
        />
      );

    case 'gallery':
    default:
      return (
        <VideoGalleryScreen
          session={session}
          onVideoPress={handleVideoPress}
          onUploadPress={handleUploadPress}
        />
      );
  }
}
