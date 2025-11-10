import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useOnboarding = () => {
  const { user } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
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
        .select('onboarding_completed')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;

      // If no organization exists or onboarding not completed, needs onboarding
      setNeedsOnboarding(!data || !data.onboarding_completed);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setNeedsOnboarding(true);
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ onboarding_completed: true })
        .eq('user_id', user?.id);

      if (error) throw error;
      setNeedsOnboarding(false);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  };

  return {
    needsOnboarding,
    loading,
    checkOnboardingStatus,
    completeOnboarding,
  };
};
