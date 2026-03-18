import { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import { ConversationsListScreen } from './inbox/ConversationsListScreen';
import { ChatScreen } from './inbox/ChatScreen';
import { NotificationsScreen } from './inbox/NotificationsScreen';
import { InboxThread } from '../../hooks/useInboxThreads';

type View =
  | { kind: 'list' }
  | { kind: 'chat'; thread: InboxThread }
  | { kind: 'notifications' };

export function InboxTabScreen({ session }: { session: Session }) {
  const [view, setView] = useState<View>({ kind: 'list' });

  if (view.kind === 'chat') {
    return (
      <ChatScreen
        session={session}
        threadType={view.thread.threadType}
        threadId={view.thread.threadId}
        title={view.thread.title}
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  if (view.kind === 'notifications') {
    return <NotificationsScreen session={session} onBack={() => setView({ kind: 'list' })} />;
  }

  return (
    <ConversationsListScreen
      onOpenThread={(thread) => setView({ kind: 'chat', thread })}
      onOpenNotifications={() => setView({ kind: 'notifications' })}
    />
  );
}
