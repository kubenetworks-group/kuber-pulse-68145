import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCluster } from "@/contexts/ClusterContext";
import { useClusterSnapshots } from "@/hooks/useClusterSnapshots";
import { useClusterMigrations } from "@/hooks/useClusterMigrations";
import { SnapshotsList } from "@/components/migration/SnapshotsList";
import { MigrationWizard } from "@/components/migration/MigrationWizard";
import { MigrationsList } from "@/components/migration/MigrationsList";
import { CompatibilityReport } from "@/components/migration/CompatibilityReport";
import { ManifestDiffViewer } from "@/components/migration/ManifestDiffViewer";
import { ValidationResults } from "@/components/migration/ValidationResults";
import { type ClusterMigration } from "@/services/migrationAnalysisService";
import { Archive, Camera, Wand2, History } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Migration = () => {
  const { selectedClusterId, clusters } = useCluster();
  const { snapshots, loading: snapshotsLoading, creating, createSnapshot, deleteSnapshot } =
    useClusterSnapshots(selectedClusterId);
  const {
    migrations,
    loading: migrationsLoading,
    analyzing,
    analysisProgress,
    createMigration,
    applyMigration,
    validateMigration,
  } = useClusterMigrations();

  const [selectedMigration, setSelectedMigration] = useState<ClusterMigration | null>(null);
  const [activeTab, setActiveTab] = useState("snapshots");

  const handleSelectSnapshotForMigration = () => {
    setActiveTab("nova-migracao");
  };

  const handleViewMigration = (migration: ClusterMigration) => {
    setSelectedMigration(migration);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Archive className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Backup & Migração</h1>
              <p className="text-sm text-muted-foreground">
                Snapshots completos e migração zero-downtime entre qualquer infra Kubernetes
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            {clusters.length} cluster{clusters.length !== 1 ? "s" : ""} disponível{clusters.length !== 1 ? "is" : ""}
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="snapshots" className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Snapshots
            </TabsTrigger>
            <TabsTrigger value="nova-migracao" className="flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Nova Migração
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Snapshots tab */}
          <TabsContent value="snapshots" className="mt-6">
            {!selectedClusterId ? (
              <div className="text-center py-16 text-muted-foreground">
                <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Selecione um cluster</p>
                <p className="text-sm">Selecione um cluster no menu superior para gerenciar snapshots.</p>
              </div>
            ) : (
              <SnapshotsList
                snapshots={snapshots}
                loading={snapshotsLoading}
                creating={creating}
                onCreateSnapshot={createSnapshot}
                onDeleteSnapshot={deleteSnapshot}
                onSelectForMigration={handleSelectSnapshotForMigration}
              />
            )}
          </TabsContent>

          {/* Nova migração tab */}
          <TabsContent value="nova-migracao" className="mt-6">
            {clusters.length < 2 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Wand2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Dois clusters necessários</p>
                <p className="text-sm">
                  Para criar uma migração você precisa de pelo menos 2 clusters cadastrados — um de origem e um de destino.
                </p>
              </div>
            ) : (
              <MigrationWizard
                clusters={clusters.map((c) => ({
                  id: c.id,
                  name: c.name,
                  provider: c.provider,
                }))}
                snapshots={snapshots}
                analyzing={analyzing}
                analysisProgress={analysisProgress}
                onAnalyze={createMigration}
                onApply={async (m) => {
                  await applyMigration(m);
                  setActiveTab("historico");
                }}
              />
            )}
          </TabsContent>

          {/* Histórico tab */}
          <TabsContent value="historico" className="mt-6">
            <MigrationsList
              migrations={migrations}
              loading={migrationsLoading}
              onViewMigration={handleViewMigration}
              onApply={applyMigration}
              onValidate={(m) => validateMigration(m)}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Migration detail sheet */}
      <Sheet open={!!selectedMigration} onOpenChange={(open) => !open && setSelectedMigration(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedMigration && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedMigration.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <CompatibilityReport migration={selectedMigration} />
                <ManifestDiffViewer migration={selectedMigration} />
                <ValidationResults migration={selectedMigration} />
                {(selectedMigration.status === "applying" || selectedMigration.status === "completed") && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      validateMigration(selectedMigration);
                    }}
                  >
                    Executar Validação
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
};

export default Migration;
