import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Network, Lock, ExternalLink, Wifi, ChevronDown, ChevronUp } from "lucide-react";

interface ServiceData {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP: string | null;
  ports: string;
}

interface ServicesOverviewProps {
  services: ServiceData[];
  loading: boolean;
}

const TYPE_CONFIG: Record<string, { icon: typeof Globe; color: string; glow: string; label: string; bg: string }> = {
  LoadBalancer: {
    icon: Globe,
    color: "#38bdf8",
    glow: "0 0 12px #38bdf840",
    label: "LB",
    bg: "rgba(56,189,248,0.08)",
  },
  NodePort: {
    icon: ExternalLink,
    color: "#fbbf24",
    glow: "0 0 12px #fbbf2440",
    label: "NP",
    bg: "rgba(251,191,36,0.08)",
  },
  ClusterIP: {
    icon: Lock,
    color: "#34d399",
    glow: "0 0 12px #34d39940",
    label: "CIP",
    bg: "rgba(52,211,153,0.08)",
  },
  ExternalName: {
    icon: Wifi,
    color: "#a78bfa",
    glow: "0 0 12px #a78bfa40",
    label: "EXT",
    bg: "rgba(167,139,250,0.08)",
  },
};

const getTypeConfig = (type: string) =>
  TYPE_CONFIG[type] ?? {
    icon: Network,
    color: "#94a3b8",
    glow: "none",
    label: type.slice(0, 3).toUpperCase(),
    bg: "rgba(148,163,184,0.08)",
  };

const parsePorts = (ports: string): string[] => {
  if (!ports) return [];
  return ports.split(",").map((p) => p.trim()).filter(Boolean);
};

const ServiceCard = ({ svc }: { svc: ServiceData }) => {
  const cfg = getTypeConfig(svc.type);
  const Icon = cfg.icon;
  const portList = parsePorts(svc.ports);

  return (
    <div
      className="relative rounded-lg overflow-hidden transition-all duration-200 hover:translate-y-[-1px] group"
      style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border)/0.5)" }}
    >
      {/* Type accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg transition-all duration-300 group-hover:w-[4px]"
        style={{ background: cfg.color, boxShadow: cfg.glow }}
      />

      <div className="pl-4 pr-3 pt-3 pb-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <p
              className="text-xs font-mono font-medium truncate text-foreground leading-tight"
              title={svc.name}
            >
              {svc.name}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{svc.clusterIP}</p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide"
              style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}
            >
              <Icon className="w-2.5 h-2.5" />
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Namespace */}
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 h-4 font-mono border-border/40 text-muted-foreground"
          >
            {svc.namespace}
          </Badge>

          {svc.externalIP && (
            <span className="text-[9px] font-mono text-blue-400 flex items-center gap-0.5">
              <Globe className="w-2.5 h-2.5" />
              {svc.externalIP}
            </span>
          )}
        </div>

        {/* Ports */}
        {portList.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {portList.slice(0, 4).map((port, i) => (
              <span
                key={i}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: "hsl(var(--muted)/0.5)",
                  color: "hsl(var(--muted-foreground))",
                  border: "1px solid hsl(var(--border)/0.3)",
                }}
              >
                {port}
              </span>
            ))}
            {portList.length > 4 && (
              <span className="text-[9px] text-muted-foreground px-1">+{portList.length - 4}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const ServicesOverview = ({ services, loading }: ServicesOverviewProps) => {
  const [showAll, setShowAll] = useState(false);

  const typeCounts = services.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const lbCount = typeCounts["LoadBalancer"] || 0;
  const npCount = typeCounts["NodePort"] || 0;
  const cipCount = typeCounts["ClusterIP"] || 0;

  const displayedServices = showAll ? services : services.slice(0, 9);

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)" }}
            >
              <Network className="w-3.5 h-3.5" style={{ color: "#a78bfa" }} />
            </div>
            Services
            {services.length > 0 && (
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}
              >
                {services.length}
              </span>
            )}
          </CardTitle>

          {/* Type distribution pills */}
          {services.length > 0 && (
            <div className="flex items-center gap-1.5">
              {lbCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono" style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}>
                  {lbCount} LB
                </span>
              )}
              {npCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>
                  {npCount} NP
                </span>
              )}
              {cipCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono" style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                  {cipCount} CIP
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
              <span className="text-[11px] text-muted-foreground font-mono">scanning services...</span>
            </div>
          </div>
        ) : services.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(148,163,184,0.08)", border: "1px dashed hsl(var(--border))" }}
            >
              <Network className="w-5 h-5 text-muted-foreground/40" />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Nenhum service encontrado</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono">aguardando dados do agente...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {displayedServices.map((svc, i) => (
                <ServiceCard key={i} svc={svc} />
              ))}
            </div>

            {services.length > 9 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/30 border border-dashed border-border/40"
              >
                {showAll ? (
                  <>
                    <ChevronUp className="w-3 h-3" /> Mostrar menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" /> Ver mais {services.length - 9} services
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
