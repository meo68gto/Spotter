/**
 * @spotter/supabase — Canonical Supabase client factory for mobile.
 * Singleton supabase instance + PKCE helpers.
 */
import { createMobileClient } from '@spotter/supabase/mobile';

export const supabase = createMobileClient();
export { mobileRedirectTo } from '@spotter/supabase/mobile';
