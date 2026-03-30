import 'react-native-url-polyfill/auto';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackKey = 'placeholder-anon-key';

/**
 * Mobile Supabase client using PKCE flow + AsyncStorage.
 * Designed for React Native / Expo mobile apps.
 */
export function createMobileClient() {
  return createClient(
    supabaseUrl || fallbackUrl,
    supabaseAnonKey || fallbackKey,
    {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
      global: {
        // Use native fetch (polyfilled by react-native-url-polyfill/auto)
        fetch,
      },
    },
  );
}

/**
 * Deep-link redirect URL for PKCE callback.
 * Register this as your OAuth redirect scheme in app.json/app.config.js.
 */
export const mobileRedirectTo = Linking.createURL('auth/callback');
