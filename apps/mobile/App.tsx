import { Session } from '@supabase/supabase-js';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { Button } from './src/components/Button';
import { ToastHost } from './src/components/ToastHost';
import { invokeFunction } from './src/lib/api';
import { trackEvent } from './src/lib/analytics';
import { supabase } from './src/lib/supabase';
import { SplashScreen } from './src/screens/auth/SplashScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { SignUpScreen } from './src/screens/auth/SignUpScreen';
import { WelcomeScreen } from './src/screens/auth/WelcomeScreen';
import { DashboardScreen, DeepLinkTarget } from './src/screens/DashboardScreen';
import { LegalConsentScreen } from './src/screens/LegalConsentScreen';
import { OnboardingWizardScreenPhase1 } from './src/screens/onboarding/OnboardingWizardScreenPhase1';
import { ThemeProvider } from './src/theme/provider';
import { env, validateMobileEnv } from './src/types/env';

type Stage = 'splash' | 'welcome' | 'login' | 'signup' | 'legal' | 'onboarding' | 'dashboard';

const SPLASH_MIN_MS = 900;
const sentryEnabled = Boolean(env.sentryDsnMobile);
const WebStripeProvider = ({ children }: { publishableKey: string; children: ReactNode }) => <>{children}</>;
const StripeProvider =
  Platform.OS === 'web'
    ? WebStripeProvider
    : (eval('require')('@stripe/stripe-react-native').StripeProvider as React.ComponentType<{
        publishableKey: string;
        children: ReactNode;
      }>);

if (sentryEnabled && !Sentry.getClient()) {
  Sentry.init({
    dsn: env.sentryDsnMobile,
    enabled: true,
    tracesSampleRate: 0.1,
    environment: process.env.EXPO_PUBLIC_FLAG_ENVIRONMENT ?? 'local'
  });
}

