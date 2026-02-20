import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { invokeFunction } from './src/lib/api';
import { supabase } from './src/lib/supabase';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { LegalConsentScreen } from './src/screens/LegalConsentScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { validateMobileEnv } from './src/types/env';

type Stage = 'auth' | 'legal' | 'onboarding' | 'map';

export default function App() {
  return (
    <AppErrorBoundary>
      <RootApp />
    </AppErrorBoundary>
  );
}

function RootApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [stage, setStage] = useState<Stage>('auth');
  const [envErrors] = useState<string[]>(validateMobileEnv());

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (!data.session) {
        setStage('auth');
        return;
      }

      try {
        const legal = await invokeFunction<{ accepted: boolean }>('legal-status', { method: 'GET' });
        if (!legal.accepted) {
          setStage('legal');
          return;
        }
      } catch {
        setStage('legal');
        return;
      }

      const { data: me } = await supabase.from('users').select('onboarding_complete').eq('id', data.session.user.id).maybeSingle();
      setStage(me?.onboarding_complete ? 'map' : 'onboarding');
    });

    const { data: authSub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setStage('auth');
        return;
      }
      try {
        const legal = await invokeFunction<{ accepted: boolean }>('legal-status', { method: 'GET' });
        if (!legal.accepted) {
          setStage('legal');
          return;
        }
      } catch {
        setStage('legal');
        return;
      }
      const { data: me } = await supabase.from('users').select('onboarding_complete').eq('id', nextSession.user.id).maybeSingle();
      setStage(me?.onboarding_complete ? 'map' : 'onboarding');
    });

    return () => authSub.subscription.unsubscribe();
  }, []);

  if (envErrors.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Missing Environment Variables</Text>
        {envErrors.map((key) => (
          <Text key={key} style={styles.item}>
            - {key}
          </Text>
        ))}
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
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
          const { data: me } = await supabase.from('users').select('onboarding_complete').eq('id', user.id).maybeSingle();
          setStage(me?.onboarding_complete ? 'map' : 'onboarding');
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
  }
});
