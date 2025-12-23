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
  ChevronUp,
  Wrench,
  Play
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

type FixType = 'restrict_rbac' | 'create_network_policy' | 'apply_pod_security' | 'enable_secrets_encryption' | 'apply_resource_limits';

export const ClusterSecurityAnalysis = () => {
  const { selectedClusterId } = useCluster();
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [latestScan, setLatestScan] = useState<SecurityScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [applyingFix, setApplyingFix] = useState<string | null>(null);
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());

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
    } catch (error) {
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

  const applySecurityFix = async (fixType: FixType, checkKey: string) => {
    if (!selectedClusterId || !user) {
      toast({
        title: "Erro",
        description: "Cluster ou usuário não identificado",
        variant: "destructive"
      });
      return;
    }

    const fixKey = `${checkKey}-${fixType}`;
    setApplyingFix(fixKey);

    try {
      const { data: command, error: commandError } = await supabase
        .from('agent_commands')
        .insert({
          cluster_id: selectedClusterId,
          user_id: user.id,
          command_type: fixType,
          command_params: getFixParams(fixType),
          status: 'pending',
        })
        .select()
        .single();

      if (commandError) throw commandError;

      await supabase
        .from('auto_heal_actions_log')
        .insert({
          cluster_id: selectedClusterId,
          user_id: user.id,
          action_type: 'security_fix',
          trigger_reason: getFixDescription(fixType),
          action_details: {
            fix_type: fixType,
            check_key: checkKey,
            command_id: command.id,
          },
          status: 'pending',
        });

      await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title: '🔧 Correção de Segurança Enviada',
          message: `${getFixDescription(fixType)} foi enviada para execução no cluster`,
          type: 'info',
        });

      setAppliedFixes(prev => new Set([...prev, fixKey]));

      toast({
        title: "✅ Correção Enviada",
        description: `Comando de ${getFixDescription(fixType)} enviado para o agente`,
      });
    } catch (error: any) {
      console.error('Error applying fix:', error);
      toast({
        title: "Erro ao aplicar correção",
        description: error.message || "Falha ao enviar comando de correção",
        variant: "destructive"
      });
    } finally {
      setApplyingFix(null);
    }
  };

  const getFixParams = (fixType: FixType) => {
    switch (fixType) {
      case 'restrict_rbac':
        return { action: 'create_least_privilege_roles', apply_to_all_namespaces: true };
      case 'create_network_policy':
        return { policy_type: 'deny-all-ingress', apply_to_all_namespaces: true };
      case 'apply_pod_security':
        return { level: 'restricted', enforce: true, apply_to_all_namespaces: true };
      case 'enable_secrets_encryption':
        return { enable_encryption_at_rest: true };
      case 'apply_resource_limits':
        return { default_cpu_limit: '500m', default_memory_limit: '512Mi', apply_to_all_pods: true };
      default:
        return {};
    }
  };

  const getFixDescription = (fixType: FixType): string => {
    switch (fixType) {
      case 'restrict_rbac':
        return 'Configurar RBAC com privilégios mínimos';
      case 'create_network_policy':
        return 'Criar Network Policies restritivas';
      case 'apply_pod_security':
        return 'Aplicar Pod Security Standards';
      case 'enable_secrets_encryption':
        return 'Habilitar encriptação de secrets';
      case 'apply_resource_limits':
        return 'Aplicar limites de recursos';
      default:
        return fixType;
    }
  };

  const applyAllFixes = async () => {
    const fixTypes: { key: string; type: FixType; enabled: boolean }[] = [
      { key: 'rbac', type: 'restrict_rbac', enabled: !latestScan?.has_rbac },
      { key: 'network', type: 'create_network_policy', enabled: !latestScan?.has_network_policies },
      { key: 'pod', type: 'apply_pod_security', enabled: !latestScan?.has_pod_security },
      { key: 'secrets', type: 'enable_secrets_encryption', enabled: !latestScan?.has_secrets_encryption },
      { key: 'limits', type: 'apply_resource_limits', enabled: !latestScan?.has_resource_limits },
    ];

    const pendingFixes = fixTypes.filter(f => f.enabled && !appliedFixes.has(`${f.key}-${f.type}`));
    
    for (const fix of pendingFixes) {
      await applySecurityFix(fix.type, fix.key);
    }

    toast({
      title: "✅ Todas as Correções Enviadas",
      description: `${pendingFixes.length} correções foram enviadas para execução`,
    });
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

  const getFixTypeForCheck = (checkKey: string): FixType => {
    const mapping: Record<string, FixType> = {
      'rbac': 'restrict_rbac',
      'network': 'create_network_policy',
      'pod': 'apply_pod_security',
      'secrets': 'enable_secrets_encryption',
      'limits': 'apply_resource_limits',
    };
    return mapping[checkKey];
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

  const pendingFixesCount = securityChecks.filter(c => !c.enabled).length;

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            {latestScan?.status === 'passed' ? (
              <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-success shrink-0" />
            ) : latestScan?.status === 'warning' ? (
              <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 text-warning shrink-0" />
            ) : (
              <ShieldX className="h-5 w-5 sm:h-6 sm:w-6 text-destructive shrink-0" />
            )}
            <div>
              <CardTitle className="text-base sm:text-lg">Análise de Segurança</CardTitle>
              <CardDescription className="text-[10px] sm:text-xs">
                Última análise: {latestScan?.scan_date ? new Date(latestScan.scan_date).toLocaleString('pt-BR') : 'N/A'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {pendingFixesCount > 0 && (
              <Button
                onClick={applyAllFixes}
                disabled={applyingFix !== null}
                size="sm"
                className="gap-1.5 sm:gap-2 bg-primary hover:bg-primary/90 text-xs sm:text-sm h-8 sm:h-9"
              >
                {applyingFix ? (
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 sm:h-4 sm:w-4" />
                )}
                <span className="hidden xs:inline">Aplicar Todas</span> ({pendingFixesCount})
              </Button>
            )}
            {latestScan && getStatusBadge(latestScan.status)}
            <Button
              onClick={runSecurityAnalysis}
              disabled={scanning}
              size="sm"
              variant="outline"
              className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9"
            >
              {scanning ? (
                <>
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  <span className="hidden xs:inline">Analisando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">Nova Análise</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {latestScan && (
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Score de Segurança</span>
              <span className={`text-2xl font-bold ${getScoreColor(latestScan.security_score)}`}>
                {latestScan.security_score}/100
              </span>
            </div>
            <Progress value={latestScan.security_score} className="h-2" />
            {latestScan.ai_analysis?.summary && (
              <p className="mt-3 text-sm text-muted-foreground">
                {latestScan.ai_analysis.summary}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          {securityChecks.map((check) => {
            const fixType = getFixTypeForCheck(check.key);
            const fixKey = `${check.key}-${fixType}`;
            const isApplying = applyingFix === fixKey;
            const isApplied = appliedFixes.has(fixKey);

            return (
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
                        <div className="mb-3">
                          <p className="text-xs font-medium text-destructive mb-1">Problemas Encontrados:</p>
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
                        <div className="mb-3">
                          <p className="text-xs font-medium text-primary mb-1">O que fazer para corrigir:</p>
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
                      
                      {!check.enabled && (
                        <div className="mt-3 pt-3 border-t border-border/30">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              applySecurityFix(fixType, check.key);
                            }}
                            disabled={isApplying || isApplied}
                            size="sm"
                            variant={isApplied ? "outline" : "default"}
                            className="gap-2 w-full"
                          >
                            {isApplying ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Aplicando...
                              </>
                            ) : isApplied ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                Correção Enviada
                              </>
                            ) : (
                              <>
                                <Wrench className="h-4 w-4" />
                                Aplicar Correção Automática
                              </>
                            )}
                          </Button>
                          <p className="text-[10px] text-muted-foreground mt-1 text-center">
                            {isApplied 
                              ? "O agente executará a correção no cluster"
                              : getFixDescription(fixType)
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>

        {latestScan?.recommendations && latestScan.recommendations.length > 0 && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Recomendações Prioritárias da IA
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
