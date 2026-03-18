import { useCallback, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { invokeFunction } from '../lib/api';

export type ThreadType = 'session' | 'engagement';

export type ThreadMessage = {
  id: string;
  sender_user_id: string;
  message: string;
  created_at: string;
  client_message_id?: string | null;
};

const sortByCreated = (rows: ThreadMessage[]) => [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

export function useInboxThreadMessages(session: Session, threadType: ThreadType, threadId: string) {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);

  const table = threadType === 'session' ? 'messages' : 'engagement_thread_messages';
  const fkColumn = threadType === 'session' ? 'session_id' : 'engagement_request_id';

  const load = useCallback(async () => {
    if (!threadId) return;
    setLoading(true);
    const { data } = await supabase
      .from(table as any)
      .select('id, sender_user_id, message, created_at, client_message_id')
      .eq(fkColumn, threadId)
      .order('created_at', { ascending: true })
      .limit(300);
    setMessages(sortByCreated((data ?? []) as ThreadMessage[]));
    setLoading(false);
  }, [fkColumn, table, threadId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`inbox-${threadType}-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table,
          filter: `${fkColumn}=eq.${threadId}`
        },
        (payload) => {
          const incoming = payload.new as ThreadMessage;
          setMessages((prev) => sortByCreated([...prev.filter((row) => row.id !== incoming.id), incoming]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fkColumn, table, threadId, threadType]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const clientMessageId = `${session.user.id}-${Date.now()}`;
    const optimistic: ThreadMessage = {
      id: `optimistic-${clientMessageId}`,
      sender_user_id: session.user.id,
      message: trimmed,
      created_at: new Date().toISOString(),
      client_message_id: clientMessageId
    };
    setMessages((prev) => sortByCreated([...prev, optimistic]));

    if (threadType === 'session') {
      const result = await invokeFunction<{ id: string; sender_user_id: string; message: string; created_at: string; client_message_id?: string }>('chat-send', {
        method: 'POST',
        body: {
          sessionId: threadId,
          message: trimmed,
          clientMessageId
        }
      });
      setMessages((prev) => sortByCreated(prev.filter((row) => row.id !== optimistic.id).concat(result as ThreadMessage)));
    } else {
      const result = await invokeFunction<{ id: string; sender_user_id: string; message: string; created_at: string; client_message_id?: string }>('engagement-chat-send', {
        method: 'POST',
        body: {
          engagementRequestId: threadId,
          message: trimmed,
          clientMessageId
        }
      });
      setMessages((prev) => sortByCreated(prev.filter((row) => row.id !== optimistic.id).concat(result as ThreadMessage)));
    }

    await invokeFunction('inbox-mark-read', {
      method: 'POST',
      body: {
        threadType,
        threadId,
        lastReadAt: new Date().toISOString()
      }
    });
  };

  const markRead = async () => {
    await invokeFunction('inbox-mark-read', {
      method: 'POST',
      body: {
        threadType,
        threadId,
        lastReadAt: new Date().toISOString()
      }
    });
  };

  return {
    loading,
    messages,
    send,
    markRead,
    unread: useMemo(() => messages.filter((row) => row.sender_user_id !== session.user.id).length, [messages, session.user.id])
  };
}
