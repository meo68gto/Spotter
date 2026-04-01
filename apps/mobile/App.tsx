import { Session } from '@supabase/supabase-js';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { Platform, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
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
import { BIPAConsentScreen } from './src/screens/onboarding/BIPAConsentScreen';
import { GuestFlow } from './src/screens/guest';
import { ThemeProvider } from './src/theme/provider';
import { env, validateMobileEnv } from './src/types/env';

type Stage = 'splash' | 'welcome' | 'login' | 'signup' | 'legal' | 'bipa' | 'onboarding' | 'dashboard' | 'guest';

type ParseTargetResult = {
  authStage?: Extract<Stage, 'welcome' | 'login' | 'signup' | 'guest'>;
  tabTarget?: DeepLinkTarget;
  verificationToken?: string;
};

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
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [envErrors] = useState<string[]>(validateMobileEnv());

  /** Persists across BIPA stage so we can pass dynamic isIllinois/locationDenied to BIPAConsentScreen */
  const [bipaState, setBipaState] = useState<{ isIllinois: boolean; locationDenied: boolean }>({
    isIllinois: false,
    locationDenied: true, // worst-case default: show BIPA to all until we know better
  });

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

  const parseTarget = useCallback((url: string | null): ParseTargetResult => {
    if (!url) return {};
    const parsed = Linking.parse(url);
    const rawPath = ((parsed.path ?? parsed.hostname ?? '') as string).replace(/^\/+/, '').toLowerCase();

    if (rawPath === 'welcome') return { authStage: 'welcome' };
    if (rawPath === 'login') return { authStage: 'login' };
    if (rawPath === 'signup') return { authStage: 'signup' };

    if (rawPath === 'home') return { tabTarget: 'home' };
    if (rawPath === 'feed') return { tabTarget: 'feed' };
    if (rawPath === 'coaching' || rawPath.startsWith('coaching/')) return { tabTarget: 'coaching' };
    if (rawPath === 'ask') return { tabTarget: 'ask' };
    if (rawPath === 'requests') return { tabTarget: 'requests' };
    if (rawPath === 'sessions') return { tabTarget: 'sessions' };
    if (rawPath === 'profile') return { tabTarget: 'profile' };
    if (rawPath === 'network') return { tabTarget: 'network' };
    if (rawPath === 'rounds' || rawPath.startsWith('rounds/')) return { tabTarget: 'rounds' };
    // EPIC 14: Guest verification deep link
    if (rawPath === 'verify') return { authStage: 'guest', verificationToken: parsed.queryParams?.token as string };
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

    // BIPA check: after legal accepted, check if BIPA consent is required
    // (Illinois user OR location was denied — worst-case: treat all denied-location users as Illinois)
    try {
      const bipa = await invokeFunction<{
        bipa_required: boolean;
        bipa_accepted: boolean;
        is_illinois: boolean;
        location_denied: boolean;
      }>('bipa-status', { method: 'GET' });
      if (bipa.bipa_required && !bipa.bipa_accepted) {
        // Capture state for use when rendering the BIPAConsentScreen
        setBipaState({ isIllinois: bipa.is_illinois, locationDenied: bipa.location_denied });
        return 'bipa';
      }
    } catch {
      // If bipa-status fails, proceed to dashboard — don't block on a BIPA check error
      // BIPA blocking is best-effort; the app will still be functional
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
      if (initial.verificationToken) setVerificationToken(initial.verificationToken);

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
      if (target.verificationToken) setVerificationToken(target.verificationToken);
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

  // CRITICAL: In production, any env error is fatal — demo mode must never be available.
  // Only __DEV__ builds may continue in demo mode for local exploration.
  if (envErrors.length) {
    if (__DEV__ && demoMode) {
      return (
        <>
          <DemoModeBanner onDismiss={() => setDemoMode(false)} />
          <DashboardScreen session={demoSession} onSignOut={() => setDemoMode(false)} deepLinkTarget={deepLinkTarget} />
        </>
      );
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Missing Environment Variables</Text>
        {envErrors.map((key) => (
          <Text key={key} style={styles.item}>
            - {key}
          </Text>
        ))}
        {__DEV__ && (
          <View style={styles.actions}>
            <Button title="Continue in Demo Mode" onPress={() => setDemoMode(true)} />
            {sentryEnabled ? (
              <Button
                title="Crash Test (Sentry)"
                tone="secondary"
                onPress={() => {
                  throw new Error('Sentry crash smoke test from env error screen');
                }}
              />
            ) : null}
          </View>
        )}
      </View>
    );
  }

  if (!session) {
    // Demo mode only allowed in __DEV__ builds
    if (__DEV__ && demoMode) {
      return (
        <>
          <DemoModeBanner onDismiss={() => setDemoMode(false)} />
          <DashboardScreen session={demoSession} onSignOut={() => setDemoMode(false)} deepLinkTarget={deepLinkTarget} />
        </>
      );
    }

    if (stage === 'splash') return <SplashScreen subtitle="Loading Spotter" />;
    if (stage === 'login') return <LoginScreen onSwitchToSignUp={() => setStage('signup')} onDemoMode={__DEV__ ? () => setDemoMode(true) : undefined} />;
    if (stage === 'signup') return <SignUpScreen onSwitchToLogin={() => setStage('login')} />;
    if (stage === 'guest') return (
      <GuestFlow
        onSignIn={() => setStage('login')}
        onComplete={() => setStage('welcome')}
        initialVerificationToken={verificationToken || undefined}
      />
    );
    return <WelcomeScreen onLogin={() => setStage('login')} onSignUp={() => setStage('signup')} onDemoMode={__DEV__ ? () => setDemoMode(true) : undefined} onGuestBrowse={() => setStage('guest')} />;
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
          // After accepting legal, immediately check BIPA status
          // to determine whether to show the bipa screen next
          setStage('onboarding');
        }}
      />
    );
  }

  if (stage === 'bipa') {
    return (
      <BIPAConsentScreen
        isIllinois={bipaState.isIllinois}
        locationDenied={bipaState.locationDenied}
        onComplete={async () => {
          const { data: me } = await supabase.from('users').select('onboarding_complete').eq('id', session.user.id).maybeSingle();
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

/**
 * Demo session for development-only exploration mode.
 * This session is only accessible in __DEV__ builds.
 * NEVER shipped to production.
 */
const demoSession: Session = {
  access_token: 'dev-only-demo-access-token',
  refresh_token: 'dev-only-demo-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: {
    id: 'dev-demo-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'demo@spotter.app',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { name: 'Spotter Demo User' },
    created_at: new Date().toISOString()
  }
};

/**
 * Persistent banner shown when the app is running in demo mode.
 * Only rendered in __DEV__ builds. Clearly identifies demo state
 * to prevent users mistaking demo data for real data.
 */
function DemoModeBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <View style={demoBannerStyles.container}>
      <Text style={demoBannerStyles.text}>🧪 DEMO MODE — Data is simulated, not real</Text>
      <TouchableOpacity onPress={onDismiss} accessibilityLabel="Dismiss demo banner">
        <Text style={demoBannerStyles.dismiss}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const demoBannerStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  dismiss: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 8,
  },
});

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
