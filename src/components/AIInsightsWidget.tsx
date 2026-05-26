import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight, Sparkles, FileDown, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Incident = {
  id: string;
  severity: string;
  title: string;
  created_at: string;
  action_taken: boolean;
};

interface AIInsightsWidgetProps {
  recentIncidents: Incident[];
}

export const AIInsightsWidget = ({ recentIncidents }: AIInsightsWidgetProps) => {
  const { selectedClusterId } = useCluster();
  const [generating, setGenerating] = useState(false);
  const topIncidents = recentIncidents.slice(0, 3);
  const actionsToday = recentIncidents.filter(i => {
    const createdToday = new Date(i.created_at).toDateString() === new Date().toDateString();
    return createdToday && i.action_taken;
  }).length;

  const generatePDFReport = async () => {
    if (!selectedClusterId) {
      toast.error("Selecione um cluster primeiro");
      return;
    }

    setGenerating(true);
    try {
      // Fetch cluster info
      const { data: cluster } = await supabase
        .from('clusters')
        .select('name, environment, provider')
        .eq('id', selectedClusterId)
        .single();

      // Fetch all incidents
      const { data: incidents } = await supabase
        .from('ai_incidents')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .order('created_at', { ascending: false })
        .limit(100);

      // Fetch anomalies
      const { data: anomalies } = await supabase
        .from('agent_anomalies')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .order('created_at', { ascending: false })
        .limit(100);

      // Fetch auto-heal actions
      const { data: healActions } = await supabase
        .from('auto_heal_actions_log')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .order('created_at', { ascending: false })
        .limit(100);

      // Create PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFillColor(99, 102, 241); // Primary color
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatorio Kodo AI', 14, 20);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Cluster: ${cluster?.name || 'N/A'} | ${cluster?.environment || ''} | ${cluster?.provider || ''}`, 14, 32);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 50);

      let yPos = 60;

      // Summary Section
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo', 14, yPos);
      yPos += 10;

      const totalIncidents = incidents?.length || 0;
      const resolvedIncidents = incidents?.filter(i => i.action_taken)?.length || 0;
      const totalAnomalies = anomalies?.length || 0;
      const resolvedAnomalies = anomalies?.filter(a => a.resolved)?.length || 0;
      const totalHealActions = healActions?.length || 0;
      const successfulHeals = healActions?.filter(h => h.status === 'completed')?.length || 0;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`• Total de Incidentes: ${totalIncidents} (${resolvedIncidents} resolvidos pela IA)`, 20, yPos);
      yPos += 7;
      doc.text(`• Total de Anomalias: ${totalAnomalies} (${resolvedAnomalies} resolvidas)`, 20, yPos);
      yPos += 7;
      doc.text(`• Acoes de Auto-Cura: ${totalHealActions} (${successfulHeals} com sucesso)`, 20, yPos);
      yPos += 7;
      
      const resolutionRate = totalIncidents > 0 ? Math.round((resolvedIncidents / totalIncidents) * 100) : 0;
      doc.text(`• Taxa de Resolucao da IA: ${resolutionRate}%`, 20, yPos);
      yPos += 15;

      // Incidents Table
      if (incidents && incidents.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Incidentes Recentes', 14, yPos);
        yPos += 5;

        autoTable(doc, {
          startY: yPos,
          head: [['Data', 'Severidade', 'Titulo', 'Status']],
          body: incidents.slice(0, 20).map(i => [
            new Date(i.created_at || '').toLocaleDateString('pt-BR'),
            i.severity?.toUpperCase() || 'N/A',
            (i.title || '').substring(0, 40) + ((i.title || '').length > 40 ? '...' : ''),
            i.action_taken ? '✓ Resolvido' : '⏳ Pendente'
          ]),
          headStyles: { fillColor: [99, 102, 241] },
          styles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 20 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 25 }
          }
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Anomalies Table
      if (anomalies && anomalies.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Anomalias Detectadas', 14, yPos);
        yPos += 5;

        autoTable(doc, {
          startY: yPos,
          head: [['Data', 'Tipo', 'Severidade', 'Status']],
          body: anomalies.slice(0, 20).map(a => [
            new Date(a.created_at || '').toLocaleDateString('pt-BR'),
            (a.anomaly_type || '').replace(/_/g, ' '),
            a.severity?.toUpperCase() || 'N/A',
            a.resolved ? (a.auto_heal_applied ? '✓ Auto-curado' : '✓ Resolvido') : '⏳ Pendente'
          ]),
          headStyles: { fillColor: [234, 179, 8] },
          styles: { fontSize: 9 }
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Auto-Heal Actions Table
      if (healActions && healActions.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Acoes de Auto-Cura', 14, yPos);
        yPos += 5;

        autoTable(doc, {
          startY: yPos,
          head: [['Data', 'Acao', 'Motivo', 'Status']],
          body: healActions.slice(0, 20).map(h => [
            new Date(h.created_at || '').toLocaleDateString('pt-BR'),
            (h.action_type || '').replace(/_/g, ' '),
            (h.trigger_reason || '').substring(0, 35) + ((h.trigger_reason || '').length > 35 ? '...' : ''),
            h.status === 'completed' ? '✓ Sucesso' : h.status === 'failed' ? '✗ Falhou' : '⏳ Pendente'
          ]),
          headStyles: { fillColor: [34, 197, 94] },
          styles: { fontSize: 9 }
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Pagina ${i} de ${pageCount} | Gerado por Kodo AI`, pageWidth / 2, 290, { align: 'center' });
      }

      // Download
      doc.save(`kodo-ai-report-${cluster?.name || 'cluster'}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Relatório PDF gerado com sucesso!");
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error("Erro ao gerar relatório");
    } finally {
      setGenerating(false);
    }
  };

  const severityColor = (s: string) => {
    if (s === "critical") return "var(--kodo-crit)";
    if (s === "high") return "var(--kodo-warn)";
    return "#6366f1";
  };

  return (
    <Card className="overflow-hidden bg-card border-border/60 shadow-sm dark:bg-card/40 dark:shadow-none dark:backdrop-blur-sm">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border/40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="p-2.5 rounded-xl shrink-0"
              style={{ background: "var(--kodo-brand-muted)", border: "1px solid var(--kodo-brand-border)" }}
            >
              <Bot className="h-4 w-4" style={{ color: "var(--kodo-brand)" }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground leading-none">AI Insights</h3>
              <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5 flex items-center gap-1.5">
                <span
                  className="size-1.5 rounded-full inline-block animate-pulse"
                  style={{ background: "var(--kodo-brand)" }}
                />
                {actionsToday} auto-healing hoje
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={generatePDFReport}
              disabled={generating}
              className="gap-1.5 text-xs h-8 border-border/60 hover:border-border font-mono"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">PDF</span>
            </Button>
            <Sparkles className="h-4 w-4 text-muted-foreground/40 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="p-5">
        {topIncidents.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-8 rounded-xl border"
            style={{ borderColor: "var(--kodo-brand-border)", background: "var(--kodo-brand-muted)" }}
          >
            <span
              className="size-2 rounded-full mb-3 animate-pulse"
              style={{ background: "var(--kodo-brand)" }}
            />
            <p className="text-sm font-mono font-medium" style={{ color: "var(--kodo-brand)" }}>
              Todos os sistemas saudáveis
            </p>
            <p className="text-[11px] font-mono text-muted-foreground/50 mt-1">
              Nenhum incidente detectado
            </p>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {topIncidents.map((incident) => {
              const col = severityColor(incident.severity);
              return (
                <div
                  key={incident.id}
                  className="bg-muted/30 border border-border/40 rounded-lg p-3 hover:bg-muted/50 hover:border-border/60 transition-all dark:bg-card/30 dark:hover:bg-card/50"
                  style={{ borderLeftColor: col, borderLeftWidth: "3px" }}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 mt-0.5"
                      style={{
                        color: col,
                        borderColor: `${col}40`,
                        background: `${col}10`,
                      }}
                    >
                      {incident.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground leading-snug">
                        {incident.title}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground/50 mt-1">
                        {new Date(incident.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    {incident.action_taken && (
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0"
                        style={{
                          color: "var(--kodo-brand)",
                          borderColor: "#00E5A030",
                          background: "var(--kodo-brand-muted)",
                        }}
                      >
                        ✓ fixed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Link to="/ai-monitor">
          <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border/50 text-xs font-mono text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-all group">
            Ver todos os incidentes
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </Link>
      </div>
    </Card>
  );
};
