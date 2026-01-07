import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify user is admin from authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["ADMIN", "ADMIN_MASTER"])
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado - apenas admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { linkId } = await req.json();

    if (!linkId) {
      return new Response(JSON.stringify({ error: "linkId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Deleting channels for m3u_link_id: ${linkId} using database function`);

    // Use the database function which is much faster (single DELETE statement)
    const { data: deletedCount, error: deleteError } = await supabase.rpc(
      "delete_channels_by_link",
      { p_link_id: linkId }
    );

    if (deleteError) {
      console.error("Error deleting channels:", deleteError);
      return new Response(JSON.stringify({ 
        error: `Erro ao deletar canais: ${deleteError.message}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Deleted ${deletedCount} channels, now deleting m3u_link...`);

    // Delete the m3u_link
    const { error: deleteLinkError } = await supabase
      .from("m3u_links")
      .delete()
      .eq("id", linkId);

    if (deleteLinkError) {
      console.error("Error deleting link:", deleteLinkError);
      return new Response(JSON.stringify({ 
        error: `Erro ao deletar link: ${deleteLinkError.message}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Successfully deleted m3u_link and ${deletedCount} channels`);

    return new Response(JSON.stringify({ 
      success: true, 
      deletedChannels: deletedCount || 0 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro desconhecido" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
