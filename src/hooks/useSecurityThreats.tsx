import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCluster } from '@/contexts/ClusterContext';
import { toast } from '@/hooks/use-toast';

export interface SecurityThreat {
  id: string;
  cluster_id: string;
  user_id: string;
  threat_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'investigating' | 'mitigated' | 'false_positive';
  title: string;
  description: string | null;
  affected_resources: any[];
  ai_analysis: {
    threat_score?: number;
    confidence?: number;
    indicators?: string[];
    recommendation?: string;
    mitigation_steps?: string[];
  } | null;
  ai_recommendation: string | null;
  remediation_steps: any[];
  auto_remediated: boolean;
  remediated_at: string | null;
  remediation_result: any;
  detection_source: string;
  raw_data: any;
  false_positive: boolean;
  acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
  // Legacy fields for backwards compatibility
  container_name: string | null;
  container_id: string | null;
  pod_name: string | null;
  namespace: string | null;
  node_name: string | null;
  suspicious_command: string | null;
  suspicious_process: string | null;
  source_ip: string | null;
  destination_ip: string | null;
  affected_port: number | null;
  connection_count: number | null;
  network_activity: any;
  evidence: any;
  mitigated: boolean;
  mitigated_at: string | null;
  mitigation_action: string | null;
  detected_at: string;
}

export interface ThreatStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  active: number;
  mitigated: number;
}

