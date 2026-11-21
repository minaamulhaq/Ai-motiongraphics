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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      contact_messages: {
        Row: {
          body: string
          created_at: string
          email: string
          id: string
        }
        Insert: {
          body: string
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          body?: string
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          balance_after: number
          created_at: string
          credits: number
          generation_type: string
          id: string
          project_id: string
          run_id: string
          settled_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          credits: number
          generation_type: string
          id?: string
          project_id: string
          run_id: string
          settled_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          credits?: number
          generation_type?: string
          id?: string
          project_id?: string
          run_id?: string
          settled_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          display_name: string
          id: string
        }
        Insert: {
          display_name: string
          id: string
        }
        Update: {
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      project_generations: {
        Row: {
          attempt: number
          brief: Json | null
          composition_code: string | null
          credit_cost: number
          error: string | null
          progress: number
          project_id: string
          request_prompt: string | null
          request_type: string
          run_id: string
          status: string
          theme: Json | null
          updated_at: string
        }
        Insert: {
          attempt?: number
          brief?: Json | null
          composition_code?: string | null
          credit_cost?: number
          error?: string | null
          progress?: number
          project_id: string
          request_prompt?: string | null
          request_type?: string
          run_id?: string
          status?: string
          theme?: Json | null
          updated_at?: string
        }
        Update: {
          attempt?: number
          brief?: Json | null
          composition_code?: string | null
          credit_cost?: number
          error?: string | null
          progress?: number
          project_id?: string
          request_prompt?: string | null
          request_type?: string
          run_id?: string
          status?: string
          theme?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_generations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_video_versions: {
        Row: {
          run_id: string
          project_id: string
          brief: Json | null
          theme: Json | null
          composition_code: string
          request_prompt: string | null
          completed_at: string
        }
        Insert: {
          run_id: string
          project_id: string
          brief?: Json | null
          theme?: Json | null
          composition_code: string
          request_prompt?: string | null
          completed_at?: string
        }
        Update: {
          run_id?: string
          project_id?: string
          brief?: Json | null
          theme?: Json | null
          composition_code?: string
          request_prompt?: string | null
          completed_at?: string
        }
        Relationships: [{
          foreignKeyName: "project_video_versions_project_id_fkey"
          columns: ["project_id"]
          isOneToOne: false
          referencedRelation: "projects"
          referencedColumns: ["id"]
        }]
      }
      project_video_exports: {
        Row: {
          id: string
          project_id: string
          owner_id: string
          run_id: string
          status: string
          progress: number
          render_id: string | null
          output_bucket: string | null
          output_key: string | null
          error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          owner_id: string
          run_id: string
          status?: string
          progress?: number
          render_id?: string | null
          output_bucket?: string | null
          output_key?: string | null
          error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          owner_id?: string
          run_id?: string
          status?: string
          progress?: number
          render_id?: string | null
          output_bucket?: string | null
          output_key?: string | null
          error?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_video_exports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_video_exports_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "project_video_versions"
            referencedColumns: ["run_id"]
          },
        ]
      }
      subscription_credit_grants: {
        Row: {
          id: string
          user_id: string
          source_key: string
          plan_slug: string
          credits: number
          balance_after: number
          period_start: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_key: string
          plan_slug: string
          credits: number
          balance_after: number
          period_start: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source_key?: string
          plan_slug?: string
          credits?: number
          balance_after?: number
          period_start?: string
          created_at?: string
        }
        Relationships: [{
          foreignKeyName: "subscription_credit_grants_user_id_fkey"
          columns: ["user_id"]
          isOneToOne: false
          referencedRelation: "users"
          referencedColumns: ["id"]
        }]
      }
      project_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          art: Database["public"]["Enums"]["artwork"]
          collection_position: number | null
          created_at: string
          hue: number
          id: string
          owner_id: string | null
          prompt: string
          ratio: string
          seconds: number
          shared: boolean
          title: string
          theme_config: Json | null
          user_id: string | null
        }
        Insert: {
          art: Database["public"]["Enums"]["artwork"]
          collection_position?: number | null
          created_at?: string
          hue?: number
          id?: string
          owner_id?: string | null
          prompt: string
          ratio: string
          seconds: number
          shared?: boolean
          title: string
          theme_config?: Json | null
          user_id?: string | null
        }
        Update: {
          art?: Database["public"]["Enums"]["artwork"]
          collection_position?: number | null
          created_at?: string
          hue?: number
          id?: string
          owner_id?: string | null
          prompt?: string
          ratio?: string
          seconds?: number
          shared?: boolean
          title?: string
          theme_config?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          credit: number
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit?: number
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit?: number
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      grant_subscription_credits: {
        Args: {
          target_user: string
          source_key_value: string
          plan_slug_value: string
          credit_amount: number
          billing_period_start: string
        }
        Returns: number
      }
      complete_project_generation: {
        Args: { source_code: string; target: string; target_run: string }
        Returns: boolean
      }
      fail_project_generation: {
        Args: { failure_message: string; target: string; target_run: string }
        Returns: boolean
      }
      queue_project_generation: {
        Args: {
          requested_prompt?: string
          retry_requested?: boolean
          target: string
        }
        Returns: {
          attempt: number
          brief: Json | null
          composition_code: string | null
          credit_cost: number
          error: string | null
          progress: number
          project_id: string
          request_prompt: string | null
          request_type: string
          run_id: string
          status: string
          theme: Json | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "project_generations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      artwork: "ember" | "chrome" | "terrain" | "tide"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      artwork: ["ember", "chrome", "terrain", "tide"],
    },
  },
} as const
