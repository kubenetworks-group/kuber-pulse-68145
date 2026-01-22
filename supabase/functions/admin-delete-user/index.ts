import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate the requesting user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await anonClient.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin using service role client
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await serviceClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent admin from deleting themselves
    if (user_id === userData.user.id) {
      return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ADMIN] Deleting user: ${user_id}`);

    // Get user email for logging
    const { data: userToDelete } = await serviceClient.auth.admin.getUserById(user_id);
    const userEmail = userToDelete?.user?.email || "unknown";

    // Delete all related data first (cascade should handle most, but being explicit)
    // Delete clusters (this will cascade to cluster-related tables via delete_cluster_data function)
    const { data: clusters } = await serviceClient
      .from("clusters")
      .select("id")
      .eq("user_id", user_id);

    if (clusters && clusters.length > 0) {
      for (const cluster of clusters) {
        await serviceClient.rpc("delete_cluster_data", { p_cluster_id: cluster.id });
      }
    }

    // Delete other user-related data
    await serviceClient.from("organizations").delete().eq("user_id", user_id);
    await serviceClient.from("subscriptions").delete().eq("user_id", user_id);
    await serviceClient.from("profiles").delete().eq("id", user_id);
    await serviceClient.from("user_consents").delete().eq("user_id", user_id);
    await serviceClient.from("mfa_backup_codes").delete().eq("user_id", user_id);
    await serviceClient.from("notifications").delete().eq("user_id", user_id);
    await serviceClient.from("security_alerts").delete().eq("user_id", user_id);
    await serviceClient.from("audit_logs").delete().eq("user_id", user_id);
    await serviceClient.from("ai_usage_logs").delete().eq("user_id", user_id);
    await serviceClient.from("user_roles").delete().eq("user_id", user_id);

    // Finally delete the user from auth.users
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user_id);

    if (deleteError) {
      console.error("[ADMIN] Error deleting user:", deleteError);
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ADMIN] Successfully deleted user ${user_id} (${userEmail})`);

    // Log the action (using the admin's user_id since the deleted user no longer exists)
    await serviceClient.rpc("log_audit_event", {
      p_user_id: userData.user.id,
      p_action: "delete_user",
      p_resource_type: "user",
      p_resource_id: null,
      p_details: { deleted_user_id: user_id, deleted_user_email: userEmail },
    });

    return new Response(JSON.stringify({ success: true, deleted_user_id: user_id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[ADMIN] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
