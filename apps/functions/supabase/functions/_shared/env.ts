const ensure = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const getRuntimeEnv = () => ({
  supabaseUrl: ensure('SUPABASE_URL'),
  serviceRoleKey: ensure('SUPABASE_SERVICE_ROLE_KEY'),
  bucketRaw: Deno.env.get('VIDEOS_RAW_BUCKET') ?? 'videos-raw',
  adminDeletionToken: Deno.env.get('ADMIN_DELETION_TOKEN') ?? ''
});
