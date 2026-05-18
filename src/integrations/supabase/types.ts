export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_cluster_alerts: {
        Row: {
          action_params: Json | null
          action_type: string | null
          alert_type: string
          cluster_id: string
          created_at: string | null
          created_by: string
          dismissed: boolean | null
          dismissed_at: string | null
          expires_at: string | null
          id: string
          message: string
          title: string
          user_id: string
        }
        Insert: {
          action_params?: Json | null
          action_type?: string | null
          alert_type?: string
          cluster_id: string
          created_at?: string | null
          created_by: string
          dismissed?: boolean | null
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          message: string
          title: string
          user_id: string
        }
        Update: {
          action_params?: Json | null
          action_type?: string | null
          alert_type?: string
          cluster_id?: string
          created_at?: string | null
          created_by?: string
          dismissed?: boolean | null
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          message?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_cluster_alerts_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_anomalies: {
        Row: {
          ai_analysis: Json
          anomaly_type: string
          auto_heal_applied: boolean | null
          cluster_id: string
          created_at: string
          description: string
          id: string
          recommendation: string | null
          resolved: boolean | null
          resolved_at: string | null
          severity: string
          user_id: string
        }
        Insert: {
          ai_analysis: Json
          anomaly_type: string
          auto_heal_applied?: boolean | null
          cluster_id: string
          created_at?: string
          description: string
          id?: string
          recommendation?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity: string
          user_id: string
        }
        Update: {
          ai_analysis?: Json
          anomaly_type?: string
          auto_heal_applied?: boolean | null
          cluster_id?: string
          created_at?: string
          description?: string
          id?: string
          recommendation?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_anomalies_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_api_keys: {
        Row: {
          api_key: string
          api_key_hash: string | null
          api_key_prefix: string | null
          cluster_id: string
          created_at: string
          id: string
          is_active: boolean
          last_seen: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          api_key_hash?: string | null
          api_key_prefix?: string | null
          cluster_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          api_key_hash?: string | null
          api_key_prefix?: string | null
          cluster_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_api_keys_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_commands: {
        Row: {
          cluster_id: string
          command_params: Json
          command_type: string
          completed_at: string | null
          created_at: string
          executed_at: string | null
          id: string
          max_retries: number | null
          next_retry_at: string | null
          result: Json | null
          retry_count: number | null
          status: string
          user_id: string
        }
        Insert: {
          cluster_id: string
          command_params: Json
          command_type: string
          completed_at?: string | null
          created_at?: string
          executed_at?: string | null
          id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          result?: Json | null
          retry_count?: number | null
          status?: string
          user_id: string
        }
        Update: {
          cluster_id?: string
          command_params?: Json
          command_type?: string
          completed_at?: string | null
          created_at?: string
          executed_at?: string | null
          id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          result?: Json | null
          retry_count?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_commands_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_metrics: {
        Row: {
          cluster_id: string
          collected_at: string
          created_at: string
          id: string
          metric_data: Json
          metric_type: string
        }
        Insert: {
          cluster_id: string
          collected_at: string
          created_at?: string
          id?: string
          metric_data: Json
          metric_type: string
        }
        Update: {
          cluster_id?: string
          collected_at?: string
          created_at?: string
          id?: string
          metric_data?: Json
          metric_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_metrics_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_versions: {
        Row: {
          created_at: string
          id: string
          is_latest: boolean | null
          is_required: boolean | null
          min_compatible_version: string | null
          release_notes: string | null
          release_type: string | null
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_latest?: boolean | null
          is_required?: boolean | null
          min_compatible_version?: string | null
          release_notes?: string | null
          release_type?: string | null
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          is_latest?: boolean | null
          is_required?: boolean | null
          min_compatible_version?: string | null
          release_notes?: string | null
          release_type?: string | null
          version?: string
        }
        Relationships: []
      }
      ai_cost_savings: {
        Row: {
          calculation_details: Json | null
          cluster_id: string
          cost_per_minute: number
          created_at: string | null
          downtime_avoided_minutes: number
          estimated_savings: number
          id: string
          incident_id: string
          is_demo: boolean | null
          saving_type: string
          user_id: string
        }
        Insert: {
          calculation_details?: Json | null
          cluster_id: string
          cost_per_minute?: number
          created_at?: string | null
          downtime_avoided_minutes?: number
          estimated_savings?: number
          id?: string
          incident_id: string
          is_demo?: boolean | null
          saving_type: string
          user_id: string
        }
        Update: {
          calculation_details?: Json | null
          cluster_id?: string
          cost_per_minute?: number
          created_at?: string | null
          downtime_avoided_minutes?: number
          estimated_savings?: number
          id?: string
          incident_id?: string
          is_demo?: boolean | null
          saving_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_cost_savings_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_cost_savings_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "ai_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_incidents: {
        Row: {
          action_result: Json | null
          action_taken: boolean | null
          ai_analysis: Json
          auto_heal_action: string | null
          cluster_id: string
          created_at: string | null
          description: string
          id: string
          incident_type: string
          is_demo: boolean | null
          resolved_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          action_result?: Json | null
          action_taken?: boolean | null
          ai_analysis: Json
          auto_heal_action?: string | null
          cluster_id: string
          created_at?: string | null
          description: string
          id?: string
          incident_type: string
          is_demo?: boolean | null
          resolved_at?: string | null
          severity: string
          title: string
          user_id: string
        }
        Update: {
          action_result?: Json | null
          action_taken?: boolean | null
          ai_analysis?: Json
          auto_heal_action?: string | null
          cluster_id?: string
          created_at?: string | null
          description?: string
          id?: string
          incident_type?: string
          is_demo?: boolean | null
          resolved_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_incidents_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_incidents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          estimated_cost_usd: number | null
          function_name: string
          id: string
          input_tokens: number
          is_free_tier: boolean
          model: string
          output_tokens: number
          provider: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_cost_usd?: number | null
          function_name: string
          id?: string
          input_tokens?: number
          is_free_tier?: boolean
          model: string
          output_tokens?: number
          provider: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_cost_usd?: number | null
          function_name?: string
          id?: string
          input_tokens?: number
          is_free_tier?: boolean
          model?: string
          output_tokens?: number
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      alert_instances: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          alert_rule_id: string | null
          cluster_id: string
          created_at: string
          id: string
          message: string
          metric_value: number | null
          resolved_at: string | null
          severity: string
          source: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          alert_rule_id?: string | null
          cluster_id: string
          created_at?: string
          id?: string
          message: string
          metric_value?: number | null
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          alert_rule_id?: string | null
          cluster_id?: string
          created_at?: string
          id?: string
          message?: string
          metric_value?: number | null
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_instances_alert_rule_id_fkey"
            columns: ["alert_rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_instances_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          cluster_id: string
          condition: string
          cooldown_minutes: number
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          metric_type: string
          name: string
          severity: string
          target_name: string | null
          target_namespace: string | null
          target_type: string
          threshold: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cluster_id: string
          condition?: string
          cooldown_minutes?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          metric_type?: string
          name: string
          severity?: string
          target_name?: string | null
          target_namespace?: string | null
          target_type?: string
          threshold?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cluster_id?: string
          condition?: string
          cooldown_minutes?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          metric_type?: string
          name?: string
          severity?: string
          target_name?: string | null
          target_namespace?: string | null
          target_type?: string
          threshold?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      auto_heal_actions_log: {
        Row: {
          action_details: Json
          action_type: string
          cluster_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          result: Json | null
          started_at: string | null
          status: string
          trigger_entity_id: string | null
          trigger_entity_type: string | null
          trigger_reason: string
          user_id: string
        }
        Insert: {
          action_details?: Json
          action_type: string
          cluster_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_entity_id?: string | null
          trigger_entity_type?: string | null
          trigger_reason: string
          user_id: string
        }
        Update: {
          action_details?: Json
          action_type?: string
          cluster_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_entity_id?: string | null
          trigger_entity_type?: string | null
          trigger_reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_heal_actions_log_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_heal_settings: {
        Row: {
          approval_timeout_minutes: number | null
          auto_apply_anomalies: boolean
          auto_apply_security: boolean
          cluster_id: string
          created_at: string
          enabled: boolean
          id: string
          require_whatsapp_approval: boolean | null
          scan_interval_minutes: number
          severity_threshold: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_timeout_minutes?: number | null
          auto_apply_anomalies?: boolean
          auto_apply_security?: boolean
          cluster_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          require_whatsapp_approval?: boolean | null
          scan_interval_minutes?: number
          severity_threshold?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_timeout_minutes?: number | null
          auto_apply_anomalies?: boolean
          auto_apply_security?: boolean
          cluster_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          require_whatsapp_approval?: boolean | null
          scan_interval_minutes?: number
          severity_threshold?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_heal_settings_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: true
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      cluster_events: {
        Row: {
          cluster_id: string
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          cluster_id: string
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          cluster_id?: string
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cluster_events_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      cluster_migrations: {
        Row: {
          ai_analysis: Json | null
          compatibility_score: number | null
          completed_at: string | null
          created_at: string
          current_step: string | null
          description: string | null
          error_message: string | null
          id: string
          issues_auto_fixed: number | null
          issues_found: number | null
          name: string
          original_manifest_path: string | null
          progress_percent: number | null
          rollback_available: boolean | null
          snapshot_id: string | null
          source_cluster_id: string
          started_at: string | null
          status: string
          steps_log: Json | null
          target_cluster_id: string
          transformation_log: Json | null
          transformed_manifest_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          compatibility_score?: number | null
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          issues_auto_fixed?: number | null
          issues_found?: number | null
          name: string
          original_manifest_path?: string | null
          progress_percent?: number | null
          rollback_available?: boolean | null
          snapshot_id?: string | null
          source_cluster_id: string
          started_at?: string | null
          status?: string
          steps_log?: Json | null
          target_cluster_id: string
          transformation_log?: Json | null
          transformed_manifest_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          compatibility_score?: number | null
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          issues_auto_fixed?: number | null
          issues_found?: number | null
          name?: string
          original_manifest_path?: string | null
          progress_percent?: number | null
          rollback_available?: boolean | null
          snapshot_id?: string | null
          source_cluster_id?: string
          started_at?: string | null
          status?: string
          steps_log?: Json | null
          target_cluster_id?: string
          transformation_log?: Json | null
          transformed_manifest_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cluster_migrations_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "cluster_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cluster_migrations_source_cluster_id_fkey"
            columns: ["source_cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cluster_migrations_target_cluster_id_fkey"
            columns: ["target_cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      cluster_security_scans: {
        Row: {
          ai_analysis: Json | null
          cluster_id: string
          created_at: string
          has_network_policies: boolean | null
          has_pod_security: boolean | null
          has_rbac: boolean | null
          has_resource_limits: boolean | null
          has_secrets_encryption: boolean | null
          id: string
          network_policy_details: Json | null
          pod_security_details: Json | null
          rbac_details: Json | null
          recommendations: string[] | null
          resource_limits_details: Json | null
          scan_date: string
          secrets_details: Json | null
          security_score: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          cluster_id: string
          created_at?: string
          has_network_policies?: boolean | null
          has_pod_security?: boolean | null
          has_rbac?: boolean | null
          has_resource_limits?: boolean | null
          has_secrets_encryption?: boolean | null
          id?: string
          network_policy_details?: Json | null
          pod_security_details?: Json | null
          rbac_details?: Json | null
          recommendations?: string[] | null
          resource_limits_details?: Json | null
          scan_date?: string
          secrets_details?: Json | null
          security_score?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          cluster_id?: string
          created_at?: string
          has_network_policies?: boolean | null
          has_pod_security?: boolean | null
          has_rbac?: boolean | null
          has_resource_limits?: boolean | null
          has_secrets_encryption?: boolean | null
          id?: string
          network_policy_details?: Json | null
          pod_security_details?: Json | null
          rbac_details?: Json | null
          recommendations?: string[] | null
          resource_limits_details?: Json | null
          scan_date?: string
          secrets_details?: Json | null
          security_score?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cluster_security_scans_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      cluster_snapshots: {
        Row: {
          cluster_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          error_message: string | null
          id: string
          manifest_count: number | null
          name: string
          namespace_count: number | null
          resource_summary: Json | null
          started_at: string | null
          status: string
          storage_path: string | null
          storage_size_bytes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cluster_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          error_message?: string | null
          id?: string
          manifest_count?: number | null
          name: string
          namespace_count?: number | null
          resource_summary?: Json | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          storage_size_bytes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cluster_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          error_message?: string | null
          id?: string
          manifest_count?: number | null
          name?: string
          namespace_count?: number | null
          resource_summary?: Json | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          storage_size_bytes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cluster_snapshots_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      cluster_validation_results: {
        Row: {
          available_features: Json | null
          cluster_id: string
          created_at: string
          has_ingress: boolean
          has_monitoring: boolean
          has_storage: boolean
          id: string
          recommendations: string | null
          validation_status: string
        }
        Insert: {
          available_features?: Json | null
          cluster_id: string
          created_at?: string
          has_ingress?: boolean
          has_monitoring?: boolean
          has_storage?: boolean
          id?: string
          recommendations?: string | null
          validation_status?: string
        }
        Update: {
          available_features?: Json | null
          cluster_id?: string
          created_at?: string
          has_ingress?: boolean
          has_monitoring?: boolean
          has_storage?: boolean
          id?: string
          recommendations?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cluster_validation_results_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      clusters: {
        Row: {
          agent_last_seen_at: string | null
          agent_update_available: boolean | null
          agent_update_message: string | null
          agent_version: string | null
          api_endpoint: string
          cluster_type: string
          config_file: string | null
          connection_type: string | null
          cpu_usage: number | null
          created_at: string | null
          environment: string
          id: string
          is_demo: boolean | null
          is_local: boolean | null
          last_cost_calculation: string | null
          last_sync: string | null
          local_connection_instructions: Json | null
          memory_usage: number | null
          monthly_cost: number | null
          name: string
          nodes: number | null
          pods: number | null
          provider: string
          region: string | null
          skip_ssl_verify: boolean | null
          status: string
          storage_available_gb: number | null
          storage_total_gb: number | null
          storage_used_gb: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agent_last_seen_at?: string | null
          agent_update_available?: boolean | null
          agent_update_message?: string | null
          agent_version?: string | null
          api_endpoint: string
          cluster_type: string
          config_file?: string | null
          connection_type?: string | null
          cpu_usage?: number | null
          created_at?: string | null
          environment: string
          id?: string
          is_demo?: boolean | null
          is_local?: boolean | null
          last_cost_calculation?: string | null
          last_sync?: string | null
          local_connection_instructions?: Json | null
          memory_usage?: number | null
          monthly_cost?: number | null
          name: string
          nodes?: number | null
          pods?: number | null
          provider: string
          region?: string | null
          skip_ssl_verify?: boolean | null
          status?: string
          storage_available_gb?: number | null
          storage_total_gb?: number | null
          storage_used_gb?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agent_last_seen_at?: string | null
          agent_update_available?: boolean | null
          agent_update_message?: string | null
          agent_version?: string | null
          api_endpoint?: string
          cluster_type?: string
          config_file?: string | null
          connection_type?: string | null
          cpu_usage?: number | null
          created_at?: string | null
          environment?: string
          id?: string
          is_demo?: boolean | null
          is_local?: boolean | null
          last_cost_calculation?: string | null
          last_sync?: string | null
          local_connection_instructions?: Json | null
          memory_usage?: number | null
          monthly_cost?: number | null
          name?: string
          nodes?: number | null
          pods?: number | null
          provider?: string
          region?: string | null
          skip_ssl_verify?: boolean | null
          status?: string
          storage_available_gb?: number | null
          storage_total_gb?: number | null
          storage_used_gb?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cost_calculations: {
        Row: {
          calculation_date: string
          cluster_id: string
          compute_cost: number
          created_at: string | null
          id: string
          is_demo: boolean | null
          network_cost: number
          period_end: string
          period_start: string
          pricing_details: Json | null
          storage_cost: number
          total_cost: number
          user_id: string
        }
        Insert: {
          calculation_date?: string
          cluster_id: string
          compute_cost?: number
          created_at?: string | null
          id?: string
          is_demo?: boolean | null
          network_cost?: number
          period_end: string
          period_start: string
          pricing_details?: Json | null
          storage_cost?: number
          total_cost?: number
          user_id: string
        }
        Update: {
          calculation_date?: string
          cluster_id?: string
          compute_cost?: number
          created_at?: string | null
          id?: string
          is_demo?: boolean | null
          network_cost?: number
          period_end?: string
          period_start?: string
          pricing_details?: Json | null
          storage_cost?: number
          total_cost?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_calculations_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      documentation: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_public: boolean | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          id?: string
          is_public?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_public?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_yamls: {
        Row: {
          cluster_id: string
          components: string[] | null
          created_at: string
          explanation: string | null
          generated_yaml: string
          id: string
          user_description: string
          user_id: string
        }
        Insert: {
          cluster_id: string
          components?: string[] | null
          created_at?: string
          explanation?: string | null
          generated_yaml: string
          id?: string
          user_description: string
          user_id: string
        }
        Update: {
          cluster_id?: string
          components?: string[] | null
          created_at?: string
          explanation?: string | null
          generated_yaml?: string
          id?: string
          user_description?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          ab_variant: string | null
          cluster_size: string | null
          company: string | null
          created_at: string
          email: string
          id: string
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          vertical: string | null
        }
        Insert: {
          ab_variant?: string | null
          cluster_size?: string | null
          company?: string | null
          created_at?: string
          email: string
          id?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          vertical?: string | null
        }
        Update: {
          ab_variant?: string | null
          cluster_size?: string | null
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          vertical?: string | null
        }
        Relationships: []
      }
      loadbalancer_services: {
        Row: {
          cluster_id: string
          created_at: string
          external_ip: string
          first_seen_at: string
          has_network_policy: boolean | null
          id: string
          last_seen_at: string
          last_suspicious_at: string | null
          namespace: string
          ports: Json | null
          service_name: string
          suspicious_requests: number | null
          total_requests: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cluster_id: string
          created_at?: string
          external_ip: string
          first_seen_at?: string
          has_network_policy?: boolean | null
          id?: string
          last_seen_at?: string
          last_suspicious_at?: string | null
          namespace: string
          ports?: Json | null
          service_name: string
          suspicious_requests?: number | null
          total_requests?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cluster_id?: string
          created_at?: string
          external_ip?: string
          first_seen_at?: string
          has_network_policy?: boolean | null
          id?: string
          last_seen_at?: string
          last_suspicious_at?: string | null
          namespace?: string
          ports?: Json | null
          service_name?: string
          suspicious_requests?: number | null
          total_requests?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loadbalancer_services_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      loadbalancer_traffic_logs: {
        Row: {
          cluster_id: string
          created_at: string
          external_ip: string
          id: string
          is_suspicious: boolean | null
          namespace: string
          request_method: string | null
          request_path: string | null
          request_timestamp: string
          service_name: string
          source_ip: string | null
          status_code: number | null
          threat_level: string | null
          threat_reason: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          cluster_id: string
          created_at?: string
          external_ip: string
          id?: string
          is_suspicious?: boolean | null
          namespace: string
          request_method?: string | null
          request_path?: string | null
          request_timestamp?: string
          service_name: string
          source_ip?: string | null
          status_code?: number | null
          threat_level?: string | null
          threat_reason?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          cluster_id?: string
          created_at?: string
          external_ip?: string
          id?: string
          is_suspicious?: boolean | null
          namespace?: string
          request_method?: string | null
          request_path?: string | null
          request_timestamp?: string
          service_name?: string
          source_ip?: string | null
          status_code?: number | null
          threat_level?: string | null
          threat_reason?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loadbalancer_traffic_logs_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_backup_codes: {
        Row: {
          code_hash: string
          code_prefix: string
          created_at: string
          id: string
          used: boolean
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          code_prefix: string
          created_at?: string
          id?: string
          used?: boolean
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          code_prefix?: string
          created_at?: string
          id?: string
          used?: boolean
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      migration_validations: {
        Row: {
          actual: Json | null
          created_at: string
          detail: string | null
          error_message: string | null
          expected: Json | null
          id: string
          migration_id: string
          namespace: string | null
          ran_at: string | null
          resource_name: string | null
          status: string
          user_id: string
          validation_type: string
        }
        Insert: {
          actual?: Json | null
          created_at?: string
          detail?: string | null
          error_message?: string | null
          expected?: Json | null
          id?: string
          migration_id: string
          namespace?: string | null
          ran_at?: string | null
          resource_name?: string | null
          status?: string
          user_id: string
          validation_type: string
        }
        Update: {
          actual?: Json | null
          created_at?: string
          detail?: string | null
          error_message?: string | null
          expected?: Json | null
          id?: string
          migration_id?: string
          namespace?: string | null
          ran_at?: string | null
          resource_name?: string | null
          status?: string
          user_id?: string
          validation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "migration_validations_migration_id_fkey"
            columns: ["migration_id"]
            isOneToOne: false
            referencedRelation: "cluster_migrations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          auto_heals_applied: number | null
          company_name: string
          created_at: string
          id: string
          total_incidents: number | null
          total_savings: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_heals_applied?: number | null
          company_name: string
          created_at?: string
          id?: string
          total_incidents?: number | null
          total_savings?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_heals_applied?: number | null
          company_name?: string
          created_at?: string
          id?: string
          total_incidents?: number | null
          total_savings?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      persistent_volumes: {
        Row: {
          access_modes: string[] | null
          capacity_bytes: number
          claim_ref_name: string | null
          claim_ref_namespace: string | null
          cluster_id: string
          created_at: string | null
          id: string
          last_sync: string | null
          name: string
          reclaim_policy: string | null
          status: string
          storage_class: string | null
          user_id: string
          volume_mode: string | null
        }
        Insert: {
          access_modes?: string[] | null
          capacity_bytes?: number
          claim_ref_name?: string | null
          claim_ref_namespace?: string | null
          cluster_id: string
          created_at?: string | null
          id?: string
          last_sync?: string | null
          name: string
          reclaim_policy?: string | null
          status: string
          storage_class?: string | null
          user_id: string
          volume_mode?: string | null
        }
        Update: {
          access_modes?: string[] | null
          capacity_bytes?: number
          claim_ref_name?: string | null
          claim_ref_namespace?: string | null
          cluster_id?: string
          created_at?: string | null
          id?: string
          last_sync?: string | null
          name?: string
          reclaim_policy?: string | null
          status?: string
          storage_class?: string | null
          user_id?: string
          volume_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "persistent_volumes_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_restart_audit: {
        Row: {
          analysis_summary: string | null
          cluster_id: string
          command_id: string | null
          container_logs: string | null
          container_logs_tail: number | null
          container_name: string | null
          created_at: string
          episode_key: string | null
          exit_code: number | null
          id: string
          namespace: string
          pod_name: string
          previous_state: Json | null
          restart_count: number | null
          restart_reason: string
          source: string | null
          terminated_at: string | null
          user_id: string
        }
        Insert: {
          analysis_summary?: string | null
          cluster_id: string
          command_id?: string | null
          container_logs?: string | null
          container_logs_tail?: number | null
          container_name?: string | null
          created_at?: string
          episode_key?: string | null
          exit_code?: number | null
          id?: string
          namespace: string
          pod_name: string
          previous_state?: Json | null
          restart_count?: number | null
          restart_reason: string
          source?: string | null
          terminated_at?: string | null
          user_id: string
        }
        Update: {
          analysis_summary?: string | null
          cluster_id?: string
          command_id?: string | null
          container_logs?: string | null
          container_logs_tail?: number | null
          container_name?: string | null
          created_at?: string
          episode_key?: string | null
          exit_code?: number | null
          id?: string
          namespace?: string
          pod_name?: string
          previous_state?: Json | null
          restart_count?: number | null
          restart_reason?: string
          source?: string | null
          terminated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pod_restart_daily_reports: {
        Row: {
          ai_analysis: string | null
          cluster_id: string
          created_at: string
          id: string
          namespaces_affected: string[] | null
          pods_affected: number | null
          pods_summary: Json | null
          report_date: string
          top_restart_reasons: Json | null
          total_restarts: number | null
          user_id: string
        }
        Insert: {
          ai_analysis?: string | null
          cluster_id: string
          created_at?: string
          id?: string
          namespaces_affected?: string[] | null
          pods_affected?: number | null
          pods_summary?: Json | null
          report_date?: string
          top_restart_reasons?: Json | null
          total_restarts?: number | null
          user_id: string
        }
        Update: {
          ai_analysis?: string | null
          cluster_id?: string
          created_at?: string
          id?: string
          namespaces_affected?: string[] | null
          pods_affected?: number | null
          pods_summary?: Json | null
          report_date?: string
          top_restart_reasons?: Json | null
          total_restarts?: number | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          username: string | null
          whatsapp_notifications_enabled: boolean | null
          whatsapp_phone: string | null
          whatsapp_verification_code: string | null
          whatsapp_verification_expires_at: string | null
          whatsapp_verified: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
          whatsapp_notifications_enabled?: boolean | null
          whatsapp_phone?: string | null
          whatsapp_verification_code?: string | null
          whatsapp_verification_expires_at?: string | null
          whatsapp_verified?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
          whatsapp_notifications_enabled?: boolean | null
          whatsapp_phone?: string | null
          whatsapp_verification_code?: string | null
          whatsapp_verification_expires_at?: string | null
          whatsapp_verified?: boolean | null
        }
        Relationships: []
      }
      pvc_usage_history: {
        Row: {
          cluster_id: string
          created_at: string
          id: string
          pvc_id: string
          recorded_at: string
          requested_bytes: number
          usage_percentage: number
          used_bytes: number
          user_id: string
        }
        Insert: {
          cluster_id: string
          created_at?: string
          id?: string
          pvc_id: string
          recorded_at?: string
          requested_bytes?: number
          usage_percentage?: number
          used_bytes?: number
          user_id: string
        }
        Update: {
          cluster_id?: string
          created_at?: string
          id?: string
          pvc_id?: string
          recorded_at?: string
          requested_bytes?: number
          usage_percentage?: number
          used_bytes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pvc_usage_history_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvc_usage_history_pvc_id_fkey"
            columns: ["pvc_id"]
            isOneToOne: false
            referencedRelation: "pvcs"
            referencedColumns: ["id"]
          },
        ]
      }
      pvcs: {
        Row: {
          cluster_id: string
          created_at: string | null
          id: string
          is_demo: boolean | null
          last_sync: string | null
          name: string
          namespace: string
          requested_bytes: number
          status: string
          storage_class: string | null
          updated_at: string | null
          used_bytes: number
          user_id: string
        }
        Insert: {
          cluster_id: string
          created_at?: string | null
          id?: string
          is_demo?: boolean | null
          last_sync?: string | null
          name: string
          namespace: string
          requested_bytes?: number
          status?: string
          storage_class?: string | null
          updated_at?: string | null
          used_bytes?: number
          user_id: string
        }
        Update: {
          cluster_id?: string
          created_at?: string | null
          id?: string
          is_demo?: boolean | null
          last_sync?: string | null
          name?: string
          namespace?: string
          requested_bytes?: number
          status?: string
          storage_class?: string | null
          updated_at?: string | null
          used_bytes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pvcs_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_history: {
        Row: {
          anomalies_data: Json | null
          anomalies_found: number
          cluster_id: string
          created_at: string
          id: string
          scan_date: string
          summary: string | null
          user_id: string
        }
        Insert: {
          anomalies_data?: Json | null
          anomalies_found?: number
          cluster_id: string
          created_at?: string
          id?: string
          scan_date?: string
          summary?: string | null
          user_id: string
        }
        Update: {
          anomalies_data?: Json | null
          anomalies_found?: number
          cluster_id?: string
          created_at?: string
          id?: string
          scan_date?: string
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_history_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          alert_type: string
          created_at: string
          description: string | null
          details: Json | null
          id: string
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          alert_type: string
          created_at?: string
          description?: string | null
          details?: Json | null
          id?: string
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          alert_type?: string
          created_at?: string
          description?: string | null
          details?: Json | null
          id?: string
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      security_threats: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          affected_resources: Json | null
          ai_analysis: Json | null
          ai_recommendation: string | null
          auto_remediated: boolean | null
          cluster_id: string
          created_at: string
          description: string | null
          detection_source: string | null
          false_positive: boolean | null
          id: string
          is_attack: boolean | null
          raw_data: Json | null
          remediated_at: string | null
          remediation_result: Json | null
          remediation_steps: Json | null
          severity: string
          status: string
          threat_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          affected_resources?: Json | null
          ai_analysis?: Json | null
          ai_recommendation?: string | null
          auto_remediated?: boolean | null
          cluster_id: string
          created_at?: string
          description?: string | null
          detection_source?: string | null
          false_positive?: boolean | null
          id?: string
          is_attack?: boolean | null
          raw_data?: Json | null
          remediated_at?: string | null
          remediation_result?: Json | null
          remediation_steps?: Json | null
          severity?: string
          status?: string
          threat_type: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          affected_resources?: Json | null
          ai_analysis?: Json | null
          ai_recommendation?: string | null
          auto_remediated?: boolean | null
          cluster_id?: string
          created_at?: string
          description?: string | null
          detection_source?: string | null
          false_positive?: boolean | null
          id?: string
          is_attack?: boolean | null
          raw_data?: Json | null
          remediated_at?: string | null
          remediation_result?: Json | null
          remediation_steps?: Json | null
          severity?: string
          status?: string
          threat_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_threats_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_recommendations: {
        Row: {
          applied_at: string | null
          cluster_id: string
          created_at: string | null
          current_size_gb: number
          days_analyzed: number
          id: string
          potential_savings: number
          pvc_id: string
          reasoning: string | null
          recommendation_type: string
          recommended_size_gb: number
          status: string
          usage_percentage: number
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          cluster_id: string
          created_at?: string | null
          current_size_gb?: number
          days_analyzed?: number
          id?: string
          potential_savings?: number
          pvc_id: string
          reasoning?: string | null
          recommendation_type: string
          recommended_size_gb?: number
          status?: string
          usage_percentage?: number
          user_id: string
        }
        Update: {
          applied_at?: string | null
          cluster_id?: string
          created_at?: string | null
          current_size_gb?: number
          days_analyzed?: number
          id?: string
          potential_savings?: number
          pvc_id?: string
          reasoning?: string | null
          recommendation_type?: string
          recommended_size_gb?: number
          status?: string
          usage_percentage?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_recommendations_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_recommendations_pvc_id_fkey"
            columns: ["pvc_id"]
            isOneToOne: false
            referencedRelation: "pvcs"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          ai_analyses_reset_at: string
          ai_analyses_used: number
          chat_messages_reset_at: string | null
          chat_messages_used: number | null
          created_at: string
          current_period_end: string | null
          custom_cluster_limit: number | null
          id: string
          plan: string
          status: string
          storage_analyses_reset_at: string | null
          storage_analyses_used: number | null
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_analyses_reset_at?: string
          ai_analyses_used?: number
          chat_messages_reset_at?: string | null
          chat_messages_used?: number | null
          created_at?: string
          current_period_end?: string | null
          custom_cluster_limit?: number | null
          id?: string
          plan?: string
          status?: string
          storage_analyses_reset_at?: string | null
          storage_analyses_used?: number | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_analyses_reset_at?: string
          ai_analyses_used?: number
          chat_messages_reset_at?: string | null
          chat_messages_used?: number | null
          created_at?: string
          current_period_end?: string | null
          custom_cluster_limit?: number | null
          id?: string
          plan?: string
          status?: string
          storage_analyses_reset_at?: string | null
          storage_analyses_used?: number | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          consent_date: string
          created_at: string
          id: string
          ip_address: string | null
          marketing_consent: boolean
          policy_version: string
          privacy_policy_accepted: boolean
          terms_accepted: boolean
          terms_version: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_date?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          marketing_consent?: boolean
          policy_version?: string
          privacy_policy_accepted?: boolean
          terms_accepted?: boolean
          terms_version?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_date?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          marketing_consent?: boolean
          policy_version?: string
          privacy_policy_accepted?: boolean
          terms_accepted?: boolean
          terms_version?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_configs: {
        Row: {
          cluster_id: string
          created_at: string
          enabled: boolean
          headers: Json | null
          id: string
          last_error: string | null
          last_triggered_at: string | null
          name: string
          severity_filter: string[] | null
          updated_at: string
          url: string
          user_id: string
          webhook_type: string
        }
        Insert: {
          cluster_id: string
          created_at?: string
          enabled?: boolean
          headers?: Json | null
          id?: string
          last_error?: string | null
          last_triggered_at?: string | null
          name: string
          severity_filter?: string[] | null
          updated_at?: string
          url: string
          user_id: string
          webhook_type?: string
        }
        Update: {
          cluster_id?: string
          created_at?: string
          enabled?: boolean
          headers?: Json | null
          id?: string
          last_error?: string | null
          last_triggered_at?: string | null
          name?: string
          severity_filter?: string[] | null
          updated_at?: string
          url?: string
          user_id?: string
          webhook_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_configs_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reports: {
        Row: {
          ai_summary: string | null
          auto_heals_applied: number | null
          cluster_health_score: number | null
          cluster_id: string
          cluster_status: string | null
          created_at: string
          critical_incidents: number | null
          critical_issues: Json | null
          id: string
          is_read: boolean | null
          nodes_count: number | null
          pods_count: number | null
          pods_healthy: number | null
          pods_restarted: number | null
          pods_unhealthy: number | null
          read_at: string | null
          recommendations: Json | null
          report_date: string
          resolved_incidents: number | null
          resource_limits_applied: number | null
          storage_available_gb: number | null
          storage_used_gb: number | null
          total_agent_actions: number | null
          total_incidents: number | null
          total_storage_gb: number | null
          updated_at: string
          user_id: string
          warning_incidents: number | null
          week_end: string
          week_start: string
        }
        Insert: {
          ai_summary?: string | null
          auto_heals_applied?: number | null
          cluster_health_score?: number | null
          cluster_id: string
          cluster_status?: string | null
          created_at?: string
          critical_incidents?: number | null
          critical_issues?: Json | null
          id?: string
          is_read?: boolean | null
          nodes_count?: number | null
          pods_count?: number | null
          pods_healthy?: number | null
          pods_restarted?: number | null
          pods_unhealthy?: number | null
          read_at?: string | null
          recommendations?: Json | null
          report_date?: string
          resolved_incidents?: number | null
          resource_limits_applied?: number | null
          storage_available_gb?: number | null
          storage_used_gb?: number | null
          total_agent_actions?: number | null
          total_incidents?: number | null
          total_storage_gb?: number | null
          updated_at?: string
          user_id: string
          warning_incidents?: number | null
          week_end: string
          week_start: string
        }
        Update: {
          ai_summary?: string | null
          auto_heals_applied?: number | null
          cluster_health_score?: number | null
          cluster_id?: string
          cluster_status?: string | null
          created_at?: string
          critical_incidents?: number | null
          critical_issues?: Json | null
          id?: string
          is_read?: boolean | null
          nodes_count?: number | null
          pods_count?: number | null
          pods_healthy?: number | null
          pods_restarted?: number | null
          pods_unhealthy?: number | null
          read_at?: string | null
          recommendations?: Json | null
          report_date?: string
          resolved_incidents?: number | null
          resource_limits_applied?: number | null
          storage_available_gb?: number | null
          storage_used_gb?: number | null
          total_agent_actions?: number | null
          total_incidents?: number | null
          total_storage_gb?: number | null
          updated_at?: string
          user_id?: string
          warning_incidents?: number | null
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_approvals: {
        Row: {
          action_params: Json
          action_type: string
          anomaly_id: string | null
          cluster_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          responded_at: string | null
          status: string | null
          user_id: string
          user_response: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          action_params?: Json
          action_type: string
          anomaly_id?: string | null
          cluster_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          responded_at?: string | null
          status?: string | null
          user_id: string
          user_response?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          action_params?: Json
          action_type?: string
          anomaly_id?: string | null
          cluster_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          responded_at?: string | null
          status?: string | null
          user_id?: string
          user_response?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_approvals_anomaly_id_fkey"
            columns: ["anomaly_id"]
            isOneToOne: false
            referencedRelation: "agent_anomalies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_approvals_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agent_api_keys_secure: {
        Row: {
          api_key_prefix: string | null
          cluster_id: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          last_seen: string | null
          name: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          api_key_prefix?: string | null
          cluster_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_seen?: string | null
          name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          api_key_prefix?: string | null
          cluster_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_seen?: string | null
          name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_api_keys_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cleanup_old_pvc_usage_history: { Args: never; Returns: undefined }
      create_security_alert: {
        Args: {
          p_alert_type: string
          p_description?: string
          p_details?: Json
          p_severity: string
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      delete_cluster_data: { Args: { p_cluster_id: string }; Returns: number }
      delete_user_account: { Args: never; Returns: undefined }
      get_cron_jobs_status: {
        Args: never
        Returns: {
          active: boolean
          jobid: number
          jobname: string
          last_run_time: string
          next_run_time: string
          schedule: string
        }[]
      }
      get_user_daily_ai_requests: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_user_monthly_ai_cost: { Args: { p_user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_ip_address?: string
          p_resource_id?: string
          p_resource_type: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      verify_api_key_hash: {
        Args: { p_api_key: string; p_stored_hash: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
