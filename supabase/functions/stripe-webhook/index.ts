import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRICE_TO_PLAN: Record<string, string> = {
  "price_1SZvJ1KqhwUY4V5zcXrVOLkS": "pro",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    // For now, we'll process without signature verification
    // In production, add STRIPE_WEBHOOK_SECRET
    const event = JSON.parse(body) as Stripe.Event;

    console.log(`[STRIPE-WEBHOOK] Event received: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan || "pro";

        if (userId && session.subscription) {
          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const priceId = subscription.items.data[0]?.price.id;

          const { error } = await supabaseAdmin
            .from("subscriptions")
            .update({
              plan: plan,
              status: "active",
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              stripe_price_id: priceId,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

          if (error) {
            console.error("[STRIPE-WEBHOOK] Error updating subscription:", error);
          } else {
            console.log(`[STRIPE-WEBHOOK] Subscription activated for user ${userId}`);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.user_id;

        if (userId) {
          const priceId = subscription.items.data[0]?.price.id;
          const plan = PRICE_TO_PLAN[priceId] || "pro";
          
          let status: string;
          if (subscription.status === "active") {
            status = "active";
          } else if (subscription.status === "past_due") {
            status = "readonly";
          } else if (subscription.status === "canceled") {
            status = "expired";
          } else {
            status = subscription.status;
          }

          const { error } = await supabaseAdmin
            .from("subscriptions")
            .update({
              plan: plan,
              status: status,
              stripe_price_id: priceId,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

          if (error) {
            console.error("[STRIPE-WEBHOOK] Error updating subscription:", error);
          } else {
            console.log(`[STRIPE-WEBHOOK] Subscription updated for user ${userId}, status: ${status}`);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.user_id;

        if (userId) {
          const { error } = await supabaseAdmin
            .from("subscriptions")
            .update({
              plan: "free",
              status: "active",
              stripe_subscription_id: null,
              stripe_price_id: null,
              current_period_end: null,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

          if (error) {
            console.error("[STRIPE-WEBHOOK] Error canceling subscription:", error);
          } else {
            console.log(`[STRIPE-WEBHOOK] Subscription canceled for user ${userId}`);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Find user by stripe_customer_id
        const { data: subscriptionData } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (subscriptionData) {
          const { error } = await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "readonly",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", subscriptionData.user_id);

          if (error) {
            console.error("[STRIPE-WEBHOOK] Error marking subscription as readonly:", error);
          } else {
            console.log(`[STRIPE-WEBHOOK] Payment failed for customer ${customerId}`);
          }
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[STRIPE-WEBHOOK] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
