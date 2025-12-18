import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Pricing tables by provider ($/hour for compute, $/GB/month for storage, $/GB for network)
const pricingTables = {
  aws: {
    compute: {
      't3.medium': 0.0416,
      't3.large': 0.0832,
      'm5.large': 0.096,
      'm5.xlarge': 0.192,
      'default': 0.096
    },
    storage: 0.10, // EBS gp3
    network: 0.09
  },
  gcp: {
    compute: {
      'n1-standard-2': 0.095,
      'n1-standard-4': 0.190,
      'n2-standard-2': 0.097,
      'default': 0.095
    },
    storage: 0.17, // Persistent Disk
    network: 0.12
  },
  azure: {
    compute: {
      'Standard_B2s': 0.0416,
      'Standard_D2s_v3': 0.096,
      'Standard_D4s_v3': 0.192,
      'default': 0.096
    },
    storage: 0.05, // Managed Disk
    network: 0.087
  },
  digitalocean: {
    compute: {
      'basic': 0.007,
      'general': 0.018,
      'cpu-optimized': 0.024,
      'default': 0.007
    },
    storage: 0.15, // Volume
    network: 0.01
  },
  magalu: {
    compute: {
      'BV2-2-20': 0.02,      // ~R$0.10/h
      'BV4-8-50': 0.05,      // ~R$0.25/h  
      'BV8-16-100': 0.10,    // ~R$0.50/h
      'default': 0.035       // ~R$0.18/h média
    },
    storage: 0.12,           // R$0.58/GiB = ~$0.12/GB
    network: 0.02,           // R$0.10/GB = ~$0.02/GB
    management: 0.09         // R$0.45/h = ~$0.09/h (custo do cluster)
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { cluster_id } = await req.json();

    if (!cluster_id) {
      return new Response(
        JSON.stringify({ error: 'cluster_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch cluster data
    const { data: cluster, error: clusterError } = await supabase
      .from('clusters')
      .select('*')
      .eq('id', cluster_id)
      .single();

    if (clusterError || !cluster) {
      console.error('Error fetching cluster:', clusterError);
      return new Response(
        JSON.stringify({ error: 'Cluster not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get pricing for provider
    const provider = cluster.provider.toLowerCase();
    const pricing = pricingTables[provider as keyof typeof pricingTables] || pricingTables.aws;

    // Calculate period (last 30 days)
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hoursInPeriod = 24 * 30;

    // Estimate instance type based on nodes (simplified)
    const instanceType = cluster.nodes <= 3 ? 'default' : 
                        cluster.nodes <= 6 ? Object.keys(pricing.compute)[1] || 'default' :
                        Object.keys(pricing.compute)[2] || 'default';
    
    const computeHourlyRate = pricing.compute[instanceType as keyof typeof pricing.compute] || pricing.compute.default;

    // Calculate costs
    const computeCost = Number((cluster.nodes * computeHourlyRate * hoursInPeriod).toFixed(2));
    const storageCost = Number((cluster.storage_used_gb * pricing.storage).toFixed(2));
    const networkCost = Number((cluster.storage_used_gb * 0.1 * pricing.network).toFixed(2)); // Estimate 10% of storage as transfer
    const totalCost = Number((computeCost + storageCost + networkCost).toFixed(2));

    // Prepare pricing details
    const pricingDetails = {
      provider: cluster.provider,
      region: cluster.region || 'unknown',
      instance_type: instanceType,
      nodes: cluster.nodes,
      hours_in_period: hoursInPeriod,
      rates: {
        compute_hourly: computeHourlyRate,
        storage_monthly: pricing.storage,
        network_per_gb: pricing.network
      },
      breakdown: {
        compute: computeCost,
        storage: storageCost,
        network: networkCost,
        total: totalCost
      }
    };

    // Insert cost calculation
    const { data: costCalc, error: insertError } = await supabase
      .from('cost_calculations')
      .insert({
        user_id: cluster.user_id,
        cluster_id: cluster.id,
        compute_cost: computeCost,
        storage_cost: storageCost,
        network_cost: networkCost,
        total_cost: totalCost,
        calculation_date: new Date().toISOString(),
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        pricing_details: pricingDetails
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting cost calculation:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save cost calculation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update cluster's monthly_cost and last_cost_calculation
    await supabase
      .from('clusters')
      .update({
        monthly_cost: totalCost,
        last_cost_calculation: new Date().toISOString()
      })
      .eq('id', cluster_id);

    console.log(`Cost calculation completed for cluster ${cluster.name}: $${totalCost}`);

    return new Response(
      JSON.stringify({
        success: true,
        calculation: costCalc,
        breakdown: pricingDetails.breakdown
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in calculate-cluster-costs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
