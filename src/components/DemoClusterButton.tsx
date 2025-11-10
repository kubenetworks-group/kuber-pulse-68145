import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TestTube } from "lucide-react";
import { useState } from "react";

export const DemoClusterButton = ({ onSuccess }: { onSuccess?: (cluster: any, validation: any) => void }) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCreateDemoCluster = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-demo-cluster');

      if (error) throw error;

      toast({
        title: "Cluster de teste criado!",
        description: data.message,
      });

      // Fetch validation result
      const { data: validation } = await supabase
        .from('cluster_validation_results')
        .select('*')
        .eq('cluster_id', data.cluster.id)
        .single();

      if (onSuccess) {
        onSuccess(data.cluster, validation);
      }
    } catch (error: any) {
      console.error('Error creating demo cluster:', error);
      toast({
        title: "Erro ao criar cluster de teste",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleCreateDemoCluster}
      disabled={loading}
      className="w-full"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Criando cluster de teste...
        </>
      ) : (
        <>
          <TestTube className="mr-2 h-4 w-4" />
          Criar Cluster de Teste
        </>
      )}
    </Button>
  );
};
