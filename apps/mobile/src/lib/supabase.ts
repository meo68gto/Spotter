import 'react-native-url-polyfill/auto';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { env } from '../types/env';

// M-6: Throw early if env vars are missing instead of using placeholder fallbacks
if (!env.supabaseUrl) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL is not set. Please configure your environment.');
}
if (!env.supabaseAnonKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set. Please configure your environment.');
}

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce'
  },
  global: {
    fetch
  }
});

export const redirectTo = Linking.createURL('/auth/callback');
