import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRiskAnalysis } from "@/hooks/useRiskAnalysis";
import { useCluster } from "@/contexts/ClusterContext";
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
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Activity } from "lucide-react";

const RiskPanel = () => {
  const { analysis, loading } = useRiskAnalysis();
  const { clusters, selectedClusterId } = useCluster();
  
  const selectedCluster = clusters.find(c => c.id === selectedClusterId);

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
          
          {analysis && (
            <RiskScoreCard score={analysis.overallScore} />
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="risks" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="risks" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Análise de Riscos
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Health Manager
            </TabsTrigger>
          </TabsList>

          {/* Tab: Análise de Riscos */}
          <TabsContent value="risks" className="space-y-6">
            {analysis && (
              <>
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
              </>
            )}
          </TabsContent>

          {/* Tab: Kubernetes Health Manager */}
          <TabsContent value="health" className="space-y-6">
            {analysis && (
              <>
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
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default RiskPanel;
