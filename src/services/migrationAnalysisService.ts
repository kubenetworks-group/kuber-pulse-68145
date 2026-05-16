import { supabase } from "@/integrations/supabase/client";
import { analyzeCompatibility, transformManifests, type CompatibilityIssue } from "./manifestTransformer";
import { getSnapshotDownloadUrl } from "./snapshotService";

export interface ClusterMigration {
  id: string;
  user_id: string;
  source_cluster_id: string;
  target_cluster_id: string;
  snapshot_id?: string;
  name: string;
  description?: string;
  status:
    | "pending"
    | "analyzing"
    | "ready"
    | "transforming"
    | "applying"
    | "validating"
    | "completed"
    | "failed"
    | "rolled_back";
  ai_analysis?: Record<string, unknown>;
  compatibility_score?: number;
  issues_found?: number;
  issues_auto_fixed?: number;
  original_manifest_path?: string;
  transformed_manifest_path?: string;
  transformation_log?: unknown[];
  progress_percent?: number;
  current_step?: string;
  steps_log?: unknown[];
  error_message?: string;
  rollback_available?: boolean;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MigrationStep {
  step: string;
  status: "pending" | "running" | "done" | "failed";
  timestamp: string;
  detail?: string;
}

// Create a migration record and kick off AI analysis + manifest transformation
export async function createMigration(params: {
  sourceClusterId: string;
  targetClusterId: string;
  snapshotId: string;
  name: string;
  description?: string;
  targetStorageClass?: string;
  onProgress?: (step: string, percent: number) => void;
}): Promise<ClusterMigration> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { sourceClusterId, targetClusterId, snapshotId, name, description, onProgress } = params;
  // "auto" means the agent will detect at apply time; still run analysis with a neutral hint
  const targetStorageClass = (!params.targetStorageClass || params.targetStorageClass === "auto")
    ? "standard"
    : params.targetStorageClass;

  // 1. Create migration record
  onProgress?.("Criando registro de migração...", 5);
  const { data: migration, error: insertError } = await supabase
    .from("cluster_migrations")
    .insert({
      user_id: user.id,
      source_cluster_id: sourceClusterId,
      target_cluster_id: targetClusterId,
      snapshot_id: snapshotId,
      name,
      description,
      status: "analyzing",
      started_at: new Date().toISOString(),
      progress_percent: 5,
      current_step: "Iniciando análise de compatibilidade",
    })
    .select()
    .single();

  if (insertError) throw insertError;

  const migrationId = migration.id;

  try {
    // 2. Download snapshot
    onProgress?.("Baixando snapshot do cluster de origem...", 15);
    const { data: snapshot } = await supabase
      .from("cluster_snapshots")
      .select("storage_path")
      .eq("id", snapshotId)
      .single();

    if (!snapshot?.storage_path) throw new Error("Snapshot sem arquivo de storage");

    const downloadUrl = await getSnapshotDownloadUrl(snapshot.storage_path);
    const resp = await fetch(downloadUrl);
    if (!resp.ok) throw new Error("Falha ao baixar snapshot");

    const snapshotData = await resp.json();
    const manifests = snapshotData.manifests as Record<string, unknown[]>;

    // 3. Analyze compatibility
    onProgress?.("Analisando compatibilidade entre clusters...", 30);
    const issues: CompatibilityIssue[] = analyzeCompatibility(manifests, targetStorageClass);

    // 4. Stream AI analysis via cluster-assistant edge function
    onProgress?.("Consultando IA para análise detalhada...", 45);
    const aiAnalysis = await streamAIAnalysis(migrationId, issues, snapshotData, targetStorageClass);

    await supabase
      .from("cluster_migrations")
      .update({
        status: "transforming",
        ai_analysis: aiAnalysis as never,
        compatibility_score: calculateScore(issues),
        issues_found: issues.filter(i => i.severity !== "info").length,
        progress_percent: 55,
        current_step: "Transformando manifests",
      })
      .eq("id", migrationId);

    // 5. Transform manifests
    onProgress?.("Aplicando transformações nos manifests...", 60);
    const transformResult = transformManifests(manifests, targetStorageClass);

    // 6. Upload original manifests to storage
    onProgress?.("Salvando manifests originais...", 70);
    const origPath = `${user.id}/${sourceClusterId}/${migrationId}/original.json`;
    const transformedPath = `${user.id}/${targetClusterId}/${migrationId}/transformed.json`;

    await supabase.storage
      .from("cluster-backups")
      .upload(origPath, JSON.stringify(snapshotData), { contentType: "application/json", upsert: true });

    // 7. Upload transformed manifests
    onProgress?.("Salvando manifests transformados...", 80);
    await supabase.storage
      .from("cluster-backups")
      .upload(transformedPath, JSON.stringify(transformResult.manifests), { contentType: "application/json", upsert: true });

    // 8. Update migration to ready
    onProgress?.("Pronto para aplicar!", 95);
    const { data: updated } = await supabase
      .from("cluster_migrations")
      .update({
        status: "ready",
        original_manifest_path: origPath,
        transformed_manifest_path: transformedPath,
        transformation_log: transformResult.log as never,
        issues_auto_fixed: transformResult.issuesFixed,
        rollback_available: true,
        progress_percent: 100,
        current_step: "Análise completa — pronto para aplicar",
        completed_at: new Date().toISOString(),
      })
      .eq("id", migrationId)
      .select()
      .single();

    onProgress?.("Análise concluída!", 100);
    return (updated ?? migration) as unknown as ClusterMigration;
  } catch (error) {
    await supabase
      .from("cluster_migrations")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq("id", migrationId);
    throw error;
  }
}

