'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('web-admin error boundary', error);
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <main style={{ padding: 32, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>500 - Something went wrong</h1>
      <p style={{ marginBottom: 16 }}>{isDev ? error.message : 'An internal error occurred.'}</p>
      <button onClick={reset}>Retry</button>
    </main>
  );
}
