// Trust Report Incident Edge Function
// Submit an incident report (private)
// Route: POST /trust-report-incident

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface IncidentReport {
  reportedId: string;
  roundId?: string;
  severity: 'minor' | 'moderate' | 'serious';
  category: 'no_show' | 'late' | 'behavior' | 'safety' | 'other';
  description: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'method_not_allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'missing_auth' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'invalid_token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: IncidentReport = await req.json();
    const { reportedId, roundId, severity, category, description } = body;

    // Validation
    if (!reportedId) {
      return new Response(
        JSON.stringify({ error: 'reportedId required', code: 'missing_reported_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!severity || !['minor', 'moderate', 'serious'].includes(severity)) {
      return new Response(
        JSON.stringify({ error: 'Valid severity required', code: 'invalid_severity' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!category || !['no_show', 'late', 'behavior', 'safety', 'other'].includes(category)) {
      return new Response(
        JSON.stringify({ error: 'Valid category required', code: 'invalid_category' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!description || description.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Description must be at least 10 characters', code: 'invalid_description' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (reportedId === user.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot report yourself', code: 'self_report' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify they played together if roundId provided
    if (roundId) {
      const { data: reporterInRound } = await supabase
        .from('round_participants')
        .select('id')
        .eq('round_id', roundId)
        .eq('member_id', user.id)
        .maybeSingle();

      const { data: reportedInRound } = await supabase
        .from('round_participants')
        .select('id')
        .eq('round_id', roundId)
        .eq('member_id', reportedId)
        .maybeSingle();

      if (!reporterInRound || !reportedInRound) {
        return new Response(
          JSON.stringify({ error: 'Both users must be in the round', code: 'round_participation_required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check for duplicate reports in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentReports } = await supabase
      .from('incidents')
      .select('*', { count: 'exact', head: true })
      .eq('reporter_id', user.id)
      .eq('reported_id', reportedId)
      .gte('created_at', thirtyDaysAgo);

    if ((recentReports || 0) > 0) {
      return new Response(
        JSON.stringify({ error: 'Already reported this user recently', code: 'duplicate_report' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create incident report
    const { data: incident, error: insertError } = await supabase
      .from('incidents')
      .insert({
        reporter_id: user.id,
        reported_id: reportedId,
        round_id: roundId || null,
        severity,
        category,
        description,
        status: 'reported',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create report', code: 'insert_failed', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return limited info (private)
    return new Response(
      JSON.stringify({ 
        data: { 
          id: incident.id,
          status: 'reported',
          message: 'Report submitted. Our team will review this privately.'
        } 
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Trust report incident error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
