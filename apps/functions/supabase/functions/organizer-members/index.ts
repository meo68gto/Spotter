// Organizer Members Edge Function
// Handles staff member invites, role updates, and removals

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PERMISSION_LEVELS = {
  owner: 3,
  admin: 2,
  editor: 1,
  viewer: 0
};

type OrganizerRole = keyof typeof PERMISSION_LEVELS;
const VALID_ROLES: OrganizerRole[] = ['owner', 'admin', 'editor', 'viewer'];

interface InviteMemberRequest {
  organizerId: string;
  email: string;
  role: OrganizerRole;
  message?: string;
}

interface UpdateRoleRequest {
  organizerId: string;
  userId: string;
  newRole: OrganizerRole;
}

interface RemoveMemberRequest {
  organizerId: string;
  userId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const lastPath = pathParts[pathParts.length - 1] || '';

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

    const method = req.method;

    if (lastPath === 'invite' && method === 'POST') {
      return await handleInviteMember(req, supabase, user.id);
    } else if (lastPath === 'update-role' && method === 'POST') {
      return await handleUpdateRole(req, supabase, user.id);
    } else if (lastPath === 'remove' && method === 'POST') {
      return await handleRemoveMember(req, supabase, user.id);
    } else if (lastPath === 'list' && method === 'GET') {
      return await handleListMembers(url, supabase, user.id);
    }

