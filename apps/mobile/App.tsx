import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { StyleSheet, Text, View } from 'react-native';
import { StripeProvider } from '@stripe/stripe-react-native';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { Button } from './src/components/Button';
import { invokeFunction } from './src/lib/api';
import { trackEvent } from './src/lib/analytics';
import { supabase } from './src/lib/supabase';
import { isWeb } from './src/theme/design';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen, DeepLinkTarget } from './src/screens/DashboardScreen';
import { LegalConsentScreen } from './src/screens/LegalConsentScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { env, validateMobileEnv } from './src/types/env';

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
  const [demoMode, setDemoMode] = useState(false);
  const [stage, setStage] = useState<Stage>('auth');
  const [deepLinkTarget, setDeepLinkTarget] = useState<DeepLinkTarget | null>(null);
  const [envErrors] = useState<string[]>(validateMobileEnv());

  const parseTarget = (url: string | null): DeepLinkTarget | null => {
    if (!url) return null;
    const parsed = Linking.parse(url);
    const rawPath = ((parsed.path ?? parsed.hostname ?? '') as string).replace(/^\/+/, '').toLowerCase();
    if (rawPath === 'home') return 'home';
    if (rawPath === 'discover') return 'discover';
    if (rawPath === 'ask') return 'ask';
    if (rawPath === 'requests') return 'requests';
    if (rawPath === 'sessions') return 'sessions';
    if (rawPath === 'coaches') return 'coaches';
    if (rawPath === 'matches') return 'matches';
    return null;
  };

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

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      const parsed = parseTarget(url);
      if (parsed) setDeepLinkTarget(parsed);
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      const parsed = parseTarget(url);
      if (parsed) setDeepLinkTarget(parsed);
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (!data.session) {
        await trackEvent('session_restore_failure', 'anonymous', { reason: 'missing_session' });
        setStage('auth');
        return;
      }
      await trackEvent('session_restore_success', data.session.user.id);

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
        await trackEvent('session_restore_failure', 'anonymous', { reason: 'auth_state_no_session' });
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

    return () => {
      sub.remove();
      authSub.subscription.unsubscribe();
    };
  }, []);

  if (envErrors.length) {
    if (demoMode) {
      return <DashboardScreen session={demoSession} onSignOut={() => setDemoMode(false)} deepLinkTarget={deepLinkTarget} />;
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
      return <DashboardScreen session={demoSession} onSignOut={() => setDemoMode(false)} deepLinkTarget={deepLinkTarget} />;
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
          const { data: me } = await supabase.from('users').select('onboarding_complete').eq('id', user.id).maybeSingle();
          setStage(me?.onboarding_complete ? 'map' : 'onboarding');
        }}
      />
    );
  }

  if (stage === 'onboarding') {
    return <OnboardingScreen onComplete={() => setStage('map')} />;
  }

  const app = <DashboardScreen session={session} onSignOut={() => supabase.auth.signOut()} deepLinkTarget={deepLinkTarget} />;
  if (isWeb) return app;
  return <StripeProvider publishableKey={env.stripePublishableKey}>{app}</StripeProvider>;
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
