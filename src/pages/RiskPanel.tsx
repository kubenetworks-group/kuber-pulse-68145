import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRiskAnalysis } from "@/hooks/useRiskAnalysis";
import { useCluster } from "@/contexts/ClusterContext";
import { useSecurityThreats } from "@/hooks/useSecurityThreats";
import { RiskScoreCard } from "@/components/risk/RiskScoreCard";
import { RisksOverview } from "@/components/risk/RisksOverview";
import { ClusterChangesWidget } from "@/components/risk/ClusterChangesWidget";
import { AvailabilityWidget } from "@/components/risk/AvailabilityWidget";
import { PublicExposuresWidget } from "@/components/risk/PublicExposuresWidget";
import { ProblemTrendChart } from "@/components/risk/ProblemTrendChart";
import { UnstablePodsWidget } from "@/components/risk/UnstablePodsWidget";
import { ResourceMisuseWidget } from "@/components/risk/ResourceMisuseWidget";
import { MissingProbesWidget } from "@/components/risk/MissingProbesWidget";
import { ProblematicVolumesWidget } from "@/components/risk/ProblematicVolumesWidget";
import { CertificatesWidget } from "@/components/risk/CertificatesWidget";
import { LoadBalancerMonitorWidget } from "@/components/risk/LoadBalancerMonitorWidget";
import { SecurityThreatsPanel } from "@/components/risk/SecurityThreatsPanel";
import { ConfigurationRisksWidget } from "@/components/risk/ConfigurationRisksWidget";
import { RiskPanelFilters, RiskFilters, filterThreats, extractNamespaces } from "@/components/risk/RiskPanelFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Activity, Globe, ShieldAlert } from "lucide-react";

const RiskPanel = () => {
  const { analysis, loading } = useRiskAnalysis();
  const { clusters, selectedClusterId } = useCluster();
  const { 
    threats, 
    stats: threatStats, 
    loading: threatsLoading, 
    scanning,
    runSecurityScan,
    mitigateThreat,
    markAsFalsePositive,
    updateThreatStatus 
  } = useSecurityThreats();
  
  // Filter state
  const [filters, setFilters] = useState<RiskFilters>({
    severity: "all",
    status: "all",
    namespace: "all",
    period: "all",
  });
  
  const selectedCluster = clusters.find(c => c.id === selectedClusterId);
  
  // Extract namespaces from all threats for the filter dropdown
  const availableNamespaces = useMemo(() => extractNamespaces(threats), [threats]);
  
  // Apply filters to threats
  const filteredThreats = useMemo(() => filterThreats(threats, filters), [threats, filters]);
  
  // Only count REAL ATTACKS for the badge, not configuration risks
  const activeAttacks = filteredThreats.filter(t => t.status === 'active' && t.is_attack !== false);
  const hasActiveAttacks = activeAttacks.length > 0;
  
  // Configuration risks go to Risks tab
  const configRisks = filteredThreats.filter(t => t.is_attack === false && t.status === 'active');

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  if (!selectedClusterId) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col items-center justify-center py-20">
            <AlertTriangle className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nenhum cluster selecionado</h2>
            <p className="text-muted-foreground text-center max-w-md">
              Selecione um cluster no menu superior para visualizar a análise de riscos e o painel de saúde do Kubernetes.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Painel de Risco</h1>
              {selectedCluster && (
                <p className="text-sm text-muted-foreground">
                  {selectedCluster.name} - {selectedCluster.environment}
                </p>
              )}
            </div>
          </div>
          
          <RiskScoreCard score={analysis.overallScore} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue={hasActiveAttacks ? "threats" : "risks"} className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="threats" className="flex items-center gap-2 relative">
              <ShieldAlert className="h-4 w-4" />
              Ameaças
              {hasActiveAttacks && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center animate-pulse">
                  {activeAttacks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="risks" className="flex items-center gap-2 relative">
              <AlertTriangle className="h-4 w-4" />
              Riscos
              {configRisks.length > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center">
                  {configRisks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="loadbalancer" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              LoadBalancers
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Health
            </TabsTrigger>
          </TabsList>

          {/* Tab: Security Threats */}
          <TabsContent value="threats" className="space-y-6">
            <RiskPanelFilters
              filters={filters}
              onFiltersChange={setFilters}
              namespaces={availableNamespaces}
              showStatusFilter={true}
            />
            <SecurityThreatsPanel
              threats={filteredThreats}
              stats={threatStats}
              loading={threatsLoading}
              scanning={scanning}
              onScan={runSecurityScan}
              onMitigate={mitigateThreat}
              onMarkFalsePositive={markAsFalsePositive}
              onUpdateStatus={updateThreatStatus}
            />
          </TabsContent>

          {/* Tab: Análise de Riscos */}
          <TabsContent value="risks" className="space-y-6">
            <RiskPanelFilters
              filters={filters}
              onFiltersChange={setFilters}
              namespaces={availableNamespaces}
              showStatusFilter={true}
            />
            
            {/* Configuration Risks from Security Threats */}
            {configRisks.length > 0 && (
              <ConfigurationRisksWidget
                risks={configRisks}
                onResolve={mitigateThreat}
                onMarkFalsePositive={markAsFalsePositive}
              />
            )}
            
            {/* Risk Categories */}
            <RisksOverview risks={analysis.risks} />

            {/* Grid: Changes + Availability */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ClusterChangesWidget changes={analysis.recentChanges} />
              <AvailabilityWidget availability={analysis.availability} />
            </div>

            {/* Public Exposures */}
            <PublicExposuresWidget exposures={analysis.publicExposures} />

            {/* Trend Chart */}
            <ProblemTrendChart trends={analysis.trends} />
          </TabsContent>

          {/* Tab: LoadBalancer Monitoring */}
          <TabsContent value="loadbalancer" className="space-y-6">
            <LoadBalancerMonitorWidget />
            
            {/* Also show public exposures for context */}
            <PublicExposuresWidget exposures={analysis.publicExposures} />
          </TabsContent>

          {/* Tab: Kubernetes Health Manager */}
          <TabsContent value="health" className="space-y-6">
            {/* Unstable Pods + Resource Issues */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UnstablePodsWidget pods={analysis.unstablePods} />
              <ResourceMisuseWidget issues={analysis.resourceIssues} />
            </div>

            {/* Missing Probes + Volumes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MissingProbesWidget issues={analysis.probeIssues} />
              <ProblematicVolumesWidget problems={analysis.volumeProblems} />
            </div>

            {/* Certificates */}
            <CertificatesWidget issues={analysis.certificateIssues} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default RiskPanel;
