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
  ai_analysis: {
    threat_score?: number;
    confidence?: number;
    indicators?: string[];
    recommendation?: string;
    mitigation_steps?: string[];
  } | null;
  evidence: any;
  raw_data: any;
  mitigated: boolean;
  mitigated_at: string | null;
  mitigation_action: string | null;
  false_positive: boolean;
  detected_at: string;
  created_at: string;
  updated_at: string;
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

  // Fetch threats
  const fetchThreats = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('security_threats')
        .select('*')
        .eq('user_id', user.id)
        .order('detected_at', { ascending: false });

      if (selectedClusterId) {
        query = query.eq('cluster_id', selectedClusterId);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      setThreats((data as SecurityThreat[]) || []);

      // Calculate stats
      const threatData = (data as SecurityThreat[]) || [];
      setStats({
        total: threatData.length,
        critical: threatData.filter(t => t.severity === 'critical').length,
        high: threatData.filter(t => t.severity === 'high').length,
        medium: threatData.filter(t => t.severity === 'medium').length,
        low: threatData.filter(t => t.severity === 'low').length,
        active: threatData.filter(t => t.status === 'active').length,
        mitigated: threatData.filter(t => t.mitigated).length,
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
        description: 'Por favor, selecione um cluster para executar a varredura de seguranca.',
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
          title: '🚨 Ameacas Detectadas',
          description: `Foram encontradas ${data.threats_found} ameaca(s) de seguranca!`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: '✅ Cluster Seguro',
          description: 'Nenhuma ameaca de seguranca foi detectada.',
        });
      }

      // Refresh threats list
      await fetchThreats();

      return data;
    } catch (error: any) {
      console.error('Error running security scan:', error);
      toast({
        title: 'Erro na varredura',
        description: error.message || 'Falha ao executar varredura de seguranca',
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  // Mark threat as mitigated
  const mitigateThreat = async (threatId: string, action: string) => {
    try {
      const { error } = await supabase
        .from('security_threats')
        .update({
          status: 'mitigated',
          mitigated: true,
          mitigated_at: new Date().toISOString(),
          mitigation_action: action,
        })
        .eq('id', threatId);

      if (error) throw error;

      toast({
        title: '✅ Ameaca Mitigada',
        description: 'A ameaca foi marcada como mitigada.',
      });

      await fetchThreats();
    } catch (error: any) {
      console.error('Error mitigating threat:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao mitigar ameaca',
        variant: 'destructive',
      });
    }
  };

  // Mark threat as false positive
  const markAsFalsePositive = async (threatId: string) => {
    try {
      const { error } = await supabase
        .from('security_threats')
        .update({
          status: 'false_positive',
          false_positive: true,
        })
        .eq('id', threatId);

      if (error) throw error;

      toast({
        title: 'Marcado como Falso Positivo',
        description: 'A ameaca foi marcada como falso positivo.',
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
        .from('security_threats')
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
          const newThreat = payload.new as SecurityThreat;
          setThreats(prev => [newThreat, ...prev]);

          // Show toast for critical/high threats
          if (newThreat.severity === 'critical' || newThreat.severity === 'high') {
            toast({
              title: newThreat.severity === 'critical' ? '🚨 AMEACA CRITICA!' : '⚠️ Ameaca Detectada',
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
          const updatedThreat = payload.new as SecurityThreat;
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
    mitigateThreat,
    markAsFalsePositive,
    updateThreatStatus,
  };
}
