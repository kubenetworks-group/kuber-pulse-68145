import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
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
import { Plus, Trash2, RefreshCw, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { toast } from "sonner";

const Clusters = () => {
  const { user } = useAuth();
  const { canCreateCluster, isReadOnly } = useSubscription();
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
          setClusters((current) =>
            current.map((cluster) =>
              cluster.id === payload.new.id ? { ...cluster, ...payload.new } : cluster
            )
          );
          
          // Show toast notification for status changes
          const newCluster = payload.new as any;
          if (newCluster.status === 'healthy') {
            toast.success(`${newCluster.name} connected successfully!`);
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
      toast.success("Cluster connection initiated!");
      
      // Create initial log
      await createClusterLog(data.id, "info", "Cluster connection initiated", {
        cluster_type: formData.cluster_type,
        provider: formData.provider,
      });

      // Call edge function to validate the cluster connection
      try {
        console.log('Calling validation for cluster:', data.id, 'type:', formData.cluster_type);
        
        const { data: validationData, error: validationError } = await supabase.functions.invoke('validate-cluster-connection', {
          body: {
            cluster_id: data.id,
            config_file: formData.config_file,
            cluster_type: formData.cluster_type,
            api_endpoint: formData.api_endpoint,
            skip_ssl_verify: formData.skip_ssl_verify,
          },
        });

        console.log('Validation response:', { validationData, validationError });

        if (validationError) {
          console.error('Error calling validation function:', validationError);
          toast.error('Failed to validate cluster connection');
          
          // Update status to error if validation failed
          await supabase
            .from("clusters")
            .update({ status: 'error' })
            .eq("id", data.id);
            
          await createClusterLog(data.id, "error", "Validation function failed", {
            error: validationError.message || validationError
          });
        }
      } catch (validationException) {
        console.error('Exception during validation:', validationException);
        toast.error('Failed to validate cluster connection');
        
        await supabase
          .from("clusters")
          .update({ status: 'error' })
          .eq("id", data.id);
          
        await createClusterLog(data.id, "error", "Validation exception", {
          error: validationException instanceof Error ? validationException.message : String(validationException)
        });
      }

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
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Clusters</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage your infrastructure clusters</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button 
                className="gap-2" 
                disabled={isReadOnly}
                onClick={(e) => {
                  if (!canCreateCluster(clusters.length)) {
                    e.preventDefault();
                    setLimitModalOpen(true);
                  }
                }}
              >
                <Plus className="w-4 h-4" />
                Connect Cluster
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader>
                <DialogTitle>Connect New Cluster</DialogTitle>
                <DialogDescription>
                  Configure your cluster connection settings
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Cluster Name</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="prod-us-east-1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="environment">Environment</Label>
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
                  <Label htmlFor="provider">Cloud Provider</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="cluster_type">Cluster Type</Label>
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
                   <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                     <p className="text-sm text-blue-700 dark:text-blue-300">
                       ℹ️ <strong>Cluster Local:</strong> Clusters locais não podem ser acessados diretamente pela cloud. 
                       Após criar o cluster, você precisará baixar e instalar o agente dentro do cluster para que ele possa enviar métricas.
                     </p>
                   </div>
                 )}

                 {(formData.cluster_type === "kubernetes" || formData.cluster_type === "microk8s" || formData.cluster_type === "k3s" || formData.cluster_type === "minikube") ? (
                  <div className="space-y-2">
                    <Label htmlFor="config_file">Kubernetes Config File (YAML)</Label>
                    <Input
                      id="config_file"
                      type="file"
                      accept=".yml,.yaml"
                      onChange={handleFileUpload}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload your kubeconfig.yml file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="api_endpoint">Docker Endpoint</Label>
                    <Input
                      id="api_endpoint"
                      required
                      value={formData.api_endpoint}
                      onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                      placeholder="unix:///var/run/docker.sock or tcp://host:2375"
                    />
                    <p className="text-xs text-muted-foreground">
                      Specify where your Docker cluster is located
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="region">Region (Optional)</Label>
                  <Input
                    id="region"
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    placeholder="us-east-1"
                  />
                </div>
                
                <div className="flex items-center space-x-2 p-4 border border-muted rounded-md bg-muted/20">
                  <input
                    type="checkbox"
                    id="skip-ssl"
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    checked={formData.skip_ssl_verify}
                    onChange={(e) => setFormData({ ...formData, skip_ssl_verify: e.target.checked })}
                  />
                  <Label htmlFor="skip-ssl" className="text-sm font-medium cursor-pointer">
                    Ignorar verificação SSL (para certificados auto-assinados)
                  </Label>
                </div>
                
                <Button type="submit" className="w-full">
                  Connect Cluster
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading clusters...</p>
          </div>
        ) : clusters.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No clusters connected yet</p>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Connect Your First Cluster
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <ClusterDeletionProgress deletingClusters={deletingClusters} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clusters.map((cluster) => (
                <div key={cluster.id} className="relative group">
                  <div onClick={() => setSelectedClusterId(cluster.id)} className="cursor-pointer">
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
                  </div>
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="secondary"
                      size="icon"
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditCluster(cluster);
                      }}
                      title="Edit configuration"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
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
            
            {selectedClusterId && (
              <ClusterLogs clusterId={selectedClusterId} />
            )}
          </div>
        )}

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>Edit Cluster Configuration</DialogTitle>
              <DialogDescription>
                Update your cluster connection settings
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateCluster} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Cluster Name</Label>
                <Input
                  id="edit-name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="prod-us-east-1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-environment">Environment</Label>
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
                <Label htmlFor="edit-provider">Cloud Provider</Label>
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
              <div className="space-y-2">
                <Label htmlFor="edit-cluster_type">Cluster Type</Label>
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
                  <Label htmlFor="edit-config_file">Kubernetes Config File (YAML)</Label>
                  <Input
                    id="edit-config_file"
                    type="file"
                    accept=".yml,.yaml"
                    onChange={handleFileUpload}
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload new kubeconfig.yml file (leave empty to keep current)
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="edit-api_endpoint">Docker Endpoint</Label>
                  <Input
                    id="edit-api_endpoint"
                    required
                    value={formData.api_endpoint}
                    onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                    placeholder="unix:///var/run/docker.sock or tcp://host:2375"
                  />
                  <p className="text-xs text-muted-foreground">
                    Specify where your Docker cluster is located
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-region">Region (Optional)</Label>
                <Input
                  id="edit-region"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="us-east-1"
                />
              </div>
              
              <div className="flex items-center space-x-2 p-4 border border-muted rounded-md bg-muted/20">
                <input
                  type="checkbox"
                  id="edit-skip-ssl"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  checked={formData.skip_ssl_verify}
                  onChange={(e) => setFormData({ ...formData, skip_ssl_verify: e.target.checked })}
                />
                <Label htmlFor="edit-skip-ssl" className="text-sm font-medium cursor-pointer">
                  Ignorar verificação SSL (para certificados auto-assinados)
                </Label>
              </div>
              
              <Button type="submit" className="w-full">
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
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">
                ⚠️ Confirmar Exclusão Permanente
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>Esta ação é <strong>irreversível</strong>. Todos os dados do cluster serão excluídos permanentemente:</p>
                  <ul className="list-disc ml-4 text-sm space-y-1">
                    <li>Métricas e histórico de monitoramento</li>
                    <li>Eventos e logs do cluster</li>
                    <li>Configurações e chaves de API</li>
                    <li>Incidentes e anomalias detectadas</li>
                    <li>Cálculos de custos e economias</li>
                  </ul>
                  <div className="pt-2">
                    <p className="font-medium">Para confirmar, digite o nome do cluster:</p>
                    <p className="text-sm font-mono bg-muted px-2 py-1 rounded mt-1">
                      {clusterToDeleteName}
                    </p>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <Input
              placeholder="Digite o nome do cluster"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              disabled={isDeleting}
              className="mt-2"
            />
            
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancelar
              </AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleDeleteCluster}
                disabled={deleteConfirmName !== clusterToDeleteName || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir Cluster
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
      </div>
    </DashboardLayout>
  );
};

export default Clusters;
