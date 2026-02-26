import { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { Button } from './src/components/Button';
import { invokeFunction } from './src/lib/api';
import { supabase } from './src/lib/supabase';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { LegalConsentScreen } from './src/screens/LegalConsentScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { validateMobileEnv } from './src/types/env';

type Stage = 'auth' | 'legal' | 'onboarding' | 'map';

// m-7: demoSession moved to module-level constant (not re-created on every render)
const demoSession: Session = {
  access_token: 'demo-access-token',
  refresh_token: 'demo-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: {
    id: 'demo-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'demo@spotter.app',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { name: 'Spotter Demo User' },
    created_at: new Date().toISOString()
  }
};

export default function App() {
  return (
    <AppErrorBoundary>
      <RootApp />
    </AppErrorBoundary>
  );
}

function RootApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [stage, setStage] = useState<Stage>('auth');
  const [envErrors] = useState<string[]>(validateMobileEnv());

  // C-7: Extracted resolveStage — replaces triplicated auth navigation logic
  const resolveStage = useCallback(async (nextSession: Session) => {
    try {
      const legal = await invokeFunction<{ accepted: boolean }>('legal-status', { method: 'GET' });
      if (!legal.accepted) { setStage('legal'); return; }
    } catch {
      setStage('legal'); return;
    }
    const { data: me } = await supabase
      .from('users')
      .select('onboarding_complete')
      .eq('id', nextSession.user.id)
      .maybeSingle();
    setStage(me?.onboarding_complete ? 'map' : 'onboarding');
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (!data.session) {
        setStage('auth');
        return;
      }
      await resolveStage(data.session);
    });

    const { data: authSub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setStage('auth');
        return;
      }
      await resolveStage(nextSession);
    });

    return () => authSub.subscription.unsubscribe();
  }, [resolveStage]);

  if (envErrors.length) {
    if (demoMode) {
      return <DashboardScreen session={demoSession} onSignOut={() => setDemoMode(false)} />;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Missing Environment Variables</Text>
        {envErrors.map((key) => (
          <Text key={key} style={styles.item}>
            - {key}
          </Text>
        ))}
        <View style={styles.actions}>
          <Button title="Continue in Demo Mode" onPress={() => setDemoMode(true)} />
        </View>
      </View>
    );
  }

  if (!session) {
    if (demoMode) {
      return <DashboardScreen session={demoSession} onSignOut={() => setDemoMode(false)} />;
    }
    return <AuthScreen onDemoMode={() => setDemoMode(true)} />;
  }

  if (stage === 'legal') {
    return (
      <LegalConsentScreen
        onAccepted={async () => {
          const user = (await supabase.auth.getUser()).data.user;
          if (!user) {
            setStage('auth');
            return;
          }
          // C-7: Re-use resolveStage after legal acceptance
          await resolveStage(session);
        }}
      />
    );
  }

  if (stage === 'onboarding') {
    return <OnboardingScreen onComplete={() => setStage('map')} />;
  }

  return <DashboardScreen session={session} onSignOut={() => supabase.auth.signOut()} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#f6f9fc'
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
    color: '#102a43'
  },
  item: {
    color: '#334e68',
    marginBottom: 4
  },
  actions: {
    marginTop: 18
  }
});