export function useSecurityThreats() {
  const { user } = useAuth();
  const { selectedClusterId } = useCluster();
  const [threats, setThreats] = useState<SecurityThreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [stats, setStats] = useState<ThreatStats>({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    active: 0,
    mitigated: 0,
  });

  // Helper to transform data with defaults
  const transformThreat = (data: any): SecurityThreat => ({
    ...data,
    container_name: data.container_name || data.affected_resources?.[0]?.container || null,
    container_id: data.container_id || null,
    pod_name: data.pod_name || data.affected_resources?.[0]?.pod || null,
    namespace: data.namespace || data.affected_resources?.[0]?.namespace || null,
    node_name: data.node_name || data.affected_resources?.[0]?.node || null,
    suspicious_command: data.suspicious_command || data.raw_data?.command || null,
    suspicious_process: data.suspicious_process || null,
    source_ip: data.source_ip || data.raw_data?.source_ip || null,
    destination_ip: data.destination_ip || data.raw_data?.destination_ip || null,
    affected_port: data.affected_port || data.raw_data?.port || null,
    connection_count: data.connection_count || null,
    network_activity: data.network_activity || null,
    evidence: data.evidence || data.raw_data || null,
    mitigated: data.mitigated ?? data.status === 'mitigated',
    mitigated_at: data.mitigated_at || data.remediated_at || null,
    mitigation_action: data.mitigation_action || data.remediation_result?.action || null,
    detected_at: data.detected_at || data.created_at,
  });

  // Fetch threats
  const fetchThreats = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('security_threats' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (selectedClusterId) {
        query = query.eq('cluster_id', selectedClusterId);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      const threatData = ((data as any[]) || []).map(transformThreat);
      setThreats(threatData);

      // Calculate stats
      setStats({
        total: threatData.length,
        critical: threatData.filter(t => t.severity === 'critical').length,
        high: threatData.filter(t => t.severity === 'high').length,
        medium: threatData.filter(t => t.severity === 'medium').length,
        low: threatData.filter(t => t.severity === 'low').length,
        active: threatData.filter(t => t.status === 'active').length,
        mitigated: threatData.filter(t => t.status === 'mitigated' || t.mitigated).length,
      });
    } catch (error) {
      console.error('Error fetching threats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Run security scan
  const runSecurityScan = async () => {
    if (!selectedClusterId) {
      toast({
        title: 'Selecione um cluster',
        description: 'Por favor, selecione um cluster para executar a varredura de segurança.',
        variant: 'destructive',
      });
      return;
    }

    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-security-threats', {
        body: { cluster_id: selectedClusterId },
      });

      if (error) throw error;

      if (data.threats_found > 0) {
        toast({
          title: '🚨 Ameaças Detectadas',
          description: `Foram encontradas ${data.threats_found} ameaça(s) de segurança!`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: '✅ Cluster Seguro',
          description: 'Nenhuma ameaça de segurança foi detectada.',
        });
      }

      // Refresh threats list
      await fetchThreats();

      return data;
    } catch (error: any) {
      console.error('Error running security scan:', error);
      toast({
        title: 'Erro na varredura',
        description: error.message || 'Falha ao executar varredura de segurança',
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  // Implement security fix
  const implementSecurityFix = async (threatId: string, fixType: string) => {
    if (!selectedClusterId) return;

    try {
      const { data, error } = await supabase.functions.invoke('execute-security-fix', {
        body: { 
          cluster_id: selectedClusterId,
          threat_id: threatId,
          fix_type: fixType
        },
      });

      if (error) throw error;

      toast({
        title: '🔧 Correção Aplicada',
        description: 'A correção de segurança foi implementada com sucesso.',
      });

      await fetchThreats();
      return data;
    } catch (error: any) {
      console.error('Error implementing security fix:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao implementar correção',
        variant: 'destructive',
      });
    }
  };

  // Mark threat as mitigated
  const mitigateThreat = async (threatId: string, action: string) => {
    try {
      const { error } = await supabase
        .from('security_threats' as any)
        .update({
          status: 'mitigated',
          remediated_at: new Date().toISOString(),
          remediation_result: { action, manual: true },
        })
        .eq('id', threatId);

      if (error) throw error;

      toast({
        title: '✅ Ameaça Mitigada',
        description: 'A ameaça foi marcada como mitigada.',
      });

      await fetchThreats();
    } catch (error: any) {
      console.error('Error mitigating threat:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao mitigar ameaça',
        variant: 'destructive',
      });
    }
  };

  // Mark threat as false positive
  const markAsFalsePositive = async (threatId: string) => {
    try {
      const { error } = await supabase
        .from('security_threats' as any)
        .update({
          status: 'false_positive',
          false_positive: true,
        })
        .eq('id', threatId);

      if (error) throw error;

      toast({
        title: 'Marcado como Falso Positivo',
        description: 'A ameaça foi marcada como falso positivo.',
      });

      await fetchThreats();
    } catch (error: any) {
      console.error('Error marking as false positive:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao marcar como falso positivo',
        variant: 'destructive',
      });
    }
  };

  // Update threat status
  const updateThreatStatus = async (threatId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('security_threats' as any)
        .update({ status })
        .eq('id', threatId);

      if (error) throw error;

      await fetchThreats();
    } catch (error: any) {
      console.error('Error updating threat status:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar status',
        variant: 'destructive',
      });
    }
  };

  // Initial fetch and realtime subscription
  useEffect(() => {
    if (user) {
      fetchThreats();
    }
  }, [user, selectedClusterId]);

  // Continuous security monitoring - auto-trigger analysis every 2 minutes
  useEffect(() => {
    if (!user || !selectedClusterId) return;

    const runContinuousMonitoring = async () => {
      try {
        // Silently run security analysis in background
        await supabase.functions.invoke('analyze-security-threats', {
          body: { cluster_id: selectedClusterId, silent: true },
        });
        // Refresh threats after analysis
        await fetchThreats();
      } catch (error) {
        console.error('Background security monitoring error:', error);
      }
    };

    // Run initial analysis after 10 seconds
    const initialTimeout = setTimeout(runContinuousMonitoring, 10000);

    // Then run every 2 minutes (120000ms)
    const monitoringInterval = setInterval(runContinuousMonitoring, 120000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(monitoringInterval);
    };
  }, [user, selectedClusterId]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`security-threats-${selectedClusterId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'security_threats',
          ...(selectedClusterId && { filter: `cluster_id=eq.${selectedClusterId}` }),
        },
        (payload) => {
          const newThreat = transformThreat(payload.new);
          setThreats(prev => [newThreat, ...prev]);

          // Show toast for critical/high threats
          if (newThreat.severity === 'critical' || newThreat.severity === 'high') {
            toast({
              title: newThreat.severity === 'critical' ? '🚨 AMEAÇA CRÍTICA!' : '⚠️ Ameaça Detectada',
              description: newThreat.title,
              variant: 'destructive',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'security_threats',
          ...(selectedClusterId && { filter: `cluster_id=eq.${selectedClusterId}` }),
        },
        (payload) => {
          const updatedThreat = transformThreat(payload.new);
          setThreats(prev =>
            prev.map(t => (t.id === updatedThreat.id ? updatedThreat : t))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedClusterId]);

  return {
    threats,
    stats,
    loading,
    scanning,
    fetchThreats,
    runSecurityScan,
    implementSecurityFix,
    mitigateThreat,
    markAsFalsePositive,
    updateThreatStatus,
  };
}
