import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Node cost estimates by provider ($/hour) - based on official pricing
const nodeCostByProvider: Record<string, number> = {
  aws: 0.096,
  gcp: 0.095,
  azure: 0.096,
  digitalocean: 0.018,
  magalu: 0.035  // ~R$0.18/h média (BV2-2-20 a BV8-16-100)
};

// Revenue multiplier for downtime impact (more conservative)
const DOWNTIME_MULTIPLIER = 150; // Revenue impact ~150x infrastructure cost

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { incident_id } = await req.json();

    if (!incident_id) {
      return new Response(
        JSON.stringify({ error: 'incident_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch incident data
    const { data: incident, error: incidentError } = await supabase
      .from('ai_incidents')
      .select('*')
      .eq('id', incident_id)
      .single();

    if (incidentError || !incident) {
      console.error('Error fetching incident:', incidentError);
      return new Response(
        JSON.stringify({ error: 'Incident not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if savings already calculated
    const { data: existingSavings } = await supabase
      .from('ai_cost_savings')
      .select('id')
      .eq('incident_id', incident_id)
      .maybeSingle();

    if (existingSavings) {
      return new Response(
        JSON.stringify({ message: 'Savings already calculated for this incident' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch cluster data
    const { data: cluster, error: clusterError } = await supabase
      .from('clusters')
      .select('*')
      .eq('id', incident.cluster_id)
      .single();

    if (clusterError || !cluster) {
      console.error('Error fetching cluster:', clusterError);
      return new Response(
        JSON.stringify({ error: 'Cluster not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate savings based on incident type and action
    let savingType: string;
    let downtimeAvoidedMinutes = 0;
    let costPerMinute = 0;
    let estimatedSavings = 0;
    let calculationDetails: any = {};

    const monthlyMinutes = 30 * 24 * 60;
    const baseCostPerMinute = (cluster.monthly_cost || 300) / monthlyMinutes; // Default $300 if not set
    
    // More conservative revenue multiplier based on real impact
    const revenueMultiplier = DOWNTIME_MULTIPLIER;

    // 1. Downtime Prevention (for critical/high severity incidents)
    if (incident.severity === 'critical' || incident.severity === 'high') {
      savingType = 'downtime_prevention';
      // Realistic downtime estimates: critical ~20min, high ~12min
      downtimeAvoidedMinutes = incident.severity === 'critical' ? 20 : 12;
      costPerMinute = baseCostPerMinute * revenueMultiplier;
      estimatedSavings = Number((downtimeAvoidedMinutes * costPerMinute).toFixed(2));
      
      // Cap maximum savings at reasonable values
      const maxSavings = incident.severity === 'critical' ? 50 : 30;
      estimatedSavings = Math.min(estimatedSavings, maxSavings);
      
      calculationDetails = {
        severity: incident.severity,
        revenue_multiplier: revenueMultiplier,
        base_cost_per_minute: baseCostPerMinute,
        downtime_minutes: downtimeAvoidedMinutes,
        max_capped: maxSavings,
        assumption: 'Based on downtime avoided and revenue impact (capped)'
      };
    }
    // 2. Resource Optimization (restart_pod instead of scale_up)
    else if (incident.auto_heal_action === 'restart_pod' && 
             incident.ai_analysis?.recommendation?.toLowerCase().includes('scale')) {
      savingType = 'resource_optimization';
      const nodesAvoided = 1; // More conservative: 1 node instead of 2
      const provider = cluster.provider.toLowerCase();
      const nodeHourlyCost = nodeCostByProvider[provider] || nodeCostByProvider.magalu;
      const hoursInMonth = 24 * 30;
      estimatedSavings = Number((nodesAvoided * nodeHourlyCost * hoursInMonth).toFixed(2));
      
      // Cap at reasonable value
      estimatedSavings = Math.min(estimatedSavings, 25);
      
      calculationDetails = {
        nodes_avoided: nodesAvoided,
        node_hourly_cost: nodeHourlyCost,
        hours_in_month: hoursInMonth,
        max_capped: 25,
        assumption: 'Avoided unnecessary scale-up by fixing issue with restart (capped)'
      };
    }
    // 3. Scale Optimization (intelligent scale_up or scale_down)
    else if (incident.auto_heal_action === 'scale_up' || incident.auto_heal_action === 'scale_down') {
      savingType = 'scale_optimization';
      const optimizationPercent = 0.03; // 3% savings vs over-provisioning (more conservative)
      const monthlyCost = cluster.monthly_cost || 300;
      estimatedSavings = Number((monthlyCost * optimizationPercent).toFixed(2));
      
      // Cap at reasonable value
      estimatedSavings = Math.min(estimatedSavings, 20);
      
      calculationDetails = {
        optimization_percent: optimizationPercent,
        monthly_cost: monthlyCost,
        max_capped: 20,
        assumption: 'Intelligent scaling vs. conservative over-provisioning (capped)'
      };
    }
    // Default: minimal savings for other actions
    else {
      savingType = 'resource_optimization';
      const monthlyCost = cluster.monthly_cost || 300;
      estimatedSavings = Number((monthlyCost * 0.02).toFixed(2)); // 2% minimal savings
      
      // Cap at reasonable value
      estimatedSavings = Math.min(estimatedSavings, 15);
      
      calculationDetails = {
        auto_heal_action: incident.auto_heal_action,
        max_capped: 15,
        assumption: 'Minimal optimization from automated remediation (capped)'
      };
    }

    // Insert savings record
    const { data: savings, error: insertError } = await supabase
      .from('ai_cost_savings')
      .insert({
        user_id: incident.user_id,
        incident_id: incident.id,
        cluster_id: incident.cluster_id,
        downtime_avoided_minutes: downtimeAvoidedMinutes,
        cost_per_minute: costPerMinute,
        estimated_savings: estimatedSavings,
        saving_type: savingType,
        calculation_details: calculationDetails
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting cost savings:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save cost savings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`AI savings calculated for incident ${incident.title}: $${estimatedSavings} (${savingType})`);

    return new Response(
      JSON.stringify({
        success: true,
        savings: savings
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in calculate-ai-savings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