export default function App() {
  return (
    <AppErrorBoundary contextTag="root">
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <ToastHost>
            <RootApp />
          </ToastHost>
        </ThemeProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

function RootApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [stage, setStage] = useState<Stage>('splash');
  const [deepLinkTarget, setDeepLinkTarget] = useState<DeepLinkTarget | null>(null);
  const [envErrors] = useState<string[]>(validateMobileEnv());

  useEffect(() => {
    if (!sentryEnabled) return;
    Sentry.setTag('stage', stage);
  }, [stage]);

  useEffect(() => {
    if (!sentryEnabled) return;
    if (!session) {
      Sentry.setUser(null);
      return;
    }
    Sentry.setUser({
      id: session.user.id,
      email: session.user.email
    });
  }, [session]);

  const parseTarget = useCallback((url: string | null): { authStage?: Extract<Stage, 'welcome' | 'login' | 'signup'>; tabTarget?: DeepLinkTarget } => {
    if (!url) return {};
    const parsed = Linking.parse(url);
    const rawPath = ((parsed.path ?? parsed.hostname ?? '') as string).replace(/^\/+/, '').toLowerCase();

    if (rawPath === 'welcome') return { authStage: 'welcome' };
    if (rawPath === 'login') return { authStage: 'login' };
    if (rawPath === 'signup') return { authStage: 'signup' };

    if (rawPath === 'home') return { tabTarget: 'home' };
    if (rawPath === 'coaching' || rawPath.startsWith('coaching/')) return { tabTarget: 'coaching' };
    if (rawPath === 'ask') return { tabTarget: 'ask' };
    if (rawPath === 'requests') return { tabTarget: 'requests' };
    if (rawPath === 'sessions') return { tabTarget: 'sessions' };
    if (rawPath === 'profile') return { tabTarget: 'profile' };
    if (rawPath === 'network') return { tabTarget: 'network' };
    if (rawPath === 'rounds' || rawPath.startsWith('rounds/')) return { tabTarget: 'rounds' };
    return {};
  }, []);

  const resolveStageForSession = useCallback(async (activeSession: Session | null): Promise<Stage> => {
    if (!activeSession) return 'welcome';
    try {
      const legal = await invokeFunction<{ accepted: boolean }>('legal-status', { method: 'GET' });
      if (!legal.accepted) return 'legal';
    } catch {
      return 'legal';
    }

    const { data: me } = await supabase.from('users').select('onboarding_complete').eq('id', activeSession.user.id).maybeSingle();
    return me?.onboarding_complete ? 'dashboard' : 'onboarding';
  }, []);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      const startedAt = Date.now();
      const initial = parseTarget(await Linking.getInitialURL());
      if (initial.tabTarget) setDeepLinkTarget(initial.tabTarget);

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);

      if (!data.session) {
        await trackEvent('session_restore_failure', 'anonymous', { reason: 'missing_session' });
      } else {
        await trackEvent('session_restore_success', data.session.user.id);
      }

      const nextStage = (initial.authStage && !data.session ? initial.authStage : await resolveStageForSession(data.session)) as Stage;
      const elapsed = Date.now() - startedAt;
      if (elapsed < SPLASH_MIN_MS) {
        await new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_MS - elapsed));
      }
      if (mounted) setStage(nextStage);
    };

    hydrate();

    const linkSub = Linking.addEventListener('url', async ({ url }) => {
      const target = parseTarget(url);
      if (target.tabTarget) setDeepLinkTarget(target.tabTarget);
      if (target.authStage) {
        const current = await supabase.auth.getSession();
        if (!current.data.session) setStage(target.authStage);
      }
    });

    const { data: authSub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        await trackEvent('session_restore_failure', 'anonymous', { reason: 'auth_state_no_session' });
        setStage('welcome');
        return;
      }
      const nextStage = await resolveStageForSession(nextSession);
      setStage(nextStage);
    });

    return () => {
      mounted = false;
      linkSub.remove();
      authSub.subscription.unsubscribe();
    };
  }, [parseTarget, resolveStageForSession]);

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
          {__DEV__ && sentryEnabled ? (
            <Button
              title="Crash Test (Sentry)"
              tone="secondary"
              onPress={() => {
                throw new Error('Sentry crash smoke test from env error screen');
              }}
            />
          ) : null}
        </View>
      </View>
    );
  }

  if (!session) {
    if (demoMode) {
      return <DashboardScreen session={demoSession} onSignOut={() => setDemoMode(false)} deepLinkTarget={deepLinkTarget} />;
    }

    if (stage === 'splash') return <SplashScreen subtitle="Loading Spotter" />;
    if (stage === 'login') return <LoginScreen onSwitchToSignUp={() => setStage('signup')} onDemoMode={() => setDemoMode(true)} />;
    if (stage === 'signup') return <SignUpScreen onSwitchToLogin={() => setStage('login')} />;
    return <WelcomeScreen onLogin={() => setStage('login')} onSignUp={() => setStage('signup')} onDemoMode={() => setDemoMode(true)} />;
  }

  if (stage === 'splash') return <SplashScreen />;

  if (stage === 'legal') {
    return (
      <LegalConsentScreen
        onAccepted={async () => {
          const activeUser = (await supabase.auth.getUser()).data.user;
          if (!activeUser) {
            setStage('welcome');
            return;
          }
          const { data: me } = await supabase.from('users').select('onboarding_complete').eq('id', activeUser.id).maybeSingle();
          setStage(me?.onboarding_complete ? 'dashboard' : 'onboarding');
        }}
      />
    );
  }

  if (stage === 'onboarding') {
    return <OnboardingWizardScreenPhase1 onComplete={() => setStage('dashboard')} />;
  }

  const app = <DashboardScreen session={session} onSignOut={() => supabase.auth.signOut()} deepLinkTarget={deepLinkTarget} />;
  return <StripeProvider publishableKey={env.stripePublishableKey}>{app}</StripeProvider>;
}

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
