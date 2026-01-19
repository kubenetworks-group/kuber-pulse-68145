import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

type PlanType = 'free' | 'pro';
type SubscriptionStatus = 'trialing' | 'active' | 'expired' | 'readonly';

interface Subscription {
  id: string;
  user_id: string;
  plan: PlanType;
  status: SubscriptionStatus;
  trial_started_at: string;
  trial_ends_at: string;
  ai_analyses_used: number;
  ai_analyses_reset_at: string;
  storage_analyses_used: number;
  storage_analyses_reset_at: string;
  chat_messages_used: number;
  chat_messages_reset_at: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  stripe_price_id?: string;
  current_period_end?: string;
  custom_cluster_limit?: number | null;
}

interface PlanLimits {
  clusters: number;
  aiAnalysesPerMonth: number;
  storageAnalysesPerMonth: number;
  chatMessagesPerMonth: number;
  historyRetentionDays: number;
  autoHealing: boolean;
}

const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    clusters: 1,
    aiAnalysesPerMonth: 10,
    storageAnalysesPerMonth: 1,
    chatMessagesPerMonth: 10,
    historyRetentionDays: 7,
    autoHealing: false,
  },
  pro: {
    clusters: 10,
    aiAnalysesPerMonth: Infinity,
    storageAnalysesPerMonth: 3,
    chatMessagesPerMonth: Infinity,
    historyRetentionDays: 90,
    autoHealing: true,
  },
};

