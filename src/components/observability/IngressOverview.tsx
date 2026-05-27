import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe2, ShieldCheck, ShieldOff, ChevronDown, ChevronUp, ArrowRight, Tag } from "lucide-react";

interface IngressData {
  name: string;
  namespace: string;
  hosts: string[];
  tls: boolean;
  rules: { host: string; paths: string[] }[];
  className: string | null;
}

interface IngressOverviewProps {
  ingresses: IngressData[];
  loading: boolean;
}

const IngressCard = ({ ing }: { ing: IngressData }) => {
  const [expanded, setExpanded] = useState(false);

  const allHosts = ing.hosts.length > 0
    ? ing.hosts
    : ing.rules.map((r) => r.host).filter(Boolean);

  const hasRules = ing.rules.length > 0;

  return (
    <div
      className="rounded-lg overflow-hidden transition-all duration-200 group"
      style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border)/0.5)" }}
    >
      {/* Top accent line */}
      <div
        className="h-[2px] w-full"
        style={{
          background: ing.tls
            ? "linear-gradient(90deg, #16A34A, #0F3CA5)"
            : "linear-gradient(90deg, #CA8A04, #DC2626)",
        }}
      />

      <div className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Name + namespace */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-semibold text-foreground truncate max-w-[200px]" title={ing.name}>
                {ing.name}
              </span>
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 h-4 font-mono border-border/40 text-muted-foreground"
              >
                {ing.namespace}
              </Badge>
              {ing.className && (
                <span
                  className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-mono"
                  style={{
                    background: "rgba(96,165,250,0.1)",
                    color: "#60a5fa",
                    border: "1px solid rgba(96,165,250,0.2)",
                  }}
                >
                  <Tag className="w-2 h-2" />
                  {ing.className}
                </span>
              )}
            </div>

            {/* Hosts */}
            {allHosts.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {allHosts.slice(0, 3).map((host, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 text-[10px] font-mono"
                    style={{ color: "#38bdf8" }}
                  >
                    <Globe2 className="w-2.5 h-2.5 flex-shrink-0" />
                    {host}
                  </span>
                ))}
                {allHosts.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{allHosts.length - 3}</span>
                )}
              </div>
            )}
          </div>

          {/* TLS badge */}
          <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
              style={
                ing.tls
                  ? { background: "rgba(22,163,74,0.08)", color: "#16A34A", border: "1px solid rgba(22,163,74,0.2)" }
                  : { background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }
              }
            >
              {ing.tls ? (
                <>
                  <ShieldCheck className="w-3 h-3" /> TLS
                </>
              ) : (
                <>
                  <ShieldOff className="w-3 h-3" /> HTTP
                </>
              )}
            </div>
          </div>
        </div>

        {/* Rules preview / expand */}
        {hasRules && (
          <>
            <div className="mt-2.5 pt-2.5 border-t border-border/30">
              {(!expanded ? ing.rules.slice(0, 1) : ing.rules).map((rule, i) => (
                <div key={i} className={i > 0 ? "mt-2" : ""}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono text-blue-400 flex items-center gap-1">
                      <Globe2 className="w-2.5 h-2.5" />
                      {rule.host || "*"}
                    </span>
                    {rule.paths && rule.paths.length > 0 && (
                      <>
                        <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/40 flex-shrink-0" />
                        <div className="flex flex-wrap gap-1">
                          {rule.paths.slice(0, 4).map((path, j) => (
                            <span
                              key={j}
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                              style={{
                                background: "hsl(var(--muted)/0.4)",
                                color: "hsl(var(--muted-foreground))",
                                border: "1px solid hsl(var(--border)/0.3)",
                              }}
                            >
                              {path}
                            </span>
                          ))}
                          {rule.paths.length > 4 && (
                            <span className="text-[9px] text-muted-foreground">+{rule.paths.length - 4}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {ing.rules.length > 1 && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {expanded ? (
                    <><ChevronUp className="w-3 h-3" /> Mostrar menos</>
                  ) : (
                    <><ChevronDown className="w-3 h-3" /> +{ing.rules.length - 1} regras</>
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const IngressOverview = ({ ingresses, loading }: IngressOverviewProps) => {
  const [showAll, setShowAll] = useState(false);

  const tlsCount = ingresses.filter((i) => i.tls).length;
  const noTlsCount = ingresses.length - tlsCount;
  const displayedIngresses = showAll ? ingresses : ingresses.slice(0, 6);

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.25)" }}
            >
              <Globe2 className="w-3.5 h-3.5" style={{ color: "#38bdf8" }} />
            </div>
            Ingress
            {ingresses.length > 0 && (
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}
              >
                {ingresses.length}
              </span>
            )}
          </CardTitle>

          {ingresses.length > 0 && (
            <div className="flex items-center gap-2">
              {tlsCount > 0 && (
                <span
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "rgba(22,163,74,0.08)", color: "#16A34A", border: "1px solid rgba(22,163,74,0.2)" }}
                >
                  <ShieldCheck className="w-3 h-3" /> TLS: {tlsCount}
                </span>
              )}
              {noTlsCount > 0 && (
                <span
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}
                >
                  <ShieldOff className="w-3 h-3" /> HTTP: {noTlsCount}
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
              <div className="w-6 h-6 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
              <span className="text-[11px] text-muted-foreground font-mono">scanning ingresses...</span>
            </div>
          </div>
        ) : ingresses.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(148,163,184,0.08)", border: "1px dashed hsl(var(--border))" }}
            >
              <Globe2 className="w-5 h-5 text-muted-foreground/40" />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Nenhum ingress encontrado</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono">aguardando dados do agente...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {displayedIngresses.map((ing, i) => (
                <IngressCard key={i} ing={ing} />
              ))}
            </div>

            {ingresses.length > 6 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/30 border border-dashed border-border/40"
              >
                {showAll ? (
                  <><ChevronUp className="w-3 h-3" /> Mostrar menos</>
                ) : (
                  <><ChevronDown className="w-3 h-3" /> Ver mais {ingresses.length - 6} ingresses</>
                )}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
