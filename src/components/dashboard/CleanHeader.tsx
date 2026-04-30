import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface CleanHeaderProps {
  clusterData: any;
}

/**
 * Minimal greeting header — replaces the loud gradient WelcomeHeader.
 * Single line: "Olá, {name}" + small subtitle with environment.
 */
export const CleanHeader = ({ clusterData }: CleanHeaderProps) => {
  const { user } = useAuth();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("username, full_name")
        .eq("id", user.id)
        .single();
      const display =
        data?.username ||
        data?.full_name?.split(" ")[0] ||
        user.email?.split("@")[0] ||
        "Usuário";
      setName(display);
    };
    void load();
  }, [user]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();

  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-border/40">
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          {greeting}, {name || "—"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral do seu cluster Kubernetes
        </p>
      </div>
      {clusterData && (
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span className="px-2 py-1 rounded border border-border/60 bg-card/40 text-foreground">
            {clusterData.name}
          </span>
          <span className="px-2 py-1 rounded border border-border/60 bg-card/40 capitalize">
            {clusterData.environment}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`size-1.5 rounded-full ${
                clusterData.status === "active" || clusterData.status === "connected"
                  ? "bg-success animate-pulse"
                  : "bg-muted-foreground"
              }`}
            />
            {clusterData.status}
          </span>
        </div>
      )}
    </div>
  );
};
