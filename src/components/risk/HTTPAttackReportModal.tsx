import { useState, useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText, RefreshCw, Download, ShieldAlert, Globe, Ban,
  AlertTriangle, CheckCircle, Clock,
} from "lucide-react";
import { SecurityThreat } from "@/hooks/useSecurityThreats";

interface Props {
  open: boolean;
  onClose: () => void;
  threatId: string;
  threat: SecurityThreat;
}

const DARK_BG    = [15, 21, 32] as [number, number, number];
const RED        = [255, 45, 45] as [number, number, number];
const GREEN      = [0, 229, 160] as [number, number, number];
const MUTED      = [136, 146, 164] as [number, number, number];
const LIGHT_TEXT = [200, 210, 230] as [number, number, number];

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2.5 rounded-lg border border-border bg-muted/40">
      <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
      <span className="text-lg font-bold font-mono" style={color ? { color } : {}}>
        {value}
      </span>
    </div>
  );
}

export function HTTPAttackReportModal({ open, onClose, threatId, threat }: Props) {
  const { selectedClusterId } = useCluster();
  const [loading, setLoading]   = useState(false);
  const [report, setReport]     = useState<any>(null);
  const [error, setError]       = useState<string | null>(null);

  const generateReport = useCallback(async () => {
    if (!selectedClusterId) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada. Faça login novamente.");
      const res = await fetch(
        `${(supabase as any).supabaseUrl}/functions/v1/generate-attack-report`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            "apikey": (supabase as any).supabaseKey,
          },
          body: JSON.stringify({ cluster_id: selectedClusterId, threat_id: threatId }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao gerar relatório.");
      setReport(json.report);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedClusterId, threatId]);

  const downloadPDF = useCallback(() => {
    if (!report) return;
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    const ev = (threat.evidence || {}) as any;
    const s  = report.statistics || {};

    const addBg = () => {
      doc.setFillColor(...DARK_BG);
      doc.rect(0, 0, W, 297, "F");
    };

    // ── Page 1: Cover ────────────────────────────────────────────────────────
    addBg();
    doc.setFillColor(...RED);
    doc.rect(0, 0, 5, 297, "F");

    doc.setTextColor(...LIGHT_TEXT);
    doc.setFontSize(26); doc.setFont("helvetica", "bold");
    doc.text("Attack Detection Report", 14, 40);

    doc.setFontSize(11); doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(`Cluster: ${report.cluster_name || "—"}`, 14, 54);
    doc.text(`Data: ${new Date(report.generated_at).toLocaleString("pt-BR")}`, 14, 62);
    doc.text(`Período: últimas ${report.since_hours}h`, 14, 70);

    // Severity badge
    doc.setFillColor(...RED);
    doc.roundedRect(14, 78, 40, 10, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("CRÍTICO", 16, 84.5);

    // Stats grid
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    const stats = [
      ["Total de ataques", s.total_attacks ?? 0],
      ["IPs atacantes únicos", s.unique_ips ?? 0],
      ["IPs C2 detectados", s.unique_c2_ips ?? 0],
      ["Tipos de ataque", (s.attack_types || []).join(", ") || "—"],
      ["Mitigados", s.mitigated ?? 0],
      ["Ainda ativos", s.active ?? 0],
      ["Lateral movement", s.internal_source_count ?? 0],
      ["Comandos de bloqueio", s.mitigation_commands ?? 0],
    ];
    let y = 100;
    for (const [label, val] of stats) {
      doc.setTextColor(...MUTED);
      doc.text(String(label) + ":", 14, y);
      doc.setTextColor(...LIGHT_TEXT);
      doc.text(String(val), 80, y);
      y += 8;
    }

    // Attack trace on cover
    if (ev.lb_ingress) {
      y += 4;
      doc.setTextColor(...GREEN);
      doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.text("Trace do Ataque", 14, y); y += 8;
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.text(`LB: ${ev.lb_ingress}  →  svc: ${ev.service_name ?? "?"}  →  pod: ${threat.pod_name ?? "?"}`, 14, y); y += 6;
      if (ev.attack_url) {
        doc.text(`Endpoint: ${String(ev.attack_url).slice(0, 80)}`, 14, y); y += 6;
      }
      if (threat.source_ip) {
        doc.setTextColor(...RED);
        doc.text(`IP do Atacante: ${threat.source_ip}`, 14, y); y += 6;
      }
      if ((threat as any).destination_ip) {
        doc.setTextColor(255, 122, 0);
        doc.text(`C2 Server: ${(threat as any).destination_ip}`, 14, y);
      }
    }

    // ── Page 2: Attack Timeline ───────────────────────────────────────────────
    doc.addPage(); addBg();
    doc.setFillColor(...RED); doc.rect(0, 0, 5, 297, "F");
    doc.setTextColor(...GREEN);
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("Linha do Tempo dos Ataques", 14, 20);

    if (report.attack_timeline?.length > 0) {
      autoTable(doc, {
        startY: 28,
        head: [["Horário", "Source IP", "Endpoint", "Status", "Tipo"]],
        body: report.attack_timeline.slice(0, 40).map((e: any) => [
          e.timestamp ? new Date(e.timestamp).toLocaleTimeString("pt-BR") : "—",
          e.source_ip || "—",
          String(e.endpoint || "").slice(0, 40) + (String(e.endpoint || "").length > 40 ? "…" : ""),
          String(e.status_code || ""),
          (e.type || "—").replace(/_/g, " "),
        ]),
        headStyles: { fillColor: RED, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { textColor: LIGHT_TEXT, fillColor: [22, 30, 46], fontSize: 7 },
        alternateRowStyles: { fillColor: [28, 36, 54] },
        styles: { lineColor: [50, 60, 80], lineWidth: 0.3 },
      });
    } else {
      doc.setFontSize(9); doc.setTextColor(...MUTED);
      doc.text("Nenhuma entrada de timeline disponível.", 14, 36);
    }

    // ── Page 3: Attack Trace Detail ───────────────────────────────────────────
    doc.addPage(); addBg();
    doc.setFillColor(...RED); doc.rect(0, 0, 5, 297, "F");
    doc.setTextColor(...GREEN);
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("Rastreamento Detalhado do Ataque", 14, 20);

    const traceRows: [string, string][] = [
      ["LB IP Externo",         ev.lb_ingress || "—"],
      ["Service",               ev.service_name || "—"],
      ["Pod Alvo",              threat.pod_name || "—"],
      ["Container",             threat.container_name || "—"],
      ["Endpoint Atacado",      String(ev.attack_url || "—").slice(0, 70)],
      ["Payload Decodificado",  String(ev.decoded_payload || "—").slice(0, 120)],
      ["IP do Atacante",        threat.source_ip || "—"],
      ["C2 Server (wget/curl)", (threat as any).destination_ip || "—"],
      ["externalTrafficPolicy", ev.external_traffic_policy || "Cluster"],
      ["Lateral Movement",      ev.internal_source ? "SIM — IP interno detectado" : "Não"],
    ];

    let ty = 32;
    for (const [label, val] of traceRows) {
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.setTextColor(...MUTED);
      doc.text(`${label}:`, 14, ty);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...LIGHT_TEXT);
      doc.text(val, 72, ty, { maxWidth: W - 80 });
      ty += 9;
    }

    if (ev.external_traffic_policy === "Cluster") {
      ty += 4;
      doc.setFillColor(60, 40, 10);
      doc.roundedRect(14, ty - 4, W - 28, 18, 2, 2, "F");
      doc.setTextColor(245, 197, 24);
      doc.setFontSize(8);
      doc.text(
        "⚠ AVISO: externalTrafficPolicy=Cluster. O IP exibido pode ser o IP do nó, não o real atacante.\n" +
        "   Recomendação: configure externalTrafficPolicy=Local no Service para bloqueio efetivo.",
        16, ty + 3, { maxWidth: W - 32 }
      );
      ty += 22;
    }

    if (ev.evidence_logs?.[0]) {
      ty += 4;
      doc.setTextColor(...GREEN);
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text("Linha de Log (evidência):", 14, ty); ty += 7;
      doc.setFillColor(10, 15, 26);
      doc.rect(14, ty - 4, W - 28, 16, "F");
      doc.setTextColor(168, 200, 255);
      doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
      doc.text(String(ev.evidence_logs[0]).slice(0, 220), 16, ty + 3, { maxWidth: W - 32 });
    }

    // ── Page 4+: AI Report ────────────────────────────────────────────────────
    if (report.ai_report) {
      doc.addPage(); addBg();
      doc.setFillColor(...RED); doc.rect(0, 0, 5, 297, "F");
      doc.setTextColor(...GREEN);
      doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text("Análise Completa (IA Kodo)", 14, 20);

      // Strip markdown and render as plain text
      const plain = report.ai_report
        .replace(/#{1,4}\s+/g, "")
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/`/g, "")
        .replace(/^\s*[-•]\s*/gm, "• ");

      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.setTextColor(...LIGHT_TEXT);
      const lines = doc.splitTextToSize(plain.slice(0, 4000), W - 28);
      let ry = 30;
      for (const line of lines) {
        if (ry > 285) {
          doc.addPage(); addBg();
          doc.setFillColor(...RED); doc.rect(0, 0, 5, 297, "F");
          doc.setFontSize(8); doc.setFont("helvetica", "normal");
          doc.setTextColor(...LIGHT_TEXT);
          ry = 16;
        }
        // Section headers in green
        if (line.startsWith("## ") || /^\d+\./.test(line.trim())) {
          doc.setTextColor(...GREEN);
          doc.setFont("helvetica", "bold");
        } else {
          doc.setTextColor(...LIGHT_TEXT);
          doc.setFont("helvetica", "normal");
        }
        doc.text(line, 14, ry);
        ry += 5;
      }
    }

    // ── Footer on all pages ───────────────────────────────────────────────────
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(6.5); doc.setTextColor(...MUTED);
      doc.text(
        `Kodo Attack Report  |  Cluster: ${report.cluster_name || "—"}  |  Página ${i} de ${total}  |  ${new Date().toLocaleDateString("pt-BR")}`,
        W / 2, 292, { align: "center" }
      );
    }

    doc.save(`kodo-attack-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [report, threat]);

  const s = report?.statistics || {};

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="w-4 h-4 text-destructive" />
            Relatório de Ataque HTTP
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {!report && !loading && !error && (
            <div className="flex flex-col items-center justify-center gap-4 py-12 px-6">
              <FileText className="w-10 h-10 text-muted-foreground opacity-50" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  Gere um relatório detalhado deste ataque com análise de IA, trace completo e recomendações.
                </p>
                {threat.source_ip && (
                  <p className="text-xs text-muted-foreground font-mono">
                    Atacante: <span className="text-destructive">{threat.source_ip}</span>
                    {(threat as any).destination_ip && ` → C2: ${(threat as any).destination_ip}`}
                  </p>
                )}
              </div>
              <button
                onClick={generateReport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer border-none outline-none"
              >
                <FileText className="w-4 h-4" />
                Gerar Relatório
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 px-6">
              <RefreshCw className="w-6 h-6 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Analisando ataque com IA Kodo...</p>
              <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos.</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 px-6">
              <AlertTriangle className="w-6 h-6 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <button
                onClick={generateReport}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-muted border border-border text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer outline-none"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Tentar novamente
              </button>
            </div>
          )}

          {report && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-4 gap-2 px-6 pt-4 pb-3">
                <StatCard label="Ataques"   value={s.total_attacks ?? 0} color="#FF2D2D" />
                <StatCard label="IPs únicos" value={s.unique_ips ?? 0} color="#FF7A00" />
                <StatCard label="Mitigados" value={s.mitigated ?? 0} color="#00E5A0" />
                <StatCard label="Ativos"    value={s.active ?? 0} color={s.active > 0 ? "#FF2D2D" : undefined} />
              </div>

              {/* Attack types */}
              {(s.attack_types || []).length > 0 && (
                <div className="flex gap-1.5 flex-wrap px-6 pb-3">
                  {(s.attack_types as string[]).map(t => (
                    <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded bg-destructive/10 border border-destructive/20 text-destructive">
                      {t.replace(/_/g, " ")}
                    </span>
                  ))}
                  {s.internal_source_count > 0 && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-destructive/20 border border-destructive/30 text-destructive">
                      ⚠ lateral movement
                    </span>
                  )}
                </div>
              )}

              <ScrollArea className="flex-1 px-6 pb-2">
                {/* AI report */}
                <div className="prose prose-sm prose-invert max-w-none text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap py-2">
                  {report.ai_report}
                </div>

                {/* Mitigation applied */}
                {(report.mitigation_summary || []).length > 0 && (
                  <div className="mt-4 flex flex-col gap-2">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3 text-emerald-500" /> Mitigações Aplicadas
                    </span>
                    {(report.mitigation_summary as any[]).map((m, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg border border-border bg-muted/30 text-xs font-mono">
                        <Ban className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-destructive" />
                        <div className="flex flex-col gap-0.5">
                          <span>IP bloqueado: <strong>{m.blocked_ip}</strong> ({m.namespace})</span>
                          {m.result_message && <span className="text-muted-foreground">{m.result_message}</span>}
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(m.applied_at).toLocaleString("pt-BR")}
                            <span className={m.status === "completed" ? "text-emerald-500" : "text-yellow-500"}>
                              ({m.status})
                            </span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Download button */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {s.mitigation_commands ?? 0} comando(s) de bloqueio aplicado(s)
                </span>
                <button
                  onClick={downloadPDF}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer border-none outline-none"
                >
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
