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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient(supabaseUrl, supabaseServiceKey) as any

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deleteClusterInBackground(
  supabase: any,
  clusterId: string,
  clusterName: string,
  userId: string,
  notificationId: string
) {
  const startTime = Date.now()
  let deletedMetrics = 0
  
  try {
    console.log(`Starting background deletion for cluster ${clusterId}`)

    // Delete agent_metrics in batches
    const BATCH_SIZE = 5000
    let hasMoreMetrics = true
    
    while (hasMoreMetrics) {
      const { data: metricsToDelete, error: selectError } = await supabase
        .from("agent_metrics")
        .select("id")
        .eq("cluster_id", clusterId)
        .limit(BATCH_SIZE)

      if (selectError) {
        console.error('Error selecting metrics:', selectError)
        throw selectError
      }

      if (metricsToDelete && metricsToDelete.length > 0) {
        const ids = metricsToDelete.map((m: { id: string }) => m.id)
        const { error: deleteError } = await supabase
          .from("agent_metrics")
          .delete()
          .in("id", ids)

        if (deleteError) {
          console.error('Error deleting metrics batch:', deleteError)
          throw deleteError
        }
        
        deletedMetrics += ids.length
        console.log(`Deleted ${deletedMetrics} metrics so far...`)

        // Update notification with progress every 10000 records
        if (deletedMetrics % 10000 === 0) {
          await supabase
            .from('notifications')
            .update({
              message: `Excluindo cluster "${clusterName}"... ${deletedMetrics.toLocaleString()} métricas removidas.`
            })
            .eq('id', notificationId)
        }
      } else {
        hasMoreMetrics = false
      }
    }

    console.log(`Finished deleting ${deletedMetrics} metrics, now deleting related records...`)

    // Delete other related records
    const tables = [
      "cluster_events",
      "cluster_validation_results",
      "agent_api_keys",
      "agent_anomalies",
      "agent_commands",
      "ai_incidents",
      "ai_cost_savings",
      "cost_calculations",
      "persistent_volumes",
      "pvcs",
      "scan_history",
    ]

    for (const table of tables) {
      const { error } = await supabase.from(table).delete().eq("cluster_id", clusterId)
      if (error) {
        console.error(`Error deleting from ${table}:`, error)
      }
    }

    // Finally delete the cluster
    const { error: clusterError } = await supabase
      .from("clusters")
      .delete()
      .eq("id", clusterId)

    if (clusterError) {
      throw clusterError
    }

    const elapsedTime = Math.round((Date.now() - startTime) / 1000)

    // Update notification to success
    await supabase
      .from('notifications')
      .update({
        type: 'success',
        title: 'Cluster excluído com sucesso',
        message: `O cluster "${clusterName}" foi excluído. ${deletedMetrics.toLocaleString()} métricas removidas em ${elapsedTime}s.`,
        related_entity_type: null,
        related_entity_id: null
      })
      .eq('id', notificationId)

    // Create a final success notification
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'success',
      title: 'Exclusão concluída',
      message: `O cluster "${clusterName}" foi completamente removido do sistema.`,
      read: false
    })

    console.log(`Successfully deleted cluster ${clusterId} in ${elapsedTime}s`)

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
