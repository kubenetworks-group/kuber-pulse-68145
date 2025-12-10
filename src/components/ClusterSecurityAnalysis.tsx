import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX,
  Network, 
  Lock, 
  Key, 
  Gauge,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SecurityCheck {
  status: 'configured' | 'partial' | 'missing';
  issues: string[];
  recommendations: string[];
}

interface SecurityScan {
  id: string;
  has_rbac: boolean;
  rbac_details: SecurityCheck;
  has_network_policies: boolean;
  network_policy_details: SecurityCheck;
  has_pod_security: boolean;
  pod_security_details: SecurityCheck;
  has_secrets_encryption: boolean;
  secrets_details: SecurityCheck;
  has_resource_limits: boolean;
  resource_limits_details: SecurityCheck;
  security_score: number;
  recommendations: string[];
  status: 'pending' | 'passed' | 'warning' | 'failed';
  ai_analysis: { summary: string };
  scan_date: string;
}

export const ClusterSecurityAnalysis = () => {
  const { selectedClusterId } = useCluster();
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [latestScan, setLatestScan] = useState<SecurityScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (selectedClusterId && user) {
      fetchLatestScan();
    }
  }, [selectedClusterId, user]);

  const fetchLatestScan = async () => {
    if (!selectedClusterId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cluster_security_scans')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .order('scan_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setLatestScan(data as unknown as SecurityScan | null);
      console.error('Error fetching security scan:', error);
    } finally {
      setLoading(false);
    }
  };

  const runSecurityAnalysis = async () => {
    if (!selectedClusterId) {
      toast({
        title: "Selecione um cluster",
        description: "Por favor, selecione um cluster para análise",
        variant: "destructive"
      });
      return;
    }

    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-cluster-security', {
        body: { cluster_id: selectedClusterId }
      });

      if (error) throw error;

      toast({
        title: "✅ Análise Concluída",
        description: `Score de segurança: ${data.security_score}/100`,
      });

      fetchLatestScan();
    } catch (error: any) {
      console.error('Error running security analysis:', error);
      toast({
        title: "Erro na análise",
        description: error.message || "Falha ao analisar segurança do cluster",
        variant: "destructive"
      });
    } finally {
      setScanning(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle2 className="h-5 w-5 text-success" />
    ) : (
      <XCircle className="h-5 w-5 text-destructive" />
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-success';
    if (score >= 50) return 'bg-warning';
    return 'bg-destructive';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return <Badge className="bg-success/20 text-success border-success/30">Aprovado</Badge>;
      case 'warning':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Atenção</Badge>;
      case 'failed':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Crítico</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  const securityChecks = latestScan ? [
    {
      key: 'rbac',
      icon: Shield,
      title: 'RBAC',
      description: 'Role-Based Access Control',
      enabled: latestScan.has_rbac,
      details: latestScan.rbac_details
    },
    {
      key: 'network',
      icon: Network,
      title: 'Network Policies',
      description: 'Isolamento de rede entre workloads',
      enabled: latestScan.has_network_policies,
      details: latestScan.network_policy_details
    },
    {
      key: 'pod',
      icon: Lock,
      title: 'Pod Security',
      description: 'Políticas de segurança de pods',
      enabled: latestScan.has_pod_security,
      details: latestScan.pod_security_details
    },
    {
      key: 'secrets',
      icon: Key,
      title: 'Secrets Encryption',
      description: 'Encriptação de secrets em repouso',
      enabled: latestScan.has_secrets_encryption,
      details: latestScan.secrets_details
    },
    {
      key: 'limits',
      icon: Gauge,
      title: 'Resource Limits',
      description: 'Limites de CPU e memória',
      enabled: latestScan.has_resource_limits,
      details: latestScan.resource_limits_details
    }
  ] : [];

  // Show first-time analysis prompt if no scan exists
  if (!loading && !latestScan) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10 w-fit">
            <ShieldCheck className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-xl">Análise de Segurança</CardTitle>
          <CardDescription className="max-w-md mx-auto">
            Execute sua primeira análise de segurança para verificar RBAC, Network Policies, Pod Security e mais.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Button
            onClick={runSecurityAnalysis}
            disabled={scanning || !selectedClusterId}
            size="lg"
            className="gap-2"
          >
            {scanning ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Analisando com IA...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Iniciar Análise de Segurança
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            A IA irá analisar a configuração do seu cluster e fornecer recomendações de segurança.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            {latestScan?.status === 'passed' ? (
              <ShieldCheck className="h-6 w-6 text-success" />
            ) : latestScan?.status === 'warning' ? (
              <ShieldAlert className="h-6 w-6 text-warning" />
            ) : (
              <ShieldX className="h-6 w-6 text-destructive" />
            )}
            <div>
              <CardTitle className="text-lg">Análise de Segurança</CardTitle>
              <CardDescription className="text-xs">
                Última análise: {latestScan?.scan_date ? new Date(latestScan.scan_date).toLocaleString('pt-BR') : 'N/A'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {latestScan && getStatusBadge(latestScan.status)}
            <Button
              onClick={runSecurityAnalysis}
              disabled={scanning}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              {scanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Nova Análise
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Security Score */}
        {latestScan && (
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Score de Segurança</span>
              <span className={`text-2xl font-bold ${getScoreColor(latestScan.security_score)}`}>
                {latestScan.security_score}/100
              </span>
            </div>
            <Progress 
              value={latestScan.security_score} 
              className="h-2"
            />
            {latestScan.ai_analysis?.summary && (
              <p className="mt-3 text-sm text-muted-foreground">
                {latestScan.ai_analysis.summary}
              </p>
            )}
          </div>
        )}

        {/* Security Checks */}
        <div className="space-y-2">
          {securityChecks.map((check) => (
            <Collapsible
              key={check.key}
              open={expandedSections[check.key]}
              onOpenChange={() => toggleSection(check.key)}
            >
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button className="w-full p-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <check.icon className="h-5 w-5 text-muted-foreground" />
                      <div className="text-left">
                        <p className="font-medium text-sm">{check.title}</p>
                        <p className="text-xs text-muted-foreground">{check.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(check.enabled)}
                      {expandedSections[check.key] ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 pt-1 border-t border-border/50 bg-muted/10">
                    {check.details?.issues?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-destructive mb-1">Problemas:</p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {check.details.issues.map((issue, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <XCircle className="h-3 w-3 mt-0.5 text-destructive shrink-0" />
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {check.details?.recommendations?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-primary mb-1">Recomendações:</p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {check.details.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <AlertTriangle className="h-3 w-3 mt-0.5 text-warning shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>

        {/* Top Recommendations */}
        {latestScan?.recommendations && latestScan.recommendations.length > 0 && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Recomendações Prioritárias
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {latestScan.recommendations.slice(0, 5).map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary font-medium">{i + 1}.</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
