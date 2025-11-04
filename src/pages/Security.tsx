import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { SecurityScanCard } from "@/components/SecurityScanCard";
import { AlertCircle, CheckCircle, AlertTriangle, XCircle, Bot, Scan, Shield, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

type ScanResult = {
  id: string;
  category: 'security' | 'compliance' | 'configuration' | 'vulnerability' | 'network';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'passed';
  title: string;
  description: string;
  recommendation: string;
  affected_resources: string[];
  needs_specialist: boolean;
};

type Cluster = {
  id: string;
  name: string;
};

const Security = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string>("all");
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [lastScanDate, setLastScanDate] = useState<Date | null>(null);

  useEffect(() => {
    if (user) {
      fetchClusters();
    }
  }, [user]);

  const fetchClusters = async () => {
    const { data, error } = await supabase
      .from('clusters')
      .select('id, name');

    if (error) {
      console.error('Error fetching clusters:', error);
      return;
    }

    setClusters(data || []);
  };

  const startAIScan = async () => {
    if (!selectedCluster || selectedCluster === "all") {
      toast({
        title: "Selecione um cluster",
        description: "Por favor, selecione um cluster específico para iniciar a varredura.",
        variant: "destructive"
      });
      return;
    }

    setIsScanning(true);
    setScanProgress(0);
    setScanResults([]);

    // Simulate progressive scan
    const progressInterval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 5;
      });
    }, 300);

    // Simulate AI scan with realistic results
    setTimeout(() => {
      clearInterval(progressInterval);
      setScanProgress(100);
      
      const mockResults: ScanResult[] = [
        {
          id: '1',
          category: 'security',
          severity: 'critical',
          title: 'Pods executando como root',
          description: 'Detectados 5 pods executando com privilégios de root, o que representa um risco de segurança significativo.',
          recommendation: 'Configure securityContext nos deployments para executar como usuário não-privilegiado. Use runAsNonRoot: true e defina um UID específico.',
          affected_resources: ['deployment/api-server', 'deployment/worker', 'statefulset/cache'],
          needs_specialist: true
        },
        {
          id: '2',
          category: 'vulnerability',
          severity: 'high',
          title: 'Imagens com vulnerabilidades conhecidas',
          description: '8 containers usando imagens Docker com CVEs críticas conhecidas. Última atualização há mais de 90 dias.',
          recommendation: 'Atualize as imagens base para as versões mais recentes. Implemente scanning automático de vulnerabilidades no CI/CD.',
          affected_resources: ['nginx:1.19', 'postgres:12.3', 'redis:5.0'],
          needs_specialist: false
        },
        {
          id: '3',
          category: 'network',
          severity: 'high',
          title: 'Network Policies não configuradas',
          description: 'Nenhuma Network Policy encontrada. Todo tráfego entre pods está permitido por padrão.',
          recommendation: 'Implemente Network Policies para restringir comunicação entre namespaces e pods. Use o princípio de menor privilégio.',
          affected_resources: ['namespace/production', 'namespace/staging'],
          needs_specialist: true
        },
        {
          id: '4',
          category: 'configuration',
          severity: 'medium',
          title: 'Resource Limits não definidos',
          description: '12 deployments sem resource limits configurados, podendo causar instabilidade no cluster.',
          recommendation: 'Defina requests e limits de CPU e memória para todos os containers. Isso previne que um pod consuma todos os recursos do nó.',
          affected_resources: ['deployment/frontend', 'deployment/api', 'deployment/worker-queue'],
          needs_specialist: false
        },
        {
          id: '5',
          category: 'security',
          severity: 'medium',
          title: 'Secrets não rotacionados',
          description: 'Detectados secrets com mais de 180 dias sem rotação.',
          recommendation: 'Implemente rotação automática de secrets. Use ferramentas como Sealed Secrets ou External Secrets Operator.',
          affected_resources: ['secret/db-credentials', 'secret/api-keys'],
          needs_specialist: false
        },
        {
          id: '6',
          category: 'compliance',
          severity: 'low',
          title: 'Labels e annotations inconsistentes',
          description: 'Alguns recursos não seguem o padrão de labels definido pela organização.',
          recommendation: 'Padronize labels em todos os recursos. Use admission controllers para forçar compliance.',
          affected_resources: ['deployment/legacy-app'],
          needs_specialist: false
        },
        {
          id: '7',
          category: 'security',
          severity: 'passed',
          title: 'RBAC configurado corretamente',
          description: 'Todas as service accounts possuem roles apropriadas e seguem o princípio de menor privilégio.',
          recommendation: '',
          affected_resources: [],
          needs_specialist: false
        },
        {
          id: '8',
          category: 'configuration',
          severity: 'passed',
          title: 'Health checks configurados',
          description: 'Todos os pods possuem liveness e readiness probes configuradas adequadamente.',
          recommendation: '',
          affected_resources: [],
          needs_specialist: false
        }
      ];

      setScanResults(mockResults);
      setLastScanDate(new Date());
      setIsScanning(false);

      // Create notification
      supabase
        .from('notifications')
        .insert({
          user_id: user?.id,
          title: '🔍 Varredura de Segurança Concluída',
          message: `A IA terminou a análise do cluster. Encontrados ${mockResults.filter(r => r.severity !== 'passed').length} problemas que precisam de atenção.`,
          type: 'info',
          related_entity_type: 'cluster',
          related_entity_id: selectedCluster
        });

      toast({
        title: "Varredura concluída!",
        description: `Encontrados ${mockResults.filter(r => r.severity !== 'passed').length} problemas de segurança.`,
      });
    }, 5000);
  };

  const stats = {
    critical: scanResults.filter(r => r.severity === 'critical').length,
    high: scanResults.filter(r => r.severity === 'high').length,
    medium: scanResults.filter(r => r.severity === 'medium').length,
    low: scanResults.filter(r => r.severity === 'low').length,
    passed: scanResults.filter(r => r.severity === 'passed').length,
    needsSpecialist: scanResults.filter(r => r.needs_specialist).length,
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 bg-gradient-primary bg-clip-text text-transparent">
              Auditoria de Segurança com IA
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Varredura inteligente de vulnerabilidades e configurações de segurança
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
            <Select value={selectedCluster} onValueChange={setSelectedCluster}>
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue placeholder="Selecione um cluster" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Clusters</SelectItem>
                {clusters.map(cluster => (
                  <SelectItem key={cluster.id} value={cluster.id}>
                    {cluster.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={startAIScan} 
              disabled={isScanning || selectedCluster === "all"}
              size="lg"
              className="gap-2"
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Scan className="h-5 w-5" />
                  Iniciar Varredura
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Scan Progress */}
        {isScanning && (
          <Card className="border-primary/50 bg-gradient-to-r from-primary/10 to-accent/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary animate-pulse" />
                IA Analisando Cluster
              </CardTitle>
              <CardDescription>
                Verificando configurações de segurança, vulnerabilidades e conformidade...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={scanProgress} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">{scanProgress}% concluído</p>
            </CardContent>
          </Card>
        )}

        {/* Last Scan Info */}
        {lastScanDate && !isScanning && (
          <div className="text-sm text-muted-foreground">
            Última varredura: {lastScanDate.toLocaleString('pt-BR')}
          </div>
        )}

        {/* Stats Grid */}
        {scanResults.length > 0 && (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Crítico</p>
                    <h3 className="text-3xl font-bold text-destructive">{stats.critical}</h3>
                  </div>
                  <XCircle className="w-8 h-8 text-destructive" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Alto</p>
                    <h3 className="text-3xl font-bold text-orange-500">{stats.high}</h3>
                  </div>
                  <AlertCircle className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Médio</p>
                    <h3 className="text-3xl font-bold text-warning">{stats.medium}</h3>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-warning" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Baixo</p>
                    <h3 className="text-3xl font-bold text-blue-500">{stats.low}</h3>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">OK</p>
                    <h3 className="text-3xl font-bold text-success">{stats.passed}</h3>
                  </div>
                  <CheckCircle className="w-8 h-8 text-success" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-warning/10 to-destructive/10 border-warning/30">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Especialista</p>
                    <h3 className="text-3xl font-bold text-warning">{stats.needsSpecialist}</h3>
                  </div>
                  <Shield className="w-8 h-8 text-warning" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Scan Results */}
        {scanResults.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Resultados da Varredura</h2>
            
            {/* Critical issues first */}
            {scanResults.filter(r => r.severity === 'critical').length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-destructive">🔥 Crítico - Ação Imediata Necessária</h3>
                {scanResults
                  .filter(r => r.severity === 'critical')
                  .map(result => (
                    <SecurityScanCard key={result.id} result={result} />
                  ))}
              </div>
            )}

            {/* High severity */}
            {scanResults.filter(r => r.severity === 'high').length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-orange-500">⚠️ Alta Prioridade</h3>
                {scanResults
                  .filter(r => r.severity === 'high')
                  .map(result => (
                    <SecurityScanCard key={result.id} result={result} />
                  ))}
              </div>
            )}

            {/* Medium and Low */}
            {scanResults.filter(r => r.severity === 'medium' || r.severity === 'low').length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">📋 Atenção Recomendada</h3>
                {scanResults
                  .filter(r => r.severity === 'medium' || r.severity === 'low')
                  .map(result => (
                    <SecurityScanCard key={result.id} result={result} />
                  ))}
              </div>
            )}

            {/* Passed checks */}
            {scanResults.filter(r => r.severity === 'passed').length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-success">✅ Configurações Corretas</h3>
                {scanResults
                  .filter(r => r.severity === 'passed')
                  .map(result => (
                    <SecurityScanCard key={result.id} result={result} />
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {scanResults.length === 0 && !isScanning && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Scan className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma varredura realizada</h3>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                Selecione um cluster e clique em "Iniciar Varredura" para que a IA analise
                as configurações de segurança, vulnerabilidades e conformidade.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Security;
