import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type RegistrationState = "loading" | "complete" | "incomplete";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, sessionExpired } = useAuth();
  const location = useLocation();
  const [regState, setRegState] = useState<RegistrationState>("loading");

  useEffect(() => {
    if (!user) return;

    // /register itself should never trigger a redirect loop
    if (location.pathname === "/register") {
      setRegState("complete");
      return;
    }

    const check = async () => {
      const { data } = await supabase
        .from("user_consents")
        .select("id")
        .eq("user_id", user.id)
        .eq("terms_accepted", true)
        .maybeSingle();

      setRegState(data ? "complete" : "incomplete");
    };

    check();
  }, [user, location.pathname]);

  if (loading || (user && regState === "loading")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user && !sessionExpired) {
    return <Navigate to="/auth" replace />;
  }

  if (user && regState === "incomplete" && location.pathname !== "/register") {
    return <Navigate to="/register" replace />;
  }

  return <>{children}</>;
};
