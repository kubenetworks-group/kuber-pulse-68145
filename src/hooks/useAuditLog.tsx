import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type AuditAction = 
  | 'login'
  | 'logout'
  | 'signup'
  | 'oauth_login'
  | 'password_reset'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'cluster_created'
  | 'cluster_deleted'
  | 'cluster_updated'
  | 'security_scan_requested'
  | 'ai_analysis_requested'
  | 'auto_heal_executed'
  | 'subscription_changed'
  | 'profile_updated'
  | 'settings_changed'
  | 'page_accessed'
  | 'action_failed';

type ResourceType = 
  | 'user'
  | 'cluster'
  | 'api_key'
  | 'subscription'
  | 'security_scan'
  | 'ai_analysis'
  | 'profile'
  | 'settings'
  | 'page'
  | 'system';

interface AuditLogParams {
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
  errorMessage?: string;
  pagePath?: string;
}

export const useAuditLog = () => {
  const { user } = useAuth();

  const logAuditEvent = async ({
    action,
    resourceType,
    resourceId,
    details,
    errorMessage,
    pagePath
  }: AuditLogParams) => {
    if (!user) return;

    try {
      const enrichedDetails = {
        ...details,
        ...(errorMessage && { error_message: errorMessage }),
        ...(pagePath && { page_path: pagePath }),
      };

      const { error } = await supabase.rpc('log_audit_event', {
        p_user_id: user.id,
        p_action: action,
        p_resource_type: resourceType,
        p_resource_id: resourceId || null,
        p_details: Object.keys(enrichedDetails).length > 0 ? JSON.stringify(enrichedDetails) : null,
        p_ip_address: null,
        p_user_agent: navigator.userAgent
      });

      if (error) {
        console.error('Failed to log audit event:', error);
      }
    } catch (err) {
      console.error('Audit log error:', err);
    }
  };

  const logPageAccess = async (pagePath: string, pageName: string) => {
    await logAuditEvent({
      action: 'page_accessed',
      resourceType: 'page',
      details: { page_name: pageName },
      pagePath
    });
  };

  const logError = async (
    action: string,
    resourceType: ResourceType,
    errorMessage: string,
    details?: Record<string, unknown>
  ) => {
    await logAuditEvent({
      action: 'action_failed',
      resourceType,
      errorMessage,
      details: { ...details, original_action: action }
    });
  };

  return { logAuditEvent, logPageAccess, logError };
};

// Standalone function for use outside React components
export const logAuditEvent = async (
  userId: string,
  action: AuditAction,
  resourceType: ResourceType,
  resourceId?: string,
  details?: Record<string, unknown>,
  errorMessage?: string
) => {
  try {
    const enrichedDetails = {
      ...details,
      ...(errorMessage && { error_message: errorMessage }),
    };

    const { error } = await supabase.rpc('log_audit_event', {
      p_user_id: userId,
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId || null,
      p_details: Object.keys(enrichedDetails).length > 0 ? JSON.stringify(enrichedDetails) : null,
      p_ip_address: null,
      p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
    });

    if (error) {
      console.error('Failed to log audit event:', error);
    }
  } catch (err) {
    console.error('Audit log error:', err);
  }
};
