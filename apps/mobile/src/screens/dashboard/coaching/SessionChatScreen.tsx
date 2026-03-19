import { Session } from '@supabase/supabase-js';
import { ChatScreen } from '../inbox/ChatScreen';

export function SessionChatScreen({ session, sessionId, onBack }: { session: Session; sessionId: string; onBack: () => void }) {
  return <ChatScreen session={session} threadType="session" threadId={sessionId} title={`Session ${sessionId.slice(0, 8)}`} onBack={onBack} />;
}
