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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          achieved_at: string | null
          id: string
          kind: string
          metadata: Json | null
          module: Database["public"]["Enums"]["module_id"] | null
          user_id: string
          value: number | null
        }
        Insert: {
          achieved_at?: string | null
          id?: string
          kind: string
          metadata?: Json | null
          module?: Database["public"]["Enums"]["module_id"] | null
          user_id: string
          value?: number | null
        }
        Update: {
          achieved_at?: string | null
          id?: string
          kind?: string
          metadata?: Json | null
          module?: Database["public"]["Enums"]["module_id"] | null
          user_id?: string
          value?: number | null
        }
        Relationships: []
      }
      daily_activity: {
        Row: {
          avg_accuracy: number | null
          by_module: Json | null
          date: string
          total_minutes: number | null
          total_reviews: number | null
          total_words: number | null
          user_id: string
        }
        Insert: {
          avg_accuracy?: number | null
          by_module?: Json | null
          date: string
          total_minutes?: number | null
          total_reviews?: number | null
          total_words?: number | null
          user_id: string
        }
        Update: {
          avg_accuracy?: number | null
          by_module?: Json | null
          date?: string
          total_minutes?: number | null
          total_reviews?: number | null
          total_words?: number | null
          user_id?: string
        }
        Relationships: []
      }
      dictation_items: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          expected_text: string
          hints_used: number | null
          id: string
          index: number
          result: Json | null
          session_id: string
          time_ms: number | null
          user_id: string
          user_input: string | null
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string | null
          expected_text: string
          hints_used?: number | null
          id?: string
          index: number
          result?: Json | null
          session_id: string
          time_ms?: number | null
          user_id: string
          user_input?: string | null
        }
        Update: {
          attempt_count?: number | null
          created_at?: string | null
          expected_text?: string
          hints_used?: number | null
          id?: string
          index?: number
          result?: Json | null
          session_id?: string
          time_ms?: number | null
          user_id?: string
          user_input?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dictation_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "dictation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dictation_sessions: {
        Row: {
          completed_at: string | null
          config: Json
          current_index: number | null
          id: string
          resource_title: string
          started_at: string | null
          text_id: string | null
          total_accuracy: number | null
          total_hints_used: number | null
          total_time_ms: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          config: Json
          current_index?: number | null
          id?: string
          resource_title: string
          started_at?: string | null
          text_id?: string | null
          total_accuracy?: number | null
          total_hints_used?: number | null
          total_time_ms?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          config?: Json
          current_index?: number | null
          id?: string
          resource_title?: string
          started_at?: string | null
          text_id?: string | null
          total_accuracy?: number | null
          total_hints_used?: number | null
          total_time_ms?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dictation_sessions_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "texts"
            referencedColumns: ["id"]
          },
        ]
      }
      dictionary_categories: {
        Row: {
          cover_emoji: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          level: number
          name_en: string
          name_ko: string | null
          parent_id: string | null
          sort_order: number | null
          updated_at: string | null
          word_count: number | null
        }
        Insert: {
          cover_emoji?: string | null
          created_at?: string | null
          id: string
          is_active?: boolean | null
          level: number
          name_en: string
          name_ko?: string | null
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
          word_count?: number | null
        }
        Update: {
          cover_emoji?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          level?: number
          name_en?: string
          name_ko?: string | null
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dictionary_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "dictionary_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      dictionary_word_categories: {
        Row: {
          added_at: string | null
          category_id: string
          cefr_in_context: string | null
          pos_in_context: string | null
          rank_in_category: number | null
          source: string
          word: string
        }
        Insert: {
          added_at?: string | null
          category_id: string
          cefr_in_context?: string | null
          pos_in_context?: string | null
          rank_in_category?: number | null
          source?: string
          word: string
        }
        Update: {
          added_at?: string | null
          category_id?: string
          cefr_in_context?: string | null
          pos_in_context?: string | null
          rank_in_category?: number | null
          source?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "dictionary_word_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "dictionary_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dictionary_word_categories_word_fkey"
            columns: ["word"]
            isOneToOne: false
            referencedRelation: "shared_dictionary"
            referencedColumns: ["word"]
          },
        ]
      }
      learning_records: {
        Row: {
          attempted_at: string | null
          id: string
          is_correct: boolean
          metadata: Json | null
          module: Database["public"]["Enums"]["module_id"]
          rating: number | null
          response_time_ms: number | null
          retrievability_before: number | null
          stability_delta: number | null
          user_id: string
          vocabulary_id: string | null
        }
        Insert: {
          attempted_at?: string | null
          id?: string
          is_correct: boolean
          metadata?: Json | null
          module: Database["public"]["Enums"]["module_id"]
          rating?: number | null
          response_time_ms?: number | null
          retrievability_before?: number | null
          stability_delta?: number | null
          user_id: string
          vocabulary_id?: string | null
        }
        Update: {
          attempted_at?: string | null
          id?: string
          is_correct?: boolean
          metadata?: Json | null
          module?: Database["public"]["Enums"]["module_id"]
          rating?: number | null
          response_time_ms?: number | null
          retrievability_before?: number | null
          stability_delta?: number | null
          user_id?: string
          vocabulary_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_records_vocabulary_id_fkey"
            columns: ["vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabularies"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_index: number
          created_at: string | null
          id: string
          options: Json
          question: string
          source_sentence_idx: number | null
          source_snippet: string | null
          text_id: string
          type: string
          user_id: string
        }
        Insert: {
          correct_index: number
          created_at?: string | null
          id?: string
          options: Json
          question: string
          source_sentence_idx?: number | null
          source_snippet?: string | null
          text_id: string
          type?: string
          user_id: string
        }
        Update: {
          correct_index?: number
          created_at?: string | null
          id?: string
          options?: Json
          question?: string
          source_sentence_idx?: number | null
          source_snippet?: string | null
          text_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "texts"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_note: string | null
          created_at: string | null
          id: string
          kind: string
          message: string
          resolved_at: string | null
          status: string | null
          subject: string
          text_id: string | null
          user_id: string | null
          vocabulary_id: string | null
        }
        Insert: {
          admin_note?: string | null
          created_at?: string | null
          id?: string
          kind: string
          message: string
          resolved_at?: string | null
          status?: string | null
          subject: string
          text_id?: string | null
          user_id?: string | null
          vocabulary_id?: string | null
        }
        Update: {
          admin_note?: string | null
          created_at?: string | null
          id?: string
          kind?: string
          message?: string
          resolved_at?: string | null
          status?: string | null
          subject?: string
          text_id?: string | null
          user_id?: string | null
          vocabulary_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "texts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_vocabulary_id_fkey"
            columns: ["vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabularies"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          accuracy: number | null
          correct_count: number | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          is_record: boolean | null
          metadata: Json | null
          module: Database["public"]["Enums"]["module_id"]
          score: number
          text_id: string | null
          total_questions: number | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          correct_count?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          is_record?: boolean | null
          metadata?: Json | null
          module: Database["public"]["Enums"]["module_id"]
          score: number
          text_id?: string | null
          total_questions?: number | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          correct_count?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          is_record?: boolean | null
          metadata?: Json | null
          module?: Database["public"]["Enums"]["module_id"]
          score?: number
          text_id?: string | null
          total_questions?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "texts"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_dictionary: {
        Row: {
          antonyms: string[] | null
          cefr_level: string | null
          created_at: string | null
          example_en: string | null
          frequency_rank: number | null
          meaning_ko: string
          meanings_ko: Json | null
          pos: string
          pos_all: string[] | null
          source: string
          synonyms: string[] | null
          updated_at: string | null
          verified: boolean | null
          word: string
        }
        Insert: {
          antonyms?: string[] | null
          cefr_level?: string | null
          created_at?: string | null
          example_en?: string | null
          frequency_rank?: number | null
          meaning_ko: string
          meanings_ko?: Json | null
          pos: string
          pos_all?: string[] | null
          source?: string
          synonyms?: string[] | null
          updated_at?: string | null
          verified?: boolean | null
          word: string
        }
        Update: {
          antonyms?: string[] | null
          cefr_level?: string | null
          created_at?: string | null
          example_en?: string | null
          frequency_rank?: number | null
          meaning_ko?: string
          meanings_ko?: Json | null
          pos?: string
          pos_all?: string[] | null
          source?: string
          synonyms?: string[] | null
          updated_at?: string | null
          verified?: boolean | null
          word?: string
        }
        Relationships: []
      }
      shared_word_sets: {
        Row: {
          category: string
          cefr_level: string | null
          cover_emoji: string | null
          created_at: string | null
          description: string | null
          id: string
          is_published: boolean | null
          sort_order: number | null
          title: string
          word_count: number | null
        }
        Insert: {
          category: string
          cefr_level?: string | null
          cover_emoji?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          sort_order?: number | null
          title: string
          word_count?: number | null
        }
        Update: {
          category?: string
          cefr_level?: string | null
          cover_emoji?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          sort_order?: number | null
          title?: string
          word_count?: number | null
        }
        Relationships: []
      }
      shared_words: {
        Row: {
          cefr_level: string | null
          example_en: string | null
          id: string
          meaning_ko: string
          part_of_speech: string | null
          pronunciation: string | null
          set_id: string
          sort_order: number | null
          word: string
        }
        Insert: {
          cefr_level?: string | null
          example_en?: string | null
          id?: string
          meaning_ko: string
          part_of_speech?: string | null
          pronunciation?: string | null
          set_id: string
          sort_order?: number | null
          word: string
        }
        Update: {
          cefr_level?: string | null
          example_en?: string | null
          id?: string
          meaning_ko?: string
          part_of_speech?: string | null
          pronunciation?: string | null
          set_id?: string
          sort_order?: number | null
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_words_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "shared_word_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      texts: {
        Row: {
          author: string | null
          cefr_level: string | null
          content: string
          cover_from: string | null
          cover_to: string | null
          created_at: string | null
          id: string
          is_bookmarked: boolean | null
          last_opened: string | null
          progress_percent: number | null
          source: Database["public"]["Enums"]["text_source"] | null
          source_file_path: string | null
          source_url: string | null
          status: string | null
          title: string
          translation: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          author?: string | null
          cefr_level?: string | null
          content: string
          cover_from?: string | null
          cover_to?: string | null
          created_at?: string | null
          id?: string
          is_bookmarked?: boolean | null
          last_opened?: string | null
          progress_percent?: number | null
          source?: Database["public"]["Enums"]["text_source"] | null
          source_file_path?: string | null
          source_url?: string | null
          status?: string | null
          title: string
          translation?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          author?: string | null
          cefr_level?: string | null
          content?: string
          cover_from?: string | null
          cover_to?: string | null
          created_at?: string | null
          id?: string
          is_bookmarked?: boolean | null
          last_opened?: string | null
          progress_percent?: number | null
          source?: Database["public"]["Enums"]["text_source"] | null
          source_file_path?: string | null
          source_url?: string | null
          status?: string | null
          title?: string
          translation?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          cefr_level: string | null
          created_at: string | null
          daily_word_goal: number | null
          display_name: string | null
          locale: string | null
          notify_email: boolean | null
          notify_push: boolean | null
          notify_streak_risk: boolean | null
          role: string
          status: string
          theme: string | null
          tts_speed: number | null
          tts_voice: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cefr_level?: string | null
          created_at?: string | null
          daily_word_goal?: number | null
          display_name?: string | null
          locale?: string | null
          notify_email?: boolean | null
          notify_push?: boolean | null
          notify_streak_risk?: boolean | null
          role?: string
          status?: string
          theme?: string | null
          tts_speed?: number | null
          tts_voice?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cefr_level?: string | null
          created_at?: string | null
          daily_word_goal?: number | null
          display_name?: string | null
          locale?: string | null
          notify_email?: boolean | null
          notify_push?: boolean | null
          notify_streak_risk?: boolean | null
          role?: string
          status?: string
          theme?: string | null
          tts_speed?: number | null
          tts_voice?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          current_streak: number | null
          fsrs_target_retention: number | null
          last_studied_at: string | null
          longest_streak: number | null
          mastery_level: string | null
          total_words: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          current_streak?: number | null
          fsrs_target_retention?: number | null
          last_studied_at?: string | null
          longest_streak?: number | null
          mastery_level?: string | null
          total_words?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          current_streak?: number | null
          fsrs_target_retention?: number | null
          last_studied_at?: string | null
          longest_streak?: number | null
          mastery_level?: string | null
          total_words?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_word_set_subscriptions: {
        Row: {
          set_id: string
          subscribed_at: string | null
          user_id: string
        }
        Insert: {
          set_id: string
          subscribed_at?: string | null
          user_id: string
        }
        Update: {
          set_id?: string
          subscribed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_word_set_subscriptions_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "shared_word_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabularies: {
        Row: {
          cefr_level: string | null
          created_at: string | null
          difficulty: number | null
          example_sentence: string | null
          id: string
          last_review_at: string | null
          meaning: string
          module_history: string[] | null
          next_review_at: string | null
          origin: string | null
          pos: string | null
          pronunciation: string | null
          review_count: number | null
          shared_set_id: string | null
          stability: number | null
          text_id: string | null
          updated_at: string | null
          user_id: string
          word: string
        }
        Insert: {
          cefr_level?: string | null
          created_at?: string | null
          difficulty?: number | null
          example_sentence?: string | null
          id?: string
          last_review_at?: string | null
          meaning: string
          module_history?: string[] | null
          next_review_at?: string | null
          origin?: string | null
          pos?: string | null
          pronunciation?: string | null
          review_count?: number | null
          shared_set_id?: string | null
          stability?: number | null
          text_id?: string | null
          updated_at?: string | null
          user_id: string
          word: string
        }
        Update: {
          cefr_level?: string | null
          created_at?: string | null
          difficulty?: number | null
          example_sentence?: string | null
          id?: string
          last_review_at?: string | null
          meaning?: string
          module_history?: string[] | null
          next_review_at?: string | null
          origin?: string | null
          pos?: string | null
          pronunciation?: string | null
          review_count?: number | null
          shared_set_id?: string | null
          stability?: number | null
          text_id?: string | null
          updated_at?: string | null
          user_id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabularies_shared_set_id_fkey"
            columns: ["shared_set_id"]
            isOneToOne: false
            referencedRelation: "shared_word_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vocabularies_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "texts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_category_path: { Args: { cat_id: string }; Returns: string[] }
    }
    Enums: {
      module_id:
        | "flashcard"
        | "spellforge"
        | "wordblitz"
        | "pairflip"
        | "scriptquiz"
        | "dictation"
        | "wordvault"
        | "workspace"
        | "textviewer"
        | "pirate_quest"
      text_source: "library" | "direct-script" | "direct-file" | "shared-set"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      module_id: [
        "flashcard",
        "spellforge",
        "wordblitz",
        "pairflip",
        "scriptquiz",
        "dictation",
        "wordvault",
        "workspace",
        "textviewer",
        "pirate_quest",
      ],
      text_source: ["library", "direct-script", "direct-file", "shared-set"],
    },
  },
} as const
