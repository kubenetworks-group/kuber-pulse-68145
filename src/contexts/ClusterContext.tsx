import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

interface ClusterContextType {
  selectedClusterId: string | null;
  setSelectedClusterId: (id: string | null) => void;
  clusters: any[];
  loading: boolean;
  refetchClusters: () => void;
}

const ClusterContext = createContext<ClusterContextType | undefined>(undefined);

export const ClusterProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClusters = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clusters')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setClusters(data || []);
      
      // Auto-select first cluster if none selected or if current selection was deleted
      if (data && data.length > 0) {
        if (!selectedClusterId || !data.find(c => c.id === selectedClusterId)) {
          setSelectedClusterId(data[0].id);
        }
      } else {
        setSelectedClusterId(null);
      }
    } catch (error) {
      console.error('Error fetching clusters:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchClusters();
    }
  }, [user]);

  // Subscribe to realtime changes for clusters (including deletes)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('cluster-context-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clusters',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            // Remove deleted cluster from state
            const deletedId = (payload.old as any).id;
            setClusters(prev => prev.filter(c => c.id !== deletedId));
            
            // If deleted cluster was selected, select another one
            if (selectedClusterId === deletedId) {
              setClusters(prev => {
                if (prev.length > 0) {
                  setSelectedClusterId(prev[0].id);
                } else {
                  setSelectedClusterId(null);
                }
                return prev;
              });
            }
          } else if (payload.eventType === 'INSERT') {
            // Add new cluster
            setClusters(prev => [payload.new as any, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            // Update existing cluster
            setClusters(prev => 
              prev.map(c => c.id === (payload.new as any).id ? payload.new : c)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedClusterId]);

  return (
    <ClusterContext.Provider value={{ 
      selectedClusterId, 
      setSelectedClusterId, 
      clusters, 
      loading,
      refetchClusters: fetchClusters 
    }}>
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