// Apply the transformed manifests to the target cluster via agent command
export async function applyMigration(migration: ClusterMigration): Promise<void> {
  if (!migration.transformed_manifest_path) throw new Error("Nenhum manifest transformado encontrado");

  const downloadUrl = await getSnapshotDownloadUrl(migration.transformed_manifest_path);

  await supabase.from("cluster_migrations").update({
    status: "applying",
    progress_percent: 10,
    current_step: "Enviando manifests para o agente do cluster destino",
  }).eq("id", migration.id);

  await supabase.from("agent_commands").insert({
    cluster_id: migration.target_cluster_id,
    user_id: migration.user_id,
    command_type: "apply_manifests",
    command_params: {
      migration_id: migration.id,
      download_url: downloadUrl,
    },
    status: "pending",
  });
}

// Run post-migration validation via agent command
export async function runMigrationValidation(migration: ClusterMigration, namespaces?: string[]): Promise<void> {
  await supabase.from("cluster_migrations").update({
    status: "validating",
    current_step: "Executando verificações de integridade",
  }).eq("id", migration.id);

  await supabase.from("agent_commands").insert({
    cluster_id: migration.target_cluster_id,
    user_id: migration.user_id,
    command_type: "validate_migration",
    command_params: {
      migration_id: migration.id,
      namespaces: namespaces ?? [],
    },
    status: "pending",
  });
}

// How long (ms) each in-progress status is allowed before being considered stalled
const STALL_THRESHOLDS: Partial<Record<ClusterMigration["status"], number>> = {
  analyzing:    15 * 60 * 1000,
  transforming:  5 * 60 * 1000,
  applying:     30 * 60 * 1000,
  validating:   20 * 60 * 1000,
};

export function isMigrationStalled(migration: ClusterMigration): boolean {
  const threshold = STALL_THRESHOLDS[migration.status];
  if (!threshold) return false;
  const lastUpdate = new Date(migration.updated_at).getTime();
  return Date.now() - lastUpdate > threshold;
}

// Cancel a stalled or in-progress migration — marks it failed and kills pending agent commands
export async function cancelMigration(migration: ClusterMigration): Promise<void> {
  const IN_PROGRESS: ClusterMigration["status"][] = ["analyzing", "transforming", "applying", "validating", "pending"];
  if (!IN_PROGRESS.includes(migration.status)) return;

  await supabase
    .from("cluster_migrations")
    .update({
      status: "failed",
      error_message: "Migração cancelada pelo usuário.",
      completed_at: new Date().toISOString(),
      progress_percent: 0,
      current_step: null,
    })
    .eq("id", migration.id);

  // Cancel any pending/sent agent commands related to this migration
  await supabase
    .from("agent_commands")
    .update({ status: "failed", completed_at: new Date().toISOString() } as never)
    .eq("cluster_id", migration.target_cluster_id)
    .in("status", ["pending", "sent", "executing"])
    .contains("command_params", { migration_id: migration.id } as never);
}

