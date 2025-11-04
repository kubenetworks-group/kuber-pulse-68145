-- Create cost_calculations table
CREATE TABLE cost_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  
  -- Calculated costs
  compute_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  storage_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  network_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  -- Calculation metadata
  calculation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Pricing details (JSON breakdown)
  pricing_details JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cost_calculations_cluster ON cost_calculations(cluster_id);
CREATE INDEX idx_cost_calculations_date ON cost_calculations(calculation_date);
CREATE INDEX idx_cost_calculations_user ON cost_calculations(user_id);

-- RLS Policies for cost_calculations
ALTER TABLE cost_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cost calculations"
  ON cost_calculations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own cost calculations"
  ON cost_calculations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create ai_cost_savings table
CREATE TABLE ai_cost_savings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  incident_id UUID NOT NULL REFERENCES ai_incidents(id) ON DELETE CASCADE,
  cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  
  -- Calculated savings
  downtime_avoided_minutes INTEGER NOT NULL DEFAULT 0,
  cost_per_minute NUMERIC(10,4) NOT NULL DEFAULT 0,
  estimated_savings NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  -- Saving type
  saving_type TEXT NOT NULL,
  
  -- Calculation details (JSON)
  calculation_details JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_saving_type CHECK (saving_type IN ('downtime_prevention', 'resource_optimization', 'scale_optimization'))
);

CREATE INDEX idx_ai_cost_savings_incident ON ai_cost_savings(incident_id);
CREATE INDEX idx_ai_cost_savings_cluster ON ai_cost_savings(cluster_id);
CREATE INDEX idx_ai_cost_savings_user ON ai_cost_savings(user_id);

-- RLS Policies for ai_cost_savings
ALTER TABLE ai_cost_savings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cost savings"
  ON ai_cost_savings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own cost savings"
  ON ai_cost_savings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add last_cost_calculation column to clusters
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS last_cost_calculation TIMESTAMPTZ;