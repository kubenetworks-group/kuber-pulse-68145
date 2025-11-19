import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { History, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type ScanHistoryItem = {
  id: string;
  scan_date: string;
  anomalies_found: number;
  summary: string;
  anomalies_data: any[];
};

interface ScanHistoryTabProps {
  scanHistory: ScanHistoryItem[];
  loading: boolean;
}

export function ScanHistoryTab({ scanHistory, loading }: ScanHistoryTabProps) {
  const { i18n } = useTranslation();

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'pt-BR':
        return ptBR;
      case 'es-ES':
        return es;
      default:
        return enUS;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!scanHistory || scanHistory.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <History className="w-16 h-16 text-muted-foreground" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Nenhuma varredura realizada</h3>
            <p className="text-sm text-muted-foreground">
              Execute uma varredura de cluster para começar a rastrear anomalias
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <History className="w-6 h-6" />
          Histórico de Varreduras
        </h2>
        <Badge variant="secondary">
          {scanHistory.length} {scanHistory.length === 1 ? 'varredura' : 'varreduras'}
        </Badge>
      </div>

      <Accordion type="single" collapsible className="space-y-4">
        {scanHistory.map((scan, index) => (
          <AccordionItem 
            key={scan.id} 
            value={scan.id}
            className="border rounded-lg bg-card"
          >
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {format(new Date(scan.scan_date), 'PPpp', { locale: getDateLocale() })}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">
                      Varredura #{scanHistory.length - index}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {scan.anomalies_found > 0 ? (
                    <>
                      <Badge variant="destructive" className="ml-2">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {scan.anomalies_found} {scan.anomalies_found === 1 ? 'anomalia' : 'anomalias'}
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="outline" className="border-green-500 text-green-500">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Nenhuma anomalia
                    </Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4 pt-4">
                {/* Summary */}
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm">
                    <span className="font-semibold">📊 Resumo:</span> {scan.summary}
                  </p>
                </div>

                {/* Anomalies Details */}
                {scan.anomalies_data && scan.anomalies_data.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Detalhes das Anomalias
                    </h4>
                    
                    {scan.anomalies_data.map((anomaly, idx) => (
                      <Card 
                        key={idx}
                        className={`border-l-4 ${
                          anomaly.severity === 'critical' ? 'border-l-destructive' :
                          anomaly.severity === 'high' ? 'border-l-orange-500' :
                          anomaly.severity === 'medium' ? 'border-l-yellow-500' :
                          'border-l-blue-500'
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={getSeverityColor(anomaly.severity)}>
                                {anomaly.severity}
                              </Badge>
                              <span className="text-xs text-muted-foreground font-medium">
                                {anomaly.type}
                              </span>
                            </div>
                            
                            <p className="text-sm font-medium">{anomaly.description}</p>
                            
                            {anomaly.recommendation && (
                              <p className="text-xs text-muted-foreground">
                                💡 {anomaly.recommendation}
                              </p>
                            )}
                            
                            {anomaly.affected_pods && anomaly.affected_pods.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">
                                  Pods Afetados:
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {anomaly.affected_pods.map((pod: string, pidx: number) => (
                                    <Badge key={pidx} variant="outline" className="text-xs font-mono">
                                      {pod}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {anomaly.event_messages && anomaly.event_messages.length > 0 && (
                              <div className="mt-2 p-2 bg-destructive/10 rounded border border-destructive/20">
                                <p className="text-xs font-semibold text-destructive mb-1">
                                  🔴 Erros do Kubernetes:
                                </p>
                                {anomaly.event_messages.map((msg: string, midx: number) => (
                                  <p key={midx} className="text-xs font-mono text-destructive/90">
                                    {msg}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}