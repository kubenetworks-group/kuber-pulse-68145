-- Add indexes for performance optimization on subscriptions and related tables

-- Index on subscriptions.organization_id (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_subscriptions_organization_id 
ON subscriptions(organization_id);

-- Index on subscriptions.user_id (for RLS policies)
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id 
ON subscriptions(user_id);

-- Index on subscriptions.status (for filtering active/trial subscriptions)
CREATE INDEX IF NOT EXISTS idx_subscriptions_status 
ON subscriptions(status);

-- Index on organizations.user_id (for fast user lookup)
CREATE INDEX IF NOT EXISTS idx_organizations_user_id 
ON organizations(user_id);

-- Index on subscription_plans.slug (for plan lookup by slug)
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug 
ON subscription_plans(slug);

-- Index on subscription_plans.is_active (for filtering active plans)
CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active 
ON subscription_plans(is_active);