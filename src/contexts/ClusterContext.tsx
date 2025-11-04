import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

interface ClusterContextType {
  selectedClusterId: string | null;
  setSelectedClusterId: (id: string | null) => void;
  clusters: any[];
  loading: boolean;
}

const ClusterContext = createContext<ClusterContextType | undefined>(undefined);

export const ClusterProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchClusters();
    }
  }, [user]);

  const fetchClusters = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clusters')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setClusters(data || []);
      
      // Auto-select first cluster if none selected
      if (data && data.length > 0 && !selectedClusterId) {
        setSelectedClusterId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching clusters:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ClusterContext.Provider value={{ selectedClusterId, setSelectedClusterId, clusters, loading }}>
      {children}
    </ClusterContext.Provider>
  );
};

export const useCluster = () => {
  const context = useContext(ClusterContext);
  if (!context) {
    throw new Error("useCluster must be used within ClusterProvider");
  }
  return context;
};