    return new Response(
      JSON.stringify({ error: 'Not found', code: 'not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Organizer members error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function checkOrganizerPermission(
  supabase: any,
  userId: string,
  organizerId: string,
  minRole: OrganizerRole = 'viewer'
): Promise<{ allowed: boolean; role: OrganizerRole | null; membershipId: string | null }> {
  const { data: membership, error } = await supabase
    .from('organizer_members')
    .select('id, role')
    .eq('user_id', userId)
    .eq('organizer_id', organizerId)
    .eq('status', 'active')
    .single();

  if (error || !membership) {
    return { allowed: false, role: null, membershipId: null };
  }

  const requiredLevel = PERMISSION_LEVELS[minRole];
  const userLevel = PERMISSION_LEVELS[membership.role as OrganizerRole] || 0;

  return {
    allowed: userLevel >= requiredLevel,
    role: membership.role as OrganizerRole,
    membershipId: membership.id
  };
}

async function handleInviteMember(req: Request, supabase: any, userId: string): Promise<Response> {
  let body: InviteMemberRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.organizerId || !body.email || !body.role) {
    return new Response(
      JSON.stringify({ error: 'organizerId, email, and role are required', code: 'missing_fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate role
  if (!VALID_ROLES.includes(body.role)) {
    return new Response(
      JSON.stringify({ error: 'Invalid role', code: 'invalid_role', validRoles: VALID_ROLES }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Only owner/admin can invite
  const { allowed, role: currentRole } = await checkOrganizerPermission(supabase, userId, body.organizerId, 'admin');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Only owner can invite owners
  if (body.role === 'owner' && currentRole !== 'owner') {
    return new Response(
      JSON.stringify({ error: 'Only owners can invite other owners', code: 'owner_only' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Find user by email
  const { data: targetUser, error: userError } = await supabase
    .from('users')
    .select('id, email, display_name')
    .eq('email', body.email)
    .single();

  if (userError || !targetUser) {
    return new Response(
      JSON.stringify({ error: 'User not found with this email', code: 'user_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from('organizer_members')
    .select('id, status')
    .eq('organizer_id', body.organizerId)
    .eq('user_id', targetUser.id)
    .maybeSingle();

  if (existingMember && existingMember.status === 'active') {
    return new Response(
      JSON.stringify({ error: 'User is already a member of this organizer', code: 'already_member' }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (existingMember) {
    // Re-activate with new role
    const { data: updated, error: updateError } = await supabase
      .from('organizer_members')
      .update({
        role: body.role,
        status: 'active',
        invited_by: userId,
        invited_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existingMember.id)
      .select()
      .single();

    if (updateError || !updated) {
      return new Response(
        JSON.stringify({ error: 'Failed to update member', code: 'update_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TODO: Send invitation email

    return new Response(
      JSON.stringify({ data: updated }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create new member
  const { data: member, error: memberError } = await supabase
    .from('organizer_members')
    .insert({
      organizer_id: body.organizerId,
      user_id: targetUser.id,
      role: body.role,
      status: 'active',
      invited_by: userId,
      invited_at: new Date().toISOString()
    })
    .select()
    .single();

  if (memberError || !member) {
    console.error('Error creating member:', memberError);
    return new Response(
      JSON.stringify({ error: 'Failed to invite member', code: 'invite_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // TODO: Send invitation email

  return new Response(
    JSON.stringify({ data: member }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleUpdateRole(req: Request, supabase: any, userId: string): Promise<Response> {
  let body: UpdateRoleRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.organizerId || !body.userId || !body.newRole) {
    return new Response(
      JSON.stringify({ error: 'organizerId, userId, and newRole are required', code: 'missing_fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate role
  if (!VALID_ROLES.includes(body.newRole)) {
    return new Response(
      JSON.stringify({ error: 'Invalid role', code: 'invalid_role', validRoles: VALID_ROLES }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permission
  const { allowed, role: currentRole } = await checkOrganizerPermission(supabase, userId, body.organizerId, 'admin');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get target member
  const { data: targetMember, error: targetError } = await supabase
    .from('organizer_members')
    .select('id, role, user_id')
    .eq('organizer_id', body.organizerId)
    .eq('user_id', body.userId)
    .eq('status', 'active')
    .single();

  if (targetError || !targetMember) {
    return new Response(
      JSON.stringify({ error: 'Member not found', code: 'member_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Cannot modify owner unless you're the owner
  if (targetMember.role === 'owner' && currentRole !== 'owner') {
    return new Response(
      JSON.stringify({ error: 'Cannot modify owner role', code: 'owner_protected' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Cannot grant owner unless you're the owner
  if (body.newRole === 'owner' && currentRole !== 'owner') {
    return new Response(
      JSON.stringify({ error: 'Only owners can grant owner role', code: 'owner_only' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update role
  const { data: updated, error: updateError } = await supabase
    .from('organizer_members')
    .update({
      role: body.newRole,
      updated_at: new Date().toISOString()
    })
    .eq('id', targetMember.id)
    .select()
    .single();

  if (updateError || !updated) {
    return new Response(
      JSON.stringify({ error: 'Failed to update role', code: 'update_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ data: updated }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleRemoveMember(req: Request, supabase: any, userId: string): Promise<Response> {
  let body: RemoveMemberRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.organizerId || !body.userId) {
    return new Response(
      JSON.stringify({ error: 'organizerId and userId are required', code: 'missing_fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permission
  const { allowed, role: currentRole } = await checkOrganizerPermission(supabase, userId, body.organizerId, 'admin');
  
  // Users can remove themselves
  const isSelfRemoval = body.userId === userId;
  if (!allowed && !isSelfRemoval) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get target member
  const { data: targetMember, error: targetError } = await supabase
    .from('organizer_members')
    .select('id, role')
    .eq('organizer_id', body.organizerId)
    .eq('user_id', body.userId)
    .eq('status', 'active')
    .single();

  if (targetError || !targetMember) {
    return new Response(
      JSON.stringify({ error: 'Member not found', code: 'member_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Cannot remove owner (must transfer ownership first)
  if (targetMember.role === 'owner') {
    return new Response(
      JSON.stringify({ error: 'Cannot remove owner. Transfer ownership first.', code: 'cannot_remove_owner' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Soft delete - update status to removed
  const { data: updated, error: updateError } = await supabase
    .from('organizer_members')
    .update({
      status: 'removed',
      removed_at: new Date().toISOString(),
      removed_by: userId,
      updated_at: new Date().toISOString()
    })
    .eq('id', targetMember.id)
    .select()
    .single();

  if (updateError || !updated) {
    return new Response(
      JSON.stringify({ error: 'Failed to remove member', code: 'remove_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ data: updated }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleListMembers(url: URL, supabase: any, userId: string): Promise<Response> {
  const organizerId = url.searchParams.get('organizerId');

  if (!organizerId) {
    return new Response(
      JSON.stringify({ error: 'organizerId is required', code: 'missing_organizer_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permission
  const { allowed } = await checkOrganizerPermission(supabase, userId, organizerId, 'viewer');
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Permission denied', code: 'permission_denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: members, error } = await supabase
    .from('organizer_members')
    .select(`
      id,
      role,
      status,
      invited_at,
      joined_at,
      user:user_id (
        id,
        display_name,
        email,
        avatar_url
      ),
      invitedBy:invited_by (
        display_name
      )
    `)
    .eq('organizer_id', organizerId)
    .neq('status', 'removed')
    .order('role', { ascending: false })
    .order('joined_at', { ascending: true });

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch members', code: 'fetch_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ data: members }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
