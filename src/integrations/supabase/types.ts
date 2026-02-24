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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null
          email: string
          estate_id: string | null
          full_name: string | null
          id: string
          last_login: string | null
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          estate_id?: string | null
          full_name?: string | null
          id: string
          last_login?: string | null
          role: string
        }
        Update: {
          created_at?: string | null
          email?: string
          estate_id?: string | null
          full_name?: string | null
          id?: string
          last_login?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          answer_value: string
          id: string
          question_id: string
          response_id: string
        }
        Insert: {
          answer_value: string
          id?: string
          question_id: string
          response_id: string
        }
        Update: {
          answer_value?: string
          id?: string
          question_id?: string
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          admin_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          id: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      estates: {
        Row: {
          city: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          state: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          state?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          state?: string | null
        }
        Relationships: []
      }
      forms: {
        Row: {
          ab_variant: string | null
          created_at: string | null
          description: string | null
          estate_id: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          ab_variant?: string | null
          created_at?: string | null
          description?: string | null
          estate_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          ab_variant?: string | null
          created_at?: string | null
          description?: string | null
          estate_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forms_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      logic_rules: {
        Row: {
          action: string
          created_at: string | null
          depends_on_question_id: string
          flag_type: string | null
          id: string
          operator: string
          source_question_id: string
          value_to_match: string
        }
        Insert: {
          action: string
          created_at?: string | null
          depends_on_question_id: string
          flag_type?: string | null
          id?: string
          operator: string
          source_question_id: string
          value_to_match: string
        }
        Update: {
          action?: string
          created_at?: string | null
          depends_on_question_id?: string
          flag_type?: string | null
          id?: string
          operator?: string
          source_question_id?: string
          value_to_match?: string
        }
        Relationships: [
          {
            foreignKeyName: "logic_rules_depends_on_question_id_fkey"
            columns: ["depends_on_question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logic_rules_source_question_id_fkey"
            columns: ["source_question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_options: {
        Row: {
          created_at: string | null
          display_order: number
          icon_emoji: string | null
          id: string
          option_text: string
          option_value: string
          question_id: string
        }
        Insert: {
          created_at?: string | null
          display_order: number
          icon_emoji?: string | null
          id?: string
          option_text: string
          option_value: string
          question_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          icon_emoji?: string | null
          id?: string
          option_text?: string
          option_value?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          category_tag: string | null
          created_at: string | null
          display_order: number
          form_id: string
          helper_text: string | null
          id: string
          is_active: boolean | null
          is_required: boolean | null
          path_tag: string | null
          placeholder_text: string | null
          question_text: string
          question_type: string
          updated_at: string | null
          validation_rule: Json | null
        }
        Insert: {
          category_tag?: string | null
          created_at?: string | null
          display_order: number
          form_id: string
          helper_text?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          path_tag?: string | null
          placeholder_text?: string | null
          question_text: string
          question_type: string
          updated_at?: string | null
          validation_rule?: Json | null
        }
        Update: {
          category_tag?: string | null
          created_at?: string | null
          display_order?: number
          form_id?: string
          helper_text?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          path_tag?: string | null
          placeholder_text?: string | null
          question_text?: string
          question_type?: string
          updated_at?: string | null
          validation_rule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          admin_notes: string | null
          browser: string | null
          churn_risk_flag: boolean | null
          created_at: string | null
          customer_tier: string | null
          device_type: string | null
          estate_id: string | null
          form_id: string | null
          high_referrer_flag: boolean | null
          id: string
          ip_address: unknown
          is_duplicate: boolean | null
          legacy_import: boolean | null
          os: string | null
          phone_number: string | null
          priority_flag: boolean | null
          referral_source: string | null
          reviewed_by_admin: boolean | null
          session_id: string | null
          source: string | null
          submission_timestamp: string | null
          upsell_candidate: boolean | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
        }
        Insert: {
          admin_notes?: string | null
          browser?: string | null
          churn_risk_flag?: boolean | null
          created_at?: string | null
          customer_tier?: string | null
          device_type?: string | null
          estate_id?: string | null
          form_id?: string | null
          high_referrer_flag?: boolean | null
          id?: string
          ip_address?: unknown
          is_duplicate?: boolean | null
          legacy_import?: boolean | null
          os?: string | null
          phone_number?: string | null
          priority_flag?: boolean | null
          referral_source?: string | null
          reviewed_by_admin?: boolean | null
          session_id?: string | null
          source?: string | null
          submission_timestamp?: string | null
          upsell_candidate?: boolean | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
        }
        Update: {
          admin_notes?: string | null
          browser?: string | null
          churn_risk_flag?: boolean | null
          created_at?: string | null
          customer_tier?: string | null
          device_type?: string | null
          estate_id?: string | null
          form_id?: string | null
          high_referrer_flag?: boolean | null
          id?: string
          ip_address?: unknown
          is_duplicate?: boolean | null
          legacy_import?: boolean | null
          os?: string | null
          phone_number?: string | null
          priority_flag?: boolean | null
          referral_source?: string | null
          reviewed_by_admin?: boolean | null
          session_id?: string | null
          source?: string | null
          submission_timestamp?: string | null
          upsell_candidate?: boolean | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "responses_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
