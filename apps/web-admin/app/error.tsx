'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('web-admin error boundary', error);
  }, [error]);

  return (
    <main style={{ padding: 32, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>500 - Something went wrong</h1>
      <p style={{ marginBottom: 16 }}>{error.message}</p>
      <button onClick={reset}>Retry</button>
    </main>
  );
}
