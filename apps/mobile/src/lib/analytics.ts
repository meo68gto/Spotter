/**
 * @spotter/analytics — PostHog analytics for Spotter.
 *
 * Mobile: initialise in app root via PostHogProvider.
 * Web: initialise in _app.tsx or PostHogProvider.
 *
 * Usage (mobile):
 *   import { posthog } from './lib/analytics';
 *   posthog.screen('MatchingScreen', { tier: 'select' });
 *
 * Usage (web):
 *   import { posthog } from '@spotter/analytics';
 *   posthog.capture('page_view', { page: 'home' });
 */

import { PostHog } from 'posthog-react-native';

const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com';

/**
 * Singleton PostHog instance for mobile.
 * Initialise once in the app root.
 */
export const posthog = new PostHog(posthogKey, {
  host: posthogHost,
  // Disable native bridge crash reporting if Sentry handles it
  enableNativeCrashReporting: false,
  // Batch events to reduce network chatter
  flushIntervalSeconds: 10,
  // Capture screen views automatically
  captureScreenViews: true,
  // Capture deep links
  captureDeepLinks: true,
  // iOS only: disable in simulators
  disableAutocapture: __DEV__,
});

/**
 * Identify a user after sign-in or sign-up.
 * Call this once per session when the user is known.
 */
export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  posthog.identify(userId, traits);
}

/**
 * Track any event.
 */
export function trackEvent(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}

/**
 * Track a screen view.
 */
export function trackScreen(name: string, properties?: Record<string, unknown>) {
  posthog.screen(name, properties);
}

/**
 * Reset (anon) user on sign-out.
 */
export function resetUser() {
  posthog.reset();
}
