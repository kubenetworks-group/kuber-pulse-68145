import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Sparkles } from "lucide-react";

export const WelcomeHeader = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{
    full_name: string | null;
    company: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, company")
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const getFirstName = () => {
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
      <div className="flex items-center gap-3">
        <Sparkles className="w-8 h-8 text-primary animate-pulse" />
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
          <span className="bg-gradient-primary bg-clip-text text-transparent drop-shadow-sm">
            {getGreeting()}, {getFirstName()}!
          </span>
        </h1>
      </div>

      {/* Company Info */}
      {profile?.company && (
        <div className="flex items-center gap-2 pl-11 animate-in fade-in slide-in-from-left duration-500" style={{ animationDelay: '200ms' }}>
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <p className="text-base sm:text-lg text-muted-foreground font-medium">
            {profile.company}
          </p>
        </div>
      )}

      {/* Subtitle */}
      <p className="text-sm sm:text-base text-muted-foreground pl-11 animate-in fade-in slide-in-from-left duration-500" style={{ animationDelay: '400ms' }}>
        Gerencie seus clusters Kubernetes com inteligência artificial
      </p>
    </div>
  );
};
