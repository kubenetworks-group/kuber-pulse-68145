import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-key",
};

// Suspicious patterns for threat detection
const suspiciousPatterns = {
  paths: [
    /\.\.\//, // Path traversal
    /\.(php|asp|aspx|jsp|cgi|exe|sh|bat)(\?|$)/i, // Dangerous file extensions
    /(wp-admin|wp-content|wp-includes)/i, // WordPress probing
    /(phpmyadmin|adminer|phpinfo)/i, // Admin panel probing
    /\/\.env|\/\.git|\/\.htaccess/i, // Hidden file access
    /(select|union|insert|update|delete|drop|exec|xp_)/i, // SQL injection
    /<script|javascript:|on\w+=/i, // XSS patterns
    /\/(etc\/passwd|etc\/shadow|proc\/self)/i, // LFI patterns
    /\/api\/v\d+\/(admin|internal|private)/i, // Internal API probing
    /(shell|cmd|powershell|bash)/i, // Command injection
  ],
  userAgents: [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /zgrab/i,
    /curl\/\d/i,
    /python-requests/i,
    /go-http-client/i,
    /libwww-perl/i,
    /dirbuster/i,
    /gobuster/i,
    /nuclei/i,
    /wpscan/i,
    /hydra/i,
  ],
  methods: ["TRACE", "TRACK", "DEBUG", "CONNECT"],
};

function analyzeThreat(log: any): { isSuspicious: boolean; threatLevel: string; reason: string } {
  const reasons: string[] = [];
  let threatScore = 0;

  // Check request path
  for (const pattern of suspiciousPatterns.paths) {
    if (pattern.test(log.request_path || "")) {
      reasons.push("Padrão suspeito no caminho da requisição");
      threatScore += 30;
      break;
    }
  }

  // Check user agent
  for (const pattern of suspiciousPatterns.userAgents) {
    if (pattern.test(log.user_agent || "")) {
      reasons.push("User-Agent de ferramenta de ataque conhecida");
      threatScore += 40;
      break;
    }
  }

  // Check HTTP method
  if (suspiciousPatterns.methods.includes(log.request_method?.toUpperCase())) {
    reasons.push("Método HTTP potencialmente perigoso");
    threatScore += 25;
  }

  // Check for rapid requests (rate limiting concern)
  // This would require checking against recent requests, simplified here

  // Check status codes patterns
  if (log.status_code >= 500) {
    reasons.push("Erro de servidor possivelmente causado por payload malicioso");
    threatScore += 15;
  } else if (log.status_code === 403 || log.status_code === 401) {
    reasons.push("Tentativa de acesso não autorizado");
    threatScore += 10;
  }

  // Empty or suspicious user agent
  if (!log.user_agent || log.user_agent.length < 10) {
    reasons.push("User-Agent ausente ou muito curto");
    threatScore += 15;
  }

  // Determine threat level
  let threatLevel = "none";
  if (threatScore >= 60) threatLevel = "critical";
  else if (threatScore >= 40) threatLevel = "high";
  else if (threatScore >= 25) threatLevel = "medium";
  else if (threatScore >= 10) threatLevel = "low";

  return {
    isSuspicious: threatScore >= 10,
    threatLevel,
    reason: reasons.join("; ") || "Nenhuma ameaça detectada",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate agent
    const agentKey = req.headers.get("x-agent-key");
    if (!agentKey) {
      return new Response(JSON.stringify({ error: "Missing agent key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify agent key
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from("agent_api_keys")
      .select("user_id, cluster_id")
      .eq("api_key", agentKey)
      .eq("is_active", true)
      .single();

    if (apiKeyError || !apiKeyData) {
      return new Response(JSON.stringify({ error: "Invalid agent key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, cluster_id } = apiKeyData;

    const body = await req.json();
    const { services, traffic_logs } = body;

    // Process and upsert LoadBalancer services
    if (services && Array.isArray(services)) {
      for (const service of services) {
        const { data: existing } = await supabase
          .from("loadbalancer_services")
          .select("id, total_requests, suspicious_requests")
          .eq("cluster_id", cluster_id)
          .eq("service_name", service.name)
          .eq("namespace", service.namespace)
          .single();

        if (existing) {
          await supabase
            .from("loadbalancer_services")
            .update({
              external_ip: service.external_ip,
              ports: service.ports || [],
              has_network_policy: service.has_network_policy || false,
              last_seen_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("loadbalancer_services").insert({
            cluster_id,
            user_id,
            service_name: service.name,
            namespace: service.namespace,
            external_ip: service.external_ip,
            ports: service.ports || [],
            has_network_policy: service.has_network_policy || false,
          });
        }
      }
    }

    // Process and analyze traffic logs
    let suspiciousCount = 0;
    const processedLogs: any[] = [];

    if (traffic_logs && Array.isArray(traffic_logs)) {
      for (const log of traffic_logs) {
        const analysis = analyzeThreat(log);
        
        const processedLog = {
          cluster_id,
          user_id,
          service_name: log.service_name,
          namespace: log.namespace,
          external_ip: log.external_ip,
          source_ip: log.source_ip,
          request_path: log.request_path,
          request_method: log.request_method,
          status_code: log.status_code,
          user_agent: log.user_agent,
          is_suspicious: analysis.isSuspicious,
          threat_level: analysis.threatLevel,
          threat_reason: analysis.reason,
          request_timestamp: log.timestamp || new Date().toISOString(),
        };

        processedLogs.push(processedLog);

        if (analysis.isSuspicious) {
          suspiciousCount++;
        }
      }

      // Insert traffic logs
      if (processedLogs.length > 0) {
        await supabase.from("loadbalancer_traffic_logs").insert(processedLogs);
      }

      // Update service stats
      const serviceStats: Record<string, { total: number; suspicious: number }> = {};
      for (const log of processedLogs) {
        const key = `${log.service_name}:${log.namespace}`;
        if (!serviceStats[key]) {
          serviceStats[key] = { total: 0, suspicious: 0 };
        }
        serviceStats[key].total++;
        if (log.is_suspicious) {
          serviceStats[key].suspicious++;
        }
      }

      for (const [key, stats] of Object.entries(serviceStats)) {
        const [serviceName, namespace] = key.split(":");
        
        const { data: service } = await supabase
          .from("loadbalancer_services")
          .select("id, total_requests, suspicious_requests")
          .eq("cluster_id", cluster_id)
          .eq("service_name", serviceName)
          .eq("namespace", namespace)
          .single();

        if (service) {
          await supabase
            .from("loadbalancer_services")
            .update({
              total_requests: (service.total_requests || 0) + stats.total,
              suspicious_requests: (service.suspicious_requests || 0) + stats.suspicious,
              last_suspicious_at: stats.suspicious > 0 ? new Date().toISOString() : undefined,
              updated_at: new Date().toISOString(),
            })
            .eq("id", service.id);
        }
      }
    }

    // Update last_seen on agent_api_keys
    await supabase
      .from("agent_api_keys")
      .update({ last_seen: new Date().toISOString() })
      .eq("api_key", agentKey);

    return new Response(
      JSON.stringify({
        success: true,
        processed: {
          services: services?.length || 0,
          traffic_logs: processedLogs.length,
          suspicious: suspiciousCount,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error processing LB traffic:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errMsg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
