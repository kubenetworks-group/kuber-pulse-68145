import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Declare EdgeRuntime for TypeScript
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { cluster_id, cluster_name, user_id, notification_id } = await req.json()

    if (!cluster_id || !user_id || !notification_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Start background task
    EdgeRuntime.waitUntil(deleteClusterInBackground(supabase, cluster_id, cluster_name, user_id, notification_id))

    return new Response(
      JSON.stringify({ success: true, message: 'Deletion started in background' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const error = err as Error
    console.error('Error starting deletion:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function deleteInBatches(
  supabase: any,
  table: string,
  clusterId: string,
  batchSize: number = 1000
): Promise<number> {
  let totalDeleted = 0
  let hasMore = true

  while (hasMore) {
    // First, get the IDs to delete
    const { data: idsToDelete, error: selectError } = await supabase
      .from(table)
      .select('id')
      .eq('cluster_id', clusterId)
      .limit(batchSize)

    if (selectError) {
      console.error(`Error selecting from ${table}:`, selectError)
      throw selectError
    }

    if (!idsToDelete || idsToDelete.length === 0) {
      hasMore = false
      break
    }

    const ids = idsToDelete.map((row: any) => row.id)

    // Delete the selected IDs
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .in('id', ids)

    if (deleteError) {
      console.error(`Error deleting from ${table}:`, deleteError)
      throw deleteError
    }

    totalDeleted += ids.length
    console.log(`Deleted ${ids.length} records from ${table}, total: ${totalDeleted}`)

    // If we got less than batch size, we're done
    if (idsToDelete.length < batchSize) {
      hasMore = false
    }
  }

  return totalDeleted
}

async function deleteClusterInBackground(
  supabase: any,
  clusterId: string,
  clusterName: string,
  userId: string,
  notificationId: string
) {
  const startTime = Date.now()
  let totalMetricsDeleted = 0
  
  try {
    console.log(`Starting background deletion for cluster ${clusterId}`)

    // Update notification to show processing
    await supabase
      .from('notifications')
      .update({
        message: `Excluindo cluster "${clusterName}"... Processando dados.`
      })
      .eq('id', notificationId)

    // 1. Delete agent_metrics in batches (usually the largest table)
    console.log('Deleting agent_metrics...')
    totalMetricsDeleted = await deleteInBatches(supabase, 'agent_metrics', clusterId, 500)
    console.log(`Deleted ${totalMetricsDeleted} agent_metrics`)

    // 2. Delete related tables directly (smaller tables)
    const relatedTables = [
      'agent_anomalies',
      'agent_api_keys', 
      'agent_commands',
      'cluster_events',
      'cost_calculations',
      'pvcs',
      'persistent_volumes',
      'scan_history',
      'cluster_validation_results'
    ]

    for (const table of relatedTables) {
      console.log(`Deleting from ${table}...`)
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('cluster_id', clusterId)
      
      if (error) {
        console.error(`Error deleting from ${table}:`, error)
        // Continue with other tables
      }
    }

    // 3. Delete ai_incidents and ai_cost_savings
    console.log('Deleting ai_cost_savings...')
    const { data: incidents } = await supabase
      .from('ai_incidents')
      .select('id')
      .eq('cluster_id', clusterId)

    if (incidents && incidents.length > 0) {
      const incidentIds = incidents.map((i: any) => i.id)
      await supabase
        .from('ai_cost_savings')
        .delete()
        .in('incident_id', incidentIds)
    }

    console.log('Deleting ai_incidents...')
    await supabase
      .from('ai_incidents')
      .delete()
      .eq('cluster_id', clusterId)

    // 4. Finally delete the cluster itself
    console.log('Deleting cluster...')
    const { error: clusterError } = await supabase
      .from('clusters')
      .delete()
      .eq('id', clusterId)

    if (clusterError) {
      console.error('Error deleting cluster:', clusterError)
      throw clusterError
    }

    const elapsedTime = Math.round((Date.now() - startTime) / 1000)

    console.log(`Successfully deleted cluster ${clusterId} with ${totalMetricsDeleted} metrics in ${elapsedTime}s`)

    // Update notification to success
    await supabase
      .from('notifications')
      .update({
        type: 'success',
        title: 'Cluster excluído com sucesso',
        message: `O cluster "${clusterName}" foi excluído. ${totalMetricsDeleted.toLocaleString()} métricas removidas em ${elapsedTime}s.`,
        related_entity_type: null,
        related_entity_id: null
      })
      .eq('id', notificationId)

  } catch (err) {
    const error = err as Error
    console.error('Error in background deletion:', error)

    // Update notification to error
    await supabase
      .from('notifications')
      .update({
        type: 'error',
        title: 'Erro ao excluir cluster',
        message: `Falha ao excluir o cluster "${clusterName}": ${error.message}`,
        related_entity_type: null,
        related_entity_id: null
      })
      .eq('id', notificationId)
  }
}
