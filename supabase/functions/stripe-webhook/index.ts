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

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
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

    // CRITICAL: Verify webhook signature
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      logStep("ERROR: STRIPE_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!signature) {
      logStep("ERROR: Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Signature verified", { eventType: event.type, eventId: event.id });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logStep("ERROR: Signature verification failed", { error: errorMessage });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Processing event", { type: event.type });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan || "pro";

        if (userId && session.subscription) {
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
            logStep("Error updating subscription", { error: error.message, userId });
          } else {
            logStep("Subscription activated", { userId, plan });
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
            logStep("Error updating subscription", { error: error.message, userId });
          } else {
            logStep("Subscription updated", { userId, status });
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
            logStep("Error canceling subscription", { error: error.message, userId });
          } else {
            logStep("Subscription canceled", { userId });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

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
            logStep("Error marking subscription as readonly", { error: error.message });
          } else {
            logStep("Payment failed, subscription marked readonly", { customerId });
          }
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Unexpected error", { error: errorMessage });
    // Don't expose internal error details
    return new Response(JSON.stringify({ error: "Internal error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
