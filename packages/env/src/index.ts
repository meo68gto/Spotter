import { z } from 'zod';

// Server environment schema (used by web-admin and Edge Functions)
export const serverSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  ADMIN_DELETION_TOKEN: z.string().min(1),
  ADMIN_PANEL_SECRET: z.string().min(1),
  ADMIN_HMAC_SECRET: z.string().min(1),
  DAILY_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().optional(),
  POSTHOG_API_KEY: z.string().optional(),
  SUPABASE_FUNCTIONS_URL: z.string().url().optional(),
});

// Mobile/client environment schema 
export const clientSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  EXPO_PUBLIC_API_BASE_URL: z.string().url(),
  EXPO_PUBLIC_POSTHOG_API_KEY: z.string().optional(),
  EXPO_PUBLIC_FLAG_MATCHING_V2: z.string().optional(),
  EXPO_PUBLIC_FLAG_VIDEO_PIPELINE: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

/** Validate and return typed server env. Throws on missing/invalid keys. */
export function parseServerEnv(env: Record<string, string | undefined> = process.env as any): ServerEnv {
  return serverSchema.parse(env);
}

/** Validate and return typed client env. Throws on missing/invalid keys. */
export function parseClientEnv(env: Record<string, string | undefined>): ClientEnv {
  return clientSchema.parse(env);
}

/** Legacy helper — returns names of missing keys (kept for backwards compat) */
export const requireKeys = (record: Record<string, string | undefined>, keys: string[]): string[] =>
  keys.filter((key) => !record[key]);
