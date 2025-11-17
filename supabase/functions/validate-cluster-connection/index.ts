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

    // Support all Kubernetes-based cluster types
    const kubernetesTypes = ['kubernetes', 'microk8s', 'k3s', 'minikube']

    if (kubernetesTypes.includes(cluster_type)) {
      await validateKubernetesCluster(supabaseClient, cluster_id, user.id, config_file)
    } else if (cluster_type === 'docker') {
      await validateDockerCluster(supabaseClient, cluster_id, user.id, api_endpoint)
    } else {
      throw new Error(`Unsupported cluster type: ${cluster_type}`)
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
    console.log('Starting Kubernetes cluster validation...')
    
    // Parse the kubeconfig YAML
    const config = parseKubeConfig(config_file)
    console.log('Parsed kubeconfig:', JSON.stringify(config, null, 2))
    
    if (!config.clusters || config.clusters.length === 0) {
      await createLog(supabase, cluster_id, user_id, 'error', 'Invalid kubeconfig: no clusters found')
      await updateClusterStatus(supabase, cluster_id, 'error')
      return
    }

    const clusterInfo = config.clusters[0].cluster
    
    if (!clusterInfo || !clusterInfo.server) {
      console.error('Invalid cluster info:', JSON.stringify(clusterInfo, null, 2))
      await createLog(supabase, cluster_id, user_id, 'error', 'Invalid kubeconfig: server URL not found in cluster configuration')
      await updateClusterStatus(supabase, cluster_id, 'error')
      return
    }
    
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
      // Fetch cluster info to check if it's a local cluster
      const { data: cluster } = await supabase
        .from('clusters')
        .select('is_local, name')
        .eq('id', cluster_id)
        .single()
      
      if (cluster?.is_local) {
        // ✅ Local cluster with private IP is EXPECTED
        await createLog(supabase, cluster_id, user_id, 'info', 
          'Local cluster detected. Waiting for agent connection...',
          { 
            note: 'This is a local cluster. Install the agent inside your cluster to begin monitoring.',
            server: serverUrl,
            next_steps: [
              '1. Download the agent deployment file from the Clusters page',
              '2. Apply it to your cluster: kubectl apply -f agent.yaml',
              '3. The agent will automatically connect and send metrics'
            ]
          }
        )
        await updateClusterStatus(supabase, cluster_id, 'pending_agent')
        return
      } else {
        // ❌ Cloud cluster with private IP is ERROR
        await createLog(supabase, cluster_id, user_id, 'error', 
          'Cluster uses a private IP address and cannot be accessed from the cloud',
          { 
            note: 'Private networks require direct access. Consider using a VPN or exposing the cluster through a public endpoint.',
            server: serverUrl
          }
        )
        await updateClusterStatus(supabase, cluster_id, 'error')
        return
      }
    }

    await createLog(supabase, cluster_id, user_id, 'info', 'Cluster endpoint is public, attempting connection...')

    // Try to reach the server with proper certificates handling
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      
      await createLog(supabase, cluster_id, user_id, 'info', `Connecting to ${serverUrl}...`)
      
      // Try different endpoints that Kubernetes exposes
      const endpoints = ['/version', '/livez', '/readyz', '/api/v1']
      let connected = false
      let lastError = null
      
      for (const endpoint of endpoints) {
        try {
          const testUrl = `${serverUrl}${endpoint}`
          await createLog(supabase, cluster_id, user_id, 'info', `Testing endpoint: ${endpoint}`)
          
          // First attempt with normal SSL verification
          let response = await fetch(testUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'KubeNetworks-Validator/1.0'
            }
          })
          
          clearTimeout(timeoutId)
          
          // Any response means the server is reachable
          if (response.status === 200) {
            try {
              const data = await response.json()
              await createLog(supabase, cluster_id, user_id, 'success', 
                `Successfully connected to Kubernetes cluster via ${endpoint}`,
                { 
                  status: response.status,
                  endpoint: endpoint,
                  responseData: JSON.stringify(data).substring(0, 200)
                }
              )
              await updateClusterStatus(supabase, cluster_id, 'healthy')
              connected = true
              break
            } catch {
              await createLog(supabase, cluster_id, user_id, 'success', 
                `Cluster is reachable via ${endpoint} (non-JSON response)`,
                { status: response.status, endpoint: endpoint }
              )
              await updateClusterStatus(supabase, cluster_id, 'healthy')
              connected = true
              break
            }
          } else if (response.status === 401 || response.status === 403) {
            await createLog(supabase, cluster_id, user_id, 'warning', 
              `Cluster is reachable but requires authentication (${endpoint})`,
              { 
                note: 'Authentication is required. Your cluster is accessible but credentials need to be configured.',
                status: response.status,
                endpoint: endpoint
              }
            )
            await updateClusterStatus(supabase, cluster_id, 'warning')
            connected = true
            break
          } else if (response.status >= 200 && response.status < 500) {
            // Server responded, which means it's reachable
            await createLog(supabase, cluster_id, user_id, 'info', 
              `Cluster responded with status ${response.status} on ${endpoint}`,
              { status: response.status, endpoint: endpoint }
            )
            // Continue trying other endpoints
          }
        } catch (endpointError: any) {
          lastError = endpointError
          
          // Check if it's an SSL certificate error
          const isCertError = endpointError.message?.includes('certificate') || 
                             endpointError.message?.includes('UnknownIssuer') ||
                             endpointError.message?.includes('self-signed')
          
          if (isCertError) {
            await createLog(supabase, cluster_id, user_id, 'warning', 
              'Cluster is using self-signed or untrusted SSL certificates',
              { 
                note: 'The cluster is reachable but uses certificates not trusted by default. This is common for internal/on-premises clusters.',
                endpoint: endpoint,
                server: serverUrl
              }
            )
            
            // Mark as warning status - cluster is reachable but has cert issues
            await updateClusterStatus(supabase, cluster_id, 'warning')
            connected = true
            break
          }
          // Continue trying other endpoints for non-cert errors
        }
      }
      
      if (!connected) {
        if (lastError) {
          if (lastError.name === 'AbortError') {
            await createLog(supabase, cluster_id, user_id, 'error', 
              'Connection timeout: Cluster did not respond within 15 seconds',
              { 
                note: 'The cluster endpoint may be behind a firewall or not accessible from the internet',
                server: serverUrl
              }
            )
          } else {
            await createLog(supabase, cluster_id, user_id, 'error', 
              `Connection failed: ${lastError.message}`,
              { 
                error: lastError.toString(),
                note: 'Check if the cluster endpoint is accessible and the URL is correct',
                server: serverUrl
              }
            )
          }
        } else {
          await createLog(supabase, cluster_id, user_id, 'error', 
            'Could not connect to any Kubernetes API endpoint',
            { 
              note: 'The cluster may be offline or the endpoint URL is incorrect',
              server: serverUrl,
              testedEndpoints: endpoints
            }
          )
        }
        await updateClusterStatus(supabase, cluster_id, 'error')
      }
      
      clearTimeout(timeoutId)
    } catch (fetchError: any) {
      await createLog(supabase, cluster_id, user_id, 'error', 
        `Unexpected error during connection: ${fetchError.message}`,
        { error: fetchError.toString() }
      )
      await updateClusterStatus(supabase, cluster_id, 'error')
    }
  } catch (error: any) {
    console.error('Kubernetes validation error:', error)
    await createLog(supabase, cluster_id, user_id, 'error', 
      `Configuration parsing failed: ${error.message}`,
      { error: error.toString(), stack: error.stack }
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
  console.log('Parsing kubeconfig, length:', yamlContent.length)
  
  const lines = yamlContent.split('\n')
  const config: any = {
    clusters: [],
    contexts: [],
    users: []
  }
  
  let currentSection: string | null = null
  let currentItem: any = null
  let indentLevel = 0
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    // Track section changes
    if (trimmed.startsWith('clusters:')) {
      currentSection = 'clusters'
      currentItem = null
      continue
    } else if (trimmed.startsWith('contexts:')) {
      currentSection = 'contexts'
      currentItem = null
      continue
    } else if (trimmed.startsWith('users:')) {
      currentSection = 'users'
      currentItem = null
      continue
    }
    
    // Handle cluster items
    if (currentSection === 'clusters') {
      if (trimmed.startsWith('- cluster:')) {
        currentItem = { cluster: {} }
        config.clusters.push(currentItem)
        continue
      }
      
      if (currentItem && trimmed.includes('server:')) {
        const match = trimmed.match(/server:\s*(.+)/)
        if (match) {
          currentItem.cluster.server = match[1].trim()
          console.log('Found server URL:', currentItem.cluster.server)
        }
      }
      
      if (currentItem && trimmed.includes('name:') && !currentItem.name) {
        const match = trimmed.match(/name:\s*(.+)/)
        if (match) {
          currentItem.name = match[1].trim()
        }
      }
    }
  }
  
  console.log('Parsed config:', JSON.stringify(config, null, 2))
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
