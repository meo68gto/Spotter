'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#f9fafb',
        color: '#111827',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          textAlign: 'center',
          padding: '2rem',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            margin: '0 auto 1.5rem',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
          }}
        >
          ⚠️
        </div>

        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            marginBottom: '0.75rem',
            color: '#111827',
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            fontSize: '0.95rem',
            color: '#6b7280',
            marginBottom: '1.5rem',
            lineHeight: 1.6,
          }}
        >
          We encountered an unexpected error. This has been logged and our team
          will investigate.
          {error.digest && (
            <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.8rem' }}>
              Reference: {error.digest}
            </span>
          )}
        </p>

        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={reset}
            style={{
              padding: '0.625rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: 500,
              color: 'white',
              backgroundColor: '#2563eb',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
          >
            Try Again
          </button>

          <a
            href="/"
            style={{
              padding: '0.625rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: 500,
              color: '#374151',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              textDecoration: 'none',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'white')}
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
