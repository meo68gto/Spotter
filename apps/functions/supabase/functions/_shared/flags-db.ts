import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { getRuntimeEnv } from './env.ts';

const env = getRuntimeEnv();

export const resolveBooleanFlag = async (
  supabase: SupabaseClient,
  key: 'matching_v2' | 'video_pipeline',
  fallback: boolean
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('value')
      .eq('key', key)
      .eq('environment', env.flagEnvironment)
      .maybeSingle();

    if (error || !data) return fallback;
    return Boolean(data.value);
  } catch {
    return fallback;
  }
};
