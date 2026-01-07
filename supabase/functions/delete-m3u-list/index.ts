import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Delete channels in batches to avoid statement timeout
async function deleteChannelsInBatches(
  supabase: any,
  linkId: string
): Promise<number> {
  const BATCH_SIZE = 500;
  let totalDeleted = 0;
  let hasMore = true;

  while (hasMore) {
    // First, get IDs of channels to delete
    const { data: channelsToDelete, error: selectError } = await supabase
      .from("channels")
      .select("id")
      .eq("m3u_link_id", linkId)
      .limit(BATCH_SIZE);

    if (selectError) {
      console.error("Error selecting channels:", selectError);
      throw new Error(selectError.message);
    }

    if (!channelsToDelete || channelsToDelete.length === 0) {
      hasMore = false;
      break;
    }

    const idsToDelete = (channelsToDelete as Array<{ id: string }>).map((c) => c.id);

    // Delete this batch by IDs
    const { error: deleteError, count } = await supabase
      .from("channels")
      .delete({ count: "exact" })
      .in("id", idsToDelete);

    if (deleteError) {
      console.error("Error deleting batch:", deleteError);
      throw new Error(deleteError.message);
    }

    totalDeleted += count || idsToDelete.length;
    console.log(`Deleted batch of ${count || idsToDelete.length} channels, total: ${totalDeleted}`);

    // If we got fewer than BATCH_SIZE, we're done
    if (channelsToDelete.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  return totalDeleted;
}

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

    console.log(`Starting batch deletion for m3u_link_id: ${linkId}`);

    // Delete channels in batches to avoid timeout
    const deletedChannels = await deleteChannelsInBatches(supabase, linkId);

    console.log(`Deleted ${deletedChannels} channels, now deleting m3u_link...`);

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

    console.log(`Successfully deleted m3u_link and ${deletedChannels} channels`);

    return new Response(JSON.stringify({ 
      success: true, 
      deletedChannels: deletedChannels 
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
