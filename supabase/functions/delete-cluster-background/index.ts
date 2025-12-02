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

async function deleteClusterInBackground(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  clusterId: string,
  clusterName: string,
  userId: string,
  notificationId: string
) {
  const startTime = Date.now()
  
  try {
    console.log(`Starting background deletion for cluster ${clusterId}`)

    // Update notification to show processing
    await supabase
      .from('notifications')
      .update({
        message: `Excluindo cluster "${clusterName}"... Processando dados.`
      })
      .eq('id', notificationId)

    // Call the database function to delete all cluster data efficiently
    const { data: deletedCount, error: rpcError } = await supabase.rpc('delete_cluster_data', {
      p_cluster_id: clusterId
    })

    if (rpcError) {
      console.error('Error calling delete_cluster_data RPC:', rpcError)
      throw rpcError
    }

    const elapsedTime = Math.round((Date.now() - startTime) / 1000)

    console.log(`Successfully deleted cluster ${clusterId} with ${deletedCount} metrics in ${elapsedTime}s`)

    // Update notification to success
    await supabase
      .from('notifications')
      .update({
        type: 'success',
        title: 'Cluster excluído com sucesso',
        message: `O cluster "${clusterName}" foi excluído. ${deletedCount?.toLocaleString() || 0} métricas removidas em ${elapsedTime}s.`,
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
