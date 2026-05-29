import { useEffect, useState } from "react";
import { Loader2, Radio } from "lucide-react";

interface Props {
  clusterData: any;
  totalNodes: number;
  cpuUsage: number;
}

export const MetricsWarmingBanner = ({ clusterData, totalNodes, cpuUsage }: Props) => {
  const [visible, setVisible] = useState(false);
  const [dots, setDots] = useState(".");

  useEffect(() => {
    if (!clusterData) return;

    const isHealthy = clusterData.status === "healthy";
    const hasNoMetrics = totalNodes === 0 && (cpuUsage === 0 || cpuUsage == null);

    // Show banner when agent is healthy but metrics haven't arrived yet
    if (isHealthy && hasNoMetrics) {
      setVisible(true);
    } else {
      // Metrics arrived — fade out
      setVisible(false);
    }
  }, [clusterData, totalNodes, cpuUsage]);

  // Animated dots
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      setDots(d => d.length >= 3 ? "." : d + ".");
    }, 500);
    return () => clearInterval(id);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#0891b2]/30 bg-gradient-to-r from-[#0891b2]/10 to-[#4f46e5]/10 px-5 py-4 flex items-start gap-4">
      {/* Pulsing ring */}
      <div className="flex-shrink-0 mt-0.5 relative">
        <Radio className="w-5 h-5 text-[#0891b2] animate-pulse" />
        <span className="absolute inset-0 rounded-full bg-[#0891b2]/20 animate-ping" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          Agente conectado — coletando primeiras métricas{dots}
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground inline" />
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          O agente acabou de se conectar ao cluster. Os dados de CPU, memória, pods e nodes
          aparecem automaticamente em até <strong className="text-foreground">60 segundos</strong>{" "}
          após o primeiro ciclo de coleta. Nenhuma ação é necessária.
        </p>
      </div>

      {/* Scan line animation */}
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-[#0891b2] to-transparent opacity-60"
        style={{ animation: "slide-x 2s linear infinite", width: "40%" }}
      />

      <style>{`
        @keyframes slide-x {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
};
