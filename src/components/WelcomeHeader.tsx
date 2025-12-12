import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";

export const WelcomeHeader = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{
    full_name: string | null;
    company: string | null;
    created_at: string | null;
    username: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    // Check if it's user's first time and trigger confetti
    const hasSeenWelcome = localStorage.getItem(`welcome_shown_${user?.id}`);
    
    if (user && !hasSeenWelcome && profile) {
      // Check if account is less than 5 minutes old (first login)
      const accountAge = Date.now() - new Date(profile.created_at || '').getTime();
      const isFirstLogin = accountAge < 5 * 60 * 1000; // 5 minutes
      
      if (isFirstLogin) {
        // Trigger confetti after a short delay
        setTimeout(() => {
          triggerConfetti();
          localStorage.setItem(`welcome_shown_${user?.id}`, 'true');
        }, 500);
      }
    }
  }, [user, profile]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, company, created_at, username")
        .eq("id", user?.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Launch confetti from different positions
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const getFirstName = () => {
    // Prioridade: username > primeiro nome > parte do email
    if (profile?.username) {
      return profile.username;
    }
    if (profile?.full_name) {
      return profile.full_name.split(" ")[0];
    }
    return user?.email?.split("@")[0] || "Usuário";
  };

  if (loading) {
    return (
      <div className="mb-8 animate-pulse">
        <div className="h-10 w-64 bg-muted rounded-lg mb-2" />
        <div className="h-6 w-48 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="mb-8 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Greeting */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-primary animate-pulse flex-shrink-0" />
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
          <span className="bg-gradient-primary bg-clip-text text-transparent drop-shadow-sm">
            {getGreeting()}, {getFirstName()}!
          </span>
        </h1>
      </div>

      {/* Company Info */}
      {profile?.company && (
        <div className="flex items-center gap-2 pl-8 sm:pl-10 animate-in fade-in slide-in-from-left duration-500" style={{ animationDelay: '200ms' }}>
          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <p className="text-sm sm:text-base text-muted-foreground font-medium">
            {profile.company}
          </p>
        </div>
      )}

      {/* Subtitle */}
      <p className="text-xs sm:text-sm text-muted-foreground pl-8 sm:pl-10 animate-in fade-in slide-in-from-left duration-500" style={{ animationDelay: '400ms' }}>
        Gerencie seus clusters Kubernetes com inteligência artificial
      </p>
    </div>
  );
};
