import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface WhatsAppApproval {
  id: string;
  cluster_id: string;
  user_id: string;
  anomaly_id: string | null;
  action_type: string;
  action_params: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'executed';
  whatsapp_message_id: string | null;
  expires_at: string;
  user_response: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface WhatsAppProfile {
  whatsapp_phone: string | null;
  whatsapp_verified: boolean;
  whatsapp_notifications_enabled: boolean;
}

export function useWhatsAppApprovals() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<WhatsAppApproval[]>([]);
  const [profile, setProfile] = useState<WhatsAppProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const fetchApprovals = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('whatsapp_approvals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setApprovals((data as WhatsAppApproval[]) || []);
    } catch (error: any) {
      console.error('Error fetching approvals:', error);
    }
  }, [user]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('whatsapp_phone, whatsapp_verified, whatsapp_notifications_enabled')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data as WhatsAppProfile);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchApprovals();
    fetchProfile();

    // Set up realtime subscription for approvals
    const channel = supabase
      .channel('whatsapp-approvals')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_approvals',
        },
        () => {
          fetchApprovals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchApprovals, fetchProfile]);

  const sendVerificationCode = async (phoneNumber: string) => {
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-verify-phone', {
        body: { phone_number: phoneNumber }
      });

      if (error) throw error;

      if (data.test_code) {
        toast.info(`Código de teste: ${data.test_code}`, {
          description: 'WhatsApp não configurado - use este código',
          duration: 30000
        });
      } else {
        toast.success('Código enviado para seu WhatsApp');
      }

      await fetchProfile();
      return { success: true, testCode: data.test_code };
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar código');
      return { success: false };
    } finally {
      setVerifying(false);
    }
  };

  const confirmVerification = async (code: string) => {
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-confirm-verification', {
        body: { code }
      });

      if (error) throw error;

      toast.success('WhatsApp verificado com sucesso!');
      await fetchProfile();
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Código inválido ou expirado');
      return { success: false };
    } finally {
      setVerifying(false);
    }
  };

  const toggleNotifications = async (enabled: boolean) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ whatsapp_notifications_enabled: enabled })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, whatsapp_notifications_enabled: enabled } : null);
      toast.success(enabled ? 'Notificações ativadas' : 'Notificações desativadas');
    } catch (error: any) {
      toast.error('Erro ao atualizar configuração');
    }
  };

  const approveAction = async (approvalId: string) => {
    try {
      const approval = approvals.find(a => a.id === approvalId);
      if (!approval) return;

      // Update approval status
      const { error: updateError } = await supabase
        .from('whatsapp_approvals')
        .update({
          status: 'approved',
          responded_at: new Date().toISOString(),
          user_response: 'approved_via_web'
        })
        .eq('id', approvalId);

      if (updateError) throw updateError;

      // Create agent command
      const { error: commandError } = await supabase
        .from('agent_commands')
        .insert({
          cluster_id: approval.cluster_id,
          user_id: approval.user_id,
          command_type: approval.action_type,
          command_params: approval.action_params,
          status: 'pending',
        });

      if (commandError) throw commandError;

      // Update to executed
      await supabase
        .from('whatsapp_approvals')
        .update({ status: 'executed' })
        .eq('id', approvalId);

      toast.success('Ação aprovada e enviada para execução');
      await fetchApprovals();
    } catch (error: any) {
      toast.error('Erro ao aprovar ação');
    }
  };

  const rejectAction = async (approvalId: string) => {
    try {
      const { error } = await supabase
        .from('whatsapp_approvals')
        .update({
          status: 'rejected',
          responded_at: new Date().toISOString(),
          user_response: 'rejected_via_web'
        })
        .eq('id', approvalId);

      if (error) throw error;

      toast.info('Ação rejeitada');
      await fetchApprovals();
    } catch (error: any) {
      toast.error('Erro ao rejeitar ação');
    }
  };

  const pendingApprovals = approvals.filter(
    a => a.status === 'pending' && new Date(a.expires_at) > new Date()
  );

  return {
    approvals,
    pendingApprovals,
    profile,
    loading,
    verifying,
    sendVerificationCode,
    confirmVerification,
    toggleNotifications,
    approveAction,
    rejectAction,
    refetch: fetchApprovals,
  };
}
