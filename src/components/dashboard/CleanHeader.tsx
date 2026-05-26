import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Terminal, Clock, Wifi, WifiOff } from "lucide-react";

interface CleanHeaderProps {
  clusterData: any;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}m`;
  const h = Math.floor(m / 60);
  return `há ${h}h`;
}

export const CleanHeader = ({ clusterData }: CleanHeaderProps) => {
  const { user } = useAuth();
  const [name, setName] = useState<string>("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

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

  const isOnline = clusterData?.agent_last_seen_at
    ? new Date(clusterData.agent_last_seen_at) > new Date(Date.now() - 5 * 60 * 1000)
    : false;

  const lastSync = relativeTime(
    clusterData?.agent_last_seen_at || clusterData?.last_sync || null,
  );

  // tick dependency keeps relativeTime fresh every 30s
  void tick;

  return (
    <div className="relative pb-5">
      {/* Vertical accent line */}
      <div
        className="absolute left-0 top-1 bottom-2 w-0.5 rounded-full"
        style={{ background: "linear-gradient(to bottom, var(--kodo-brand) 0%, transparent 100%)" }}
      />

      <div className="pl-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: identity */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-tight">
            {greeting},{" "}
            <span style={{ color: "var(--kodo-brand)" }}>{name || "—"}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitoramento em tempo real · Kubernetes
          </p>
        </div>

        {/* Right: cluster status chips */}
        {clusterData && (
          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-card shadow-sm dark:bg-card/40 dark:shadow-none">
              <Terminal className="w-3 h-3 text-muted-foreground/70" />
              <span className="text-xs font-mono text-foreground font-medium">
                {clusterData.name}
              </span>
            </div>

            <span className="px-2.5 py-1.5 rounded-lg text-xs font-mono border border-border/50 bg-muted/50 text-muted-foreground capitalize shadow-sm dark:bg-card/30 dark:shadow-none dark:border-border/40">
              {clusterData.environment}
            </span>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-muted/50 shadow-sm dark:bg-card/30 dark:shadow-none dark:border-border/40">
              {isOnline ? (
                <Wifi className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--kodo-brand)" }} />
              ) : (
                <WifiOff className="w-3.5 h-3.5 shrink-0 text-muted-foreground/40" />
              )}
              <span
                className="text-xs font-mono"
                style={isOnline ? { color: "var(--kodo-brand)" } : { color: "var(--muted-foreground)" }}
              >
                {isOnline ? "online" : "offline"}
              </span>
              <span className="text-muted-foreground/30 text-xs">·</span>
              <Clock className="w-3 h-3 text-muted-foreground/40 shrink-0" />
              <span className="text-xs font-mono text-muted-foreground/60">{lastSync}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
