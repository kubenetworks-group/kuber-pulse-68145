import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSubscription();
    }
  }, [user]);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      
      // Get organization first
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!org) {
        setSubscription(null);
        return;
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organization_id', org.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      setSubscription(data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  const isTrialing = subscription?.status === 'trialing';
  const isActive = subscription?.status === 'active';
  const isExpired = subscription?.status === 'expired';
  const isPastDue = subscription?.status === 'past_due';

  const daysLeftInTrial = subscription?.trial_end
    ? Math.max(0, Math.ceil((new Date(subscription.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const trialExpired = isTrialing && daysLeftInTrial === 0;

  return {
    subscription,
    loading,
    isTrialing,
    isActive,
    isExpired,
    isPastDue,
    daysLeftInTrial,
    trialExpired,
    currentPlan: subscription?.plan_type || 'trial',
    status: subscription?.status || 'trialing',
    refetch: fetchSubscription,
  };
};
