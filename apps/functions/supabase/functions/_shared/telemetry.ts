// _shared/telemetry.ts
export interface Logger {
  info: (msg: string, data?: Record<string, unknown>) => void;
  error: (msg: string, err?: unknown, data?: Record<string, unknown>) => void;
  warn: (msg: string, data?: Record<string, unknown>) => void;
  timer: (label: string) => () => void;
}

export function createLogger(functionName: string, requestId: string): Logger {
  const base = { fn: functionName, req: requestId };

  return {
    info: (msg, data) =>
      console.log(JSON.stringify({ level: 'info', ...base, msg, ...data, ts: Date.now() })),
    error: (msg, err, data) =>
      console.error(JSON.stringify({
        level: 'error', ...base, msg,
        error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
        ...data, ts: Date.now(),
      })),
    warn: (msg, data) =>
      console.warn(JSON.stringify({ level: 'warn', ...base, msg, ...data, ts: Date.now() })),
    timer: (label) => {
      const start = performance.now();
      return () => console.log(JSON.stringify({
        level: 'perf', ...base, label, ms: Math.round(performance.now() - start), ts: Date.now(),
      }));
    },
  };
}

export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: 'event', name, ...properties, ts: Date.now() }));
}
