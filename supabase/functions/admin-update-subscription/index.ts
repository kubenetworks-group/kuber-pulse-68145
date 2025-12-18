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
    const { user_id, action, value } = await req.json();

    if (!user_id || !action) {
      return new Response(JSON.stringify({ error: "user_id and action are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ADMIN] Action: ${action}, User: ${user_id}, Value: ${value}`);

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case "extend_trial": {
        // value is number of days to extend from current end (or now if expired)
        const daysToExtend = parseInt(value) || 30;
        
        // Get current subscription
        const { data: sub } = await serviceClient
          .from("subscriptions")
          .select("trial_ends_at")
          .eq("user_id", user_id)
          .single();

        if (sub) {
          const currentEnd = new Date(sub.trial_ends_at);
          const now = new Date();
          const baseDate = currentEnd > now ? currentEnd : now;
          const newEndDate = new Date(baseDate.getTime() + daysToExtend * 24 * 60 * 60 * 1000);
          
          updateData = {
            trial_ends_at: newEndDate.toISOString(),
            status: "trialing",
            updated_at: new Date().toISOString(),
          };
        }
        break;
      }

      case "set_trial_days": {
        // value is number of days from NOW (not extending, but setting)
        const trialDays = parseInt(value) || 7;
        const now = new Date();
        const newEndDate = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
        
        updateData = {
          trial_ends_at: newEndDate.toISOString(),
          status: "trialing",
          updated_at: new Date().toISOString(),
        };
        break;
      }

      case "set_trial_end": {
        // value is ISO date string
        updateData = {
          trial_ends_at: value,
          status: "trialing",
          updated_at: new Date().toISOString(),
        };
        break;
      }

      case "set_cluster_limit": {
        // value is number or null to reset
        const limit = value === null || value === "" ? null : parseInt(value);
        updateData = {
          custom_cluster_limit: limit,
          updated_at: new Date().toISOString(),
        };
        break;
      }

      case "change_plan": {
        // value is plan name: free, pro, enterprise
        updateData = {
          plan: value,
          updated_at: new Date().toISOString(),
        };
        break;
      }

      case "change_status": {
        // value is status: trialing, active, readonly, expired
        updateData = {
          status: value,
          updated_at: new Date().toISOString(),
        };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Apply the update
    const { data, error } = await serviceClient
      .from("subscriptions")
      .update(updateData)
      .eq("user_id", user_id)
      .select()
      .single();

    if (error) {
      console.error("[ADMIN] Update error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ADMIN] Successfully updated subscription for user ${user_id}`);

    return new Response(JSON.stringify({ success: true, subscription: data }), {
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
