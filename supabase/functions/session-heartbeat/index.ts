import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, session_id, user_id } = await req.json();

    if (action === 'heartbeat' && session_id) {
      // Update last_activity for the session
      const { error } = await supabase
        .from('active_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', session_id);

      if (error) {
        console.error('Heartbeat error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to update session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'cleanup') {
      // Clean up inactive sessions (older than 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('active_sessions')
        .delete()
        .lt('last_activity', fiveMinutesAgo)
        .select();

      if (error) {
        console.error('Cleanup error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to cleanup sessions' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Cleaned up ${data?.length || 0} inactive sessions`);

      return new Response(
        JSON.stringify({ success: true, cleaned: data?.length || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'end' && session_id) {
      // End a specific session
      const { error } = await supabase
        .from('active_sessions')
        .delete()
        .eq('id', session_id);

      if (error) {
        console.error('End session error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to end session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'check' && user_id) {
      // Check session availability for a user
      const { data, error } = await supabase.rpc('check_session_availability', {
        _user_id: user_id
      });

      if (error) {
        console.error('Check availability error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to check availability' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Session heartbeat error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
