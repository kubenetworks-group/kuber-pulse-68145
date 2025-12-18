import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCluster } from '@/contexts/ClusterContext';
import { toast } from '@/hooks/use-toast';

export interface AutoHealSettings {
  id: string;
  cluster_id: string;
  user_id: string;
  enabled: boolean;
  auto_apply_security: boolean;
  auto_apply_anomalies: boolean;
  severity_threshold: 'low' | 'medium' | 'high' | 'critical';
  scan_interval_minutes: number;
  require_whatsapp_approval?: boolean;
  approval_timeout_minutes?: number;
  created_at: string;
  updated_at: string;
}

export interface AutoHealAction {
  id: string;
  cluster_id: string;
  user_id: string;
  action_type: string;
  trigger_reason: string;
  trigger_entity_id: string | null;
  trigger_entity_type: string | null;
  action_details: any;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result: any;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export function useAutoHeal() {
  const { user } = useAuth();
  const { selectedClusterId } = useCluster();
  const [settings, setSettings] = useState<AutoHealSettings | null>(null);
  const [actions, setActions] = useState<AutoHealAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    if (!user || !selectedClusterId) {
      setSettings(null);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('auto_heal_settings' as any)
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      setSettings(data as unknown as AutoHealSettings);
    } catch (error) {
      console.error('Error fetching auto-heal settings:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedClusterId]);

  // Fetch actions log
  const fetchActions = useCallback(async () => {
    if (!user || !selectedClusterId) {
      setActions([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('auto_heal_actions_log' as any)
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setActions((data as unknown as AutoHealAction[]) || []);
    } catch (error) {
      console.error('Error fetching auto-heal actions:', error);
    }
  }, [user, selectedClusterId]);

  // Save settings
  const saveSettings = async (newSettings: Partial<AutoHealSettings>) => {
    if (!user || !selectedClusterId) return;

    setSaving(true);
    try {
      if (settings?.id) {
        // Update existing
        const { error } = await supabase
          .from('auto_heal_settings' as any)
          .update({
            ...newSettings,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('auto_heal_settings' as any)
          .insert({
            cluster_id: selectedClusterId,
            user_id: user.id,
            enabled: false,
            auto_apply_security: false,
            auto_apply_anomalies: false,
            severity_threshold: 'high',
            scan_interval_minutes: 5,
            ...newSettings,
          });

        if (error) throw error;
      }

      await fetchSettings();

      toast({
        title: '✅ Configurações Salvas',
        description: 'As configurações de auto-cura foram atualizadas.',
      });
    } catch (error: any) {
      console.error('Error saving auto-heal settings:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao salvar configurações',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Toggle auto-heal
  const toggleAutoHeal = async (enabled: boolean) => {
    await saveSettings({ enabled });

    if (enabled) {
      toast({
        title: '🤖 Auto-Cura Ativada',
        description: 'O sistema irá monitorar e corrigir problemas automaticamente.',
      });
    } else {
      toast({
        title: 'Auto-Cura Desativada',
        description: 'O monitoramento automático foi pausado.',
      });
    }
  };

  // Toggle security auto-fix
  const toggleSecurityAutoFix = async (enabled: boolean) => {
    await saveSettings({ auto_apply_security: enabled });
  };

  // Toggle anomalies auto-fix
  const toggleAnomaliesAutoFix = async (enabled: boolean) => {
    await saveSettings({ auto_apply_anomalies: enabled });
  };

  // Update severity threshold
  const updateSeverityThreshold = async (threshold: 'low' | 'medium' | 'high' | 'critical') => {
    await saveSettings({ severity_threshold: threshold });
  };

  // Update scan interval
  const updateScanInterval = async (minutes: number) => {
    await saveSettings({ scan_interval_minutes: minutes });
  };

  // Manual trigger scan and heal
  const triggerScanAndHeal = async () => {
    if (!selectedClusterId) {
      toast({
        title: 'Selecione um cluster',
        description: 'Por favor, selecione um cluster para executar a análise.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('auto-heal-continuous', {
        body: { 
          cluster_id: selectedClusterId,
          force: true
        },
      });

      if (error) throw error;

      toast({
        title: '🔍 Análise Iniciada',
        description: 'O sistema está analisando e corrigindo problemas.',
      });

      // Refresh actions after a delay
      setTimeout(() => {
        fetchActions();
      }, 2000);

      return data;
    } catch (error: any) {
      console.error('Error triggering scan and heal:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao iniciar análise',
        variant: 'destructive',
      });
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchSettings();
    fetchActions();
  }, [fetchSettings, fetchActions]);

  // Realtime subscription for actions
  useEffect(() => {
    if (!user || !selectedClusterId) return;

    const channel = supabase
      .channel(`auto-heal-actions-${selectedClusterId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auto_heal_actions_log',
          filter: `cluster_id=eq.${selectedClusterId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newAction = payload.new as unknown as AutoHealAction;
            setActions(prev => [newAction, ...prev].slice(0, 50));

            toast({
              title: '🤖 Auto-Cura em Ação',
              description: `Executando: ${newAction.action_type}`,
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedAction = payload.new as unknown as AutoHealAction;
            setActions(prev =>
              prev.map(a => (a.id === updatedAction.id ? updatedAction : a))
            );

            if (updatedAction.status === 'completed') {
              toast({
                title: '✅ Correção Concluída',
                description: `${updatedAction.action_type} executado com sucesso`,
              });
            } else if (updatedAction.status === 'failed') {
              toast({
                title: '❌ Correção Falhou',
                description: updatedAction.error_message || 'Erro ao executar correção',
                variant: 'destructive',
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedClusterId]);

  return {
    settings,
    actions,
    loading,
    saving,
    fetchSettings,
    fetchActions,
    saveSettings,
    toggleAutoHeal,
    toggleSecurityAutoFix,
    toggleAnomaliesAutoFix,
    updateSeverityThreshold,
    updateScanInterval,
    triggerScanAndHeal,
  };
}
