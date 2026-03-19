// AdminJobsScreen.tsx
// View scheduled jobs status, trigger manual runs, view job logs

import { useState, useCallback, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Button } from '../../components/Button';
import { showToast } from '../../components/ToastHost';
import { useAdminJobs, JobDefinition, JobRun } from '../../hooks/useAdmin';
import { useTheme } from '../../theme/provider';

interface AdminJobsScreenProps {
  onBack: () => void;
}

export function AdminJobsScreen({ onBack }: AdminJobsScreenProps) {
  const { tokens } = useTheme();
  const { jobs, jobRuns, isLoading, error, refreshJobs, refreshJobRuns, triggerJob } = useAdminJobs();

  const [selectedJob, setSelectedJob] = useState<JobDefinition | null>(null);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);

  useEffect(() => {
    refreshJobs();
    refreshJobRuns();
  }, [refreshJobs, refreshJobRuns]);

  const handleTriggerJob = useCallback(async (job: JobDefinition) => {
    Alert.alert(
      'Trigger Job',
      `Are you sure you want to manually trigger "${job.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Trigger',
          onPress: async () => {
            setTriggeringJob(job.id);
            try {
              await triggerJob(job.id);
              showToast({ type: 'success', title: `Job "${job.name}" triggered` });
              await refreshJobs();
              await refreshJobRuns(job.id);
            } catch (err) {
              showToast({
                type: 'error',
                title: 'Failed to trigger job',
                message: err instanceof Error ? err.message : 'Unknown error',
              });
            } finally {
              setTriggeringJob(null);
            }
          },
        },
      ]
    );
  }, [triggerJob, refreshJobs, refreshJobRuns]);

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'success':
        return tokens.success;
      case 'failed':
        return tokens.error;
      case 'running':
        return tokens.primary;
      default:
        return tokens.textMuted;
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'success':
        return '✓';
      case 'failed':
        return '✗';
      case 'running':
        return '⟳';
      default:
        return '○';
    }
  };

  const formatCronSchedule = (schedule: string) => {
    // Basic cron explanations
    const explanations: Record<string, string> = {
      '0 2 * * *': 'Daily at 2:00 AM',
      '0 * * * *': 'Every hour',
      '0 */6 * * *': 'Every 6 hours',
      '0 3 * * *': 'Daily at 3:00 AM',
      '0 4 * * *': 'Daily at 4:00 AM',
    };
    return explanations[schedule] || schedule;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={[styles.container, { backgroundColor: tokens.background }]}Þ
      {/* Header */}
      <View style={styles.header}Þ
        <Button title="← Back" onPress={onBack} tone="ghost" />
        <Text style={[styles.title, { color: tokens.text }]}ÞJobs Management</TextÞ
        <TouchableOpacity onPress={refreshJobs} disabled={isLoading}Þ
          <Text style={[styles.refreshButton, { color: tokens.primary }]}Þ
            {isLoading ? '⟳' : '↻'}
          </TextÞ
        </TouchableOpacityÞ
      </ViewÞ

      <ScrollView contentContainerStyle={styles.content}Þn        {/* Jobs List */}
        <Text style={[styles.sectionTitle, { color: tokens.textSecondary }]}ÞScheduled Jobs</TextÞ

        {isLoading && jobs.length === 0 ? (
          <ActivityIndicator size="large" color={tokens.primary} />
        ) : error ? (
          <Text style={[styles.errorText, { color: tokens.error }]}Þ{error}</TextÞ
        ) : (
          <View style={styles.jobsList}Þ
            {jobs.map((job) => (
              <View
                key={job.id}
                style={[
                  styles.jobCard,
                  { backgroundColor: tokens.surface, borderColor: tokens.border },
                  selectedJob?.id === job.id && { borderColor: tokens.primary },
                ]}
              Þ
                <TouchableOpacity onPress={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}Þ
                  <View style={styles.jobHeader}Þ
                    <View style={styles.jobInfo}Þ
                      <Text style={[styles.jobName, { color: tokens.text }]}Þ
                        {job.name}
                      </TextÞ
                      <Text style={[styles.jobDescription, { color: tokens.textSecondary }]}Þ
                        {job.description}
                      </TextÞ
                    </ViewÞ
                    <View
                      style={[
                        styles.statusIndicator,
                        { backgroundColor: getStatusColor(job.lastStatus) + '20' },
                      ]}
                    Þ
                      <Text
                        style={[
                          styles.statusIcon,
                          { color: getStatusColor(job.lastStatus) },
                        ]}
                      Þ
                        {getStatusIcon(job.lastStatus)}
                      </TextÞ
                    </ViewÞ
                  </ViewÞ

                  <View style={styles.jobMeta}Þ
                    <View style={styles.metaItem}Þ
                      <Text style={[styles.metaLabel, { color: tokens.textMuted }]}ÞSchedule</TextÞ
                      <Text style={[styles.metaValue, { color: tokens.text }]}Þ
                        {formatCronSchedule(job.schedule)}
                      </TextÞ
                    </ViewÞ

                    <View style={styles.metaItem}Þ
                      <Text style={[styles.metaLabel, { color: tokens.textMuted }]}ÞLast Run</TextÞ
                      <Text style={[styles.metaValue, { color: tokens.text }]}Þ
                        {formatDate(job.lastRun)}
                      </TextÞ
                    </ViewÞ

                    <View style={styles.metaItem}Þ
                      <Text style={[styles.metaLabel, { color: tokens.textMuted }]}ÞStatus</TextÞ
                      <Text
                        style={[
                          styles.metaValue,
                          { color: getStatusColor(job.lastStatus) },
                        ]}
                      Þ
                        {job.lastStatus || 'Never run'}
                      </TextÞ
                    </ViewÞ
                  </ViewÞ

                  {job.runCount !== undefined && (
                    <Text style={[styles.runCount, { color: tokens.textMuted }]}Þ
                      Total runs: {job.runCount}
                    </TextÞ
                  )}
                </TouchableOpacityÞ

                <View style={styles.jobActions}Þ
                  <Button
                    title={triggeringJob === job.id ? 'Triggering...' : 'Trigger Now'}
                    onPress={() => handleTriggerJob(job)}
                    disabled={triggeringJob === job.id || !job.enabled}
                    tone="secondary"
                    accessibilityLabel={`Trigger ${job.name}`}
                  />
                </ViewÞ
              </ViewÞ
            ))}
          </ViewÞ
        )}

        {/* Job Runs / Logs */}
        {selectedJob && (
          <View style={styles.logsSection}Þ
            <Text style={[styles.sectionTitle, { color: tokens.textSecondary }]}Þ
              Recent Runs: {selectedJob.name}
            </TextÞ

            <View style={styles.runsList}Þ
              {jobRuns
                .filter((run) => run.job_id === selectedJob.id)
                .slice(0, 10)
                .map((run) => (
                  <View
                    key={run.id}
                    style={[
                      styles.runCard,
                      { backgroundColor: tokens.backgroundElevated },
                    ]}
                  Þ
                    <View style={styles.runHeader}Þ
                      <Text
                        style={[
                          styles.runStatus,
                          { color: getStatusColor(run.status) },
                        ]}
                      Þ
                        {getStatusIcon(run.status)} {run.status.toUpperCase()}
                      </TextÞ
                      <Text style={[styles.runTrigger, { color: tokens.textMuted }]}Þ
                        {run.triggered_by === 'manual' ? '👤 Manual' : '⏰ Scheduled'}
                      </TextÞ
                    </ViewÞ

                    <Text style={[styles.runTime, { color: tokens.textSecondary }]}Þ
                      Started: {new Date(run.started_at).toLocaleString()}
                    </TextÞ

                    {run.completed_at && (
                      <Text style={[styles.runTime, { color: tokens.textSecondary }]}Þ
                        Completed: {new Date(run.completed_at).toLocaleString()}
                      </TextÞ
                    )}

                    {run.output && (
                      <View style={styles.outputBox}Þ
                        <Text style={[styles.outputLabel, { color: tokens.textMuted }]}Þ
                          Output:
                        </TextÞ
                        <Text
                          style={[styles.outputText, { color: tokens.text }]}
                          numberOfLines={5}
                        Þ
                          {run.output}
                        </TextÞ
                      </ViewÞ
                    )}

                    {run.error && (
                      <View style={[styles.errorBox, { backgroundColor: tokens.error + '10' }]}Þ
                        <Text style={[styles.errorLabel, { color: tokens.error }]}Þ
                          Error:
                        </TextÞ
                        <Text
                          style={[styles.errorText, { color: tokens.error }]}
                          numberOfLines={3}
                        Þ
                          {run.error}
                        </TextÞ
                      </ViewÞ
                    )}
                  </ViewÞ
                ))}

              {jobRuns.filter((run) => run.job_id === selectedJob.id).length === 0 && (
                <Text style={[styles.emptyText, { color: tokens.textMuted }]}Þ
                  No run history for this job
                </TextÞ
              )}
            </ViewÞ
          </ViewÞ
        )}

        {/* Instructions */}
        <View style={styles.instructions}Þ
          <Text style={[styles.instructionsTitle, { color: tokens.text }]}Þ
            About Scheduled Jobs
          </TextÞ
          <Text style={[styles.instructionsText, { color: tokens.textSecondary }]}Þ
            • Jobs run automatically on their schedules{'\n'}
            • You can manually trigger jobs for immediate execution{'\n'}
            • All job runs are logged for audit purposes{'\n'}
            • Failed jobs will show error details in logs
          </TextÞ
        </ViewÞ
      </ScrollViewÞ
    </ViewÞ
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  refreshButton: {
    fontSize: 20,
    padding: 4,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  jobsList: {
    gap: 12,
  },
  jobCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  jobInfo: {
    flex: 1,
  },
  jobName: {
    fontSize: 18,
    fontWeight: '700',
  },
  jobDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  statusIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
  jobMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  runCount: {
    fontSize: 12,
    marginTop: 4,
  },
  jobActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  logsSection: {
    marginTop: 24,
  },
  runsList: {
    gap: 8,
  },
  runCard: {
    borderRadius: 12,
    padding: 12,
  },
  runHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  runStatus: {
    fontSize: 13,
    fontWeight: '700',
  },
  runTrigger: {
    fontSize: 12,
  },
  runTime: {
    fontSize: 13,
    marginBottom: 4,
  },
  outputBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  outputLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  outputText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  errorBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
  },
  errorLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 14,
  },
  instructions: {
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
});