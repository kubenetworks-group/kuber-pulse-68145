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
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Clusters = () => {
  const { user } = useAuth();
  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clusterToDelete, setClusterToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    environment: "production",
    provider: "aws",
    cluster_type: "kubernetes",
    api_endpoint: "",
    region: "",
    config_file: "",
  });

  useEffect(() => {
    fetchClusters();
  }, [user]);

  const fetchClusters = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("clusters")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load clusters");
      console.error(error);
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

  const handleDeleteCluster = async () => {
    if (!clusterToDelete) return;

    const { error } = await supabase
      .from("clusters")
      .delete()
      .eq("id", clusterToDelete);

    if (error) {
      toast.error("Failed to delete cluster");
      console.error(error);
    } else {
      toast.success("Cluster deleted successfully!");
      setClusters(clusters.filter((c) => c.id !== clusterToDelete));
      if (selectedClusterId === clusterToDelete) {
        setSelectedClusterId(null);
      }
    }

    setDeleteDialogOpen(false);
    setClusterToDelete(null);
  };

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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-cluster-connection`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cluster_id: data.id,
            config_file: formData.config_file,
            cluster_type: formData.cluster_type,
            api_endpoint: formData.api_endpoint,
          }),
        }).catch(err => {
          console.error('Error calling validation function:', err);
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
      });
      fetchClusters();
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Clusters</h1>
            <p className="text-muted-foreground mt-1">Manage your infrastructure clusters</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
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
                      <SelectItem value="on-premises">On-Premises</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cluster_type">Cluster Type</Label>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clusters.map((cluster) => (
                <div key={cluster.id} className="relative group">
                  <div onClick={() => setSelectedClusterId(cluster.id)} className="cursor-pointer">
                    <ClusterCard
                      name={cluster.name}
                      status={cluster.status as any}
                      nodes={cluster.nodes}
                      pods={cluster.pods}
                      cpuUsage={Number(cluster.cpu_usage)}
                      memoryUsage={Number(cluster.memory_usage)}
                      environment={`${cluster.provider.toUpperCase()} - ${cluster.environment}`}
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setClusterToDelete(cluster.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            
            {selectedClusterId && (
              <ClusterLogs clusterId={selectedClusterId} />
            )}
          </div>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Cluster</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this cluster? This action cannot be undone and will remove all associated data and logs.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteCluster} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default Clusters;
