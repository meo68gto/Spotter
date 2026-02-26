import { supabase } from './supabase';

export const extractOAuthCode = (callbackUrl: string | undefined): string | null => {
  if (!callbackUrl) return null;
  try {
    const parsed = new URL(callbackUrl);
    return parsed.searchParams.get('code');
  } catch {
    return null;
  }
};

// m-1: Centralized access token helper — replaces inline getToken() definitions across screens
export const getAccessToken = async (): Promise<string | undefined> =>
  (await supabase.auth.getSession()).data.session?.access_token;
