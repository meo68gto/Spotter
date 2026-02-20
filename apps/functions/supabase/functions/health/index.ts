import { json } from '../_shared/http.ts';

Deno.serve(() => {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter((key) => !Deno.env.get(key));
  return json(200, {
    status: missing.length ? 'degraded' : 'ok',
    service: 'spotter-functions',
    timestamp: new Date().toISOString(),
    missingEnv: missing,
    env: {
      hasSupabaseUrl: Boolean(Deno.env.get('SUPABASE_URL')),
      hasServiceRole: Boolean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    }
  });
});
