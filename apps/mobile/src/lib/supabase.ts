import 'react-native-url-polyfill/auto';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { env } from '../types/env';

const fallbackSupabaseUrl = 'https://example.supabase.co';
const fallbackSupabaseAnonKey = 'public-anon-key-placeholder';

export const supabase = createClient(env.supabaseUrl || fallbackSupabaseUrl, env.supabaseAnonKey || fallbackSupabaseAnonKey, {
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
