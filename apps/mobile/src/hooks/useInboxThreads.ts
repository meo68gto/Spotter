import { useCallback, useEffect, useState } from 'react';
import { invokeFunction } from '../lib/api';

export type InboxThread = {
  threadType: 'session' | 'engagement';
  threadId: string;
  title: string;
  status: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

export function useInboxThreads() {
  const [loading, setLoading] = useState(false);
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await invokeFunction<{ data: InboxThread[]; nextCursor?: string | null }>('inbox-conversations', {
      method: 'POST',
      body: { limit: 30 }
    });
    setThreads(data.data ?? []);
    setCursor(data.nextCursor ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { loading, threads, cursor, refresh };
}
