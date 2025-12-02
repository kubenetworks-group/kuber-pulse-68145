-- Add DELETE policies for tables that are missing them

-- cluster_validation_results
CREATE POLICY "Users can delete validation results for their clusters"
ON public.cluster_validation_results
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM clusters
  WHERE clusters.id = cluster_validation_results.cluster_id
  AND clusters.user_id = auth.uid()
));

-- agent_metrics
CREATE POLICY "Users can delete metrics from own clusters"
ON public.agent_metrics
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM clusters
  WHERE clusters.id = agent_metrics.cluster_id
  AND clusters.user_id = auth.uid()
));

-- cost_calculations
CREATE POLICY "Users can delete own cost calculations"
ON public.cost_calculations
FOR DELETE
USING (auth.uid() = user_id);

-- scan_history
CREATE POLICY "Users can delete own scan history"
ON public.scan_history
FOR DELETE
USING (auth.uid() = user_id);

-- ai_cost_savings
CREATE POLICY "Users can delete own cost savings"
ON public.ai_cost_savings
FOR DELETE
USING (auth.uid() = user_id);

-- agent_anomalies
CREATE POLICY "Users can delete own anomalies"
ON public.agent_anomalies
FOR DELETE
USING (auth.uid() = user_id);

-- ai_incidents
CREATE POLICY "Users can delete own incidents"
ON public.ai_incidents
FOR DELETE
USING (auth.uid() = user_id);

-- agent_commands
CREATE POLICY "Users can delete own commands"
ON public.agent_commands
FOR DELETE
USING (auth.uid() = user_id);