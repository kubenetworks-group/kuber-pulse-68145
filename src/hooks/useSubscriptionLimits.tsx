import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useSubscriptionLimits = () => {
  const { user } = useAuth();
  const [limits, setLimits] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchLimits();
    }
  }, [user]);

  const fetchLimits = async () => {
    try {
      setLoading(true);

      // Get organization
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!org) return;

      // Get subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organization_id', org.id)
        .single();

      if (!subscription) return;

      // Get plan limits
      const planSlug = subscription.plan_type === 'trial' ? 'starter' : subscription.plan_type;
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('limits')
        .eq('slug', planSlug)
        .single();

      // Get current cluster count
      const { count: clusterCount } = await supabase
        .from('clusters')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const planLimits = plan?.limits || { clusters: 1 };
      const maxClusters = typeof planLimits === 'object' && 'clusters' in planLimits && typeof planLimits.clusters === 'number'
        ? (planLimits.clusters === -1 ? Infinity : planLimits.clusters)
        : 1;

      setLimits({
        canConnectCluster: (clusterCount || 0) < maxClusters,
        clustersLimit: maxClusters,
        clustersUsed: clusterCount || 0,
        features: planLimits,
        subscription,
      });
    } catch (error) {
      console.error('Error fetching limits:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    ...limits,
    loading,
    refetch: fetchLimits,
  };
};
