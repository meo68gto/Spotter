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
    <View style={[styles.container, { backgroundColor: tokens.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Button title="← Back" onPress={onBack} tone="ghost" />
        <Text style={[styles.title, { color: tokens.text }]}>Jobs Management</Text>
        <TouchableOpacity onPress={refreshJobs} disabled={isLoading}>
          <Text style={[styles.refreshButton, { color: tokens.primary }]}>
            {isLoading ? '⟳' : '↻'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>n        {/* Jobs List */}
        <Text style={[styles.sectionTitle, { color: tokens.textSecondary }]}>Scheduled Jobs</Text>

        {isLoading && jobs.length === 0 ? (
          <ActivityIndicator size="large" color={tokens.primary} />
        ) : error ? (
          <Text style={[styles.errorText, { color: tokens.error }]}>{error}</Text>
        ) : (
          <View style={styles.jobsList}>
            {jobs.map((job) => (
              <View
                key={job.id}
                style={[
                  styles.jobCard,
                  { backgroundColor: tokens.surface, borderColor: tokens.border },
                  selectedJob?.id === job.id && { borderColor: tokens.primary },
                ]}
              >
                <TouchableOpacity onPress={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}>
                  <View style={styles.jobHeader}>
                    <View style={styles.jobInfo}>
                      <Text style={[styles.jobName, { color: tokens.text }]}>
                        {job.name}
                      </Text>
                      <Text style={[styles.jobDescription, { color: tokens.textSecondary }]}>
                        {job.description}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusIndicator,
                        { backgroundColor: getStatusColor(job.lastStatus) + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusIcon,
                          { color: getStatusColor(job.lastStatus) },
                        ]}
                      >
                        {getStatusIcon(job.lastStatus)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.jobMeta}>
                    <View style={styles.metaItem}>
                      <Text style={[styles.metaLabel, { color: tokens.textMuted }]}>Schedule</Text>
                      <Text style={[styles.metaValue, { color: tokens.text }]}>
                        {formatCronSchedule(job.schedule)}
                      </Text>
                    </View>

                    <View style={styles.metaItem}>
                      <Text style={[styles.metaLabel, { color: tokens.textMuted }]}>Last Run</Text>
                      <Text style={[styles.metaValue, { color: tokens.text }]}>
                        {formatDate(job.lastRun)}
                      </Text>
                    </View>

                    <View style={styles.metaItem}>
                      <Text style={[styles.metaLabel, { color: tokens.textMuted }]}>Status</Text>
                      <Text
                        style={[
                          styles.metaValue,
                          { color: getStatusColor(job.lastStatus) },
                        ]}
                      >
                        {job.lastStatus || 'Never run'}
                      </Text>
                    </View>
                  </View>

                  {job.runCount !== undefined && (
                    <Text style={[styles.runCount, { color: tokens.textMuted }]}>
                      Total runs: {job.runCount}
                    </Text>
                  )}
                </TouchableOpacity>

                <View style={styles.jobActions}>
                  <Button
                    title={triggeringJob === job.id ? 'Triggering...' : 'Trigger Now'}
                    onPress={() => handleTriggerJob(job)}
                    disabled={triggeringJob === job.id || !job.enabled}
                    tone="secondary"
                    accessibilityLabel={`Trigger ${job.name}`}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Job Runs / Logs */}
        {selectedJob && (
          <View style={styles.logsSection}>
            <Text style={[styles.sectionTitle, { color: tokens.textSecondary }]}>
              Recent Runs: {selectedJob.name}
            </Text>

            <View style={styles.runsList}>
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
                  >
                    <View style={styles.runHeader}>
                      <Text
                        style={[
                          styles.runStatus,
                          { color: getStatusColor(run.status) },
                        ]}
                      >
                        {getStatusIcon(run.status)} {run.status.toUpperCase()}
                      </Text>
                      <Text style={[styles.runTrigger, { color: tokens.textMuted }]}>
                        {run.triggered_by === 'manual' ? '👤 Manual' : '⏰ Scheduled'}
                      </Text>
                    </View>

                    <Text style={[styles.runTime, { color: tokens.textSecondary }]}>
                      Started: {new Date(run.started_at).toLocaleString()}
                    </Text>

                    {run.completed_at && (
                      <Text style={[styles.runTime, { color: tokens.textSecondary }]}>
                        Completed: {new Date(run.completed_at).toLocaleString()}
                      </Text>
                    )}

                    {run.output && (
                      <View style={styles.outputBox}>
                        <Text style={[styles.outputLabel, { color: tokens.textMuted }]}>
                          Output:
                        </Text>
                        <Text
                          style={[styles.outputText, { color: tokens.text }]}
                          numberOfLines={5}
                        >
                          {run.output}
                        </Text>
                      </View>
                    )}

                    {run.error && (
                      <View style={[styles.errorBox, { backgroundColor: tokens.error + '10' }]}>
                        <Text style={[styles.errorLabel, { color: tokens.error }]}>
                          Error:
                        </Text>
                        <Text
                          style={[styles.errorText, { color: tokens.error }]}
                          numberOfLines={3}
                        >
                          {run.error}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}

              {jobRuns.filter((run) => run.job_id === selectedJob.id).length === 0 && (
                <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
                  No run history for this job
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={[styles.instructionsTitle, { color: tokens.text }]}>
            About Scheduled Jobs
          </Text>
          <Text style={[styles.instructionsText, { color: tokens.textSecondary }]}>
            • Jobs run automatically on their schedules{'\n'}
            • You can manually trigger jobs for immediate execution{'\n'}
            • All job runs are logged for audit purposes{'\n'}
            • Failed jobs will show error details in logs
          </Text>
        </View>
      </ScrollView>
    </View>
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