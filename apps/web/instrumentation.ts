/**
 * Sentry instrumentation for web.
 * Initializes Sentry for error tracking and performance monitoring.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Re-play for session replay debugging
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0,

  // Re-play for error sessions
  replaysOnErrorSampleRate: 1.0,

  // Environment
  environment: process.env.NODE_ENV ?? 'development',

  // Enable debug mode in development
  debug: process.env.NODE_ENV !== 'production',

  // Ignore common non-actionable errors in dev
  denyUrls: [
    // Chrome extensions
    /extensions/i,
    // Devtools
    /localhost/,
  ],
});
