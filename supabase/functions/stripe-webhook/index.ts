import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';
import Stripe from 'https://esm.sh/stripe@14.21.0';

Deno.serve(async (req) => {
  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!stripeKey || !webhookSecret) {
      console.error('Stripe not configured');
      return new Response('Webhook not configured', { status: 503 });
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response('No signature', { status: 400 });
    }

    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );

    console.log('Webhook event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { organization_id, user_id, plan_slug } = session.metadata || {};

        console.log('Checkout completed:', { organization_id, user_id, plan_slug });

        // Update subscription to active
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            plan_type: plan_slug,
            stripe_subscription_id: session.subscription as string,
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('organization_id', organization_id);

        if (updateError) {
          console.error('Error updating subscription:', updateError);
        }

        // Create notification
        await supabase.from('notifications').insert({
          user_id,
          type: 'info',
          title: 'Assinatura ativada!',
          message: `Seu plano ${plan_slug} foi ativado com sucesso. Bem-vindo ao Kodo!`,
        });

        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const { organization_id, user_id } = subscription.metadata || {};

        console.log('Invoice paid:', { organization_id, invoice_id: invoice.id });

        // Create invoice record
        await supabase.from('invoices').insert({
          organization_id,
          user_id,
          subscription_id: (await supabase
            .from('subscriptions')
            .select('id')
            .eq('stripe_subscription_id', subscription.id)
            .single()).data?.id,
          stripe_invoice_id: invoice.id,
          amount_brl: invoice.amount_paid / 100,
          currency: 'BRL',
          status: 'paid',
          invoice_pdf_url: invoice.invoice_pdf,
          paid_at: new Date(invoice.status_transitions.paid_at! * 1000).toISOString(),
        });

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const { organization_id, user_id } = subscription.metadata || {};

        console.log('Payment failed:', { organization_id, invoice_id: invoice.id });

        // Update subscription to past_due
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', subscription.id);

        // Create notification
        await supabase.from('notifications').insert({
          user_id,
          type: 'info',
          title: 'Problema no pagamento',
          message: 'Houve um problema ao processar seu pagamento. Por favor, atualize seu método de pagamento.',
        });

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const { user_id } = subscription.metadata || {};

        console.log('Subscription canceled:', { subscription_id: subscription.id });

        // Update subscription to canceled
        await supabase
          .from('subscriptions')
          .update({ 
            status: 'canceled',
            canceled_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);

        // Create notification
        await supabase.from('notifications').insert({
          user_id,
          type: 'info',
          title: 'Assinatura cancelada',
          message: 'Sua assinatura foi cancelada. Seus dados serão preservados por 90 dias.',
        });

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

        console.log('Subscription updated:', { subscription_id: subscription.id });

        // Update subscription details
        await supabase
          .from('subscriptions')
          .update({
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('stripe_subscription_id', subscription.id);

        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
