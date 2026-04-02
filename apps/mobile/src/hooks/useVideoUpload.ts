import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { invokeFunction } from '../lib/api';
import { compressVideoOnDevice, CompressionResult } from '../lib/video-compression';

export type UploadStatus = 'idle' | 'picking' | 'compressing' | 'presigning' | 'uploading' | 'processing' | 'completed' | 'failed';

export interface VideoUploadState {
  status: UploadStatus;
  progress: number;
  error: string | null;
  videoSubmissionId: string | null;
  storagePath: string | null;
}

export interface PresignResponse {
  id: string;
  storage_path: string;
  status: string;
  upload_url: string;
  upload_expires_at: string;
  token: string;
  path: string;
}

export interface EnqueueResponse {
  id: string;
  video_submission_id: string;
  status: string;
}

export function useVideoUpload() {
  const [state, setState] = useState<VideoUploadState>({
    status: 'idle',
    progress: 0,
    error: null,
    videoSubmissionId: null,
    storagePath: null
  });

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      progress: 0,
      error: null,
      videoSubmissionId: null,
      storagePath: null
    });
  }, []);

  const pickVideo = useCallback(async (): Promise<string | null> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload videos.');
        return null;
      }

      setState(prev => ({ ...prev, status: 'picking' }));

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 300 // 5 minutes max
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setState(prev => ({ ...prev, status: 'idle' }));
        return null;
      }

      return result.assets[0].uri;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pick video';
      setState(prev => ({ ...prev, status: 'failed', error: errorMessage }));
      return null;
    }
  }, []);

  const recordVideo = useCallback(async (): Promise<string | null> => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access to record videos.');
        return null;
      }

      setState(prev => ({ ...prev, status: 'picking' }));

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 300 // 5 minutes max
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setState(prev => ({ ...prev, status: 'idle' }));
        return null;
      }

      return result.assets[0].uri;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to record video';
      setState(prev => ({ ...prev, status: 'failed', error: errorMessage }));
      return null;
    }
  }, []);

  const uploadVideo = useCallback(async (
    videoUri: string,
    activityId: string,
    sessionId?: string,
    engagementRequestId?: string
  ): Promise<boolean> => {
    try {
      // Step 1: Compress video
      setState(prev => ({ ...prev, status: 'compressing', progress: 0.1 }));
      const compressionResult: CompressionResult = await compressVideoOnDevice(videoUri);
      
      // Step 2: Get presigned URL
      setState(prev => ({ ...prev, status: 'presigning', progress: 0.2 }));
      
      const fileExt = compressionResult.outputUri.split('.').pop() || 'mp4';
      
      const presignData = await invokeFunction<PresignResponse>('videos-presign', {
        body: {
          activityId,
          sessionId,
          engagementRequestId,
          fileExt
        }
      });

      if (!presignData || !presignData.upload_url) {
        throw new Error('Failed to get upload URL');
      }

      setState(prev => ({
        ...prev,
        videoSubmissionId: presignData.id,
        storagePath: presignData.storage_path,
        status: 'uploading',
        progress: 0.3
      }));

      // Step 3: Upload to storage
      if (process.env.NODE_ENV === 'production') {
        const uploadResult = await FileSystem.uploadAsync(
          presignData.upload_url,
          compressionResult.outputUri,
          {
            httpMethod: 'PUT',
            headers: {
              'Content-Type': 'video/mp4'
            },
            uploadType: FileSystem.FileSystemUploadType.BINARY
          }
        );

        if (uploadResult.status !== 200) {
          throw new Error(`Upload failed with status ${uploadResult.status}`);
        }
      }

      setState(prev => ({ ...prev, progress: 0.8, status: 'processing' }));

      // Step 4: Enqueue for processing
      await invokeFunction<EnqueueResponse>('videos-enqueue-processing', {
        body: {
          videoSubmissionId: presignData.id
        }
      });

      setState(prev => ({ ...prev, status: 'completed', progress: 1.0 }));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setState(prev => ({ ...prev, status: 'failed', error: errorMessage }));
      return false;
    }
  }, []);

  return {
    ...state,
    pickVideo,
    recordVideo,
    uploadVideo,
    reset
  };
}
