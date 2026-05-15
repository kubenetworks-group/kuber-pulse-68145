import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClusterCard } from "@/components/ClusterCard";
import { ClusterLogs } from "@/components/ClusterLogs";
import { ClusterDeletionProgress } from "@/components/ClusterDeletionProgress";
import { LimitReachedModal } from "@/components/LimitReachedModal";
import { ClusterAnalysisPopup } from "@/components/ClusterAnalysisPopup";
import { Plus, Trash2, RefreshCw, Edit, Bot, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { toast } from "sonner";
import { useAuditLog } from "@/hooks/useAuditLog";

const Clusters = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canCreateCluster, isReadOnly } = useSubscription();
  const { logAuditEvent } = useAuditLog();
  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clusterToDelete, setClusterToDelete] = useState<string | null>(null);
  const [clusterToDeleteName, setClusterToDeleteName] = useState<string>("");
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingClusters, setDeletingClusters] = useState<{id: string, name: string, notificationId: string}[]>([]);
  const [clusterToEdit, setClusterToEdit] = useState<any | null>(null);
  const [refreshingCluster, setRefreshingCluster] = useState<string | null>(null);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [createdCluster, setCreatedCluster] = useState<{ id: string; name: string } | null>(null);
  const [analysisPopupOpen, setAnalysisPopupOpen] = useState(false);
  const [analysisCluster, setAnalysisCluster] = useState<{ id: string; name: string } | null>(null);
  const [previousStatuses, setPreviousStatuses] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: "",
    environment: "production",
    provider: "aws",
    cluster_type: "kubernetes",
    api_endpoint: "",
    region: "",
    config_file: "",
    is_local: false,
    connection_type: "cloud" as string,
    skip_ssl_verify: false,
  });

  useEffect(() => {
    fetchClusters();

    // Subscribe to realtime updates for cluster status changes
    if (!user) return;

    const channel = supabase
      .channel('clusters-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'clusters',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (import.meta.env.DEV) {
            console.log('Cluster updated');
          }
          
          const oldCluster = payload.old as any;
          const newCluster = payload.new as any;
          const previousStatus = previousStatuses[newCluster.id] || oldCluster?.status;
          
          setClusters((current) =>
            current.map((cluster) =>
              cluster.id === newCluster.id ? { ...cluster, ...newCluster } : cluster
            )
          );
          
          // Track status for future comparisons
          setPreviousStatuses(prev => ({ ...prev, [newCluster.id]: newCluster.status }));
          
          // Show toast notification for status changes
          if (newCluster.status === 'healthy') {
            toast.success(`${newCluster.name} connected successfully!`);
            
            // Check if this is the first successful connection (from connecting/pending to healthy)
            if (previousStatus === 'connecting' || previousStatus === 'pending') {
              // Wait a bit for metrics to arrive, then show analysis popup
              setTimeout(() => {
                setAnalysisCluster({ id: newCluster.id, name: newCluster.name });
                setAnalysisPopupOpen(true);
              }, 3000);
            }
          } else if (newCluster.status === 'error') {
            toast.error(`${newCluster.name} connection failed`);
          } else if (newCluster.status === 'warning') {
            toast.warning(`${newCluster.name} connected with warnings`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchClusters = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("clusters")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load clusters");
      if (import.meta.env.DEV) {
        console.error('Error loading clusters');
      }
    } else {
      setClusters(data || []);
    }
    setLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setFormData({ ...formData, config_file: content });
      };
      reader.readAsText(file);
    }
  };

  const createClusterLog = async (clusterId: string, eventType: string, message: string, details?: any) => {
    await supabase.from("cluster_events").insert([
      {
        cluster_id: clusterId,
        user_id: user?.id,
        event_type: eventType,
        message: message,
        details: details,
      },
    ]);
  };

  const handleRefreshConnection = async (cluster: any) => {
    setRefreshingCluster(cluster.id);
    
    // Immediately update status to 'connecting'
    await supabase
      .from("clusters")
      .update({ status: 'connecting', last_sync: new Date().toISOString() })
      .eq("id", cluster.id);
    
    toast.info("Refreshing connection...");

    try {
      const { data, error } = await supabase.functions.invoke('validate-cluster-connection', {
        body: {
          cluster_id: cluster.id,
          config_file: cluster.config_file,
          cluster_type: cluster.cluster_type,
          api_endpoint: cluster.api_endpoint,
          skip_ssl_verify: cluster.skip_ssl_verify || false,
        },
      });

      if (error) {
        console.error('Error calling validation function:', error);
        toast.error("Failed to refresh connection");
        
        // Update status to error if the function call failed
        await supabase
          .from("clusters")
          .update({ status: 'error' })
          .eq("id", cluster.id);
      } else {
        console.log('Validation response:', data);
        // Status will be updated by the edge function via realtime
      }
    } catch (err) {
      console.error('Error refreshing connection:', err);
      toast.error("Failed to refresh connection");
      
      await supabase
        .from("clusters")
        .update({ status: 'error' })
        .eq("id", cluster.id);
    } finally {
      setRefreshingCluster(null);
    }
  };

  const handleEditCluster = (cluster: any) => {
    setClusterToEdit(cluster);
    setFormData({
      name: cluster.name,
      environment: cluster.environment,
      provider: cluster.provider,
      cluster_type: cluster.cluster_type,
      api_endpoint: cluster.api_endpoint || "",
      region: cluster.region || "",
      config_file: cluster.config_file || "",
      is_local: cluster.is_local || false,
      connection_type: cluster.connection_type || "cloud",
      skip_ssl_verify: cluster.skip_ssl_verify || false,
    });
    setEditDialogOpen(true);
  };

  const handleUpdateCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clusterToEdit) return;

    const { error } = await supabase
      .from("clusters")
      .update({
        name: formData.name,
        environment: formData.environment,
        provider: formData.provider,
        cluster_type: formData.cluster_type,
        api_endpoint: formData.api_endpoint,
        region: formData.region,
        config_file: formData.config_file,
        skip_ssl_verify: formData.skip_ssl_verify,
      })
      .eq("id", clusterToEdit.id);

    if (error) {
      toast.error("Failed to update cluster");
      console.error(error);
    } else {
      toast.success("Cluster updated successfully!");
      
      // Refresh connection after update
      handleRefreshConnection({ ...clusterToEdit, ...formData });
      
      setEditDialogOpen(false);
      setClusterToEdit(null);
      setFormData({
        name: "",
        environment: "production",
        provider: "aws",
        cluster_type: "kubernetes",
        api_endpoint: "",
        region: "",
        config_file: "",
        is_local: false,
        connection_type: "cloud",
        skip_ssl_verify: false,
      });
      fetchClusters();
    }
  };

  const handleDeleteCluster = async () => {
    if (!clusterToDelete || deleteConfirmName !== clusterToDeleteName) return;

    setIsDeleting(true);

    try {
      // Create a notification for tracking progress
      const { data: notification, error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: user?.id,
          type: 'info',
          title: 'Excluindo cluster...',
          message: `Iniciando exclusão do cluster "${clusterToDeleteName}". Isso pode levar alguns minutos.`,
          read: false,
          related_entity_type: 'cluster_deletion',
          related_entity_id: clusterToDelete
        })
        .select()
        .single();

      if (notifError) throw notifError;

      // Add to deleting clusters list for progress tracking
      setDeletingClusters(prev => [...prev, {
        id: clusterToDelete,
        name: clusterToDeleteName,
        notificationId: notification.id
      }]);

      // Call background deletion function
      const { error: funcError } = await supabase.functions.invoke('delete-cluster-background', {
        body: {
          cluster_id: clusterToDelete,
          cluster_name: clusterToDeleteName,
          user_id: user?.id,
          notification_id: notification.id
        }
      });

      if (funcError) {
        console.error('Error calling delete function:', funcError);
        throw funcError;
      }

      toast.success("Exclusão iniciada em segundo plano", {
        description: "Você pode continuar usando o sistema normalmente. Acompanhe o progresso nas notificações."
      });

      // Remove cluster from local list immediately (optimistic update)
      setClusters(clusters.filter((c) => c.id !== clusterToDelete));
      if (selectedClusterId === clusterToDelete) {
        setSelectedClusterId(null);
      }

    } catch (err) {
      toast.error("Falha ao iniciar exclusão do cluster");
      console.error(err);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setClusterToDelete(null);
      setClusterToDeleteName("");
      setDeleteConfirmName("");
    }
  };

  // Listen for deletion completion via notifications
  useEffect(() => {
    if (!user || deletingClusters.length === 0) return;

    const channel = supabase
      .channel('deletion-progress')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const notification = payload.new as any;
          
          // Check if this is a completed deletion
          if (notification.related_entity_type === null && 
              (notification.type === 'success' || notification.type === 'error')) {
            // Find and remove from deleting list
            setDeletingClusters(prev => 
              prev.filter(c => c.notificationId !== notification.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, deletingClusters]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data, error } = await supabase.from("clusters").insert([
      {
        ...formData,
        user_id: user?.id,
      },
    ]).select().single();

    if (error) {
      toast.error("Failed to add cluster");
      console.error(error);
    } else {
      // Create initial log
      await createClusterLog(data.id, "info", "Cluster connection initiated", {
        cluster_type: formData.cluster_type,
        provider: formData.provider,
      });

      // Log audit event
      await logAuditEvent({
        action: 'cluster_created',
        resourceType: 'cluster',
        resourceId: data.id,
        details: { name: formData.name, provider: formData.provider }
      });

      setOpen(false);
      setFormData({
        name: "",
        environment: "production",
        provider: "aws",
        cluster_type: "kubernetes",
        api_endpoint: "",
        region: "",
        config_file: "",
        is_local: false,
        connection_type: "cloud",
        skip_ssl_verify: false,
      });
      fetchClusters();
      
      // Show success dialog with instructions to create agent
      setCreatedCluster({ id: data.id, name: data.name });
      setSuccessDialogOpen(true);
    }
  };

  const handleGoToAgents = () => {
    setSuccessDialogOpen(false);
    if (createdCluster) {
      navigate(`/agents?cluster_id=${createdCluster.id}`);
    } else {
      navigate('/agents');
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 sm:mb-12 gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">Clusters</h1>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">Manage and monitor your infrastructure</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  className="gap-2 font-semibold"
                  disabled={isReadOnly}
                  onClick={(e) => {
                    if (!canCreateCluster(clusters.length)) {
                      e.preventDefault();
                      setLimitModalOpen(true);
                    }
                  }}
                >
                  <Plus className="w-5 h-5" />
                  Connect Cluster
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl bg-card border-2 border-slate-200 dark:border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-2xl">Connect New Cluster</DialogTitle>
                  <DialogDescription className="text-base mt-2">
                    Configure your cluster connection with the required settings below
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-4">
                  {/* Cluster Identification */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4">Cluster Details</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="font-semibold">Cluster Name *</Label>
                        <Input
                          id="name"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. prod-us-east-1"
                          className="h-10"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="environment" className="font-semibold">Environment *</Label>
                          <Select
                            value={formData.environment}
                            onValueChange={(value) => setFormData({ ...formData, environment: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="production">Production</SelectItem>
                              <SelectItem value="staging">Staging</SelectItem>
                              <SelectItem value="development">Development</SelectItem>
                              <SelectItem value="on-premises">On-Premises</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="provider" className="font-semibold">Cloud Provider *</Label>
                          <Select
                            value={formData.provider}
                            onValueChange={(value) => setFormData({ ...formData, provider: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aws">AWS</SelectItem>
                              <SelectItem value="gcp">Google Cloud</SelectItem>
                              <SelectItem value="azure">Microsoft Azure</SelectItem>
                              <SelectItem value="digitalocean">DigitalOcean</SelectItem>
                              <SelectItem value="magalu">Magalu Cloud</SelectItem>
                              <SelectItem value="on-premises">On-Premises</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cluster Type & Configuration */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4">Configuration</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="cluster_type" className="font-semibold">Cluster Type *</Label>
                        <Select
                          value={formData.cluster_type}
                          onValueChange={(value) => {
                            const localTypes = ['microk8s', 'k3s', 'minikube', 'docker'];
                            const isLocal = localTypes.includes(value);
                            setFormData({
                              ...formData,
                              cluster_type: value,
                              is_local: isLocal,
                              connection_type: isLocal ? 'local-direct' : 'cloud'
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kubernetes">Kubernetes (Cloud)</SelectItem>
                            <SelectItem value="microk8s">MicroK8s (Local)</SelectItem>
                            <SelectItem value="k3s">K3s (Local)</SelectItem>
                            <SelectItem value="minikube">Minikube (Local)</SelectItem>
                            <SelectItem value="docker">Docker Desktop</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.is_local && (
                        <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                          <p className="text-sm text-orange-700 dark:text-orange-300">
                            <strong>ℹ️ Local Cluster:</strong> Local clusters cannot be accessed directly from the cloud. After creating the cluster, download and install the agent in the cluster so it can send metrics.
                          </p>
                        </div>
                      )}

                      {(formData.cluster_type === "kubernetes" || formData.cluster_type === "microk8s" || formData.cluster_type === "k3s" || formData.cluster_type === "minikube") ? (
                        <div className="space-y-2">
                          <Label htmlFor="config_file" className="font-semibold">Kubernetes Config File (YAML) *</Label>
                          <Input
                            id="config_file"
                            type="file"
                            accept=".yml,.yaml"
                            onChange={handleFileUpload}
                            required
                            className="h-10"
                          />
                          <p className="text-xs text-muted-foreground">Upload your kubeconfig.yml file for cluster access</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="api_endpoint" className="font-semibold">Docker Endpoint *</Label>
                          <Input
                            id="api_endpoint"
                            required
                            value={formData.api_endpoint}
                            onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                            placeholder="unix:///var/run/docker.sock or tcp://host:2375"
                            className="h-10"
                          />
                          <p className="text-xs text-muted-foreground">Specify your Docker daemon endpoint</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="region" className="font-semibold">Region (Optional)</Label>
                        <Input
                          id="region"
                          value={formData.region}
                          onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                          placeholder="e.g. us-east-1"
                          className="h-10"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Security */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4">Security</h3>
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded accent-primary"
                        checked={formData.skip_ssl_verify}
                        onChange={(e) => setFormData({ ...formData, skip_ssl_verify: e.target.checked })}
                      />
                      <div>
                        <p className="font-medium text-sm">Skip SSL Verification</p>
                        <p className="text-xs text-muted-foreground">Only for self-signed certificates</p>
                      </div>
                    </label>
                  </div>

                  <Button type="submit" className="w-full h-10 font-semibold text-base">
                    Connect Cluster
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Content Section */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-16 h-16 border-3 border-slate-300 dark:border-slate-600 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">Loading clusters...</p>
              </div>
            </div>
          ) : clusters.length === 0 ? (
          <div className="relative isolate">
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl" />
            <div className="text-center py-20 px-4">
              <Server className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <p className="text-muted-foreground mb-6 text-lg font-medium">No clusters connected yet</p>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">Connect your first cluster to start monitoring and managing your infrastructure.</p>
              <Button onClick={() => setOpen(true)} className="gap-2 px-6" size="lg">
                <Plus className="w-5 h-5" />
                Connect Your First Cluster
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <ClusterDeletionProgress deletingClusters={deletingClusters} />

            {/* Clusters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clusters.map((cluster) => (
                <div
                  key={cluster.id}
                  className="group relative cursor-pointer"
                  onClick={() => setSelectedClusterId(cluster.id)}
                >
                  <ClusterCard
                    id={cluster.id}
                    name={cluster.name}
                    status={cluster.status as any}
                    nodes={cluster.nodes}
                    pods={cluster.pods}
                    cpuUsage={Number(cluster.cpu_usage)}
                    memoryUsage={Number(cluster.memory_usage)}
                    environment={`${cluster.provider.toUpperCase()} - ${cluster.environment}`}
                    is_local={cluster.is_local}
                    onRefresh={() => handleRefreshConnection(cluster)}
                  />

                  {/* Action buttons */}
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-9 w-9 backdrop-blur-md bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 border border-white/20 dark:border-slate-700/50"
                      disabled={refreshingCluster === cluster.id || cluster.status === 'connecting'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRefreshConnection(cluster);
                      }}
                      title="Refresh connection"
                    >
                      <RefreshCw className={`w-4 h-4 ${refreshingCluster === cluster.id || cluster.status === 'connecting' ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-9 w-9 backdrop-blur-md bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 border border-white/20 dark:border-slate-700/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditCluster(cluster);
                      }}
                      title="Edit configuration"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-9 w-9 backdrop-blur-md bg-red-50/80 dark:bg-red-950/80 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-800/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClusterToDelete(cluster.id);
                        setClusterToDeleteName(cluster.name);
                        setDeleteConfirmName("");
                        setDeleteDialogOpen(true);
                      }}
                      title="Delete cluster"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Cluster Logs */}
            {selectedClusterId && (
              <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
                <ClusterLogs clusterId={selectedClusterId} />
              </div>
            )}
          </div>
        )}

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl bg-card border-2 border-slate-200 dark:border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-2xl">Edit Cluster Configuration</DialogTitle>
              <DialogDescription className="text-base mt-2">
                Update your cluster connection settings
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateCluster} className="space-y-6 max-h-[70vh] overflow-y-auto pr-4">
              {/* Cluster Details */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4">Cluster Details</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name" className="font-semibold">Cluster Name *</Label>
                    <Input
                      id="edit-name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. prod-us-east-1"
                      className="h-10"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-environment" className="font-semibold">Environment *</Label>
                      <Select
                        value={formData.environment}
                        onValueChange={(value) => setFormData({ ...formData, environment: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="production">Production</SelectItem>
                          <SelectItem value="staging">Staging</SelectItem>
                          <SelectItem value="development">Development</SelectItem>
                          <SelectItem value="on-premises">On-Premises</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-provider" className="font-semibold">Cloud Provider *</Label>
                      <Select
                        value={formData.provider}
                        onValueChange={(value) => setFormData({ ...formData, provider: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aws">AWS</SelectItem>
                          <SelectItem value="gcp">Google Cloud</SelectItem>
                          <SelectItem value="azure">Microsoft Azure</SelectItem>
                          <SelectItem value="digitalocean">DigitalOcean</SelectItem>
                          <SelectItem value="magalu">Magalu Cloud</SelectItem>
                          <SelectItem value="on-premises">On-Premises</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Configuration */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4">Configuration</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-cluster_type" className="font-semibold">Cluster Type *</Label>
                    <Select
                      value={formData.cluster_type}
                      onValueChange={(value) => setFormData({ ...formData, cluster_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kubernetes">Kubernetes</SelectItem>
                        <SelectItem value="docker">Docker</SelectItem>
                        <SelectItem value="docker-swarm">Docker Swarm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.cluster_type === "kubernetes" ? (
                    <div className="space-y-2">
                      <Label htmlFor="edit-config_file" className="font-semibold">Kubernetes Config File (YAML)</Label>
                      <Input
                        id="edit-config_file"
                        type="file"
                        accept=".yml,.yaml"
                        onChange={handleFileUpload}
                        className="h-10"
                      />
                      <p className="text-xs text-muted-foreground">Upload new kubeconfig.yml file (optional)</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="edit-api_endpoint" className="font-semibold">Docker Endpoint *</Label>
                      <Input
                        id="edit-api_endpoint"
                        required
                        value={formData.api_endpoint}
                        onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                        placeholder="unix:///var/run/docker.sock or tcp://host:2375"
                        className="h-10"
                      />
                      <p className="text-xs text-muted-foreground">Specify your Docker daemon endpoint</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="edit-region" className="font-semibold">Region (Optional)</Label>
                    <Input
                      id="edit-region"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      placeholder="e.g. us-east-1"
                      className="h-10"
                    />
                  </div>
                </div>
              </div>

              {/* Security */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4">Security</h3>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    id="edit-skip-ssl"
                    className="w-4 h-4 rounded accent-primary"
                    checked={formData.skip_ssl_verify}
                    onChange={(e) => setFormData({ ...formData, skip_ssl_verify: e.target.checked })}
                  />
                  <div>
                    <p className="font-medium text-sm">Skip SSL Verification</p>
                    <p className="text-xs text-muted-foreground">Only for self-signed certificates</p>
                  </div>
                </label>
              </div>

              <Button type="submit" className="w-full h-10 font-semibold text-base">
                Update Cluster
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
          if (!isDeleting) {
            setDeleteDialogOpen(open);
            if (!open) {
              setDeleteConfirmName("");
            }
          }
        }}>
          <AlertDialogContent className="border-2 border-red-200 dark:border-red-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl text-red-600 dark:text-red-400 flex items-center gap-2">
                ⚠️ Permanent Deletion
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  <p className="text-base">This action is <strong>permanent and irreversible</strong>. The following will be permanently deleted:</p>
                  <ul className="list-disc ml-6 text-sm space-y-2 text-muted-foreground">
                    <li>All monitoring metrics and historical data</li>
                    <li>Cluster events and activity logs</li>
                    <li>Configuration settings and API keys</li>
                    <li>Detected incidents and anomalies</li>
                    <li>Cost calculations and savings</li>
                  </ul>
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg mt-4">
                    <p className="font-semibold text-sm text-red-900 dark:text-red-100 mb-2">To confirm, type the cluster name:</p>
                    <p className="text-sm font-mono bg-red-100 dark:bg-red-900/40 px-3 py-2 rounded text-red-700 dark:text-red-300">
                      {clusterToDeleteName}
                    </p>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <Input
              placeholder="Type cluster name to confirm"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              disabled={isDeleting}
              className="h-10 mt-4"
            />

            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel disabled={isDeleting} className="h-10">
                Cancel
              </AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleDeleteCluster}
                disabled={deleteConfirmName !== clusterToDeleteName || isDeleting}
                className="h-10"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Cluster
                  </>
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <LimitReachedModal 
          open={limitModalOpen} 
          onOpenChange={setLimitModalOpen} 
          limitType="clusters" 
        />

        {/* Success Dialog - Redirect to Agents */}
        <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
          <DialogContent className="bg-card border-2 border-emerald-200 dark:border-emerald-800 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Bot className="w-6 h-6" />
                Cluster Created!
              </DialogTitle>
              <DialogDescription className="pt-4 space-y-4 text-base">
                <p>
                  <strong className="text-foreground text-lg">{createdCluster?.name}</strong> has been created successfully.
                </p>
                <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                  <p className="font-semibold mb-2 text-foreground">Next Step: Install Agent</p>
                  <p className="text-sm text-muted-foreground">
                    To enable Kodo to monitor your cluster, you need to create and install an <strong>Agent</strong> in your Kubernetes cluster. The agent collects metrics and sends them to Kodo in real-time.
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setSuccessDialogOpen(false)}
                className="w-full sm:w-auto h-10"
              >
                Do it later
              </Button>
              <Button
                onClick={handleGoToAgents}
                className="w-full sm:w-auto gap-2 h-10 font-semibold"
              >
                Create Agent
                <ArrowRight className="w-4 h-4" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cluster Analysis Popup */}
        <ClusterAnalysisPopup
          open={analysisPopupOpen}
          onOpenChange={setAnalysisPopupOpen}
          clusterId={analysisCluster?.id || null}
          clusterName={analysisCluster?.name || ""}
        />
      </div>
      </div>
    </DashboardLayout>
  );
};

export default Clusters;
