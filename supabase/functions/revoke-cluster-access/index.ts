import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: corsHeaders });

    const { access_grant_id } = await req.json();
    if (!access_grant_id) {
      return new Response(JSON.stringify({ error: "access_grant_id é obrigatório" }), { status: 400, headers: corsHeaders });
    }

    // ── 1. Fetch grant + verify ownership ────────────────────────────────────
    const { data: grant, error: fetchErr } = await supabase
      .from("cluster_access_grants")
      .select("id, cluster_id, user_id, status, serviceaccount_name, serviceaccount_namespace, grantee_name, namespace, access_role")
      .eq("id", access_grant_id)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !grant) {
      return new Response(JSON.stringify({ error: "Grant não encontrado ou sem permissão" }), { status: 404, headers: corsHeaders });
    }
    if (grant.status === "revoked") {
      return new Response(JSON.stringify({ error: "Acesso já foi revogado" }), { status: 400, headers: corsHeaders });
    }

    // ── 2. Revoke in DB ───────────────────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from("cluster_access_grants")
      .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: user.id })
      .eq("id", access_grant_id);

    if (updateErr) throw updateErr;

    // ── 3. Queue agent command to delete ServiceAccount ───────────────────────
    await supabase.from("agent_commands").insert({
      cluster_id: grant.cluster_id,
      user_id: user.id,
      command_type: "delete_serviceaccount",
      command_params: {
        name:      grant.serviceaccount_name,
        namespace: grant.serviceaccount_namespace,
        role_name: `kodo-role-${grant.serviceaccount_name}`,
        binding_name: `kodo-rb-${grant.serviceaccount_name}`,
        secret_name:  `kodo-token-${grant.serviceaccount_name}`,
        scoped_namespace: grant.namespace ?? null,
      },
      status: "pending",
    });

    // ── 4. Audit log ──────────────────────────────────────────────────────────
    await supabase.from("cluster_access_audit_logs").insert({
      access_grant_id,
      cluster_id: grant.cluster_id,
      event_type: "access_revoked",
      details: {
        revoked_by: user.id,
        grantee_name: grant.grantee_name,
        access_role: grant.access_role,
        serviceaccount_name: grant.serviceaccount_name,
      },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Acesso revogado com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("revoke-cluster-access error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
