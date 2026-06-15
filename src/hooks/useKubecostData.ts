import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface KubecostAllocation {
  id: string;
  resource_name: string;
  namespace: string | null;
  deployment: string | null;
  aggregate_type: string;
  cpu_cost: number;
  memory_cost: number;
  pv_cost: number;
  network_cost: number;
  total_cost: number;
  efficiency: number | null;
  window_date: string;
}

export interface KubecostSummary {
  total_cost: number;
  idle_cost: number;
  efficiency: number | null;
}

export interface KubecostData {
  installed: boolean;
  byNamespace: KubecostAllocation[];
  byDeployment: KubecostAllocation[];
  summary: KubecostSummary;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useKubecostData(clusterId: string | null): KubecostData {
  const { user } = useAuth();
  const [installed, setInstalled]       = useState(false);
  const [byNamespace, setByNamespace]   = useState<KubecostAllocation[]>([]);
  const [byDeployment, setByDeployment] = useState<KubecostAllocation[]>([]);
  const [summary, setSummary]           = useState<KubecostSummary>({ total_cost: 0, idle_cost: 0, efficiency: null });
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!clusterId || !user) return;
    setLoading(true);
    setError(null);

    try {
      // Check if KubeCost is installed for this cluster
      const { data: clusterData } = await supabase
        .from("clusters")
        .select("kubecost_installed")
        .eq("id", clusterId)
        .single();

      if (!clusterData?.kubecost_installed) {
        setInstalled(false);
        setLoading(false);
        return;
      }
      setInstalled(true);

      const today = new Date().toISOString().slice(0, 10);

      // Fetch namespace allocations
      const { data: nsData, error: nsErr } = await supabase
        .from("kubecost_allocations")
        .select("*")
        .eq("cluster_id", clusterId)
        .eq("aggregate_type", "namespace")
        .eq("window_date", today)
        .order("total_cost", { ascending: false });

      if (nsErr) throw nsErr;
      setByNamespace(nsData || []);

      // Fetch deployment allocations
      const { data: depData, error: depErr } = await supabase
        .from("kubecost_allocations")
        .select("*")
        .eq("cluster_id", clusterId)
        .eq("aggregate_type", "deployment")
        .eq("window_date", today)
        .order("total_cost", { ascending: false });

      if (depErr) throw depErr;
      setByDeployment(depData || []);

      // Fetch summary
      const { data: sumData } = await supabase
        .from("kubecost_allocations")
        .select("total_cost, efficiency")
        .eq("cluster_id", clusterId)
        .eq("aggregate_type", "summary")
        .eq("window_date", today)
        .single();

      if (sumData) {
        const idle = (nsData || [])
          .filter(n => n.resource_name === "__idle__" || n.resource_name === "kube-system")
          .reduce((acc, n) => acc + (n.total_cost || 0), 0);
        setSummary({
          total_cost: sumData.total_cost || 0,
          idle_cost: idle,
          efficiency: sumData.efficiency,
        });
      }
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados do KubeCost");
    } finally {
      setLoading(false);
    }
  }, [clusterId, user]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { installed, byNamespace, byDeployment, summary, loading, error, refetch: fetch };
}
