import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { corsHeaders } from '../_shared/cors.ts'

interface ClusterValidationRequest {
  cluster_id: string
  config_file: string
  cluster_type: string
  api_endpoint?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { cluster_id, config_file, cluster_type, api_endpoint } = await req.json() as ClusterValidationRequest
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)

    if (!user) {
      throw new Error('Unauthorized')
    }

    console.log(`Validating ${cluster_type} cluster ${cluster_id}`)

    if (cluster_type === 'kubernetes') {
      await validateKubernetesCluster(supabaseClient, cluster_id, user.id, config_file)
    } else if (cluster_type === 'docker') {
      await validateDockerCluster(supabaseClient, cluster_id, user.id, api_endpoint)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error validating cluster:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function validateKubernetesCluster(
  supabase: any,
  cluster_id: string,
  user_id: string,
  config_file: string
) {
  try {
    // Parse the kubeconfig YAML
    const config = parseKubeConfig(config_file)
    
    if (!config.clusters || config.clusters.length === 0) {
      await createLog(supabase, cluster_id, user_id, 'error', 'Invalid kubeconfig: no clusters found')
      await updateClusterStatus(supabase, cluster_id, 'error')
      return
    }

    const clusterInfo = config.clusters[0].cluster
    const serverUrl = clusterInfo.server

    await createLog(supabase, cluster_id, user_id, 'info', `Found cluster endpoint: ${serverUrl}`)

    // Check if server URL is accessible
    if (!serverUrl.startsWith('https://')) {
      await createLog(supabase, cluster_id, user_id, 'error', 'Cluster endpoint must use HTTPS')
      await updateClusterStatus(supabase, cluster_id, 'error')
      return
    }

    // Check if it's a local/private IP
    const isPrivateIP = isPrivateIPAddress(serverUrl)
    if (isPrivateIP) {
      await createLog(supabase, cluster_id, user_id, 'warning', 
        'Cluster uses a private IP address. This cluster may not be accessible from the cloud.',
        { 
          note: 'Private networks require direct access. Consider using a VPN or exposing the cluster through a public endpoint.',
          server: serverUrl
        }
      )
      await updateClusterStatus(supabase, cluster_id, 'warning')
      return
    }

    // Try to reach the server
    try {
      await createLog(supabase, cluster_id, user_id, 'info', 'Attempting to connect to cluster...')
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      const response = await fetch(`${serverUrl}/version`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      })
      
      clearTimeout(timeoutId)

      if (response.ok) {
        const version = await response.json()
        await createLog(supabase, cluster_id, user_id, 'success', 
          `Successfully connected to Kubernetes cluster`,
          { version: version.gitVersion }
        )
        await updateClusterStatus(supabase, cluster_id, 'healthy')
      } else if (response.status === 401 || response.status === 403) {
        await createLog(supabase, cluster_id, user_id, 'warning', 
          'Cluster endpoint is reachable but authentication failed',
          { 
            note: 'Please ensure your kubeconfig contains valid authentication tokens',
            status: response.status
          }
        )
        await updateClusterStatus(supabase, cluster_id, 'warning')
      } else {
        await createLog(supabase, cluster_id, user_id, 'error', 
          `Failed to connect: HTTP ${response.status}`,
          { status: response.status, statusText: response.statusText }
        )
        await updateClusterStatus(supabase, cluster_id, 'error')
      }
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        await createLog(supabase, cluster_id, user_id, 'error', 
          'Connection timeout: Could not reach cluster within 10 seconds',
          { note: 'Check if the cluster endpoint is accessible from the internet' }
        )
      } else {
        await createLog(supabase, cluster_id, user_id, 'error', 
          `Connection failed: ${fetchError.message}`,
          { error: fetchError.toString() }
        )
      }
      await updateClusterStatus(supabase, cluster_id, 'error')
    }
  } catch (error: any) {
    await createLog(supabase, cluster_id, user_id, 'error', 
      `Configuration parsing failed: ${error.message}`
    )
    await updateClusterStatus(supabase, cluster_id, 'error')
  }
}