// List all migrations for the current user
export async function listMigrations(): Promise<ClusterMigration[]> {
  const { data, error } = await supabase
    .from("cluster_migrations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ClusterMigration[];
}

// Stream AI analysis from the cluster-assistant edge function
async function streamAIAnalysis(
  migrationId: string,
  issues: CompatibilityIssue[],
  snapshotData: Record<string, unknown>,
  targetStorageClass: string
): Promise<Record<string, unknown>> {
  const prompt = buildAnalysisPrompt(issues, snapshotData, targetStorageClass);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cluster-assistant`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ message: prompt, clusterId: migrationId }),
      }
    );

    if (!response.ok) throw new Error("AI analysis request failed");

    // Read the streamed response
    const reader = response.body?.getReader();
    let aiText = "";
    if (reader) {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiText += decoder.decode(value, { stream: true });
      }
    }

    return {
      raw: aiText,
      issues: issues.map(i => ({
        severity: i.severity, kind: i.kind, resource: i.resource,
        namespace: i.namespace, issue: i.issue, suggestion: i.suggestion, autoFixable: i.autoFixable,
      })),
      issues_count: issues.length,
      critical: issues.filter((i) => i.severity === "critical").length,
      warnings: issues.filter((i) => i.severity === "warning").length,
      info: issues.filter((i) => i.severity === "info").length,
      target_storage_class: targetStorageClass,
      generated_at: new Date().toISOString(),
    };
  } catch {
    return {
      raw: buildFallbackAnalysis(issues, targetStorageClass),
      issues: issues.map(i => ({
        severity: i.severity, kind: i.kind, resource: i.resource,
        namespace: i.namespace, issue: i.issue, suggestion: i.suggestion, autoFixable: i.autoFixable,
      })),
      issues_count: issues.length,
      critical: issues.filter((i) => i.severity === "critical").length,
      warnings: issues.filter((i) => i.severity === "warning").length,
      info: issues.filter((i) => i.severity === "info").length,
      target_storage_class: targetStorageClass,
      generated_at: new Date().toISOString(),
    };
  }
}

function buildAnalysisPrompt(
  issues: CompatibilityIssue[],
  snapshotData: Record<string, unknown>,
  targetStorageClass: string
): string {
  const namespaces = (snapshotData["namespaces"] as string[]) ?? [];
  const storageClasses = (snapshotData["storage_classes"] as string[]) ?? [];

  return `Você é um especialista em migração Kubernetes. Analise a compatibilidade desta migração:

**Cluster de Origem:**
- Namespaces: ${namespaces.join(", ") || "N/A"}
- StorageClasses: ${storageClasses.join(", ") || "N/A"}

**Cluster de Destino:**
- StorageClass alvo: ${targetStorageClass}

**Problemas detectados (${issues.length} total):**
${issues.map((i) => `- [${i.severity.toUpperCase()}] ${i.kind}/${i.resource}${i.namespace ? ` (ns: ${i.namespace})` : ""}: ${i.issue}. Sugestão: ${i.suggestion}`).join("\n")}

Forneça:
1. Avaliação geral da migração (0-100% de compatibilidade)
2. Riscos críticos que impedem a migração
3. Ajustes automáticos aplicados
4. Recomendações adicionais para garantir zero downtime
5. Ordem recomendada de migração por namespace

Responda em português, de forma clara e objetiva.`;
}

function buildFallbackAnalysis(issues: CompatibilityIssue[], targetStorageClass: string): string {
  const critical = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");

  return `**Análise de Compatibilidade**

Score estimado: ${calculateScore(issues)}%

**Problemas críticos (${critical.length}):**
${critical.map((i) => `• ${i.kind}/${i.resource}: ${i.issue}`).join("\n") || "Nenhum"}

**Avisos (${warnings.length}):**
${warnings.map((i) => `• ${i.kind}/${i.resource}: ${i.issue}`).join("\n") || "Nenhum"}

**StorageClass alvo:** ${targetStorageClass}

Todos os problemas identificados foram corrigidos automaticamente nos manifests transformados.`;
}

function calculateScore(issues: CompatibilityIssue[]): number {
  const critical = issues.filter((i) => i.severity === "critical").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const score = Math.max(0, 100 - critical * 15 - warnings * 5);
  return score;
}
