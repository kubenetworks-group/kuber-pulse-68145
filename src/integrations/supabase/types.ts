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
          result: Json | null
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
          result?: Json | null
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
          result?: Json | null
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
          api_endpoint: string
          cluster_type: string
          config_file: string | null
          cpu_usage: number | null
          created_at: string | null
          environment: string
          id: string
          last_cost_calculation: string | null
          last_sync: string | null
          memory_usage: number | null
          monthly_cost: number | null
          name: string
          nodes: number | null
          pods: number | null
          provider: string
          region: string | null
          status: string
          storage_available_gb: number | null
          storage_total_gb: number | null
          storage_used_gb: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_endpoint: string
          cluster_type: string
          config_file?: string | null
          cpu_usage?: number | null
          created_at?: string | null
          environment: string
          id?: string
          last_cost_calculation?: string | null
          last_sync?: string | null
          memory_usage?: number | null
          monthly_cost?: number | null
          name: string
          nodes?: number | null
          pods?: number | null
          provider: string
          region?: string | null
          status?: string
          storage_available_gb?: number | null
          storage_total_gb?: number | null
          storage_used_gb?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_endpoint?: string
          cluster_type?: string
          config_file?: string | null
          cpu_usage?: number | null
          created_at?: string | null
          environment?: string
          id?: string
          last_cost_calculation?: string | null
          last_sync?: string | null
          memory_usage?: number | null
          monthly_cost?: number | null
          name?: string
          nodes?: number | null
          pods?: number | null
          provider?: string
          region?: string | null
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
          cnpj: string | null
          company_name: string
          created_at: string
          id: string
          onboarding_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          cnpj?: string | null
          company_name: string
          created_at?: string
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          cnpj?: string | null
          company_name?: string
          created_at?: string
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pvcs: {
        Row: {
          cluster_id: string
          created_at: string | null
          id: string
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
      security_audits: {
        Row: {
          category: string
          cluster_id: string
          created_at: string | null
          description: string
          id: string
          resolved_at: string | null
          severity: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          category: string
          cluster_id: string
          created_at?: string | null
          description: string
          id?: string
          resolved_at?: string | null
          severity: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          category?: string
          cluster_id?: string
          created_at?: string | null
          description?: string
          id?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_audits_cluster_id_fkey"
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
          days_analyzed: number | null
          id: string
          potential_savings: number | null
          pvc_id: string
          reasoning: string
          recommendation_type: string
          recommended_size_gb: number
          status: string | null
          usage_percentage: number
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          cluster_id: string
          created_at?: string | null
          current_size_gb: number
          days_analyzed?: number | null
          id?: string
          potential_savings?: number | null
          pvc_id: string
          reasoning: string
          recommendation_type: string
          recommended_size_gb: number
          status?: string | null
          usage_percentage: number
          user_id: string
        }
        Update: {
          applied_at?: string | null
          cluster_id?: string
          created_at?: string | null
          current_size_gb?: number
          days_analyzed?: number | null
          id?: string
          potential_savings?: number | null
          pvc_id?: string
          reasoning?: string
          recommendation_type?: string
          recommended_size_gb?: number
          status?: string | null
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
      user_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "dev" | "sre" | "gestor" | "finops"
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
      app_role: ["admin", "dev", "sre", "gestor", "finops"],
    },
  },
} as const