async function validateDockerCluster(
  supabase: any,
  cluster_id: string,
  user_id: string,
  api_endpoint?: string
) {
  if (!api_endpoint) {
    await createLog(supabase, cluster_id, user_id, 'error', 'Docker endpoint is required')
    await updateClusterStatus(supabase, cluster_id, 'error')
    return
  }

  await createLog(supabase, cluster_id, user_id, 'info', `Testing Docker endpoint: ${api_endpoint}`)
  
  if (api_endpoint.startsWith('unix://')) {
    await createLog(supabase, cluster_id, user_id, 'warning', 
      'Unix socket endpoints can only be accessed locally',
      { note: 'This endpoint will not be reachable from the cloud' }
    )
    await updateClusterStatus(supabase, cluster_id, 'warning')
  } else if (api_endpoint.startsWith('tcp://')) {
    // Try to connect to Docker API
    try {
      const url = api_endpoint.replace('tcp://', 'http://') + '/version'
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      const response = await fetch(url, {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      if (response.ok) {
        const version = await response.json()
        await createLog(supabase, cluster_id, user_id, 'success', 
          'Successfully connected to Docker endpoint',
          { version: version.Version }
        )
        await updateClusterStatus(supabase, cluster_id, 'healthy')
      } else {
        await createLog(supabase, cluster_id, user_id, 'error', 
          `Failed to connect: HTTP ${response.status}`
        )
        await updateClusterStatus(supabase, cluster_id, 'error')
      }
    } catch (error: any) {
      await createLog(supabase, cluster_id, user_id, 'error', 
        `Connection failed: ${error.message}`
      )
      await updateClusterStatus(supabase, cluster_id, 'error')
    }
  } else {
    await createLog(supabase, cluster_id, user_id, 'error', 
      'Invalid Docker endpoint format. Use unix:// or tcp://'
    )
    await updateClusterStatus(supabase, cluster_id, 'error')
  }
}

function parseKubeConfig(yamlContent: string): any {
  const lines = yamlContent.split('\n')
  const config: any = {
    clusters: [],
    contexts: [],
    users: []
  }
  
  let currentSection: string | null = null
  let currentItem: any = null
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    if (trimmed.startsWith('clusters:')) {
      currentSection = 'clusters'
    } else if (trimmed.startsWith('contexts:')) {
      currentSection = 'contexts'
    } else if (trimmed.startsWith('users:')) {
      currentSection = 'users'
    } else if (trimmed.startsWith('- cluster:') || trimmed.startsWith('- context:') || trimmed.startsWith('- name:')) {
      if (currentSection) {
        currentItem = {}
        config[currentSection].push(currentItem)
      }
    } else if (trimmed.includes('server:') && currentItem) {
      const match = trimmed.match(/server:\s*(.+)/)
      if (match && !currentItem.cluster) {
        currentItem.cluster = { server: match[1] }
      }
    }
  }
  
  return config
}

function isPrivateIPAddress(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname
    
    // Check for localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true
    }
    
    // Check for private IP ranges
    const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    const match = hostname.match(ipPattern)
    
    if (match) {
      const [, a, b] = match.map(Number)
      
      // 10.0.0.0/8
      if (a === 10) return true
      
      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) return true
      
      // 192.168.0.0/16
      if (a === 192 && b === 168) return true
    }
    
    return false
  } catch {
    return false
  }
}

async function createLog(
  supabase: any,
  cluster_id: string,
  user_id: string,
  event_type: string,
  message: string,
  details?: any
) {
  await supabase.from('cluster_events').insert({
    cluster_id,
    user_id,
    event_type,
    message,
    details
  })
  
  console.log(`[${event_type.toUpperCase()}] ${message}`, details || '')
}

async function updateClusterStatus(
  supabase: any,
  cluster_id: string,
  status: string
) {
  await supabase
    .from('clusters')
    .update({ status, last_sync: new Date().toISOString() })
    .eq('id', cluster_id)
}
