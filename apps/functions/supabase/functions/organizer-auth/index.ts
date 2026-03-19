// Organizer Auth Edge Function
// Handles organizer registration, login, and tier checks

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, getTierFeatures, TierSlug, TIER_PRIORITY, hasAccess } from '../_shared/tier-gate.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;

// Valid organizer tiers
const VALID_ORGANIZER_TIERS = [TIER_SLUGS.SELECT, TIER_SLUGS.SUMMIT] as const;

interface RegisterRequest {
  name: string;
  slug: string;
  description?: string;
  website?: string;
  contactEmail?: string;
}

interface OrganizerResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  contactEmail: string | null;
  status: string;
  tier: string;
  createdAt: string;
}

interface TierCheckResponse {
  canCreate: boolean;
  currentTier: TierSlug;
  allowedTiers: TierSlug[];
  pricing: {
    tier: TierSlug;
    price: number;
    interval: 'monthly' | 'annual' | 'lifetime';
  }[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop() || '';

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', code: 'missing_auth_header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'invalid_token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route based on path and method
    const method = req.method;

    if (path === 'register' && method === 'POST') {
      return await handleRegister(req, supabase, user.id);
    } else if (path === 'login' && method === 'POST') {
      return await handleLogin(supabase, user.id);
    } else if (path === 'check' && method === 'GET') {
      return await handleTierCheck(supabase, user.id);
    }

    return new Response(
      JSON.stringify({ error: 'Not found', code: 'not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Organizer auth error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleRegister(req: Request, supabase: any, userId: string): Promise<Response> {
  let body: RegisterRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.name || !body.slug) {
    return new Response(
      JSON.stringify({ error: 'name and slug are required', code: 'missing_fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate slug format (alphanumeric, hyphens, underscores)
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(body.slug)) {
    return new Response(
      JSON.stringify({ error: 'slug must be lowercase alphanumeric with hyphens only', code: 'invalid_slug' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check user's tier
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, tier_id, tier_status, membership_tiers (id, slug)')
    .eq('id', userId)
    .single();

  if (userError || !userData) {
    return new Response(
      JSON.stringify({ error: 'User not found', code: 'user_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const tier = userData.membership_tiers as { slug: TierSlug } | null;
  const tierSlug = tier?.slug || TIER_SLUGS.FREE;

  // Check if user can create organizers (must be SELECT or SUMMIT)
  if (!VALID_ORGANIZER_TIERS.includes(tierSlug as typeof VALID_ORGANIZER_TIERS[number])) {
    return new Response(
      JSON.stringify({
        error: 'Your tier does not allow creating organizers. Upgrade to Select or Summit.',
        code: 'tier_insufficient',
        currentTier: tierSlug,
        requiredTier: TIER_SLUGS.SELECT
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check tier status is active
  if (userData.tier_status !== 'active') {
    return new Response(
      JSON.stringify({
        error: 'Your membership is not active',
        code: 'tier_not_active',
        tierStatus: userData.tier_status
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if slug is unique
  const { data: existingOrg, error: slugError } = await supabase
    .from('organizers')
    .select('id')
    .eq('slug', body.slug)
    .single();

  if (existingOrg) {
    return new Response(
      JSON.stringify({ error: 'Slug is already taken', code: 'slug_taken' }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create Stripe customer (async, don't block on failure)
  let stripeCustomerId: string | null = null;
  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        name: body.name,
        email: body.contactEmail || userData.email
      })
    });
    const stripeData = await stripeRes.json();
    if (stripeData.id) {
      stripeCustomerId = stripeData.id;
    }
  } catch (e) {
    console.error('Stripe customer creation failed:', e);
  }

  // Create organizer
  const { data: organizer, error: orgError } = await supabase
    .from('organizers')
    .insert({
      name: body.name,
      slug: body.slug,
      description: body.description || null,
      website: body.website || null,
      contact_email: body.contactEmail || null,
      tier: tierSlug,
      status: 'active',
      stripe_customer_id: stripeCustomerId,
      created_by: userId
    })
    .select('id, name, slug, description, website, contact_email, status, tier, created_at')
    .single();

  if (orgError || !organizer) {
    console.error('Error creating organizer:', orgError);
    return new Response(
      JSON.stringify({ error: 'Failed to create organizer', code: 'create_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create owner membership
  const { error: membershipError } = await supabase
    .from('organizer_members')
    .insert({
      organizer_id: organizer.id,
      user_id: userId,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString()
    });

  if (membershipError) {
    console.error('Error creating membership:', membershipError);
  }

  const response: OrganizerResponse = {
    id: organizer.id,
    name: organizer.name,
    slug: organizer.slug,
    description: organizer.description,
    website: organizer.website,
    contactEmail: organizer.contact_email,
    status: organizer.status,
    tier: organizer.tier,
    createdAt: organizer.created_at
  };

  return new Response(
    JSON.stringify({ data: response }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleLogin(supabase: any, userId: string): Promise<Response> {
  // Get all organizers user belongs to with their roles
  const { data: memberships, error: membershipError } = await supabase
    .from('organizer_members')
    .select(`
      role,
      status,
      joined_at,
      organizer:organizer_id (
        id,
        name,
        slug,
        description,
        website,
        contact_email,
        status,
        tier,
        logo_url,
        created_at
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'active');

  if (membershipError) {
    console.error('Error fetching memberships:', membershipError);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch organizers', code: 'fetch_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const organizers = memberships?.map((m: any) => ({
    ...m.organizer,
    memberRole: m.role,
    memberStatus: m.status,
    joinedAt: m.joined_at
  })) || [];

  return new Response(
    JSON.stringify({ data: organizers }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleTierCheck(supabase: any, userId: string): Promise<Response> {
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('tier_id, tier_status, membership_tiers (slug)')
    .eq('id', userId)
    .single();

  if (userError || !userData) {
    return new Response(
      JSON.stringify({ error: 'User not found', code: 'user_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const tier = userData.membership_tiers as { slug: TierSlug } | null;
  const tierSlug = tier?.slug || TIER_SLUGS.FREE;
  const canCreate = VALID_ORGANIZER_TIERS.includes(tierSlug as typeof VALID_ORGANIZER_TIERS[number]) &&
                    userData.tier_status === 'active';

  const pricing = [
    { tier: TIER_SLUGS.SELECT, price: 1000, interval: 'annual' as const },
    { tier: TIER_SLUGS.SUMMIT, price: 10000, interval: 'lifetime' as const }
  ];

  const response: TierCheckResponse = {
    canCreate,
    currentTier: tierSlug,
    allowedTiers: [TIER_SLUGS.SELECT, TIER_SLUGS.SUMMIT],
    pricing
  };

  return new Response(
    JSON.stringify({ data: response }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
