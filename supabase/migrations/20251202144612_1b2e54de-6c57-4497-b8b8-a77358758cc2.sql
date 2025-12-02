-- Create function to delete all cluster data efficiently using direct SQL
CREATE OR REPLACE FUNCTION public.delete_cluster_data(p_cluster_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER := 0;
  batch_count INTEGER;
BEGIN
  -- Delete agent_metrics in batches of 10000 (much faster than API)
  LOOP
    DELETE FROM agent_metrics 
    WHERE id IN (
      SELECT id FROM agent_metrics 
      WHERE cluster_id = p_cluster_id 
      LIMIT 10000
    );
    GET DIAGNOSTICS batch_count = ROW_COUNT;
    deleted_count := deleted_count + batch_count;
    EXIT WHEN batch_count = 0;
  END LOOP;
  
  -- Delete other related tables (instant)
  DELETE FROM cluster_events WHERE cluster_id = p_cluster_id;
  DELETE FROM cluster_validation_results WHERE cluster_id = p_cluster_id;
  DELETE FROM agent_api_keys WHERE cluster_id = p_cluster_id;
  DELETE FROM agent_anomalies WHERE cluster_id = p_cluster_id;
  DELETE FROM agent_commands WHERE cluster_id = p_cluster_id;
  DELETE FROM ai_incidents WHERE cluster_id = p_cluster_id;
  DELETE FROM ai_cost_savings WHERE cluster_id = p_cluster_id;
  DELETE FROM cost_calculations WHERE cluster_id = p_cluster_id;
  DELETE FROM persistent_volumes WHERE cluster_id = p_cluster_id;
  DELETE FROM pvcs WHERE cluster_id = p_cluster_id;
  DELETE FROM scan_history WHERE cluster_id = p_cluster_id;
  
  -- Finally delete the cluster
  DELETE FROM clusters WHERE id = p_cluster_id;
  
  RETURN deleted_count;
END;
$$;