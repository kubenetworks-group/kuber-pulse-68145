import { supabase } from "@/integrations/supabase/client";

export interface ClusterSnapshot {
  id: string;
  cluster_id: string;
  user_id: string;
  name: string;
  description?: string;
  status: "pending" | "running" | "completed" | "failed";
  storage_path?: string;
  storage_size_bytes?: number;
  manifest_count?: number;
  namespace_count?: number;
  resource_summary?: {
    namespaces: string[];
    resourceCounts: Record<string, number>;
    storageClasses: string[];
  };
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

// Create a snapshot record and trigger the agent to collect it
export async function createSnapshot(
  clusterId: string,
  name: string,
  description?: string
): Promise<ClusterSnapshot> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // 1. Insert snapshot record (status = pending)
  const { data: snapshot, error: insertError } = await supabase
    .from("cluster_snapshots")
    .insert({
      cluster_id: clusterId,
      user_id: user.id,
      name,
      description,
      status: "pending",
    })
    .select()
    .single();

  if (insertError) throw insertError;

  // 2. Generate a pre-signed upload URL for the agent
  const storagePath = `${user.id}/${clusterId}/${snapshot.id}/snapshot.json`;
  const { data: signedUrl, error: signError } = await supabase.storage
    .from("cluster-backups")
    .createSignedUploadUrl(storagePath);

  if (signError) throw signError;

  // 3. Send command to agent
  const { error: cmdError } = await supabase.from("agent_commands").insert({
    cluster_id: clusterId,
    user_id: user.id,
    command_type: "collect_cluster_snapshot",
    command_params: {
      snapshot_id: snapshot.id,
      upload_url: signedUrl.signedUrl,
    },
    status: "pending",
  });

  if (cmdError) throw cmdError;

  // 4. Mark snapshot as running and store path
  const { data: updated, error: updateError } = await supabase
    .from("cluster_snapshots")
    .update({
      status: "running",
      storage_path: storagePath,
      started_at: new Date().toISOString(),
    })
    .eq("id", snapshot.id)
    .select()
    .single();

  if (updateError) throw updateError;

  return updated as unknown as ClusterSnapshot;
}

// Called by the agent-update-command webhook handler to finalize a snapshot
export async function finalizeSnapshot(
  snapshotId: string,
  result: {
    resource_count: number;
    size_bytes: number;
    namespaces: string[];
    storage_classes: string[];
  }
): Promise<void> {
  await supabase
    .from("cluster_snapshots")
    .update({
      status: "completed",
      manifest_count: result.resource_count,
      storage_size_bytes: result.size_bytes,
      namespace_count: result.namespaces.length,
      resource_summary: {
        namespaces: result.namespaces,
        storageClasses: result.storage_classes,
        resourceCounts: {},
      },
      completed_at: new Date().toISOString(),
    })
    .eq("id", snapshotId);
}

// List snapshots for a cluster
export async function listSnapshots(clusterId: string): Promise<ClusterSnapshot[]> {
  const { data, error } = await supabase
    .from("cluster_snapshots")
    .select("*")
    .eq("cluster_id", clusterId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ClusterSnapshot[];
}

// Delete a snapshot (DB record + storage file)
export async function deleteSnapshot(snapshot: ClusterSnapshot): Promise<void> {
  if (snapshot.storage_path) {
    await supabase.storage.from("cluster-backups").remove([snapshot.storage_path]);
  }
  const { error } = await supabase
    .from("cluster_snapshots")
    .delete()
    .eq("id", snapshot.id);
  if (error) throw error;
}

// Get a signed download URL for a snapshot file
export async function getSnapshotDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("cluster-backups")
    .createSignedUrl(storagePath, 3600); // 1 hour
  if (error) throw error;
  return data.signedUrl;
}
