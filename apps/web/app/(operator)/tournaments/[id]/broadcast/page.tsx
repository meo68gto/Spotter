'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BroadcastRecord {
  id: string;
  tournament_id: string;
  organizer_id: string;
  subject: string;
  body: string;
  recipient_count: number;
  successful_count: number;
  failed_count: number;
  errors: string | null;
  sent_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BroadcastPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    message: string;
    totalRecipients?: number;
    successful?: number;
    failed?: number;
    errors?: string[];
  } | null>(null);
  const [history, setHistory] = useState<BroadcastRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch history
  // ---------------------------------------------------------------------------

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/operator/tournaments/${tournamentId}/broadcast`);
      if (!res.ok) throw new Error('Failed to load history');
      const data = await res.json();
      setHistory(data.history ?? []);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setHistoryLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ---------------------------------------------------------------------------
  // Send
  // ---------------------------------------------------------------------------

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setSendResult({
        success: false,
        message: 'Please fill in both title and message.',
      });
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const res = await fetch(`/api/operator/tournaments/${tournamentId}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSendResult({ success: false, message: data.error ?? 'Send failed' });
        return;
      }

      setSendResult({
        success: true,
        message: 'Broadcast sent successfully!',
        totalRecipients: data.totalRecipients,
        successful: data.successful,
        failed: data.failed,
        errors: data.errors,
      });
      setTitle('');
      setBody('');
      // Refresh history
      await fetchHistory();
    } catch (err) {
      setSendResult({
        success: false,
        message: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setSending(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8 p-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/tournaments" className="hover:text-gray-700">Tournaments</Link>
        <span>/</span>
        <span className="text-gray-900">Broadcast</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">In-Event Broadcast</h1>
        <p className="text-gray-500 mt-1">
          Send announcements to all registered players via email.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: composer */}
        <div className="lg:col-span-3 space-y-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Compose Message</h2>
            </div>
            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Subject Line <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Weather Update — Tee time moving to 9 AM"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400"
                  maxLength={200}
                  disabled={sending}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/200</p>
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message to all registrants here. You can include important updates, schedule changes, or announcements..."
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400 resize-none"
                  disabled={sending}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{body.length} chars</p>
              </div>

              {/* Preview tip */}
              <div className="flex items-start gap-2 p-3 bg-indigo-50 rounded-lg text-xs text-indigo-700">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  This message will be sent via email to <strong>all confirmed registrants</strong> for this tournament.
                  Use for urgent updates only — keep it clear and actionable.
                </span>
              </div>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={sending || !title.trim() || !body.trim()}
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? (
                  <>
                    <svg className="w-5 h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8m-9 4l9-2m-9 4l9 2" />
                    </svg>
                    Send Broadcast Now
                  </>
                )}
              </button>

              {/* Result */}
              {sendResult && (
                <div
                  className={`rounded-lg p-4 text-sm ${
                    sendResult.success
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}
                >
                  <p className="font-medium">{sendResult.message}</p>
                  {sendResult.success && sendResult.totalRecipients != null && (
                    <ul className="mt-2 space-y-1 text-xs">
                      <li>• Recipients: {sendResult.totalRecipients}</li>
                      <li>• Successful: {sendResult.successful ?? 0}</li>
                      {(sendResult.failed ?? 0) > 0 && <li className="text-red-600">• Failed: {sendResult.failed}</li>}
                      {sendResult.errors && sendResult.errors.length > 0 && (
                        <li className="text-red-600">• Errors: {sendResult.errors.slice(0, 3).join('; ')}</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: history */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Broadcast History</h2>
              <button
                onClick={fetchHistory}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                title="Refresh"
              >
                <svg className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {historyLoading && (
                <div className="p-6 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse space-y-1.5">
                      <div className="h-3 bg-gray-200 rounded w-3/4" />
                      <div className="h-2 bg-gray-100 rounded w-1/2" />
                      <div className="h-2 bg-gray-100 rounded w-1/3" />
                    </div>
                  ))}
                </div>
              )}

              {!historyLoading && historyError && (
                <div className="p-4 text-xs text-red-600">{historyError}</div>
              )}

              {!historyLoading && !historyError && history.length === 0 && (
                <div className="py-10 text-center text-gray-400 text-sm">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  No broadcasts sent yet
                </div>
              )}

              {!historyLoading && !historyError && history.map((record) => (
                <div key={record.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                    {record.subject}
                  </p>
                  <p className="text-xs text-gray-500 mt-1.5">
                    {fmtDateTime(record.sent_at)}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="inline-flex items-center text-xs text-gray-500">
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      {record.recipient_count} sent
                    </span>
                    {record.failed_count > 0 && (
                      <span className="text-xs text-red-500">{record.failed_count} failed</span>
                    )}
                    {record.failed_count === 0 && (
                      <span className="text-xs text-green-600">All delivered</span>
                    )}
                  </div>
                  {record.body && (
                    <p className="text-xs text-gray-400 mt-2 line-clamp-2 italic">
                      {record.body.replace(/<[^>]+>/g, '').substring(0, 100)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
