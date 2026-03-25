import { describe, expect, it, beforeEach, afterAll } from 'vitest';
import { validateMobileEnv } from '../src/types/env';

// Mock process.env before each test
const originalEnv = process.env;

describe('validateMobileEnv', () => {
  beforeEach(() => {
    // Reset process.env to a clean state for each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns empty array when all required vars are set and valid', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://abc123.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://abc123.supabase.co/functions/v1';
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_abc123';
    process.env.EXPO_PUBLIC_LEGAL_TOS_URL = 'https://spotter.app/tos';
    process.env.EXPO_PUBLIC_LEGAL_PRIVACY_URL = 'https://spotter.app/privacy';
    process.env.EXPO_PUBLIC_LEGAL_COOKIE_URL = 'https://spotter.app/cookies';
    process.env.EXPO_PUBLIC_LEGAL_TOS_VERSION = '1.0';
    process.env.EXPO_PUBLIC_LEGAL_PRIVACY_VERSION = '1.0';
    process.env.EXPO_PUBLIC_LEGAL_COOKIE_VERSION = '1.0';

    const result = validateMobileEnv();
    expect(result).toEqual([]);
  });

  it('reports missing vars as missing', () => {
    // Ensure all required vars are absent
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    delete process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    delete process.env.EXPO_PUBLIC_LEGAL_TOS_URL;
    delete process.env.EXPO_PUBLIC_LEGAL_PRIVACY_URL;
    delete process.env.EXPO_PUBLIC_LEGAL_COOKIE_URL;

    const result = validateMobileEnv();
    expect(result).toContain('EXPO_PUBLIC_SUPABASE_URL');
    expect(result).toContain('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    expect(result).toContain('EXPO_PUBLIC_API_BASE_URL');
    expect(result).toContain('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY');
    expect(result).toContain('EXPO_PUBLIC_LEGAL_TOS_URL');
    expect(result).toContain('EXPO_PUBLIC_LEGAL_PRIVACY_URL');
    expect(result).toContain('EXPO_PUBLIC_LEGAL_COOKIE_URL');
  });

  it('reports empty string vars as missing', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = '';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '';
    process.env.EXPO_PUBLIC_API_BASE_URL = '';
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = '';
    process.env.EXPO_PUBLIC_LEGAL_TOS_URL = '';
    process.env.EXPO_PUBLIC_LEGAL_PRIVACY_URL = '';
    process.env.EXPO_PUBLIC_LEGAL_COOKIE_URL = '';
    process.env.EXPO_PUBLIC_LEGAL_TOS_VERSION = '';
    process.env.EXPO_PUBLIC_LEGAL_PRIVACY_VERSION = '';
    process.env.EXPO_PUBLIC_LEGAL_COOKIE_VERSION = '';

    const result = validateMobileEnv();
    expect(result.length).toBeGreaterThan(0);
  });

  it('reports placeholder Supabase URL as invalid', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://abc.supabase.co/functions/v1';
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_abc';
    process.env.EXPO_PUBLIC_LEGAL_TOS_URL = 'https://spotter.app/tos';
    process.env.EXPO_PUBLIC_LEGAL_PRIVACY_URL = 'https://spotter.app/privacy';
    process.env.EXPO_PUBLIC_LEGAL_COOKIE_URL = 'https://spotter.app/cookies';
    process.env.EXPO_PUBLIC_LEGAL_TOS_VERSION = '1.0';
    process.env.EXPO_PUBLIC_LEGAL_PRIVACY_VERSION = '1.0';
    process.env.EXPO_PUBLIC_LEGAL_COOKIE_VERSION = '1.0';

    const result = validateMobileEnv();
    expect(result).toContain('EXPO_PUBLIC_SUPABASE_URL');
  });

  it('reports http apiBaseUrl as invalid', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://abc.supabase.co/functions/v1';
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_abc';
    process.env.EXPO_PUBLIC_LEGAL_TOS_URL = 'https://spotter.app/tos';
    process.env.EXPO_PUBLIC_LEGAL_PRIVACY_URL = 'https://spotter.app/privacy';
    process.env.EXPO_PUBLIC_LEGAL_COOKIE_URL = 'https://spotter.app/cookies';
    process.env.EXPO_PUBLIC_LEGAL_TOS_VERSION = '1.0';
    process.env.EXPO_PUBLIC_LEGAL_PRIVACY_VERSION = '1.0';
    process.env.EXPO_PUBLIC_LEGAL_COOKIE_VERSION = '1.0';

    const result = validateMobileEnv();
    expect(result).toContain('EXPO_PUBLIC_API_BASE_URL');
  });

  it('reports placeholder stripe key as invalid', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://abc.supabase.co/functions/v1';
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_replace_me_abc';
    process.env.EXPO_PUBLIC_LEGAL_TOS_URL = 'https://spotter.app/tos';
    process.env.EXPO_PUBLIC_LEGAL_PRIVACY_URL = 'https://spotter.app/privacy';
    process.env.EXPO_PUBLIC_LEGAL_COOKIE_URL = 'https://spotter.app/cookies';
    process.env.EXPO_PUBLIC_LEGAL_TOS_VERSION = '1.0';
    process.env.EXPO_PUBLIC_LEGAL_PRIVACY_VERSION = '1.0';
    process.env.EXPO_PUBLIC_LEGAL_COOKIE_VERSION = '1.0';

    const result = validateMobileEnv();
    expect(result).toContain('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  });
});
