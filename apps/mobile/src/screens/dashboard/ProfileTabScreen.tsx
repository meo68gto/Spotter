import { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import { ProfileScreen } from './profile/ProfileScreen';
import { EditProfileScreen } from './profile/EditProfileScreen';
import { SkillProfileScreen } from './profile/SkillProfileScreen';
import { MatchHistoryScreen } from './profile/MatchHistoryScreen';
import { VideoPipelineScreen } from './profile/VideoPipelineScreen';
import { SettingsScreen } from './profile/SettingsScreen';

type Stage = 'home' | 'edit' | 'skills' | 'history' | 'videos' | 'settings';

export function ProfileTabScreen({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [stage, setStage] = useState<Stage>('home');

  if (stage === 'edit') return <EditProfileScreen session={session} onBack={() => setStage('home')} />;
  if (stage === 'skills') return <SkillProfileScreen session={session} onBack={() => setStage('home')} />;
  if (stage === 'history') return <MatchHistoryScreen session={session} onBack={() => setStage('home')} />;
  if (stage === 'videos') return <VideoPipelineScreen session={session} onBack={() => setStage('home')} />;
  if (stage === 'settings') return <SettingsScreen session={session} onBack={() => setStage('home')} onSignOut={onSignOut} />;

  return <ProfileScreen session={session} onNavigate={(target) => setStage(target)} />;
}
