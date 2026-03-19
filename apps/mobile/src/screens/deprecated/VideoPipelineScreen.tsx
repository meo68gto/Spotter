import { Session } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { trackEvent } from '../../lib/analytics';
import { flags } from '../../lib/flags';
import { supabase } from '../../lib/supabase';
import { compressVideoOnDevice } from '../../lib/video-compression';
import { env } from '../../types/env';

type PipelineStage = 'idle' | 'compressing' | 'presigning' | 'uploading' | 'queueing' | 'done' | 'failed';

type VideoSubmissionRow = {
  id: string;
  status: 'uploaded' | 'processing' | 'analyzed' | 'failed';
  created_at: string;
  storage_path: string;
};

type VideoJobRow = {
  id: string;
  video_submission_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  last_error_code: string | null;
  next_run_at: string | null;
  updated_at: string;
};

const MAX_UPLOAD_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveUploadUrl = (uploadUrl: string) =>
  uploadUrl
    .replace('http://kong:8000', env.supabaseUrl)
    .replace('http://kong', env.supabaseUrl)
    .replace('https://kong:8000', env.supabaseUrl)
    .replace('https://kong', env.supabaseUrl);

export function VideoPipelineScreen({ session }: { session: Session }) {
  const [activityId, setActivityId] = useState('');
  const [videoUri, setVideoUri] = useState('');
  const [stage, setStage] = useState<PipelineStage>('idle');
  const [status, setStatus] = useState('Idle');
  const [progressPct, setProgressPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState('');
  const [lastSubmissionId, setLastSubmissionId] = useState('');
  const [submissions, setSubmissions] = useState<VideoSubmissionRow[]>([]);
  const [jobsBySubmissionId, setJobsBySubmissionId] = useState<Record<string, VideoJobRow>>({});

  const canRetry = useMemo(() => stage === 'failed' && Boolean(videoUri) && Boolean(activityId), [stage, videoUri, activityId]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('skill_profiles')
        .select('activity_id')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.activity_id) setActivityId(data.activity_id);
    };
    load();
  }, [session.user.id]);

  const refreshSubmissions = async () => {
    const { data, error } = await supabase
      .from('video_submissions')
      .select('id, status, created_at, storage_path')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error) {
      const submissionRows = (data ?? []) as VideoSubmissionRow[];
      setSubmissions(submissionRows);

      if (submissionRows.length === 0) {
        setJobsBySubmissionId({});
        return;
      }

      const ids = submissionRows.map((row) => row.id);
      const { data: jobs, error: jobsError } = await supabase
        .from('video_processing_jobs')
        .select('id, video_submission_id, status, attempts, max_attempts, last_error, last_error_code, next_run_at, updated_at')
        .in('video_submission_id', ids);

      if (!jobsError) {
        const mapped: Record<string, VideoJobRow> = {};
        for (const job of (jobs ?? []) as VideoJobRow[]) {
          mapped[job.video_submission_id] = job;
        }
        setJobsBySubmissionId(mapped);
      }
    }
  };

  useEffect(() => {
    refreshSubmissions();

    const channel = supabase
      .channel(`video-submissions-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_submissions',
          filter: `user_id=eq.${session.user.id}`
        },
        () => {
          refreshSubmissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.user.id]);

  const pickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow media access to upload videos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1
    });

    if (result.canceled || !result.assets.length) return;
    setVideoUri(result.assets[0].uri);
    setStage('idle');
    setLastError('');
    setStatus('Video selected');
    setProgressPct(0);
  };

  const enqueueSubmission = async (videoSubmissionId: string, token: string) => {
    const queueRes = await fetch(`${env.apiBaseUrl}/functions/v1/videos-enqueue-processing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ videoSubmissionId })
    });

    const queuePayload = await queueRes.json();
    if (!queueRes.ok) {
      throw new Error(queuePayload.error ?? 'Queue failed');
    }
  };

  const runUpload = async () => {
    if (!flags.videoPipeline) {
      Alert.alert('Disabled', 'Video pipeline feature flag is disabled.');
      return;
    }
    if (!videoUri || !activityId) {
      Alert.alert('Missing data', 'Select a video and ensure onboarding has completed.');
      return;
    }

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      Alert.alert('Session missing', 'Please sign in again.');
      return;
    }

    setBusy(true);
    setLastError('');

    try {
      setStage('compressing');
      setStatus('Compressing on device...');
      setProgressPct(5);
      const compressed = await compressVideoOnDevice(videoUri);
      await trackEvent('video_compression_attempted', session.user.id, {
        strategy: compressed.strategy,
        compressed: compressed.compressed,
        input_size_bytes: compressed.inputSizeBytes ?? null,
        output_size_bytes: compressed.outputSizeBytes ?? null,
        target_max_bytes: compressed.targetMaxBytes,
        estimated_bitrate_kbps: compressed.estimatedBitrateKbps
      });
      if (!compressed.compressed && compressed.strategy === 'passthrough' && compressed.note) {
        await trackEvent('video_compression_fallback', session.user.id, {
          note: compressed.note,
          input_size_bytes: compressed.inputSizeBytes ?? null,
          target_max_bytes: compressed.targetMaxBytes
        });
      }

      const ext = compressed.outputUri.split('.').pop()?.toLowerCase() ?? 'mp4';

      setStage('presigning');
      setStatus('Requesting upload URL...');
      setProgressPct(15);
      const presignRes = await fetch(`${env.apiBaseUrl}/functions/v1/videos-presign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ activityId, fileExt: ext })
      });

      const presignPayload = await presignRes.json();
      if (!presignRes.ok) {
        throw new Error(presignPayload.error ?? 'Presign failed');
      }

      const uploadUrl = resolveUploadUrl(presignPayload.data.upload_url as string);
      const videoSubmissionId = presignPayload.data.id as string;
      setLastSubmissionId(videoSubmissionId);

      setStage('uploading');
      setStatus('Uploading video...');
      setProgressPct(20);

      let lastUploadError = '';
      for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
        try {
          const task = FileSystem.createUploadTask(
            uploadUrl,
            compressed.outputUri,
            {
              httpMethod: 'PUT',
              uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
              headers: {
                'Content-Type': 'video/mp4'
              }
            },
            (progress) => {
              const rawRatio =
                progress.totalBytesExpectedToSend > 0
                  ? progress.totalBytesSent / progress.totalBytesExpectedToSend
                  : 0;
              const pct = Math.min(90, Math.max(20, 20 + rawRatio * 70));
              setProgressPct(Math.round(pct));
            }
          );

          const uploadRes = await task.uploadAsync();
          if (!uploadRes || uploadRes.status < 200 || uploadRes.status >= 300) {
            throw new Error(`Upload returned ${uploadRes?.status ?? 'unknown status'}`);
          }

          lastUploadError = '';
          break;
        } catch (error) {
          lastUploadError = error instanceof Error ? error.message : 'Upload failed';
          if (attempt < MAX_UPLOAD_ATTEMPTS) {
            setStatus(`Upload failed (attempt ${attempt}/${MAX_UPLOAD_ATTEMPTS}), retrying...`);
            await sleep(600 * attempt);
          }
        }
      }

      if (lastUploadError) {
        throw new Error(lastUploadError);
      }

      setStage('queueing');
      setStatus('Queueing processing...');
      setProgressPct(95);

      await enqueueSubmission(videoSubmissionId, token);

      await trackEvent('video_uploaded_and_queued', session.user.id, {
        video_submission_id: videoSubmissionId,
        compression_strategy: compressed.strategy,
        input_size_bytes: compressed.inputSizeBytes ?? null,
        output_size_bytes: compressed.outputSizeBytes ?? null
      });

      setStage('done');
      setStatus('Uploaded and queued for processing');
      setProgressPct(100);
      await refreshSubmissions();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      await trackEvent('video_upload_failed', session.user.id, {
        stage,
        error_message: message
      });
      setStage('failed');
      setStatus('Upload failed');
      setLastError(message);
      Alert.alert('Video upload failed', message);
    } finally {
      setBusy(false);
    }
  };

  const retryQueueForSubmission = async (submissionId: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      Alert.alert('Session missing', 'Please sign in again.');
      return;
    }

    try {
      setStatus('Requeueing submission...');
      await enqueueSubmission(submissionId, token);
      setStatus('Submission requeued');
      await refreshSubmissions();
    } catch (error) {
      Alert.alert('Requeue failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Video Pipeline</Text>
      <Text style={styles.subtitle}>Upload, retry, and queue videos for async analysis.</Text>

      <Card>
        <Text style={styles.label}>Current activity ID</Text>
        <Text style={styles.value}>{activityId || 'Missing - complete onboarding first'}</Text>
      </Card>

      <Card>
        <Text style={styles.label}>Selected video</Text>
        <Text style={styles.value}>{videoUri || 'None selected'}</Text>
        <Text style={styles.status}>Status: {status}</Text>
        <Text style={styles.status}>Progress: {progressPct}%</Text>
        {lastSubmissionId ? <Text style={styles.meta}>Last submission: {lastSubmissionId}</Text> : null}
        {lastError ? <Text style={styles.error}>Error: {lastError}</Text> : null}
      </Card>

      <View style={styles.row}>
        <Button title="Pick Video" onPress={pickVideo} disabled={busy} />
        <TouchableOpacity style={[styles.primary, busy ? styles.disabled : null]} onPress={runUpload} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? 'Working...' : 'Upload + Queue'}</Text>
        </TouchableOpacity>
        {canRetry ? (
          <TouchableOpacity style={styles.secondary} onPress={runUpload}>
            <Text style={styles.secondaryText}>Retry</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Card>
        <Text style={styles.label}>Recent submissions</Text>
        <FlatList
          data={submissions}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.submissionRow}>
              <View style={styles.submissionMeta}>
                <Text style={styles.submissionId}>{item.id.slice(0, 8)}</Text>
                <Text style={styles.submissionStatus}>{item.status}</Text>
                <Text style={styles.submissionTime}>{new Date(item.created_at).toLocaleString()}</Text>
                {jobsBySubmissionId[item.id] ? (
                  <>
                    <Text style={styles.queueMeta}>
                      Queue: {jobsBySubmissionId[item.id].status} • attempts {jobsBySubmissionId[item.id].attempts}/
                      {jobsBySubmissionId[item.id].max_attempts}
                    </Text>
                    {jobsBySubmissionId[item.id].next_run_at ? (
                      <Text style={styles.queueMeta}>
                        Next run: {new Date(jobsBySubmissionId[item.id].next_run_at as string).toLocaleString()}
                      </Text>
                    ) : null}
                    {jobsBySubmissionId[item.id].last_error ? (
                      <Text style={styles.queueError}>
                        {jobsBySubmissionId[item.id].last_error_code ?? 'processing_error'}: {jobsBySubmissionId[item.id].last_error}
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </View>
              {(item.status === 'failed' || item.status === 'uploaded') ? (
                <TouchableOpacity style={styles.secondary} onPress={() => retryQueueForSubmission(item.id)}>
                  <Text style={styles.secondaryText}>Requeue</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.meta}>No submissions yet.</Text>}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f6f9fc'
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#102a43'
  },
  subtitle: {
    color: '#627d98',
    marginBottom: 12
  },
  label: {
    fontSize: 12,
    color: '#627d98',
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  value: {
    marginTop: 4,
    color: '#102a43',
    fontWeight: '600'
  },
  meta: {
    marginTop: 6,
    color: '#486581'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
    flexWrap: 'wrap'
  },
  primary: {
    backgroundColor: '#0b3a53',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700'
  },
  secondary: {
    backgroundColor: '#e4e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  secondaryText: {
    color: '#243b53',
    fontWeight: '700'
  },
  disabled: {
    opacity: 0.6
  },
  status: {
    marginTop: 8,
    color: '#334e68'
  },
  error: {
    marginTop: 6,
    color: '#9f3a38'
  },
  submissionRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e4e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  submissionMeta: {
    flex: 1,
    paddingRight: 8
  },
  submissionId: {
    color: '#102a43',
    fontWeight: '700'
  },
  submissionStatus: {
    color: '#1f5f8b',
    marginTop: 2
  },
  submissionTime: {
    color: '#627d98',
    fontSize: 12,
    marginTop: 2
  },
  queueMeta: {
    color: '#486581',
    marginTop: 2,
    fontSize: 12
  },
  queueError: {
    color: '#9f3a38',
    marginTop: 2,
    fontSize: 12
  }
});
