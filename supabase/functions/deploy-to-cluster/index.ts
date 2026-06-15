import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { cluster_id, yaml_content, namespace, source_id } = await req.json();

    if (!cluster_id || !yaml_content) {
      return new Response(JSON.stringify({ error: "cluster_id e yaml_content são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify cluster belongs to this user
    const { data: cluster } = await serviceSupabase
      .from("clusters")
      .select("id, name, status, agent_last_seen_at")
      .eq("id", cluster_id)
      .eq("user_id", user.id)
      .single();

    if (!cluster) {
      return new Response(JSON.stringify({ error: "Cluster não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if agent is active (seen in last 5 minutes)
    const lastSeen = cluster.agent_last_seen_at ? new Date(cluster.agent_last_seen_at) : null;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (!lastSeen || lastSeen < fiveMinutesAgo) {
      return new Response(JSON.stringify({
        error: "Agente offline. Conecte o agente ao cluster antes de fazer deploy.",
        agent_offline: true,
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Queue the apply_yaml command
    const { data: command, error: cmdError } = await serviceSupabase
      .from("agent_commands")
      .insert({
        cluster_id,
        user_id: user.id,
        command_type: "apply_yaml",
        command_params: {
          yaml_content,
          namespace: namespace || "default",
          source_id: source_id || null,
        },
        status: "pending",
      })
      .select("id")
      .single();

    if (cmdError || !command) {
      throw new Error(`Falha ao criar comando: ${cmdError?.message}`);
    }

    console.log(`✅ apply_yaml queued: command ${command.id} for cluster ${cluster_id}`);

    return new Response(
      JSON.stringify({
        command_id: command.id,
        cluster_name: cluster.name,
        status: "queued",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("deploy-to-cluster error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno ao fazer deploy" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
