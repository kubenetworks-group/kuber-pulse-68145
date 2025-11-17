import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useOnboarding = () => {
  const { user } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkOnboardingStatus();
    }
  }, [user]);

  const checkOnboardingStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, onboarding_completed')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // If no organization exists or onboarding not completed, needs onboarding
      setNeedsOnboarding(!data || !data.onboarding_completed);
      setOrganizationId(data?.id || null);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setNeedsOnboarding(true);
      setOrganizationId(null);
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      // Update the most recent organization
      const { error } = await supabase
        .from('organizations')
        .update({ onboarding_completed: true })
        .eq('user_id', user?.id);

      if (error) throw error;
      
      // Force reload the onboarding status
      await checkOnboardingStatus();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  };

  return {
    needsOnboarding,
    organizationId,
    loading,
    checkOnboardingStatus,
    completeOnboarding,
  };
};
