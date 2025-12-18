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

  return (
    <Card className="group relative overflow-hidden p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/30 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
      {/* Animated background effect */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
      
      <div className="relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 group-hover:scale-110 transition-transform duration-300">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              AI Insights
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
              {actionsToday} auto-healing actions today
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={generatePDFReport}
            disabled={generating}
            className="gap-2 hover:bg-primary/10 hover:border-primary/50"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Relatório PDF</span>
          </Button>
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
        </div>

        {topIncidents.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-lg bg-gradient-to-br from-success/5 to-success/10 border border-success/20">
            <div className="w-12 h-12 rounded-full bg-success/20 mx-auto mb-3 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-success" />
            </div>
            <p className="text-sm font-medium text-foreground">All systems healthy!</p>
            <p className="text-xs text-muted-foreground mt-1">No incidents detected</p>
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {topIncidents.map((incident, index) => (
              <div
                key={incident.id}
                className="p-4 rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 hover:bg-card hover:border-border transition-all duration-200 hover:scale-[1.02] cursor-pointer"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-3">
                  <Badge
                    variant="outline"
                    className={`
                      ${incident.severity === 'critical' ? 'bg-destructive/20 text-destructive border-destructive/30' : ''}
                      ${incident.severity === 'high' ? 'bg-warning/20 text-warning border-warning/30' : ''}
                      ${incident.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30' : ''}
                      font-semibold
                    `}
                  >
                    {incident.severity}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">{incident.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(incident.created_at).toLocaleString()}
                    </p>
                  </div>
                  {incident.action_taken && (
                    <Badge className="bg-success/20 text-success border-success/30 text-xs font-semibold">
                      ✓ Fixed
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Link to="/ai-monitor">
          <Button variant="outline" className="w-full gap-2 group/btn hover:bg-primary/10 hover:border-primary/50">
            <span>View All Incidents</span>
            <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </div>
    </Card>
  );
};
