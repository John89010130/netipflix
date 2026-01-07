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
      active_sessions: {
        Row: {
          device_info: string | null
          id: string
          ip_address: string | null
          last_activity: string
          profile_id: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          device_info?: string | null
          id?: string
          ip_address?: string | null
          last_activity?: string
          profile_id?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          device_info?: string | null
          id?: string
          ip_address?: string | null
          last_activity?: string
          profile_id?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      channels: {
        Row: {
          active: boolean
          category: string
          clean_title: string | null
          content_type: string
          country: string
          created_at: string
          episode_number: number | null
          episode_title: string | null
          genre: string | null
          id: string
          last_test_status: string | null
          last_tested_at: string | null
          logo_url: string | null
          m3u_link_id: string | null
          name: string
          original_name: string | null
          season_number: number | null
          series_title: string | null
          stream_url: string
          subcategory: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          active?: boolean
          category: string
          clean_title?: string | null
          content_type?: string
          country?: string
          created_at?: string
          episode_number?: number | null
          episode_title?: string | null
          genre?: string | null
          id?: string
          last_test_status?: string | null
          last_tested_at?: string | null
          logo_url?: string | null
          m3u_link_id?: string | null
          name: string
          original_name?: string | null
          season_number?: number | null
          series_title?: string | null
          stream_url: string
          subcategory?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          active?: boolean
          category?: string
          clean_title?: string | null
          content_type?: string
          country?: string
          created_at?: string
          episode_number?: number | null
          episode_title?: string | null
          genre?: string | null
          id?: string
          last_test_status?: string | null
          last_tested_at?: string | null
          logo_url?: string | null
          m3u_link_id?: string | null
          name?: string
          original_name?: string | null
          season_number?: number | null
          series_title?: string | null
          stream_url?: string
          subcategory?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_m3u_link_id_fkey"
            columns: ["m3u_link_id"]
            isOneToOne: false
            referencedRelation: "m3u_links"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          is_kids_profile: boolean
          name: string
          parent_user_id: string
          pin: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_kids_profile?: boolean
          name: string
          parent_user_id: string
          pin?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_kids_profile?: boolean
          name?: string
          parent_user_id?: string
          pin?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      client_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_screens: number
          price_per_screen: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_screens?: number
          price_per_screen?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_screens?: number
          price_per_screen?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      m3u_links: {
        Row: {
          channels_imported: number | null
          id: string
          imported_at: string
          imported_by: string | null
          is_active: boolean
          url: string
        }
        Insert: {
          channels_imported?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          is_active?: boolean
          url: string
        }
        Update: {
          channels_imported?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          is_active?: boolean
          url?: string
        }
        Relationships: []
      }
      movies: {
        Row: {
          active: boolean
          backdrop_url: string | null
          category: string
          created_at: string
          description: string | null
          duration: string | null
          id: string
          poster_url: string | null
          rating: number | null
          stream_url: string
          title: string
          updated_at: string
          views_count: number
          year: number | null
        }
        Insert: {
          active?: boolean
          backdrop_url?: string | null
          category: string
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          poster_url?: string | null
          rating?: number | null
          stream_url: string
          title: string
          updated_at?: string
          views_count?: number
          year?: number | null
        }
        Update: {
          active?: boolean
          backdrop_url?: string | null
          category?: string
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          poster_url?: string | null
          rating?: number | null
          stream_url?: string
          title?: string
          updated_at?: string
          views_count?: number
          year?: number | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          allowed_categories: string[]
          can_movies: boolean
          can_tv: boolean
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_categories?: string[]
          can_movies?: boolean
          can_tv?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_categories?: string[]
          can_movies?: boolean
          can_tv?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          adult_password: string | null
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          adult_password?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          adult_password?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      stream_test_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_count: number
          id: string
          offline_count: number
          online_count: number
          started_at: string | null
          status: string
          tested_channels: number
          total_channels: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_count?: number
          id?: string
          offline_count?: number
          online_count?: number
          started_at?: string | null
          status?: string
          tested_channels?: number
          total_channels?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_count?: number
          id?: string
          offline_count?: number
          online_count?: number
          started_at?: string | null
          status?: string
          tested_channels?: number
          total_channels?: number
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          message: string
          read_at: string | null
          sender_id: string
          sender_type: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          sender_id: string
          sender_type: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watch_history: {
        Row: {
          content_id: string
          content_type: string
          id: string
          progress: number | null
          user_id: string
          watched_at: string
        }
        Insert: {
          content_id: string
          content_type: string
          id?: string
          progress?: number | null
          user_id: string
          watched_at?: string
        }
        Update: {
          content_id?: string
          content_type?: string
          id?: string
          progress?: number | null
          user_id?: string
          watched_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      active_channels: {
        Row: {
          active: boolean | null
          category: string | null
          content_type: string | null
          country: string | null
          created_at: string | null
          episode_number: number | null
          id: string | null
          last_test_status: string | null
          last_tested_at: string | null
          logo_url: string | null
          m3u_link_id: string | null
          name: string | null
          season_number: number | null
          series_title: string | null
          stream_url: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_m3u_link_id_fkey"
            columns: ["m3u_link_id"]
            isOneToOne: false
            referencedRelation: "m3u_links"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_access_content: {
        Args: { _content_type: string; _user_id: string }
        Returns: boolean
      }
      check_session_availability: { Args: { _user_id: string }; Returns: Json }
      cleanup_inactive_sessions: { Args: never; Returns: number }
      count_user_profiles: {
        Args: { _parent_user_id: string }
        Returns: number
      }
      determine_content_type: {
        Args: { p_category: string; p_name: string }
        Returns: string
      }
      determine_content_type_v2: {
        Args: { p_category: string; p_name: string; p_stream_url: string }
        Returns: string
      }
      extract_series_info: {
        Args: { p_name: string }
        Returns: {
          episode_num: number
          season_num: number
          series_title: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_parent_user: { Args: { _user_id: string }; Returns: boolean }
      migrate_channels_batch: { Args: { batch_size?: number }; Returns: number }
      normalize_text: { Args: { text_input: string }; Returns: string }
      parse_category_info: {
        Args: { p_category: string }
        Returns: {
          detected_genre: string
          main_category: string
          sub_category: string
        }[]
      }
      parse_content_name: {
        Args: { p_name: string }
        Returns: {
          clean_title: string
          episode_num: number
          episode_title: string
          season_num: number
          year_extracted: number
        }[]
      }
      reorganize_all_channels: {
        Args: never
        Returns: {
          movies_updated: number
          series_updated: number
          subcategories_extracted: number
          total_processed: number
          tv_updated: number
          years_extracted: number
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "ADMIN_MASTER" | "ADMIN" | "USER"
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
      app_role: ["ADMIN_MASTER", "ADMIN", "USER"],
    },
  },
} as const
