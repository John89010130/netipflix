import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

interface SignupPayload {
  email?: string;
  password?: string;
  name?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: "Missing service configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: SignupPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const email = payload.email?.trim().toLowerCase();
  const password = payload.password || "";
  const name = payload.name?.trim() || "";

  if (!email || !password) {
    return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Cria usuário já confirmado
  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createError || !createData.user) {
    const msg = createError?.message || "Erro ao criar usuário";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = createData.user.id;

  // Dados padrão para perfil / permissões / role
  await adminClient.from("profiles").upsert({
    id: userId,
    name: name || email.split("@")[0],
    email,
  });

  await adminClient.from("user_roles").upsert({
    user_id: userId,
    role: "USER",
  });

  await adminClient.from("permissions").upsert({
    user_id: userId,
    can_tv: true,
    can_movies: true,
    allowed_categories: [],
  });

  return new Response(
    JSON.stringify({ user: { id: userId, email, name: name || null }, email_confirmed: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