interface AIUsageLimits {
  storageAnalyses: { used: number; limit: number; resetAt: Date | null };
  chatMessages: { used: number; limit: number; resetAt: Date | null };
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  loading: boolean;
  isReadOnly: boolean;
  isTrialActive: boolean;
  daysLeftInTrial: number;
  currentPlan: PlanType;
  planLimits: PlanLimits;
  aiUsageLimits: AIUsageLimits;
  canCreateCluster: (currentCount: number) => boolean;
  canUseAI: () => boolean;
  canUseStorageAnalysis: () => boolean;
  canUseChatMessage: () => boolean;
  canUseAutoHealing: () => boolean;
  incrementAIUsage: () => Promise<void>;
  incrementStorageAnalysis: () => Promise<void>;
  incrementChatMessage: () => Promise<void>;
  changePlan: (plan: PlanType) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      // Check if user is admin
      const { data: adminCheck } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });
      setIsAdmin(!!adminCheck);

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // If no subscription found, create one (for existing users)
        if (error.code === 'PGRST116') {
          const { data: newSub, error: insertError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: user.id,
              plan: 'free',
              status: 'trialing',
              trial_started_at: new Date().toISOString(),
              trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .select()
            .single();

          if (!insertError && newSub) {
            setSubscription(newSub as Subscription);
          }
        }
      } else {
        setSubscription(data as Subscription);
      }
    } catch (err) {
      console.error('Error fetching subscription:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Admin users are always "pro" without trial restrictions
  const isTrialActive = !isAdmin && subscription?.status === 'trialing' && 
    new Date(subscription.trial_ends_at) > new Date();

  const daysLeftInTrial = isAdmin ? Infinity : (subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0);

  // Admin users are never read-only
  const isReadOnly = !isAdmin && (subscription?.status === 'readonly' || 
    (subscription?.status === 'trialing' && daysLeftInTrial === 0));

  // Admin users always have pro plan
  const currentPlan: PlanType = isAdmin ? 'pro' : (subscription?.plan || 'free');
  const planLimits = PLAN_LIMITS[currentPlan];

  // Admin or during trial = full access (pro-like)
  const effectiveLimits = isAdmin || isTrialActive ? PLAN_LIMITS.pro : planLimits;

  // Check if storage analyses reset is needed
  const checkAndResetUsage = useCallback(async () => {
    if (!subscription) return;

    const now = new Date();
    const updates: Record<string, unknown> = {};

    if (subscription.storage_analyses_reset_at && new Date(subscription.storage_analyses_reset_at) <= now) {
      updates.storage_analyses_used = 0;
      updates.storage_analyses_reset_at = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    }

    if (subscription.chat_messages_reset_at && new Date(subscription.chat_messages_reset_at) <= now) {
      updates.chat_messages_used = 0;
      updates.chat_messages_reset_at = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('subscriptions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', subscription.id);

      if (!error) {
        setSubscription(prev => prev ? { ...prev, ...updates } as Subscription : null);
      }
    }
  }, [subscription]);

  useEffect(() => {
    checkAndResetUsage();
  }, [checkAndResetUsage]);

  // AI Usage Limits
  const aiUsageLimits: AIUsageLimits = {
    storageAnalyses: {
      used: subscription?.storage_analyses_used || 0,
      limit: effectiveLimits.storageAnalysesPerMonth,
      resetAt: subscription?.storage_analyses_reset_at ? new Date(subscription.storage_analyses_reset_at) : null,
    },
    chatMessages: {
      used: subscription?.chat_messages_used || 0,
      limit: effectiveLimits.chatMessagesPerMonth,
      resetAt: subscription?.chat_messages_reset_at ? new Date(subscription.chat_messages_reset_at) : null,
    },
  };

  const canCreateCluster = (currentCount: number): boolean => {
    if (isAdmin) return true;
    if (isReadOnly) return false;
    if (isTrialActive) return true;
    
    const clusterLimit = subscription?.custom_cluster_limit ?? effectiveLimits.clusters;
    return currentCount < clusterLimit;
  };

  const canUseAI = (): boolean => {
    if (isAdmin) return true;
    if (isReadOnly) return false;
    if (isTrialActive) return true;
    if (effectiveLimits.aiAnalysesPerMonth === Infinity) return true;
    return (subscription?.ai_analyses_used || 0) < effectiveLimits.aiAnalysesPerMonth;
  };

  const canUseStorageAnalysis = (): boolean => {
    if (isAdmin) return true;
    if (isReadOnly) return false;
    if (isTrialActive) return true;
    if (effectiveLimits.storageAnalysesPerMonth === Infinity) return true;
    return (subscription?.storage_analyses_used || 0) < effectiveLimits.storageAnalysesPerMonth;
  };

  const canUseChatMessage = (): boolean => {
    if (isAdmin) return true;
    if (isReadOnly) return false;
    if (isTrialActive) return true;
    if (effectiveLimits.chatMessagesPerMonth === Infinity) return true;
    return (subscription?.chat_messages_used || 0) < effectiveLimits.chatMessagesPerMonth;
  };

  const canUseAutoHealing = (): boolean => {
    if (isAdmin) return true;
    if (isReadOnly) return false;
    if (isTrialActive) return true;
    return effectiveLimits.autoHealing;
  };

  const incrementAIUsage = async () => {
    if (!subscription) return;
    
    const { error } = await supabase
      .from('subscriptions')
      .update({ 
        ai_analyses_used: (subscription.ai_analyses_used || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    if (!error) {
      setSubscription(prev => prev ? { ...prev, ai_analyses_used: (prev.ai_analyses_used || 0) + 1 } : null);
    }
  };

  const incrementStorageAnalysis = async () => {
    if (!subscription) return;
    
    const { error } = await supabase
      .from('subscriptions')
      .update({ 
        storage_analyses_used: (subscription.storage_analyses_used || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    if (!error) {
      setSubscription(prev => prev ? { ...prev, storage_analyses_used: (prev.storage_analyses_used || 0) + 1 } : null);
    }
  };

  const incrementChatMessage = async () => {
    if (!subscription) return;
    
    const { error } = await supabase
      .from('subscriptions')
      .update({ 
        chat_messages_used: (subscription.chat_messages_used || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    if (!error) {
      setSubscription(prev => prev ? { ...prev, chat_messages_used: (prev.chat_messages_used || 0) + 1 } : null);
    }
  };

  const changePlan = async (plan: PlanType): Promise<boolean> => {
    if (!subscription) return false;

    const { error } = await supabase
      .from('subscriptions')
      .update({ 
        plan,
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    if (!error) {
      setSubscription(prev => prev ? { ...prev, plan, status: 'active' } : null);
      return true;
    }
    return false;
  };

  return (
    <SubscriptionContext.Provider value={{
      subscription,
      loading,
      isReadOnly,
      isTrialActive,
      daysLeftInTrial,
      currentPlan,
      planLimits: effectiveLimits,
      aiUsageLimits,
      canCreateCluster,
      canUseAI,
      canUseStorageAnalysis,
      canUseChatMessage,
      canUseAutoHealing,
      incrementAIUsage,
      incrementStorageAnalysis,
      incrementChatMessage,
      changePlan,
      refetch: fetchSubscription,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export { PLAN_LIMITS };
export type { PlanType, PlanLimits, Subscription };
