import { createClient } from 'npm:@supabase/supabase-js@2';
import { getRuntimeEnv } from './env.ts';

export const createAuthedClient = (authHeader: string) => {
  const env = getRuntimeEnv();
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    global: { headers: { Authorization: authHeader } }
  });
};

export const createServiceClient = () => {
  const env = getRuntimeEnv();
  return createClient(env.supabaseUrl, env.serviceRoleKey);
};
