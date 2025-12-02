import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

type PlanType = 'free' | 'pro' | 'enterprise';
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
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  stripe_price_id?: string;
  current_period_end?: string;
}

interface PlanLimits {
  clusters: number;
  aiAnalysesPerMonth: number;
  historyRetentionDays: number;
  autoHealing: boolean;
}

const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    clusters: 1,
    aiAnalysesPerMonth: 10,
    historyRetentionDays: 7,
    autoHealing: false,
  },
  pro: {
    clusters: 5,
    aiAnalysesPerMonth: 100,
    historyRetentionDays: 30,
    autoHealing: true,
  },
  enterprise: {
    clusters: Infinity,
    aiAnalysesPerMonth: Infinity,
    historyRetentionDays: 90,
    autoHealing: true,
  },
};

interface SubscriptionContextType {
  subscription: Subscription | null;
  loading: boolean;
  isReadOnly: boolean;
  isTrialActive: boolean;
  daysLeftInTrial: number;
  currentPlan: PlanType;
  planLimits: PlanLimits;
  canCreateCluster: (currentCount: number) => boolean;
  canUseAI: () => boolean;
  canUseAutoHealing: () => boolean;
  incrementAIUsage: () => Promise<void>;
  changePlan: (plan: PlanType) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
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

  const isTrialActive = subscription?.status === 'trialing' && 
    new Date(subscription.trial_ends_at) > new Date();

  const daysLeftInTrial = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isReadOnly = subscription?.status === 'readonly' || 
    (subscription?.status === 'trialing' && daysLeftInTrial === 0);

  const currentPlan = subscription?.plan || 'free';
  const planLimits = PLAN_LIMITS[currentPlan];

  // During trial, user has full access (enterprise-like)
  const effectiveLimits = isTrialActive ? PLAN_LIMITS.enterprise : planLimits;

  const canCreateCluster = (currentCount: number): boolean => {
    if (isReadOnly) return false;
    if (isTrialActive) return true;
    return currentCount < effectiveLimits.clusters;
  };

  const canUseAI = (): boolean => {
    if (isReadOnly) return false;
    if (isTrialActive) return true;
    if (effectiveLimits.aiAnalysesPerMonth === Infinity) return true;
    return (subscription?.ai_analyses_used || 0) < effectiveLimits.aiAnalysesPerMonth;
  };

  const canUseAutoHealing = (): boolean => {
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
      canCreateCluster,
      canUseAI,
      canUseAutoHealing,
      incrementAIUsage,
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
