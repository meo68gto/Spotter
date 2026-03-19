import { useState, useCallback } from 'react';
import { VideoSubmission, AIAnalysis } from './useVideoGallery';

export interface VideoAnalysisState {
  loading: boolean;
  error: string | null;
  currentFrame: number;
  isPlaying: boolean;
  selectedMetric: string | null;
}

export function useVideoAnalysis(video: VideoSubmission | null) {
  const [state, setState] = useState<VideoAnalysisState>({
    loading: false,
    error: null,
    currentFrame: 0,
    isPlaying: false,
    selectedMetric: null
  });

  const setCurrentFrame = useCallback((frame: number) => {
    setState(prev => ({ ...prev, currentFrame: frame }));
  }, []);

  const setIsPlaying = useCallback((playing: boolean) => {
    setState(prev => ({ ...prev, isPlaying: playing }));
  }, []);

  const togglePlay = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const selectMetric = useCallback((metricKey: string | null) => {
    setState(prev => ({ ...prev, selectedMetric: metricKey }));
  }, []);

  const getMetricValue = useCallback((key: string): number | null => {
    if (!video?.ai_analysis?.metrics) return null;
    const metric = video.ai_analysis.metrics.find(m => m.key === key);
    return metric?.value ?? null;
  }, [video]);

  const getAnnotationsAtTime = useCallback((timestampMs: number): string[] => {
    if (!video?.ai_analysis?.annotations) return [];
    
    // Find annotations within 500ms of the current timestamp
    const threshold = 500;
    return video.ai_analysis.annotations
      .filter(a => Math.abs(a.tsMs - timestampMs) < threshold)
      .map(a => a.note);
  }, [video]);

  const getMetricColor = useCallback((value: number, key: string): string => {
    // Color coding based on metric type and value ranges
    switch (key) {
      case 'balance':
      case 'control':
      case 'tempo':
      case 'form':
        if (value >= 80) return '#22C55E'; // Green
        if (value >= 60) return '#EAB308'; // Yellow
        return '#EF4444'; // Red
      default:
        if (value >= 70) return '#22C55E';
        if (value >= 50) return '#EAB308';
        return '#EF4444';
    }
  }, []);

  const getMetricGrade = useCallback((value: number): string => {
    if (value >= 90) return 'A+';
    if (value >= 85) return 'A';
    if (value >= 80) return 'A-';
    if (value >= 75) return 'B+';
    if (value >= 70) return 'B';
    if (value >= 65) return 'B-';
    if (value >= 60) return 'C+';
    if (value >= 55) return 'C';
    if (value >= 50) return 'C-';
    return 'D';
  }, []);

  return {
    ...state,
    analysis: video?.ai_analysis ?? null,
    setCurrentFrame,
    setIsPlaying,
    togglePlay,
    selectMetric,
    getMetricValue,
    getAnnotationsAtTime,
    getMetricColor,
    getMetricGrade
  };
}

export type { AIAnalysis, AnalysisMetric, AnalysisAnnotation } from './useVideoGallery';
