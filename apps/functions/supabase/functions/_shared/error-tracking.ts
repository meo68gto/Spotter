// Error Tracking Utilities for Spotter Edge Functions
// Sentry integration for production error monitoring

import { corsHeaders } from './cors.ts';

// Sentry DSN from environment
const SENTRY_DSN = Deno.env.get('SENTRY_DSN_FUNCTIONS');
const ENVIRONMENT = Deno.env.get('FLAG_ENVIRONMENT') || 'production';

export interface ErrorContext {
  userId?: string;
  functionName: string;
  requestId?: string;
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
}

export interface CapturedError {
  id: string;
  timestamp: string;
  error: Error;
  context: ErrorContext;
  severity: 'fatal' | 'error' | 'warning' | 'info';
}

/**
 * Generate a unique error ID
 */
function generateErrorId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Send error to Sentry
 */
async function sendToSentry(
  error: Error,
  context: ErrorContext,
  severity: 'fatal' | 'error' | 'warning' | 'info'
): Promise<void> {
  if (!SENTRY_DSN) {
    console.warn('SENTRY_DSN_FUNCTIONS not configured, error not sent to Sentry:', error.message);
    return;
  }

  try {
    // Parse DSN to get project ID and public key
    const dsnUrl = new URL(SENTRY_DSN);
    const projectId = dsnUrl.pathname.split('/').pop();
    const publicKey = dsnUrl.username;
    const sentryHost = dsnUrl.host;

    const event = {
      event_id: generateErrorId(),
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      level: severity,
      environment: ENVIRONMENT,
      server_name: 'supabase-edge-functions',
      release: Deno.env.get('GIT_SHA') || 'unknown',
      exception: {
        values: [{
          type: error.name,
          value: error.message,
          stacktrace: {
            frames: error.stack?.split('\n').map((line, index) => ({
              filename: line.match(/at (.+):(\d+):(\d+)/)?.[1] || 'unknown',
              lineno: parseInt(line.match(/:(\d+):\d+/)?.[1] || '0'),
              colno: parseInt(line.match(/:\d+:(\d+)/)?.[1] || '0'),
              function: line.match(/at (.+) \(/)?.[1] || 'anonymous',
              in_app: true
            })) || []
          }
        }]
      },
      user: context.userId ? { id: context.userId } : undefined,
      tags: {
        function: context.functionName,
        ...context.tags
      },
      extra: {
        requestId: context.requestId,
        ...context.extra
      },
      request: {
        url: context.extra?.url as string,
        method: context.extra?.method as string,
        headers: context.extra?.headers as Record<string, string>
      }
    };

    const response = await fetch(`https://${sentryHost}/api/${projectId}/store/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=spotter-edge/1.0`
      },
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      console.error('Failed to send error to Sentry:', response.status, await response.text());
    }
  } catch (sentryError) {
    console.error('Error sending to Sentry:', sentryError);
  }
}

/**
 * Log error to database for local tracking
 */
async function logToDatabase(
  errorId: string,
  error: Error,
  context: ErrorContext,
  severity: string
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase not configured, error not logged to database');
      return;
    }

    await fetch(`${supabaseUrl}/rest/v1/error_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        id: errorId,
        function_name: context.functionName,
        error_type: error.name,
        error_message: error.message,
        error_stack: error.stack,
        user_id: context.userId,
        request_id: context.requestId,
        severity,
        environment: ENVIRONMENT,
        extra: context.extra,
        tags: context.tags,
        created_at: new Date().toISOString()
      })
    });
  } catch (dbError) {
    console.error('Failed to log error to database:', dbError);
  }
}

/**
 * Capture and track an error
 * Sends to Sentry and logs to database
 */
export async function captureError(
  error: Error | unknown,
  context: ErrorContext,
  severity: 'fatal' | 'error' | 'warning' | 'info' = 'error'
): Promise<string> {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  const errorId = generateErrorId();
  
  // Log to console immediately
  console.error(`[${severity.toUpperCase()}] ${context.functionName}:`, normalizedError.message, {
    errorId,
    userId: context.userId,
    requestId: context.requestId
  });

  // Send to Sentry (non-blocking)
  sendToSentry(normalizedError, context, severity).catch(console.error);
  
  // Log to database (non-blocking)
  logToDatabase(errorId, normalizedError, context, severity).catch(console.error);
  
  return errorId;
}

/**
 * Create a wrapped handler that captures all errors
 */
export function withErrorTracking(
  handler: (req: Request) => Promise<Response>,
  functionName: string
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const requestId = generateErrorId();
    const startTime = performance.now();
    
    try {
      const response = await handler(req);
      
      // Log slow requests as warnings
      const duration = performance.now() - startTime;
      if (duration > 5000) {
        await captureError(
          new Error(`Slow request: ${duration.toFixed(0)}ms`),
          {
            functionName,
            requestId,
            extra: {
              url: req.url,
              method: req.method,
              duration: Math.round(duration)
            }
          },
          'warning'
        );
      }
      
      return response;
    } catch (error) {
      // Capture the error
      const errorId = await captureError(error, {
        functionName,
        requestId,
        extra: {
          url: req.url,
          method: req.method,
          headers: Object.fromEntries(req.headers.entries())
        }
      }, 'error');
      
      // Return a generic error response
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          code: 'internal_error',
          errorId,
          requestId
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }
  };
}

/**
 * Create a context-aware error capturer for a specific function
 */
export function createErrorCapturer(functionName: string) {
  return {
    capture: (error: Error | unknown, extra?: Record<string, unknown>, severity?: 'fatal' | 'error' | 'warning' | 'info') =>
      captureError(error, { functionName, extra }, severity || 'error'),
    
    captureWithUser: (error: Error | unknown, userId: string, extra?: Record<string, unknown>, severity?: 'fatal' | 'error' | 'warning' | 'info') =>
      captureError(error, { functionName, userId, extra }, severity || 'error'),
    
    warning: (message: string, extra?: Record<string, unknown>) =>
      captureError(new Error(message), { functionName, extra }, 'warning'),
    
    info: (message: string, extra?: Record<string, unknown>) =>
      captureError(new Error(message), { functionName, extra }, 'info')
  };
}

/**
 * Performance monitoring helper
 */
export function createPerformanceTracker(functionName: string, operation: string) {
  const start = performance.now();
  
  return {
    end: async (extra?: Record<string, unknown>) => {
      const duration = performance.now() - start;
      
      if (duration > 1000) {
        await captureError(
          new Error(`Slow operation: ${operation}`),
          {
            functionName,
            extra: {
              operation,
              duration: Math.round(duration),
              ...extra
            }
          },
          'warning'
        );
      }
      
      return duration;
    },
    
    fail: async (error: Error | unknown, extra?: Record<string, unknown>) => {
      const duration = performance.now() - start;
      
      await captureError(error, {
        functionName,
        extra: {
          operation,
          duration: Math.round(duration),
          ...extra
        }
      }, 'error');
      
      return duration;
    }
  };
}
