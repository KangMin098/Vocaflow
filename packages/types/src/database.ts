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
  public: {
    Tables: {
      archaic_candidates: {
        Row: {
          ai_generated: boolean | null
          book_count: number
          classification: string | null
          created_at: string | null
          first_seen_book_id: string | null
          processed_at: string | null
          sample_sentence: string | null
          total_frequency: number
          updated_at: string | null
          word: string
        }
        Insert: {
          ai_generated?: boolean | null
          book_count?: number
          classification?: string | null
          created_at?: string | null
          first_seen_book_id?: string | null
          processed_at?: string | null
          sample_sentence?: string | null
          total_frequency?: number
          updated_at?: string | null
          word: string
        }
        Update: {
          ai_generated?: boolean | null
          book_count?: number
          classification?: string | null
          created_at?: string | null
          first_seen_book_id?: string | null
          processed_at?: string | null
          sample_sentence?: string | null
          total_frequency?: number
          updated_at?: string | null
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "archaic_candidates_first_seen_book_id_fkey"
            columns: ["first_seen_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      archaic_dictionary: {
        Row: {
          book_count: number | null
          created_at: string | null
          era: string | null
          generated_by: string | null
          is_learnable: boolean | null
          meaning_ko: string
          modern_equivalent: string | null
          pos: string | null
          source: string | null
          total_frequency: number | null
          usage_note: string | null
          word: string
        }
        Insert: {
          book_count?: number | null
          created_at?: string | null
          era?: string | null
          generated_by?: string | null
          is_learnable?: boolean | null
          meaning_ko: string
          modern_equivalent?: string | null
          pos?: string | null
          source?: string | null
          total_frequency?: number | null
          usage_note?: string | null
          word: string
        }
        Update: {
          book_count?: number | null
          created_at?: string | null
          era?: string | null
          generated_by?: string | null
          is_learnable?: boolean | null
          meaning_ko?: string
          modern_equivalent?: string | null
          pos?: string | null
          source?: string | null
          total_frequency?: number | null
          usage_note?: string | null
          word?: string
        }
        Relationships: []
      }
      book_curation_jobs: {
        Row: {
          book_id: string
          book_v_level: number | null
          chapter_definition: Json | null
          chapters_done: number | null
          chapters_total: number | null
          claimed_at: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          librivox_chapters: Json | null
          librivox_mapping: Json | null
          mode: string | null
          note: string | null
          panels_done: number | null
          panels_total: number | null
          questions_created: number | null
          result: Json | null
          source_chapters: Json | null
          status: string
          target_per_chapter: number | null
          task_type: string
          updated_at: string
        }
        Insert: {
          book_id: string
          book_v_level?: number | null
          chapter_definition?: Json | null
          chapters_done?: number | null
          chapters_total?: number | null
          claimed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          librivox_chapters?: Json | null
          librivox_mapping?: Json | null
          mode?: string | null
          note?: string | null
          panels_done?: number | null
          panels_total?: number | null
          questions_created?: number | null
          result?: Json | null
          source_chapters?: Json | null
          status?: string
          target_per_chapter?: number | null
          task_type?: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          book_v_level?: number | null
          chapter_definition?: Json | null
          chapters_done?: number | null
          chapters_total?: number | null
          claimed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          librivox_chapters?: Json | null
          librivox_mapping?: Json | null
          mode?: string | null
          note?: string | null
          panels_done?: number | null
          panels_total?: number | null
          questions_created?: number | null
          result?: Json | null
          source_chapters?: Json | null
          status?: string
          target_per_chapter?: number | null
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_curation_jobs_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_extraction_audit: {
        Row: {
          computed_at: string
          defect: string
          library_book_id: string
          occurrences: number
          rows: number
          words: number
        }
        Insert: {
          computed_at?: string
          defect: string
          library_book_id: string
          occurrences?: number
          rows?: number
          words?: number
        }
        Update: {
          computed_at?: string
          defect?: string
          library_book_id?: string
          occurrences?: number
          rows?: number
          words?: number
        }
        Relationships: [
          {
            foreignKeyName: "book_extraction_audit_library_book_id_fkey"
            columns: ["library_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      class_members: {
        Row: {
          class_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          class_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          class_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code: string
          name: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          teacher_id?: string
        }
        Relationships: []
      }
      comic_books: {
        Row: {
          backend: string | null
          book_v_level: number | null
          created_at: string
          created_by: string | null
          feature_rank: number | null
          library_book_id: string
          panels_pass: boolean
          panels_total: number
          preview_from: number
          published_at: string | null
          qc_verdict: Json | null
          status: string
          style: string | null
          style_key: string | null
          updated_at: string
        }
        Insert: {
          backend?: string | null
          book_v_level?: number | null
          created_at?: string
          created_by?: string | null
          feature_rank?: number | null
          library_book_id: string
          panels_pass?: boolean
          panels_total?: number
          preview_from?: number
          published_at?: string | null
          qc_verdict?: Json | null
          status?: string
          style?: string | null
          style_key?: string | null
          updated_at?: string
        }
        Update: {
          backend?: string | null
          book_v_level?: number | null
          created_at?: string
          created_by?: string | null
          feature_rank?: number | null
          library_book_id?: string
          panels_pass?: boolean
          panels_total?: number
          preview_from?: number
          published_at?: string | null
          qc_verdict?: Json | null
          status?: string
          style?: string | null
          style_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comic_books_library_book_id_fkey"
            columns: ["library_book_id"]
            isOneToOne: true
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comic_books_style_key_fkey"
            columns: ["style_key"]
            isOneToOne: false
            referencedRelation: "comic_styles"
            referencedColumns: ["key"]
          },
        ]
      }
      comic_gen_models: {
        Row: {
          char_consistency: string | null
          comic_fit: number | null
          cost_note: string | null
          cost_per_image_usd: number | null
          created_at: string
          hosting: string | null
          key: string
          license: string | null
          min_vram_gb: number | null
          multiref: boolean | null
          name: string
          provider: string | null
          run_envs: string[]
          site: string | null
          sort: number
          source_url: string | null
          status: string
          strengths: string | null
          style_consistency: string | null
          text_control: string | null
          updated_at: string
          vram_fit_4090: boolean | null
          weaknesses: string | null
        }
        Insert: {
          char_consistency?: string | null
          comic_fit?: number | null
          cost_note?: string | null
          cost_per_image_usd?: number | null
          created_at?: string
          hosting?: string | null
          key: string
          license?: string | null
          min_vram_gb?: number | null
          multiref?: boolean | null
          name: string
          provider?: string | null
          run_envs?: string[]
          site?: string | null
          sort?: number
          source_url?: string | null
          status?: string
          strengths?: string | null
          style_consistency?: string | null
          text_control?: string | null
          updated_at?: string
          vram_fit_4090?: boolean | null
          weaknesses?: string | null
        }
        Update: {
          char_consistency?: string | null
          comic_fit?: number | null
          cost_note?: string | null
          cost_per_image_usd?: number | null
          created_at?: string
          hosting?: string | null
          key?: string
          license?: string | null
          min_vram_gb?: number | null
          multiref?: boolean | null
          name?: string
          provider?: string | null
          run_envs?: string[]
          site?: string | null
          sort?: number
          source_url?: string | null
          status?: string
          strengths?: string | null
          style_consistency?: string | null
          text_control?: string | null
          updated_at?: string
          vram_fit_4090?: boolean | null
          weaknesses?: string | null
        }
        Relationships: []
      }
      comic_gen_runs: {
        Row: {
          backend: string | null
          cost_usd: number | null
          created_at: string
          created_by: string | null
          error: string | null
          finished_at: string | null
          id: string
          iterations: number
          library_book_id: string | null
          model: string | null
          note: string | null
          panels_done: number
          panels_fail: number
          panels_pass: number
          panels_total: number
          pd_issue_id: string | null
          rule_violations: number
          site: string | null
          started_at: string
          status: string
          style: string | null
          updated_at: string
          verbatim_mismatch: number
        }
        Insert: {
          backend?: string | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          iterations?: number
          library_book_id?: string | null
          model?: string | null
          note?: string | null
          panels_done?: number
          panels_fail?: number
          panels_pass?: number
          panels_total?: number
          pd_issue_id?: string | null
          rule_violations?: number
          site?: string | null
          started_at?: string
          status?: string
          style?: string | null
          updated_at?: string
          verbatim_mismatch?: number
        }
        Update: {
          backend?: string | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          iterations?: number
          library_book_id?: string | null
          model?: string | null
          note?: string | null
          panels_done?: number
          panels_fail?: number
          panels_pass?: number
          panels_total?: number
          pd_issue_id?: string | null
          rule_violations?: number
          site?: string | null
          started_at?: string
          status?: string
          style?: string | null
          updated_at?: string
          verbatim_mismatch?: number
        }
        Relationships: [
          {
            foreignKeyName: "comic_gen_runs_library_book_id_fkey"
            columns: ["library_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comic_gen_runs_pd_issue_id_fkey"
            columns: ["pd_issue_id"]
            isOneToOne: false
            referencedRelation: "pd_comic_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      comic_gen_tests: {
        Row: {
          backend: string | null
          cost_usd: number | null
          created_at: string
          created_by: string | null
          id: string
          label: string
          library_book_id: string | null
          model: string | null
          note: string | null
          params: Json | null
          result: Json | null
          sample: Json | null
          site: string | null
          status: string
          style: string | null
          updated_at: string
        }
        Insert: {
          backend?: string | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          library_book_id?: string | null
          model?: string | null
          note?: string | null
          params?: Json | null
          result?: Json | null
          sample?: Json | null
          site?: string | null
          status?: string
          style?: string | null
          updated_at?: string
        }
        Update: {
          backend?: string | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          library_book_id?: string | null
          model?: string | null
          note?: string | null
          params?: Json | null
          result?: Json | null
          sample?: Json | null
          site?: string | null
          status?: string
          style?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comic_gen_tests_library_book_id_fkey"
            columns: ["library_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      comic_pages: {
        Row: {
          book_v_level: number | null
          bubbles: Json
          chapter_idx: number
          created_at: string
          id: string
          image_url: string
          library_book_id: string
          page_order: number
          stave_label: string | null
          target_vocab: string[]
          updated_at: string
        }
        Insert: {
          book_v_level?: number | null
          bubbles?: Json
          chapter_idx: number
          created_at?: string
          id?: string
          image_url: string
          library_book_id: string
          page_order: number
          stave_label?: string | null
          target_vocab?: string[]
          updated_at?: string
        }
        Update: {
          book_v_level?: number | null
          bubbles?: Json
          chapter_idx?: number
          created_at?: string
          id?: string
          image_url?: string
          library_book_id?: string
          page_order?: number
          stave_label?: string | null
          target_vocab?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comic_pages_library_book_id_fkey"
            columns: ["library_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      comic_panel_events: {
        Row: {
          attempt: number
          backend: string | null
          chapter_idx: number | null
          created_at: string
          duration_ms: number | null
          id: string
          library_book_id: string
          message: string | null
          page_order: number | null
          phase: string | null
          run_id: string | null
          score: number | null
          status: string | null
          verdict: Json | null
        }
        Insert: {
          attempt?: number
          backend?: string | null
          chapter_idx?: number | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          library_book_id: string
          message?: string | null
          page_order?: number | null
          phase?: string | null
          run_id?: string | null
          score?: number | null
          status?: string | null
          verdict?: Json | null
        }
        Update: {
          attempt?: number
          backend?: string | null
          chapter_idx?: number | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          library_book_id?: string
          message?: string | null
          page_order?: number | null
          phase?: string | null
          run_id?: string | null
          score?: number | null
          status?: string | null
          verdict?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "comic_panel_events_library_book_id_fkey"
            columns: ["library_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comic_panel_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "comic_gen_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      comic_read_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          last_index: number
          library_book_id: string
          panels_total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          last_index?: number
          library_book_id: string
          panels_total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          last_index?: number
          library_book_id?: string
          panels_total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comic_read_progress_library_book_id_fkey"
            columns: ["library_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      comic_styles: {
        Row: {
          age_band: string | null
          art_prompt: string | null
          created_at: string
          difficulty_max: number | null
          difficulty_min: number | null
          format: string | null
          genre: string | null
          is_default: boolean
          key: string
          lettering: string | null
          name: string
          negative_prompt: string | null
          palette: string | null
          reference: string | null
          sort: number
          source_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          age_band?: string | null
          art_prompt?: string | null
          created_at?: string
          difficulty_max?: number | null
          difficulty_min?: number | null
          format?: string | null
          genre?: string | null
          is_default?: boolean
          key: string
          lettering?: string | null
          name: string
          negative_prompt?: string | null
          palette?: string | null
          reference?: string | null
          sort?: number
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          age_band?: string | null
          art_prompt?: string | null
          created_at?: string
          difficulty_max?: number | null
          difficulty_min?: number | null
          format?: string | null
          genre?: string | null
          is_default?: boolean
          key?: string
          lettering?: string | null
          name?: string
          negative_prompt?: string | null
          palette?: string | null
          reference?: string | null
          sort?: number
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_chunks: {
        Row: {
          byte_size: number
          content: string
          created_at: string
          hash: string
          ref_count: number
        }
        Insert: {
          byte_size: number
          content: string
          created_at?: string
          hash: string
          ref_count?: number
        }
        Update: {
          byte_size?: number
          content?: string
          created_at?: string
          hash?: string
          ref_count?: number
        }
        Relationships: []
      }
      csat_dcp_items: {
        Row: {
          answer_key: Json
          created_at: string
          id: string
          item_role: string
          kind: string
          paragraph_idx: number
          payload: Json
          ref_id: string
          type: string
          v_level: number | null
        }
        Insert: {
          answer_key: Json
          created_at?: string
          id?: string
          item_role?: string
          kind: string
          paragraph_idx: number
          payload: Json
          ref_id: string
          type: string
          v_level?: number | null
        }
        Update: {
          answer_key?: Json
          created_at?: string
          id?: string
          item_role?: string
          kind?: string
          paragraph_idx?: number
          payload?: Json
          ref_id?: string
          type?: string
          v_level?: number | null
        }
        Relationships: []
      }
      csat_item_attempts: {
        Row: {
          error_cause: string | null
          id: string
          is_correct: boolean
          item_role: string | null
          question_id: string | null
          responded_at: string
          text_id: string | null
          user_id: string
        }
        Insert: {
          error_cause?: string | null
          id?: string
          is_correct: boolean
          item_role?: string | null
          question_id?: string | null
          responded_at?: string
          text_id?: string | null
          user_id: string
        }
        Update: {
          error_cause?: string | null
          id?: string
          is_correct?: boolean
          item_role?: string | null
          question_id?: string | null
          responded_at?: string
          text_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "csat_item_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      csat_stage_gates: {
        Row: {
          is_locked: boolean
          metric: string
          note: string | null
          stage: string
          threshold: number
        }
        Insert: {
          is_locked?: boolean
          metric: string
          note?: string | null
          stage: string
          threshold: number
        }
        Update: {
          is_locked?: boolean
          metric?: string
          note?: string | null
          stage?: string
          threshold?: number
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
      dialect_map: {
        Row: {
          note: string | null
          standard: string
          variant: string
        }
        Insert: {
          note?: string | null
          standard: string
          variant: string
        }
        Update: {
          note?: string | null
          standard?: string
          variant?: string
        }
        Relationships: []
      }
      dictation_attempts: {
        Row: {
          accuracy: number
          created_at: string
          duration_ms: number | null
          error_tags: string[]
          expected: string
          hints_used: number
          id: string
          item_idx: number
          replay_count: number
          session_id: string
          skipped: boolean
          target_hits: string[]
          target_words: string[]
          user_id: string
          user_input: string
          word_results: Json
        }
        Insert: {
          accuracy?: number
          created_at?: string
          duration_ms?: number | null
          error_tags?: string[]
          expected: string
          hints_used?: number
          id?: string
          item_idx: number
          replay_count?: number
          session_id: string
          skipped?: boolean
          target_hits?: string[]
          target_words?: string[]
          user_id: string
          user_input?: string
          word_results?: Json
        }
        Update: {
          accuracy?: number
          created_at?: string
          duration_ms?: number | null
          error_tags?: string[]
          expected?: string
          hints_used?: number
          id?: string
          item_idx?: number
          replay_count?: number
          session_id?: string
          skipped?: boolean
          target_hits?: string[]
          target_words?: string[]
          user_id?: string
          user_input?: string
          word_results?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dictation_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "dictation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dictation_sessions: {
        Row: {
          avg_accuracy: number | null
          chapter_idx: number | null
          completed_at: string | null
          completed_items: number
          config: Json
          duration_ms: number | null
          id: string
          library_book_id: string | null
          longest_perfect_words: number | null
          shared_set_id: string | null
          source_kind: string
          started_at: string
          text_id: string | null
          title: string
          total_hints: number
          total_items: number
          user_id: string
        }
        Insert: {
          avg_accuracy?: number | null
          chapter_idx?: number | null
          completed_at?: string | null
          completed_items?: number
          config?: Json
          duration_ms?: number | null
          id?: string
          library_book_id?: string | null
          longest_perfect_words?: number | null
          shared_set_id?: string | null
          source_kind: string
          started_at?: string
          text_id?: string | null
          title: string
          total_hints?: number
          total_items?: number
          user_id: string
        }
        Update: {
          avg_accuracy?: number | null
          chapter_idx?: number | null
          completed_at?: string | null
          completed_items?: number
          config?: Json
          duration_ms?: number | null
          id?: string
          library_book_id?: string | null
          longest_perfect_words?: number | null
          shared_set_id?: string | null
          source_kind?: string
          started_at?: string
          text_id?: string | null
          title?: string
          total_hints?: number
          total_items?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dictation_sessions_library_book_id_fkey"
            columns: ["library_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dictation_sessions_shared_set_id_fkey"
            columns: ["shared_set_id"]
            isOneToOne: false
            referencedRelation: "shared_word_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dictation_sessions_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "texts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dictation_sessions_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "v_text_content"
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
      echo_match_attempts: {
        Row: {
          attempt_number: number
          created_at: string | null
          duration_ms: number | null
          energy_score: number | null
          id: string
          overall_score: number | null
          pitch_score: number | null
          sentence_id: string
          session_id: string
          timing_score: number | null
          user_id: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string | null
          duration_ms?: number | null
          energy_score?: number | null
          id?: string
          overall_score?: number | null
          pitch_score?: number | null
          sentence_id: string
          session_id: string
          timing_score?: number | null
          user_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string | null
          duration_ms?: number | null
          energy_score?: number | null
          id?: string
          overall_score?: number | null
          pitch_score?: number | null
          sentence_id?: string
          session_id?: string
          timing_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "echo_match_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "echo_match_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      echo_match_sessions: {
        Row: {
          avg_energy_score: number | null
          avg_overall_score: number | null
          avg_pitch_score: number | null
          avg_timing_score: number | null
          best_sentence_score: number | null
          completed_sentences: number | null
          ended_at: string | null
          id: string
          library_book_id: string | null
          retried_sentence_ids: string[] | null
          started_at: string | null
          text_id: string
          total_sentences: number | null
          user_id: string
          worst_sentence_score: number | null
        }
        Insert: {
          avg_energy_score?: number | null
          avg_overall_score?: number | null
          avg_pitch_score?: number | null
          avg_timing_score?: number | null
          best_sentence_score?: number | null
          completed_sentences?: number | null
          ended_at?: string | null
          id?: string
          library_book_id?: string | null
          retried_sentence_ids?: string[] | null
          started_at?: string | null
          text_id: string
          total_sentences?: number | null
          user_id: string
          worst_sentence_score?: number | null
        }
        Update: {
          avg_energy_score?: number | null
          avg_overall_score?: number | null
          avg_pitch_score?: number | null
          avg_timing_score?: number | null
          best_sentence_score?: number | null
          completed_sentences?: number | null
          ended_at?: string | null
          id?: string
          library_book_id?: string | null
          retried_sentence_ids?: string[] | null
          started_at?: string | null
          text_id?: string
          total_sentences?: number | null
          user_id?: string
          worst_sentence_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "echo_match_sessions_library_book_id_fkey"
            columns: ["library_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "echo_match_sessions_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "texts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "echo_match_sessions_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "v_text_content"
            referencedColumns: ["id"]
          },
        ]
      }
      english_irregular_forms: {
        Row: {
          base: string
          form: string
          note: string | null
          pos: string | null
        }
        Insert: {
          base: string
          form: string
          note?: string | null
          pos?: string | null
        }
        Update: {
          base?: string
          form?: string
          note?: string | null
          pos?: string | null
        }
        Relationships: []
      }
      extraction_judgments: {
        Row: {
          chapter_idx: number | null
          composite_at: number
          headword: string
          id: string
          in_cap: boolean
          judge_kind: string
          judged_at: string
          judged_by: string | null
          mode: string
          pair_wins: boolean | null
          pair_word: string | null
          sort_order_at: number
          source_id: string
          source_kind: string
          v_level_at: number | null
          verdict: string
          word: string
        }
        Insert: {
          chapter_idx?: number | null
          composite_at: number
          headword: string
          id?: string
          in_cap: boolean
          judge_kind?: string
          judged_at?: string
          judged_by?: string | null
          mode?: string
          pair_wins?: boolean | null
          pair_word?: string | null
          sort_order_at: number
          source_id: string
          source_kind: string
          v_level_at?: number | null
          verdict: string
          word: string
        }
        Update: {
          chapter_idx?: number | null
          composite_at?: number
          headword?: string
          id?: string
          in_cap?: boolean
          judge_kind?: string
          judged_at?: string
          judged_by?: string | null
          mode?: string
          pair_wins?: boolean | null
          pair_word?: string | null
          sort_order_at?: number
          source_id?: string
          source_kind?: string
          v_level_at?: number | null
          verdict?: string
          word?: string
        }
        Relationships: []
      }
      frequency_data_sources: {
        Row: {
          citation: string
          created_at: string | null
          id: number
          license: string
          source_key: string
          url: string | null
        }
        Insert: {
          citation: string
          created_at?: string | null
          id?: number
          license: string
          source_key: string
          url?: string | null
        }
        Update: {
          citation?: string
          created_at?: string | null
          id?: number
          license?: string
          source_key?: string
          url?: string | null
        }
        Relationships: []
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
            referencedRelation: "user_vocab_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_records_vocabulary_id_fkey"
            columns: ["vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabularies"
            referencedColumns: ["id"]
          },
        ]
      }
      lexicon_clean: {
        Row: {
          frequency_rank: number | null
          gloss_en: string | null
          gloss_source: string | null
          ipa: string | null
          is_valid_word: boolean
          ko_source: string | null
          lang: string
          meaning_ko: string | null
          pos: string | null
          updated_at: string
          word: string
        }
        Insert: {
          frequency_rank?: number | null
          gloss_en?: string | null
          gloss_source?: string | null
          ipa?: string | null
          is_valid_word?: boolean
          ko_source?: string | null
          lang?: string
          meaning_ko?: string | null
          pos?: string | null
          updated_at?: string
          word: string
        }
        Update: {
          frequency_rank?: number | null
          gloss_en?: string | null
          gloss_source?: string | null
          ipa?: string | null
          is_valid_word?: boolean
          ko_source?: string | null
          lang?: string
          meaning_ko?: string | null
          pos?: string | null
          updated_at?: string
          word?: string
        }
        Relationships: []
      }
      lexicon_frequencies: {
        Row: {
          appears_every_year: boolean | null
          computed_at: string | null
          frequency_tier: number | null
          id: number
          lemma: string
          metadata: Json | null
          normalized_freq: number | null
          rank_in_source: number | null
          raw_count: number | null
          source_id: number
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          appears_every_year?: boolean | null
          computed_at?: string | null
          frequency_tier?: number | null
          id?: number
          lemma: string
          metadata?: Json | null
          normalized_freq?: number | null
          rank_in_source?: number | null
          raw_count?: number | null
          source_id: number
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          appears_every_year?: boolean | null
          computed_at?: string | null
          frequency_tier?: number | null
          id?: number
          lemma?: string
          metadata?: Json | null
          normalized_freq?: number | null
          rank_in_source?: number | null
          raw_count?: number | null
          source_id?: number
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lexicon_frequencies_lemma_fkey"
            columns: ["lemma"]
            isOneToOne: false
            referencedRelation: "shared_dictionary"
            referencedColumns: ["word"]
          },
          {
            foreignKeyName: "lexicon_frequencies_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "frequency_data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      lexicon_source_tags: {
        Row: {
          added_at: string | null
          lexicon_id: string
          metadata: Json | null
          source: string
        }
        Insert: {
          added_at?: string | null
          lexicon_id: string
          metadata?: Json | null
          source: string
        }
        Update: {
          added_at?: string | null
          lexicon_id?: string
          metadata?: Json | null
          source?: string
        }
        Relationships: []
      }
      library_article_seed_catalog: {
        Row: {
          author: string | null
          created_at: string | null
          curation_meta: Json | null
          curation_status: string
          description: string | null
          feed_id: string | null
          feed_label: string | null
          fetched_at: string | null
          has_audio: boolean | null
          id: string
          imported_article_id: string | null
          imported_at: string | null
          imported_to_articles: boolean | null
          language: string | null
          published_at: string | null
          score_length: number | null
          score_level: number | null
          score_recency: number | null
          score_source: number | null
          score_total: number | null
          source: string
          source_id: string
          source_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          created_at?: string | null
          curation_meta?: Json | null
          curation_status?: string
          description?: string | null
          feed_id?: string | null
          feed_label?: string | null
          fetched_at?: string | null
          has_audio?: boolean | null
          id?: string
          imported_article_id?: string | null
          imported_at?: string | null
          imported_to_articles?: boolean | null
          language?: string | null
          published_at?: string | null
          score_length?: number | null
          score_level?: number | null
          score_recency?: number | null
          score_source?: number | null
          score_total?: number | null
          source: string
          source_id: string
          source_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          created_at?: string | null
          curation_meta?: Json | null
          curation_status?: string
          description?: string | null
          feed_id?: string | null
          feed_label?: string | null
          fetched_at?: string | null
          has_audio?: boolean | null
          id?: string
          imported_article_id?: string | null
          imported_at?: string | null
          imported_to_articles?: boolean | null
          language?: string | null
          published_at?: string | null
          score_length?: number | null
          score_level?: number | null
          score_recency?: number | null
          score_source?: number | null
          score_total?: number | null
          source?: string
          source_id?: string
          source_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_article_seed_catalog_imported_article_id_fkey"
            columns: ["imported_article_id"]
            isOneToOne: false
            referencedRelation: "library_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_article_vocabularies: {
        Row: {
          base_learning_value: number
          context_pos: string | null
          created_at: string
          first_sentence: string | null
          frequency_in_article: number
          id: string
          lemma: string | null
          library_article_id: string
          word: string
        }
        Insert: {
          base_learning_value?: number
          context_pos?: string | null
          created_at?: string
          first_sentence?: string | null
          frequency_in_article?: number
          id?: string
          lemma?: string | null
          library_article_id: string
          word: string
        }
        Update: {
          base_learning_value?: number
          context_pos?: string | null
          created_at?: string
          first_sentence?: string | null
          frequency_in_article?: number
          id?: string
          lemma?: string | null
          library_article_id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_article_vocabularies_lemma_fkey"
            columns: ["lemma"]
            isOneToOne: false
            referencedRelation: "shared_dictionary"
            referencedColumns: ["word"]
          },
          {
            foreignKeyName: "library_article_vocabularies_library_article_id_fkey"
            columns: ["library_article_id"]
            isOneToOne: false
            referencedRelation: "library_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_articles: {
        Row: {
          article_v_level: number | null
          audio_url: string | null
          author: string | null
          category_tags: string[] | null
          cefr_confidence: number | null
          cefr_level: string | null
          content: string
          content_hash: string | null
          copyright_safe_in_kr: boolean
          created_at: string
          display_only: boolean
          feed_id: string | null
          feed_label: string | null
          id: string
          language: string
          lexical_noise: number | null
          license: string
          license_class: string | null
          llm_cost_usd: number | null
          published_at: string | null
          reading_minutes: number | null
          register: string | null
          source: string
          source_fetched_at: string | null
          source_id: string
          source_url: string | null
          status: string
          status_message: string | null
          syntax_score: Json | null
          title: string
          updated_at: string
          vrl_calculated_at: string | null
          vrl_components: Json | null
          word_count: number | null
        }
        Insert: {
          article_v_level?: number | null
          audio_url?: string | null
          author?: string | null
          category_tags?: string[] | null
          cefr_confidence?: number | null
          cefr_level?: string | null
          content: string
          content_hash?: string | null
          copyright_safe_in_kr?: boolean
          created_at?: string
          display_only?: boolean
          feed_id?: string | null
          feed_label?: string | null
          id?: string
          language?: string
          lexical_noise?: number | null
          license: string
          license_class?: string | null
          llm_cost_usd?: number | null
          published_at?: string | null
          reading_minutes?: number | null
          register?: string | null
          source: string
          source_fetched_at?: string | null
          source_id: string
          source_url?: string | null
          status?: string
          status_message?: string | null
          syntax_score?: Json | null
          title: string
          updated_at?: string
          vrl_calculated_at?: string | null
          vrl_components?: Json | null
          word_count?: number | null
        }
        Update: {
          article_v_level?: number | null
          audio_url?: string | null
          author?: string | null
          category_tags?: string[] | null
          cefr_confidence?: number | null
          cefr_level?: string | null
          content?: string
          content_hash?: string | null
          copyright_safe_in_kr?: boolean
          created_at?: string
          display_only?: boolean
          feed_id?: string | null
          feed_label?: string | null
          id?: string
          language?: string
          lexical_noise?: number | null
          license?: string
          license_class?: string | null
          llm_cost_usd?: number | null
          published_at?: string | null
          reading_minutes?: number | null
          register?: string | null
          source?: string
          source_fetched_at?: string | null
          source_id?: string
          source_url?: string | null
          status?: string
          status_message?: string | null
          syntax_score?: Json | null
          title?: string
          updated_at?: string
          vrl_calculated_at?: string | null
          vrl_components?: Json | null
          word_count?: number | null
        }
        Relationships: []
      }
      library_book_vocabularies: {
        Row: {
          base_learning_value: number
          chapter_idx: number
          context_pos: string | null
          created_at: string
          first_sentence: string | null
          frequency_in_book: number
          frequency_in_chapter: number
          id: string
          lemma: string | null
          library_book_id: string
          noise_kind: string | null
          resolved_lang: string | null
          resolved_via: string | null
          resolved_word: string | null
          word: string
        }
        Insert: {
          base_learning_value?: number
          chapter_idx: number
          context_pos?: string | null
          created_at?: string
          first_sentence?: string | null
          frequency_in_book?: number
          frequency_in_chapter?: number
          id?: string
          lemma?: string | null
          library_book_id: string
          noise_kind?: string | null
          resolved_lang?: string | null
          resolved_via?: string | null
          resolved_word?: string | null
          word: string
        }
        Update: {
          base_learning_value?: number
          chapter_idx?: number
          context_pos?: string | null
          created_at?: string
          first_sentence?: string | null
          frequency_in_book?: number
          frequency_in_chapter?: number
          id?: string
          lemma?: string | null
          library_book_id?: string
          noise_kind?: string | null
          resolved_lang?: string | null
          resolved_via?: string | null
          resolved_word?: string | null
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_book_vocabularies_lemma_fkey"
            columns: ["lemma"]
            isOneToOne: false
            referencedRelation: "shared_dictionary"
            referencedColumns: ["word"]
          },
          {
            foreignKeyName: "library_book_vocabularies_library_book_id_fkey"
            columns: ["library_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_books: {
        Row: {
          audio_url: string | null
          author: string | null
          author_birth_year: number | null
          author_death_year: number | null
          book_v_level: number | null
          book_vrl_score: number | null
          category_tags: string[] | null
          cefr_band: string | null
          cefr_confidence: number | null
          cefr_level: string | null
          cefrj_confidence: number | null
          cefrj_level: string | null
          chapter_count: number | null
          copyright_safe_in_kr: boolean
          cover_from: string | null
          cover_image_url: string | null
          cover_to: string | null
          created_at: string
          curation_meta_status: string
          curation_metadata: Json | null
          flesch_kincaid_grade: number | null
          flesch_reading_ease: number | null
          id: string
          illustrations: Json | null
          is_picture_book: boolean | null
          language: string
          lexical_coverage: Json | null
          lexile_measure: number | null
          lexile_source: string | null
          librivox_audio: Json | null
          license: string
          llm_cost_usd: number | null
          original_publish_year: number | null
          published_at: string | null
          readability_computed_at: string | null
          reading_minutes: number | null
          recommended_order: number | null
          search_vector: unknown
          source: string
          source_fetched_at: string | null
          source_id: string | null
          source_url: string | null
          status: string
          status_message: string | null
          syntax_score: Json | null
          title: string
          updated_at: string
          v_level_centroid_precise: number | null
          vrl_calculated_at: string | null
          vrl_components: Json | null
          word_count: number | null
        }
        Insert: {
          audio_url?: string | null
          author?: string | null
          author_birth_year?: number | null
          author_death_year?: number | null
          book_v_level?: number | null
          book_vrl_score?: number | null
          category_tags?: string[] | null
          cefr_band?: string | null
          cefr_confidence?: number | null
          cefr_level?: string | null
          cefrj_confidence?: number | null
          cefrj_level?: string | null
          chapter_count?: number | null
          copyright_safe_in_kr?: boolean
          cover_from?: string | null
          cover_image_url?: string | null
          cover_to?: string | null
          created_at?: string
          curation_meta_status?: string
          curation_metadata?: Json | null
          flesch_kincaid_grade?: number | null
          flesch_reading_ease?: number | null
          id?: string
          illustrations?: Json | null
          is_picture_book?: boolean | null
          language?: string
          lexical_coverage?: Json | null
          lexile_measure?: number | null
          lexile_source?: string | null
          librivox_audio?: Json | null
          license: string
          llm_cost_usd?: number | null
          original_publish_year?: number | null
          published_at?: string | null
          readability_computed_at?: string | null
          reading_minutes?: number | null
          recommended_order?: number | null
          search_vector?: unknown
          source: string
          source_fetched_at?: string | null
          source_id?: string | null
          source_url?: string | null
          status?: string
          status_message?: string | null
          syntax_score?: Json | null
          title: string
          updated_at?: string
          v_level_centroid_precise?: number | null
          vrl_calculated_at?: string | null
          vrl_components?: Json | null
          word_count?: number | null
        }
        Update: {
          audio_url?: string | null
          author?: string | null
          author_birth_year?: number | null
          author_death_year?: number | null
          book_v_level?: number | null
          book_vrl_score?: number | null
          category_tags?: string[] | null
          cefr_band?: string | null
          cefr_confidence?: number | null
          cefr_level?: string | null
          cefrj_confidence?: number | null
          cefrj_level?: string | null
          chapter_count?: number | null
          copyright_safe_in_kr?: boolean
          cover_from?: string | null
          cover_image_url?: string | null
          cover_to?: string | null
          created_at?: string
          curation_meta_status?: string
          curation_metadata?: Json | null
          flesch_kincaid_grade?: number | null
          flesch_reading_ease?: number | null
          id?: string
          illustrations?: Json | null
          is_picture_book?: boolean | null
          language?: string
          lexical_coverage?: Json | null
          lexile_measure?: number | null
          lexile_source?: string | null
          librivox_audio?: Json | null
          license?: string
          llm_cost_usd?: number | null
          original_publish_year?: number | null
          published_at?: string | null
          readability_computed_at?: string | null
          reading_minutes?: number | null
          recommended_order?: number | null
          search_vector?: unknown
          source?: string
          source_fetched_at?: string | null
          source_id?: string | null
          source_url?: string | null
          status?: string
          status_message?: string | null
          syntax_score?: Json | null
          title?: string
          updated_at?: string
          v_level_centroid_precise?: number | null
          vrl_calculated_at?: string | null
          vrl_components?: Json | null
          word_count?: number | null
        }
        Relationships: []
      }
      library_chapter_quiz: {
        Row: {
          book_v_level: number | null
          chapter_idx: number
          correct_index: number
          created_at: string
          id: string
          library_book_id: string
          options: Json
          q_order: number
          question: string
          question_ko: string | null
          source_sentence_idx: number | null
          source_snippet: string | null
          type: string
          updated_at: string
        }
        Insert: {
          book_v_level?: number | null
          chapter_idx: number
          correct_index: number
          created_at?: string
          id?: string
          library_book_id: string
          options: Json
          q_order: number
          question: string
          question_ko?: string | null
          source_sentence_idx?: number | null
          source_snippet?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          book_v_level?: number | null
          chapter_idx?: number
          correct_index?: number
          created_at?: string
          id?: string
          library_book_id?: string
          options?: Json
          q_order?: number
          question?: string
          question_ko?: string | null
          source_sentence_idx?: number | null
          source_snippet?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_chapter_quiz_library_book_id_fkey"
            columns: ["library_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_chapters_master: {
        Row: {
          cefr_level: string | null
          chapter_idx: number
          chapter_title: string | null
          chapter_v_level: number | null
          content_hash: string
          created_at: string
          group_label: string | null
          id: string
          library_book_id: string
          paragraph_offsets: number[]
          sentence_offsets: number[]
          source_href: string | null
          word_count: number
        }
        Insert: {
          cefr_level?: string | null
          chapter_idx: number
          chapter_title?: string | null
          chapter_v_level?: number | null
          content_hash: string
          created_at?: string
          group_label?: string | null
          id?: string
          library_book_id: string
          paragraph_offsets?: number[]
          sentence_offsets?: number[]
          source_href?: string | null
          word_count: number
        }
        Update: {
          cefr_level?: string | null
          chapter_idx?: number
          chapter_title?: string | null
          chapter_v_level?: number | null
          content_hash?: string
          created_at?: string
          group_label?: string | null
          id?: string
          library_book_id?: string
          paragraph_offsets?: number[]
          sentence_offsets?: number[]
          source_href?: string | null
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_chapters_master_content_hash_fkey"
            columns: ["content_hash"]
            isOneToOne: false
            referencedRelation: "content_chunks"
            referencedColumns: ["hash"]
          },
          {
            foreignKeyName: "library_chapters_master_library_book_id_fkey"
            columns: ["library_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_seed_catalog: {
        Row: {
          author: string | null
          author_birth_year: number | null
          author_death_year: number | null
          cover_url: string | null
          curation_meta: Json | null
          curation_status: string
          dedup_key: string | null
          description: string | null
          enriched_at: string | null
          est_v_level: number | null
          fetched_at: string | null
          genre: string | null
          id: string
          imported_book_id: string | null
          imported_to_books: boolean | null
          language: string | null
          popularity_rank: number | null
          published_year: number | null
          reading_time_minutes: number | null
          source: string
          source_id: string
          source_url: string | null
          subjects: string[] | null
          title: string
          word_count: number | null
        }
        Insert: {
          author?: string | null
          author_birth_year?: number | null
          author_death_year?: number | null
          cover_url?: string | null
          curation_meta?: Json | null
          curation_status?: string
          dedup_key?: string | null
          description?: string | null
          enriched_at?: string | null
          est_v_level?: number | null
          fetched_at?: string | null
          genre?: string | null
          id?: string
          imported_book_id?: string | null
          imported_to_books?: boolean | null
          language?: string | null
          popularity_rank?: number | null
          published_year?: number | null
          reading_time_minutes?: number | null
          source: string
          source_id: string
          source_url?: string | null
          subjects?: string[] | null
          title: string
          word_count?: number | null
        }
        Update: {
          author?: string | null
          author_birth_year?: number | null
          author_death_year?: number | null
          cover_url?: string | null
          curation_meta?: Json | null
          curation_status?: string
          dedup_key?: string | null
          description?: string | null
          enriched_at?: string | null
          est_v_level?: number | null
          fetched_at?: string | null
          genre?: string | null
          id?: string
          imported_book_id?: string | null
          imported_to_books?: boolean | null
          language?: string | null
          popularity_rank?: number | null
          published_year?: number | null
          reading_time_minutes?: number | null
          source?: string
          source_id?: string
          source_url?: string | null
          subjects?: string[] | null
          title?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_seed_catalog_imported_book_id_fkey"
            columns: ["imported_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_source_catalogs: {
        Row: {
          api_endpoint: string | null
          catalog_size: number | null
          catalog_url: string | null
          cefrj_auto_assign_tier: string | null
          composite_score: number
          copyright_safe_in_kr: boolean
          created_at: string
          description: string | null
          display_name: string
          documentation_url: string | null
          id: string
          is_enabled: boolean
          is_implemented: boolean
          license_summary: string
          notes: string | null
          quality_api: number
          quality_learning: number
          quality_license: number
          quality_metadata: number
          quality_text: number
          quality_volume: number
          source: string
          updated_at: string
        }
        Insert: {
          api_endpoint?: string | null
          catalog_size?: number | null
          catalog_url?: string | null
          cefrj_auto_assign_tier?: string | null
          composite_score?: number
          copyright_safe_in_kr: boolean
          created_at?: string
          description?: string | null
          display_name: string
          documentation_url?: string | null
          id?: string
          is_enabled?: boolean
          is_implemented?: boolean
          license_summary: string
          notes?: string | null
          quality_api: number
          quality_learning: number
          quality_license: number
          quality_metadata: number
          quality_text: number
          quality_volume: number
          source: string
          updated_at?: string
        }
        Update: {
          api_endpoint?: string | null
          catalog_size?: number | null
          catalog_url?: string | null
          cefrj_auto_assign_tier?: string | null
          composite_score?: number
          copyright_safe_in_kr?: boolean
          created_at?: string
          description?: string | null
          display_name?: string
          documentation_url?: string | null
          id?: string
          is_enabled?: boolean
          is_implemented?: boolean
          license_summary?: string
          notes?: string | null
          quality_api?: number
          quality_learning?: number
          quality_license?: number
          quality_metadata?: number
          quality_text?: number
          quality_volume?: number
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      noise_blacklist: {
        Row: {
          category: string
          created_at: string | null
          form: string
          is_blocking: boolean
          note: string | null
          released_reason: string | null
          source: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          form: string
          is_blocking?: boolean
          note?: string | null
          released_reason?: string | null
          source?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          form?: string
          is_blocking?: boolean
          note?: string | null
          released_reason?: string | null
          source?: string | null
        }
        Relationships: []
      }
      pd_comic_issues: {
        Row: {
          acquire_pages: number | null
          attempts: number
          cover_url: string | null
          created_at: string
          id: string
          issue_no: number | null
          last_error: string | null
          last_run_at: string | null
          library_book_id: string | null
          modernize_env: string | null
          modernize_model: string | null
          modernize_track: string | null
          panels_total: number
          pd_basis: string | null
          pd_checked_at: string | null
          pd_checked_by: string | null
          pd_evidence_url: string | null
          published_at: string | null
          published_year: number | null
          qc: Json | null
          series_title: string | null
          slug: string
          source_adapter: string
          source_identifier: string
          source_url: string | null
          status: string
          title: string
          updated_at: string
          v_level: number | null
        }
        Insert: {
          acquire_pages?: number | null
          attempts?: number
          cover_url?: string | null
          created_at?: string
          id?: string
          issue_no?: number | null
          last_error?: string | null
          last_run_at?: string | null
          library_book_id?: string | null
          modernize_env?: string | null
          modernize_model?: string | null
          modernize_track?: string | null
          panels_total?: number
          pd_basis?: string | null
          pd_checked_at?: string | null
          pd_checked_by?: string | null
          pd_evidence_url?: string | null
          published_at?: string | null
          published_year?: number | null
          qc?: Json | null
          series_title?: string | null
          slug: string
          source_adapter: string
          source_identifier: string
          source_url?: string | null
          status?: string
          title: string
          updated_at?: string
          v_level?: number | null
        }
        Update: {
          acquire_pages?: number | null
          attempts?: number
          cover_url?: string | null
          created_at?: string
          id?: string
          issue_no?: number | null
          last_error?: string | null
          last_run_at?: string | null
          library_book_id?: string | null
          modernize_env?: string | null
          modernize_model?: string | null
          modernize_track?: string | null
          panels_total?: number
          pd_basis?: string | null
          pd_checked_at?: string | null
          pd_checked_by?: string | null
          pd_evidence_url?: string | null
          published_at?: string | null
          published_year?: number | null
          qc?: Json | null
          series_title?: string | null
          slug?: string
          source_adapter?: string
          source_identifier?: string
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          v_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pd_comic_issues_library_book_id_fkey"
            columns: ["library_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      pd_comic_panels: {
        Row: {
          bubbles: Json
          created_at: string
          id: string
          image_url: string
          issue_id: string
          panel_order: number
          restore_params: Json | null
          source_box: Json | null
          source_page_no: number
          target_vocab: string[]
          updated_at: string
        }
        Insert: {
          bubbles?: Json
          created_at?: string
          id?: string
          image_url: string
          issue_id: string
          panel_order: number
          restore_params?: Json | null
          source_box?: Json | null
          source_page_no: number
          target_vocab?: string[]
          updated_at?: string
        }
        Update: {
          bubbles?: Json
          created_at?: string
          id?: string
          image_url?: string
          issue_id?: string
          panel_order?: number
          restore_params?: Json | null
          source_box?: Json | null
          source_page_no?: number
          target_vocab?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pd_comic_panels_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "pd_comic_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_words: {
        Row: {
          admin_note: string | null
          context_snippet: string | null
          created_at: string | null
          encounter_count: number
          id: string
          lemma: string
          resolved_at: string | null
          status: string
          surface: string | null
          text_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          context_snippet?: string | null
          created_at?: string | null
          encounter_count?: number
          id?: string
          lemma: string
          resolved_at?: string | null
          status?: string
          surface?: string | null
          text_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          context_snippet?: string | null
          created_at?: string | null
          encounter_count?: number
          id?: string
          lemma?: string
          resolved_at?: string | null
          status?: string
          surface?: string | null
          text_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_words_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "texts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_words_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "v_text_content"
            referencedColumns: ["id"]
          },
        ]
      }
      proper_noun_forms: {
        Row: {
          book_count: number | null
          created_at: string
          evidence: string
          form: string
          occurrences: number | null
        }
        Insert: {
          book_count?: number | null
          created_at?: string
          evidence: string
          form: string
          occurrences?: number | null
        }
        Update: {
          book_count?: number | null
          created_at?: string
          evidence?: string
          form?: string
          occurrences?: number | null
        }
        Relationships: []
      }
      quality_metrics: {
        Row: {
          dims: Json
          id: number
          measured_at: string
          metric: string
          stage: string
          value: number
        }
        Insert: {
          dims?: Json
          id?: never
          measured_at?: string
          metric: string
          stage: string
          value: number
        }
        Update: {
          dims?: Json
          id?: never
          measured_at?: string
          metric?: string
          stage?: string
          value?: number
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          correct_index: number
          created_at: string | null
          id: string
          item_role: string | null
          options: Json
          question: string
          question_ko: string | null
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
          item_role?: string | null
          options: Json
          question: string
          question_ko?: string | null
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
          item_role?: string | null
          options?: Json
          question?: string
          question_ko?: string | null
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
          {
            foreignKeyName: "quiz_questions_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "v_text_content"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_fluency_log: {
        Row: {
          comprehension_ok: boolean | null
          created_at: string
          ended_at: string | null
          id: string
          is_rereading: boolean
          kind: string
          ref_id: string
          started_at: string
          user_id: string
          word_count: number | null
        }
        Insert: {
          comprehension_ok?: boolean | null
          created_at?: string
          ended_at?: string | null
          id?: string
          is_rereading?: boolean
          kind: string
          ref_id: string
          started_at?: string
          user_id: string
          word_count?: number | null
        }
        Update: {
          comprehension_ok?: boolean | null
          created_at?: string
          ended_at?: string | null
          id?: string
          is_rereading?: boolean
          kind?: string
          ref_id?: string
          started_at?: string
          user_id?: string
          word_count?: number | null
        }
        Relationships: []
      }
      reading_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          end_paragraph_idx: number
          estimated_minutes: number | null
          id: string
          session_idx: number
          start_paragraph_idx: number
          started_at: string | null
          status: string
          text_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          end_paragraph_idx: number
          estimated_minutes?: number | null
          id?: string
          session_idx: number
          start_paragraph_idx: number
          started_at?: string | null
          status?: string
          text_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          end_paragraph_idx?: number
          estimated_minutes?: number | null
          id?: string
          session_idx?: number
          start_paragraph_idx?: number
          started_at?: string | null
          status?: string
          text_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_sessions_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "texts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_sessions_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "v_text_content"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          accuracy: number | null
          content_chapter: number | null
          content_id: string | null
          content_type: string | null
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
          content_chapter?: number | null
          content_id?: string | null
          content_type?: string | null
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
          content_chapter?: number | null
          content_id?: string | null
          content_type?: string | null
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
          {
            foreignKeyName: "scores_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "v_text_content"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_dictionary: {
        Row: {
          antonyms: string[] | null
          audio_url: string | null
          audio_url_uk: string | null
          audio_url_us: string | null
          base_word: string | null
          cefr_confidence: number | null
          cefr_level: string | null
          cefrj_domain_tags: string[] | null
          cefrj_wordlist_band: string | null
          classified_by: string | null
          claude_classified_at: string | null
          claude_reasoning: string | null
          collocations: string[] | null
          created_at: string | null
          derivation_suffix: string | null
          derived_forms: string[] | null
          domain_levels: Json | null
          domain_levels_rule_v1: Json | null
          example_en: string | null
          field_provenance: Json
          frequency_band: string | null
          frequency_rank: number | null
          frequency_sources: Json | null
          homophones: string[] | null
          image_url: string | null
          inflected_forms: string[] | null
          inflections: Json | null
          ipa: string | null
          ipa_uk: string | null
          ipa_us: string | null
          korean_learner_note: string | null
          last_quality_audit_at: string | null
          lemma_band: string | null
          list_tags: string[]
          meaning_ko: string | null
          meanings_ko: Json | null
          mnemonic_ko: string | null
          ngsl_sfi: number | null
          pos: string
          pos_set: string[]
          primary_pos: string | null
          register: string | null
          related_terms: string[] | null
          rhyme_key: string | null
          senses: Json
          skill_level: number | null
          skill_level_rule_v1: number | null
          skill_type: string | null
          source: string
          spelling_variants: string[] | null
          synonyms: string[] | null
          track_levels: Json | null
          track_levels_rule_v1: Json | null
          updated_at: string | null
          v_level: number | null
          v_level_rule_v1: number | null
          verified: boolean | null
          vrl_calculated_at: string | null
          word: string
          word_register: string | null
        }
        Insert: {
          antonyms?: string[] | null
          audio_url?: string | null
          audio_url_uk?: string | null
          audio_url_us?: string | null
          base_word?: string | null
          cefr_confidence?: number | null
          cefr_level?: string | null
          cefrj_domain_tags?: string[] | null
          cefrj_wordlist_band?: string | null
          classified_by?: string | null
          claude_classified_at?: string | null
          claude_reasoning?: string | null
          collocations?: string[] | null
          created_at?: string | null
          derivation_suffix?: string | null
          derived_forms?: string[] | null
          domain_levels?: Json | null
          domain_levels_rule_v1?: Json | null
          example_en?: string | null
          field_provenance?: Json
          frequency_band?: string | null
          frequency_rank?: number | null
          frequency_sources?: Json | null
          homophones?: string[] | null
          image_url?: string | null
          inflected_forms?: string[] | null
          inflections?: Json | null
          ipa?: string | null
          ipa_uk?: string | null
          ipa_us?: string | null
          korean_learner_note?: string | null
          last_quality_audit_at?: string | null
          lemma_band?: string | null
          list_tags?: string[]
          meaning_ko?: string | null
          meanings_ko?: Json | null
          mnemonic_ko?: string | null
          ngsl_sfi?: number | null
          pos: string
          pos_set?: string[]
          primary_pos?: string | null
          register?: string | null
          related_terms?: string[] | null
          rhyme_key?: string | null
          senses?: Json
          skill_level?: number | null
          skill_level_rule_v1?: number | null
          skill_type?: string | null
          source?: string
          spelling_variants?: string[] | null
          synonyms?: string[] | null
          track_levels?: Json | null
          track_levels_rule_v1?: Json | null
          updated_at?: string | null
          v_level?: number | null
          v_level_rule_v1?: number | null
          verified?: boolean | null
          vrl_calculated_at?: string | null
          word: string
          word_register?: string | null
        }
        Update: {
          antonyms?: string[] | null
          audio_url?: string | null
          audio_url_uk?: string | null
          audio_url_us?: string | null
          base_word?: string | null
          cefr_confidence?: number | null
          cefr_level?: string | null
          cefrj_domain_tags?: string[] | null
          cefrj_wordlist_band?: string | null
          classified_by?: string | null
          claude_classified_at?: string | null
          claude_reasoning?: string | null
          collocations?: string[] | null
          created_at?: string | null
          derivation_suffix?: string | null
          derived_forms?: string[] | null
          domain_levels?: Json | null
          domain_levels_rule_v1?: Json | null
          example_en?: string | null
          field_provenance?: Json
          frequency_band?: string | null
          frequency_rank?: number | null
          frequency_sources?: Json | null
          homophones?: string[] | null
          image_url?: string | null
          inflected_forms?: string[] | null
          inflections?: Json | null
          ipa?: string | null
          ipa_uk?: string | null
          ipa_us?: string | null
          korean_learner_note?: string | null
          last_quality_audit_at?: string | null
          lemma_band?: string | null
          list_tags?: string[]
          meaning_ko?: string | null
          meanings_ko?: Json | null
          mnemonic_ko?: string | null
          ngsl_sfi?: number | null
          pos?: string
          pos_set?: string[]
          primary_pos?: string | null
          register?: string | null
          related_terms?: string[] | null
          rhyme_key?: string | null
          senses?: Json
          skill_level?: number | null
          skill_level_rule_v1?: number | null
          skill_type?: string | null
          source?: string
          spelling_variants?: string[] | null
          synonyms?: string[] | null
          track_levels?: Json | null
          track_levels_rule_v1?: Json | null
          updated_at?: string | null
          v_level?: number | null
          v_level_rule_v1?: number | null
          verified?: boolean | null
          vrl_calculated_at?: string | null
          word?: string
          word_register?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_dictionary_base_word_fkey"
            columns: ["base_word"]
            isOneToOne: false
            referencedRelation: "shared_dictionary"
            referencedColumns: ["word"]
          },
        ]
      }
      shared_word_sets: {
        Row: {
          auto_curated: boolean
          category: string
          cefr_level: string | null
          cover_emoji: string | null
          created_at: string | null
          curation_query: Json | null
          description: string | null
          id: string
          is_published: boolean | null
          parent_version_id: string | null
          regenerated_at: string | null
          slug: string
          sort_order: number | null
          source_attributions: Json | null
          source_run_id: number | null
          subcategory: string | null
          subscriber_count: number
          title: string
          version: number
          word_count: number | null
        }
        Insert: {
          auto_curated?: boolean
          category: string
          cefr_level?: string | null
          cover_emoji?: string | null
          created_at?: string | null
          curation_query?: Json | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          parent_version_id?: string | null
          regenerated_at?: string | null
          slug: string
          sort_order?: number | null
          source_attributions?: Json | null
          source_run_id?: number | null
          subcategory?: string | null
          subscriber_count?: number
          title: string
          version?: number
          word_count?: number | null
        }
        Update: {
          auto_curated?: boolean
          category?: string
          cefr_level?: string | null
          cover_emoji?: string | null
          created_at?: string | null
          curation_query?: Json | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          parent_version_id?: string | null
          regenerated_at?: string | null
          slug?: string
          sort_order?: number | null
          source_attributions?: Json | null
          source_run_id?: number | null
          subcategory?: string | null
          subscriber_count?: number
          title?: string
          version?: number
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_word_sets_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "shared_word_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_word_sets_source_run_id_fkey"
            columns: ["source_run_id"]
            isOneToOne: false
            referencedRelation: "vocab_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_words: {
        Row: {
          antonyms: string[] | null
          cefr_level: string | null
          chapter: number | null
          collocations: string[] | null
          confidence: number | null
          created_at: string | null
          definitions_en_full: Json | null
          definitions_ko_full: Json | null
          example_en: string | null
          examples_full: Json | null
          id: string
          ipa: string | null
          korean_learner_note: string | null
          lemma: string | null
          lexicon_id: string | null
          library_book_vocabulary_id: string | null
          meaning_ko: string
          part_of_speech: string | null
          pronunciation: string | null
          set_id: string
          sort_order: number | null
          source_queue_id: number | null
          source_run_id: number | null
          source_sentence: string | null
          synonyms: string[] | null
          v_level: number | null
          word: string
        }
        Insert: {
          antonyms?: string[] | null
          cefr_level?: string | null
          chapter?: number | null
          collocations?: string[] | null
          confidence?: number | null
          created_at?: string | null
          definitions_en_full?: Json | null
          definitions_ko_full?: Json | null
          example_en?: string | null
          examples_full?: Json | null
          id?: string
          ipa?: string | null
          korean_learner_note?: string | null
          lemma?: string | null
          lexicon_id?: string | null
          library_book_vocabulary_id?: string | null
          meaning_ko: string
          part_of_speech?: string | null
          pronunciation?: string | null
          set_id: string
          sort_order?: number | null
          source_queue_id?: number | null
          source_run_id?: number | null
          source_sentence?: string | null
          synonyms?: string[] | null
          v_level?: number | null
          word: string
        }
        Update: {
          antonyms?: string[] | null
          cefr_level?: string | null
          chapter?: number | null
          collocations?: string[] | null
          confidence?: number | null
          created_at?: string | null
          definitions_en_full?: Json | null
          definitions_ko_full?: Json | null
          example_en?: string | null
          examples_full?: Json | null
          id?: string
          ipa?: string | null
          korean_learner_note?: string | null
          lemma?: string | null
          lexicon_id?: string | null
          library_book_vocabulary_id?: string | null
          meaning_ko?: string
          part_of_speech?: string | null
          pronunciation?: string | null
          set_id?: string
          sort_order?: number | null
          source_queue_id?: number | null
          source_run_id?: number | null
          source_sentence?: string | null
          synonyms?: string[] | null
          v_level?: number | null
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_words_lemma_fkey"
            columns: ["lemma"]
            isOneToOne: false
            referencedRelation: "shared_dictionary"
            referencedColumns: ["word"]
          },
          {
            foreignKeyName: "shared_words_library_book_vocabulary_id_fkey"
            columns: ["library_book_vocabulary_id"]
            isOneToOne: false
            referencedRelation: "library_book_vocabularies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_words_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "shared_word_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_words_source_queue_id_fkey"
            columns: ["source_queue_id"]
            isOneToOne: false
            referencedRelation: "vocab_enrichment_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_words_source_run_id_fkey"
            columns: ["source_run_id"]
            isOneToOne: false
            referencedRelation: "vocab_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      spelling_norm: {
        Row: {
          source: string | null
          standard: string
          variant: string
        }
        Insert: {
          source?: string | null
          standard: string
          variant: string
        }
        Update: {
          source?: string | null
          standard?: string
          variant?: string
        }
        Relationships: []
      }
      st17_timetables: {
        Row: {
          created_at: string
          id: string
          name: string
          sel: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sel?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sel?: Json
          updated_at?: string
        }
        Relationships: []
      }
      study_plan_items: {
        Row: {
          chapters: number[]
          created_at: string
          id: string
          material_id: string
          material_type: string
          modules: string[]
          updated_at: string
          user_id: string
          weekdays: number[]
        }
        Insert: {
          chapters?: number[]
          created_at?: string
          id?: string
          material_id: string
          material_type: string
          modules?: string[]
          updated_at?: string
          user_id: string
          weekdays?: number[]
        }
        Update: {
          chapters?: number[]
          created_at?: string
          id?: string
          material_id?: string
          material_type?: string
          modules?: string[]
          updated_at?: string
          user_id?: string
          weekdays?: number[]
        }
        Relationships: []
      }
      sw_comments: {
        Row: {
          created_at: string | null
          id: number
          nick: string
          txt: string
        }
        Insert: {
          created_at?: string | null
          id?: never
          nick?: string
          txt: string
        }
        Update: {
          created_at?: string | null
          id?: never
          nick?: string
          txt?: string
        }
        Relationships: []
      }
      sw_players: {
        Row: {
          nick: string
          pass_hash: string
          save: Json
          updated_at: string | null
        }
        Insert: {
          nick: string
          pass_hash: string
          save?: Json
          updated_at?: string | null
        }
        Update: {
          nick?: string
          pass_hash?: string
          save?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      texts: {
        Row: {
          author: string | null
          cefr_level: string | null
          chapter_idx: number | null
          chapter_title: string | null
          content: string | null
          cover_from: string | null
          cover_to: string | null
          created_at: string | null
          current_paragraph_idx: number | null
          id: string
          is_bookmarked: boolean | null
          last_opened: string | null
          library_book_id: string | null
          progress_percent: number | null
          source: Database["public"]["Enums"]["text_source"] | null
          source_file_path: string | null
          source_url: string | null
          status: string | null
          text_v_level: number | null
          text_vrl_score: number | null
          title: string
          translation: string | null
          updated_at: string | null
          user_book_group_id: string | null
          user_id: string
          vrl_calculated_at: string | null
          vrl_components: Json | null
        }
        Insert: {
          author?: string | null
          cefr_level?: string | null
          chapter_idx?: number | null
          chapter_title?: string | null
          content?: string | null
          cover_from?: string | null
          cover_to?: string | null
          created_at?: string | null
          current_paragraph_idx?: number | null
          id?: string
          is_bookmarked?: boolean | null
          last_opened?: string | null
          library_book_id?: string | null
          progress_percent?: number | null
          source?: Database["public"]["Enums"]["text_source"] | null
          source_file_path?: string | null
          source_url?: string | null
          status?: string | null
          text_v_level?: number | null
          text_vrl_score?: number | null
          title: string
          translation?: string | null
          updated_at?: string | null
          user_book_group_id?: string | null
          user_id: string
          vrl_calculated_at?: string | null
          vrl_components?: Json | null
        }
        Update: {
          author?: string | null
          cefr_level?: string | null
          chapter_idx?: number | null
          chapter_title?: string | null
          content?: string | null
          cover_from?: string | null
          cover_to?: string | null
          created_at?: string | null
          current_paragraph_idx?: number | null
          id?: string
          is_bookmarked?: boolean | null
          last_opened?: string | null
          library_book_id?: string | null
          progress_percent?: number | null
          source?: Database["public"]["Enums"]["text_source"] | null
          source_file_path?: string | null
          source_url?: string | null
          status?: string | null
          text_v_level?: number | null
          text_vrl_score?: number | null
          title?: string
          translation?: string | null
          updated_at?: string | null
          user_book_group_id?: string | null
          user_id?: string
          vrl_calculated_at?: string | null
          vrl_components?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "texts_library_book_id_fkey"
            columns: ["library_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      user_diagnostic_results: {
        Row: {
          confidence: number | null
          estimated_domain_levels: Json | null
          estimated_skill_levels: Json | null
          estimated_track_levels: Json | null
          estimated_v_level: number | null
          id: string
          responses: Json
          taken_at: string | null
          test_id: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          estimated_domain_levels?: Json | null
          estimated_skill_levels?: Json | null
          estimated_track_levels?: Json | null
          estimated_v_level?: number | null
          id?: string
          responses: Json
          taken_at?: string | null
          test_id: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          estimated_domain_levels?: Json | null
          estimated_skill_levels?: Json | null
          estimated_track_levels?: Json | null
          estimated_v_level?: number | null
          id?: string
          responses?: Json
          taken_at?: string | null
          test_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_diagnostic_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "vrl_diagnostic_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_level_snapshots: {
        Row: {
          cefr_level: string | null
          diagnostic_result_id: string | null
          domain_levels: Json | null
          id: string
          learning_activity_score: number | null
          learning_goal: string | null
          previous_snapshot_id: string | null
          previous_v_level: number | null
          segment: string | null
          skill_levels: Json | null
          snapshot_meta: Json
          snapshot_type: string
          taken_at: string
          taken_reason: string
          target_v_level: number | null
          target_v_level_meta: Json | null
          total_words_mastered: number | null
          total_words_seen: number | null
          track_levels: Json | null
          trigger_details: Json
          triggered_by: string
          user_id: string
          v_level: number
          v_level_delta: number | null
          v_level_meta: Json
        }
        Insert: {
          cefr_level?: string | null
          diagnostic_result_id?: string | null
          domain_levels?: Json | null
          id?: string
          learning_activity_score?: number | null
          learning_goal?: string | null
          previous_snapshot_id?: string | null
          previous_v_level?: number | null
          segment?: string | null
          skill_levels?: Json | null
          snapshot_meta?: Json
          snapshot_type: string
          taken_at?: string
          taken_reason: string
          target_v_level?: number | null
          target_v_level_meta?: Json | null
          total_words_mastered?: number | null
          total_words_seen?: number | null
          track_levels?: Json | null
          trigger_details?: Json
          triggered_by: string
          user_id: string
          v_level: number
          v_level_delta?: number | null
          v_level_meta: Json
        }
        Update: {
          cefr_level?: string | null
          diagnostic_result_id?: string | null
          domain_levels?: Json | null
          id?: string
          learning_activity_score?: number | null
          learning_goal?: string | null
          previous_snapshot_id?: string | null
          previous_v_level?: number | null
          segment?: string | null
          skill_levels?: Json | null
          snapshot_meta?: Json
          snapshot_type?: string
          taken_at?: string
          taken_reason?: string
          target_v_level?: number | null
          target_v_level_meta?: Json | null
          total_words_mastered?: number | null
          total_words_seen?: number | null
          track_levels?: Json | null
          trigger_details?: Json
          triggered_by?: string
          user_id?: string
          v_level?: number
          v_level_delta?: number | null
          v_level_meta?: Json
        }
        Relationships: [
          {
            foreignKeyName: "user_level_snapshots_diagnostic_result_id_fkey"
            columns: ["diagnostic_result_id"]
            isOneToOne: false
            referencedRelation: "user_diagnostic_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_level_snapshots_previous_snapshot_id_fkey"
            columns: ["previous_snapshot_id"]
            isOneToOne: false
            referencedRelation: "user_level_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_level_snapshots_target_v_level_fkey"
            columns: ["target_v_level"]
            isOneToOne: false
            referencedRelation: "vocaflow_levels"
            referencedColumns: ["level"]
          },
          {
            foreignKeyName: "user_level_snapshots_v_level_fkey"
            columns: ["v_level"]
            isOneToOne: false
            referencedRelation: "vocaflow_levels"
            referencedColumns: ["level"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          cefr_level: string | null
          created_at: string | null
          current_domain_levels: Json | null
          current_skill_levels: Json | null
          current_track_levels: Json | null
          current_v_level: number | null
          current_v_level_meta: Json | null
          daily_word_goal: number | null
          diagnostic_completed_at: string | null
          display_name: string | null
          last_active_at: string | null
          learning_activity_score: number | null
          learning_goal: string | null
          locale: string | null
          next_level_review_due_at: string | null
          notify_email: boolean | null
          notify_push: boolean | null
          notify_streak_risk: boolean | null
          role: string
          segment: string
          status: string
          target_track_levels: Json | null
          target_v_level: number | null
          target_v_level_meta: Json | null
          theme: string | null
          total_words_mastered: number | null
          total_words_seen: number | null
          tts_speed: number | null
          tts_voice: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cefr_level?: string | null
          created_at?: string | null
          current_domain_levels?: Json | null
          current_skill_levels?: Json | null
          current_track_levels?: Json | null
          current_v_level?: number | null
          current_v_level_meta?: Json | null
          daily_word_goal?: number | null
          diagnostic_completed_at?: string | null
          display_name?: string | null
          last_active_at?: string | null
          learning_activity_score?: number | null
          learning_goal?: string | null
          locale?: string | null
          next_level_review_due_at?: string | null
          notify_email?: boolean | null
          notify_push?: boolean | null
          notify_streak_risk?: boolean | null
          role?: string
          segment?: string
          status?: string
          target_track_levels?: Json | null
          target_v_level?: number | null
          target_v_level_meta?: Json | null
          theme?: string | null
          total_words_mastered?: number | null
          total_words_seen?: number | null
          tts_speed?: number | null
          tts_voice?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cefr_level?: string | null
          created_at?: string | null
          current_domain_levels?: Json | null
          current_skill_levels?: Json | null
          current_track_levels?: Json | null
          current_v_level?: number | null
          current_v_level_meta?: Json | null
          daily_word_goal?: number | null
          diagnostic_completed_at?: string | null
          display_name?: string | null
          last_active_at?: string | null
          learning_activity_score?: number | null
          learning_goal?: string | null
          locale?: string | null
          next_level_review_due_at?: string | null
          notify_email?: boolean | null
          notify_push?: boolean | null
          notify_streak_risk?: boolean | null
          role?: string
          segment?: string
          status?: string
          target_track_levels?: Json | null
          target_v_level?: number | null
          target_v_level_meta?: Json | null
          theme?: string | null
          total_words_mastered?: number | null
          total_words_seen?: number | null
          tts_speed?: number | null
          tts_voice?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_current_v_level_fk"
            columns: ["current_v_level"]
            isOneToOne: false
            referencedRelation: "vocaflow_levels"
            referencedColumns: ["level"]
          },
          {
            foreignKeyName: "user_profiles_target_v_level_fk"
            columns: ["target_v_level"]
            isOneToOne: false
            referencedRelation: "vocaflow_levels"
            referencedColumns: ["level"]
          },
        ]
      }
      user_stats: {
        Row: {
          current_streak: number | null
          fsrs_target_retention: number | null
          known_word_count: number
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
          known_word_count?: number
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
          known_word_count?: number
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
          source_book_id: string | null
          subscribed_at: string | null
          subscription_source: string | null
          user_id: string
        }
        Insert: {
          set_id: string
          source_book_id?: string | null
          subscribed_at?: string | null
          subscription_source?: string | null
          user_id: string
        }
        Update: {
          set_id?: string
          source_book_id?: string | null
          subscribed_at?: string | null
          subscription_source?: string | null
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
          {
            foreignKeyName: "user_word_set_subscriptions_source_book_id_fkey"
            columns: ["source_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      vocab_collections: {
        Row: {
          id: number
          notes: string | null
          published_at: string | null
          published_word_count: number
          run_id: number
          shared_word_set_id: string | null
          slug: string
          title: string
          version: number
        }
        Insert: {
          id?: number
          notes?: string | null
          published_at?: string | null
          published_word_count: number
          run_id: number
          shared_word_set_id?: string | null
          slug: string
          title: string
          version?: number
        }
        Update: {
          id?: number
          notes?: string | null
          published_at?: string | null
          published_word_count?: number
          run_id?: number
          shared_word_set_id?: string | null
          slug?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "vocab_collections_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "vocab_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vocab_collections_shared_word_set_id_fkey"
            columns: ["shared_word_set_id"]
            isOneToOne: false
            referencedRelation: "shared_word_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      vocab_curation_decisions: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          decision: string
          edited_payload: Json | null
          id: number
          note: string | null
          queue_id: number
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          decision: string
          edited_payload?: Json | null
          id?: number
          note?: string | null
          queue_id: number
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          edited_payload?: Json | null
          id?: number
          note?: string | null
          queue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "vocab_curation_decisions_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "vocab_enrichment_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      vocab_dict_hits: {
        Row: {
          checked_at: string | null
          existing_payload: Json | null
          hit_level: string
          id: number
          lemma_normalized: string | null
          missing_fields: string[] | null
          seed_id: number
          source_table: string | null
        }
        Insert: {
          checked_at?: string | null
          existing_payload?: Json | null
          hit_level: string
          id?: number
          lemma_normalized?: string | null
          missing_fields?: string[] | null
          seed_id: number
          source_table?: string | null
        }
        Update: {
          checked_at?: string | null
          existing_payload?: Json | null
          hit_level?: string
          id?: number
          lemma_normalized?: string | null
          missing_fields?: string[] | null
          seed_id?: number
          source_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vocab_dict_hits_seed_id_fkey"
            columns: ["seed_id"]
            isOneToOne: true
            referencedRelation: "vocab_seed_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      vocab_enrichment_queue: {
        Row: {
          created_at: string | null
          enriched_at: string | null
          enriched_job_file: string | null
          enriched_payload: Json | null
          exported_at: string | null
          exported_job_file: string | null
          hit_level: string | null
          id: number
          last_error: string | null
          lemma_normalized: string | null
          missing_fields: string[] | null
          qa_flags: string[] | null
          retry_count: number | null
          seed_id: number
          status: Database["public"]["Enums"]["vcb_queue_status"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enriched_at?: string | null
          enriched_job_file?: string | null
          enriched_payload?: Json | null
          exported_at?: string | null
          exported_job_file?: string | null
          hit_level?: string | null
          id?: number
          last_error?: string | null
          lemma_normalized?: string | null
          missing_fields?: string[] | null
          qa_flags?: string[] | null
          retry_count?: number | null
          seed_id: number
          status?: Database["public"]["Enums"]["vcb_queue_status"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enriched_at?: string | null
          enriched_job_file?: string | null
          enriched_payload?: Json | null
          exported_at?: string | null
          exported_job_file?: string | null
          hit_level?: string | null
          id?: number
          last_error?: string | null
          lemma_normalized?: string | null
          missing_fields?: string[] | null
          qa_flags?: string[] | null
          retry_count?: number | null
          seed_id?: number
          status?: Database["public"]["Enums"]["vcb_queue_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vocab_enrichment_queue_seed_id_fkey"
            columns: ["seed_id"]
            isOneToOne: true
            referencedRelation: "vocab_seed_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      vocab_raw_texts: {
        Row: {
          content_bytes: number | null
          content_hash: string
          created_at: string | null
          external_ref: string | null
          id: number
          run_id: number
          source_id: number | null
        }
        Insert: {
          content_bytes?: number | null
          content_hash: string
          created_at?: string | null
          external_ref?: string | null
          id?: number
          run_id: number
          source_id?: number | null
        }
        Update: {
          content_bytes?: number | null
          content_hash?: string
          created_at?: string | null
          external_ref?: string | null
          id?: number
          run_id?: number
          source_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vocab_raw_texts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "vocab_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vocab_raw_texts_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "vocab_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      vocab_runs: {
        Row: {
          collection_slug: string
          collection_title: string
          config: Json
          created_at: string | null
          created_by: string | null
          id: number
          status: Database["public"]["Enums"]["vcb_run_status"]
          updated_at: string | null
        }
        Insert: {
          collection_slug: string
          collection_title: string
          config?: Json
          created_at?: string | null
          created_by?: string | null
          id?: number
          status?: Database["public"]["Enums"]["vcb_run_status"]
          updated_at?: string | null
        }
        Update: {
          collection_slug?: string
          collection_title?: string
          config?: Json
          created_at?: string | null
          created_by?: string | null
          id?: number
          status?: Database["public"]["Enums"]["vcb_run_status"]
          updated_at?: string | null
        }
        Relationships: []
      }
      vocab_seed_candidates: {
        Row: {
          context_samples: string[] | null
          created_at: string | null
          id: number
          lemma: string
          lemma_normalized: string | null
          normalized_freq: number | null
          pos: string
          rank_in_run: number | null
          raw_count: number
          run_id: number
          seed_origin: string
        }
        Insert: {
          context_samples?: string[] | null
          created_at?: string | null
          id?: number
          lemma: string
          lemma_normalized?: string | null
          normalized_freq?: number | null
          pos: string
          rank_in_run?: number | null
          raw_count: number
          run_id: number
          seed_origin?: string
        }
        Update: {
          context_samples?: string[] | null
          created_at?: string | null
          id?: number
          lemma?: string
          lemma_normalized?: string | null
          normalized_freq?: number | null
          pos?: string
          rank_in_run?: number | null
          raw_count?: number
          run_id?: number
          seed_origin?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocab_seed_candidates_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "vocab_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      vocab_sources: {
        Row: {
          citation: string
          created_at: string | null
          id: number
          kind: string
          language: string | null
          license_tier: Database["public"]["Enums"]["vcb_license_tier"]
          notes: string | null
          slug: string
          title: string
          url: string | null
        }
        Insert: {
          citation: string
          created_at?: string | null
          id?: number
          kind: string
          language?: string | null
          license_tier: Database["public"]["Enums"]["vcb_license_tier"]
          notes?: string | null
          slug: string
          title: string
          url?: string | null
        }
        Update: {
          citation?: string
          created_at?: string | null
          id?: number
          kind?: string
          language?: string | null
          license_tier?: Database["public"]["Enums"]["vcb_license_tier"]
          notes?: string | null
          slug?: string
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      vocabularies: {
        Row: {
          cefr_level: string | null
          created_at: string | null
          difficulty: number | null
          example_sentence: string | null
          extracted_pos: string | null
          extracted_surface: string | null
          id: string
          last_review_at: string | null
          lemma: string | null
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
          extracted_pos?: string | null
          extracted_surface?: string | null
          id?: string
          last_review_at?: string | null
          lemma?: string | null
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
          extracted_pos?: string | null
          extracted_surface?: string | null
          id?: string
          last_review_at?: string | null
          lemma?: string | null
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
            foreignKeyName: "vocabularies_lemma_fkey"
            columns: ["lemma"]
            isOneToOne: false
            referencedRelation: "shared_dictionary"
            referencedColumns: ["word"]
          },
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
          {
            foreignKeyName: "vocabularies_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "v_text_content"
            referencedColumns: ["id"]
          },
        ]
      }
      vocaflow_domains: {
        Row: {
          created_at: string | null
          data_source_keys: string[] | null
          description_ko: string | null
          display_order: number
          id: string
          name_ko: string
          total_words: number | null
        }
        Insert: {
          created_at?: string | null
          data_source_keys?: string[] | null
          description_ko?: string | null
          display_order: number
          id: string
          name_ko: string
          total_words?: number | null
        }
        Update: {
          created_at?: string | null
          data_source_keys?: string[] | null
          description_ko?: string | null
          display_order?: number
          id?: string
          name_ko?: string
          total_words?: number | null
        }
        Relationships: []
      }
      vocaflow_levels: {
        Row: {
          age_range: string | null
          cefr_max: string | null
          cefr_min: string | null
          classification_confidence: number | null
          classification_meta: Json | null
          classification_method: string | null
          classification_notes: string | null
          created_at: string | null
          cumulative_word_count: number | null
          description_ko: string | null
          display_order: number
          english_name: string | null
          estimated_study_hours: number | null
          external_hints: Json | null
          korean_name: string
          korean_school: string | null
          last_classified_at: string | null
          level: number
          new_words_in_level: number | null
          test_score_hints: string | null
        }
        Insert: {
          age_range?: string | null
          cefr_max?: string | null
          cefr_min?: string | null
          classification_confidence?: number | null
          classification_meta?: Json | null
          classification_method?: string | null
          classification_notes?: string | null
          created_at?: string | null
          cumulative_word_count?: number | null
          description_ko?: string | null
          display_order: number
          english_name?: string | null
          estimated_study_hours?: number | null
          external_hints?: Json | null
          korean_name: string
          korean_school?: string | null
          last_classified_at?: string | null
          level: number
          new_words_in_level?: number | null
          test_score_hints?: string | null
        }
        Update: {
          age_range?: string | null
          cefr_max?: string | null
          cefr_min?: string | null
          classification_confidence?: number | null
          classification_meta?: Json | null
          classification_method?: string | null
          classification_notes?: string | null
          created_at?: string | null
          cumulative_word_count?: number | null
          description_ko?: string | null
          display_order?: number
          english_name?: string | null
          estimated_study_hours?: number | null
          external_hints?: Json | null
          korean_name?: string
          korean_school?: string | null
          last_classified_at?: string | null
          level?: number
          new_words_in_level?: number | null
          test_score_hints?: string | null
        }
        Relationships: []
      }
      vocaflow_skills: {
        Row: {
          created_at: string | null
          description_ko: string | null
          display_order: number
          id: string
          name_ko: string
          total_words: number | null
        }
        Insert: {
          created_at?: string | null
          description_ko?: string | null
          display_order: number
          id: string
          name_ko: string
          total_words?: number | null
        }
        Update: {
          created_at?: string | null
          description_ko?: string | null
          display_order?: number
          id?: string
          name_ko?: string
          total_words?: number | null
        }
        Relationships: []
      }
      vocaflow_tracks: {
        Row: {
          created_at: string | null
          data_source_keys: string[] | null
          description_ko: string | null
          display_hint: string | null
          display_order: number
          external_test_hints: string[] | null
          id: string
          level_score_mapping: Json | null
          name_en: string | null
          name_ko: string
          total_words: number | null
        }
        Insert: {
          created_at?: string | null
          data_source_keys?: string[] | null
          description_ko?: string | null
          display_hint?: string | null
          display_order: number
          external_test_hints?: string[] | null
          id: string
          level_score_mapping?: Json | null
          name_en?: string | null
          name_ko: string
          total_words?: number | null
        }
        Update: {
          created_at?: string | null
          data_source_keys?: string[] | null
          description_ko?: string | null
          display_hint?: string | null
          display_order?: number
          external_test_hints?: string[] | null
          id?: string
          level_score_mapping?: Json | null
          name_en?: string | null
          name_ko?: string
          total_words?: number | null
        }
        Relationships: []
      }
      vrl_data_integrity_concerns: {
        Row: {
          concern_type: string
          detected_at: string | null
          detected_during: string | null
          id: number
          reasoning: string | null
          resolution_note: string | null
          resolved: boolean | null
          resolved_at: string | null
          suggested_action: string | null
          word: string
        }
        Insert: {
          concern_type: string
          detected_at?: string | null
          detected_during?: string | null
          id?: number
          reasoning?: string | null
          resolution_note?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          suggested_action?: string | null
          word: string
        }
        Update: {
          concern_type?: string
          detected_at?: string | null
          detected_during?: string | null
          id?: number
          reasoning?: string | null
          resolution_note?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          suggested_action?: string | null
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "vrl_data_integrity_concerns_word_fkey"
            columns: ["word"]
            isOneToOne: false
            referencedRelation: "shared_dictionary"
            referencedColumns: ["word"]
          },
        ]
      }
      vrl_diagnostic_questions: {
        Row: {
          created_at: string | null
          difficulty_weight: number | null
          display_order: number | null
          id: string
          target_track_level: number | null
          target_v_level: number | null
          test_id: string
          word: string
        }
        Insert: {
          created_at?: string | null
          difficulty_weight?: number | null
          display_order?: number | null
          id?: string
          target_track_level?: number | null
          target_v_level?: number | null
          test_id: string
          word: string
        }
        Update: {
          created_at?: string | null
          difficulty_weight?: number | null
          display_order?: number | null
          id?: string
          target_track_level?: number | null
          target_v_level?: number | null
          test_id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "vrl_diagnostic_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "vrl_diagnostic_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vrl_diagnostic_questions_word_fkey"
            columns: ["word"]
            isOneToOne: false
            referencedRelation: "shared_dictionary"
            referencedColumns: ["word"]
          },
        ]
      }
      vrl_diagnostic_tests: {
        Row: {
          created_at: string | null
          description_ko: string | null
          estimated_minutes: number
          id: string
          is_active: boolean | null
          name_ko: string
          question_count: number
          target_axis: string
          target_domain_id: string | null
          target_track_id: string | null
          test_type: string
        }
        Insert: {
          created_at?: string | null
          description_ko?: string | null
          estimated_minutes?: number
          id?: string
          is_active?: boolean | null
          name_ko: string
          question_count?: number
          target_axis: string
          target_domain_id?: string | null
          target_track_id?: string | null
          test_type: string
        }
        Update: {
          created_at?: string | null
          description_ko?: string | null
          estimated_minutes?: number
          id?: string
          is_active?: boolean | null
          name_ko?: string
          question_count?: number
          target_axis?: string
          target_domain_id?: string | null
          target_track_id?: string | null
          test_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vrl_diagnostic_tests_target_domain_id_fkey"
            columns: ["target_domain_id"]
            isOneToOne: false
            referencedRelation: "vocaflow_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vrl_diagnostic_tests_target_track_id_fkey"
            columns: ["target_track_id"]
            isOneToOne: false
            referencedRelation: "vocaflow_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reports: {
        Row: {
          by_module: Json
          empathetic_note: string | null
          generated_at: string
          id: string
          total_minutes: number
          total_reviews: number
          total_words: number
          user_id: string
          week_start: string
        }
        Insert: {
          by_module?: Json
          empathetic_note?: string | null
          generated_at?: string
          id?: string
          total_minutes?: number
          total_reviews?: number
          total_words?: number
          user_id: string
          week_start: string
        }
        Update: {
          by_module?: Json
          empathetic_note?: string | null
          generated_at?: string
          id?: string
          total_minutes?: number
          total_reviews?: number
          total_words?: number
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      word_familiarity: {
        Row: {
          lemma: string
          source: string
          updated_at: string
          user_id: string
          v_level: number | null
          verdict: string
        }
        Insert: {
          lemma: string
          source?: string
          updated_at?: string
          user_id: string
          v_level?: number | null
          verdict: string
        }
        Update: {
          lemma?: string
          source?: string
          updated_at?: string
          user_id?: string
          v_level?: number | null
          verdict?: string
        }
        Relationships: []
      }
      word_frequency_stats: {
        Row: {
          appears_every_year: boolean | null
          computed_at: string | null
          data_source_id: number
          frequency_tier: number | null
          id: string
          lexicon_id: string
          metadata: Json | null
          normalized_freq: number | null
          rank_in_source: number | null
          raw_count: number
          source: string
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          appears_every_year?: boolean | null
          computed_at?: string | null
          data_source_id: number
          frequency_tier?: number | null
          id?: string
          lexicon_id: string
          metadata?: Json | null
          normalized_freq?: number | null
          rank_in_source?: number | null
          raw_count: number
          source: string
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          appears_every_year?: boolean | null
          computed_at?: string | null
          data_source_id?: number
          frequency_tier?: number | null
          id?: string
          lexicon_id?: string
          metadata?: Json | null
          normalized_freq?: number | null
          rank_in_source?: number | null
          raw_count?: number
          source?: string
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "word_frequency_stats_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "frequency_data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      word_root_links: {
        Row: {
          affix_type: string
          confidence: number | null
          created_at: string
          root_id: number
          word: string
        }
        Insert: {
          affix_type?: string
          confidence?: number | null
          created_at?: string
          root_id: number
          word: string
        }
        Update: {
          affix_type?: string
          confidence?: number | null
          created_at?: string
          root_id?: number
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "word_root_links_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "word_roots"
            referencedColumns: ["id"]
          },
        ]
      }
      word_roots: {
        Row: {
          created_at: string
          gloss_ko: string
          id: number
          meaning_en: string
          notes: string | null
          origin: string
          root: string
          variants: string[] | null
        }
        Insert: {
          created_at?: string
          gloss_ko: string
          id?: never
          meaning_en: string
          notes?: string | null
          origin: string
          root: string
          variants?: string[] | null
        }
        Update: {
          created_at?: string
          gloss_ko?: string
          id?: never
          meaning_en?: string
          notes?: string | null
          origin?: string
          root?: string
          variants?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      csat_stage_catalog: {
        Row: {
          cefr_level: string | null
          display_only: boolean | null
          id: string | null
          kind: string | null
          lexical_noise: number | null
          license_class: string | null
          register: string | null
          stage_band: string | null
          syntax_score: Json | null
          title: string | null
          v_level: number | null
        }
        Relationships: []
      }
      library_seed_catalog_view: {
        Row: {
          author: string | null
          author_birth_year: number | null
          author_death_year: number | null
          cover_url: string | null
          curation_meta: Json | null
          curation_status: string | null
          dedup_key: string | null
          description: string | null
          enriched_at: string | null
          est_v_level: number | null
          fetched_at: string | null
          genre: string | null
          id: string | null
          imported_book_id: string | null
          imported_to_books: boolean | null
          language: string | null
          popularity_rank: number | null
          published_year: number | null
          reading_time_minutes: number | null
          shadowed_by_se: boolean | null
          source: string | null
          source_id: string | null
          source_url: string | null
          subjects: string[] | null
          title: string | null
          word_count: number | null
        }
        Insert: {
          author?: string | null
          author_birth_year?: number | null
          author_death_year?: number | null
          cover_url?: string | null
          curation_meta?: Json | null
          curation_status?: string | null
          dedup_key?: string | null
          description?: string | null
          enriched_at?: string | null
          est_v_level?: number | null
          fetched_at?: string | null
          genre?: string | null
          id?: string | null
          imported_book_id?: string | null
          imported_to_books?: boolean | null
          language?: string | null
          popularity_rank?: number | null
          published_year?: number | null
          reading_time_minutes?: number | null
          shadowed_by_se?: never
          source?: string | null
          source_id?: string | null
          source_url?: string | null
          subjects?: string[] | null
          title?: string | null
          word_count?: number | null
        }
        Update: {
          author?: string | null
          author_birth_year?: number | null
          author_death_year?: number | null
          cover_url?: string | null
          curation_meta?: Json | null
          curation_status?: string | null
          dedup_key?: string | null
          description?: string | null
          enriched_at?: string | null
          est_v_level?: number | null
          fetched_at?: string | null
          genre?: string | null
          id?: string | null
          imported_book_id?: string | null
          imported_to_books?: boolean | null
          language?: string | null
          popularity_rank?: number | null
          published_year?: number | null
          reading_time_minutes?: number | null
          shadowed_by_se?: never
          source?: string | null
          source_id?: string | null
          source_url?: string | null
          subjects?: string[] | null
          title?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_seed_catalog_imported_book_id_fkey"
            columns: ["imported_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_lemma_dominant_pos: {
        Row: {
          dominant_pos: string | null
          evidence_occurrences: number | null
          lemma: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_book_vocabularies_lemma_fkey"
            columns: ["lemma"]
            isOneToOne: false
            referencedRelation: "shared_dictionary"
            referencedColumns: ["word"]
          },
        ]
      }
      user_vocab_enriched: {
        Row: {
          dict_cefr: string | null
          dict_meaning_ko: string | null
          dict_v_level: number | null
          difficulty: number | null
          id: string | null
          last_review_at: string | null
          lemma: string | null
          meaning: string | null
          module_history: string[] | null
          next_review_at: string | null
          primary_pos: string | null
          review_count: number | null
          stability: number | null
          user_cefr: string | null
          user_id: string | null
          word: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vocabularies_lemma_fkey"
            columns: ["lemma"]
            isOneToOne: false
            referencedRelation: "shared_dictionary"
            referencedColumns: ["word"]
          },
        ]
      }
      v_book_extraction_reasons: {
        Row: {
          book_id: string | null
          bucket: string | null
          occurrences: number | null
          words: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_book_vocabularies_library_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      v_book_extraction_stats: {
        Row: {
          book_id: string | null
          extracted_count: number | null
          learnable_coverage_pct: number | null
          lemma_bound: number | null
          lemma_coverage_pct: number | null
          lemma_unbound: number | null
          noise_count: number | null
          resolved_other_count: number | null
          resolved_pct: number | null
          unresolved_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_book_vocabularies_library_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      v_dict_pos_sense_gap: {
        Row: {
          corpus_dominant_pos: string | null
          current_meaning_ko: string | null
          dict_pos: string | null
          dominant_pos_occurrences: number | null
          headword: string | null
          v_level: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_book_vocabularies_lemma_fkey"
            columns: ["headword"]
            isOneToOne: false
            referencedRelation: "shared_dictionary"
            referencedColumns: ["word"]
          },
        ]
      }
      v_extraction_quality_audit: {
        Row: {
          books_audited: number | null
          books_total: number | null
          books_with_defect: number | null
          defect: string | null
          detail: string | null
          occurrences: number | null
          oldest_computed_at: string | null
          rows: number | null
          words_per_book_sum: number | null
        }
        Relationships: []
      }
      v_text_content: {
        Row: {
          cefr_level: string | null
          chapter_idx: number | null
          chapter_title: string | null
          chapter_word_count: number | null
          content: string | null
          current_paragraph_idx: number | null
          id: string | null
          library_book_id: string | null
          paragraph_offsets: number[] | null
          progress_percent: number | null
          sentence_offsets: number[] | null
          status: string | null
          title: string | null
          user_book_group_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "texts_library_book_id_fkey"
            columns: ["library_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      v_user_book_progress: {
        Row: {
          author: string | null
          avg_progress_percent: number | null
          cefr_level: string | null
          cover_from: string | null
          cover_to: string | null
          done_chapters: number | null
          last_activity: string | null
          library_book_id: string | null
          title: string | null
          total_chapters: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "texts_library_book_id_fkey"
            columns: ["library_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      word_mislevel_signal: {
        Row: {
          dict_v_level: number | null
          known_avg_v: number | null
          known_ct: number | null
          lemma: string | null
          unknown_avg_v: number | null
          unknown_ct: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _enroll_book_subscribe_word_sets: {
        Args: { p_book_id: string; p_user_id: string }
        Returns: undefined
      }
      _extract_composite_score: {
        Args: {
          p_example_en: string
          p_freq_in_unit: number
          p_frequency_rank: number
          p_skill_level: number
          p_unit_max_freq: number
          p_unit_v_level: number
          p_v_level: number
          p_verified: boolean
        }
        Returns: number
      }
      acp_classify_license: { Args: { p_license: string }; Returns: string }
      admin_archive_article: {
        Args: { p_article_id: string }
        Returns: undefined
      }
      admin_archive_book: { Args: { p_book_id: string }; Returns: string }
      admin_bulk_requeue_articles: {
        Args: { p_article_ids: string[] }
        Returns: {
          blocked_by_published: number
          blocked_by_users: number
          deleted_count: number
          seed_unlocked: number
          skipped_count: number
          word_sets_deleted: number
        }[]
      }
      admin_bulk_requeue_books: {
        Args: { p_book_ids: string[] }
        Returns: {
          blocked_by_published: number
          blocked_by_users: number
          deleted_count: number
          seed_unlocked: number
          skipped_count: number
          word_sets_deleted: number
        }[]
      }
      admin_bulk_set_books_curating: {
        Args: { p_book_ids: string[] }
        Returns: {
          blocked_by_published: number
          blocked_by_users: number
          skipped_count: number
          updated_count: number
          word_sets_deleted: number
        }[]
      }
      admin_collect_content_gate_metrics: { Args: never; Returns: number }
      admin_collect_quality_metrics: { Args: never; Returns: undefined }
      admin_delete_article: {
        Args: { p_article_id: string }
        Returns: {
          deleted_article_id: string
          seed_unlocked: number
          status_was: string
          word_sets_deleted: number
        }[]
      }
      admin_delete_book: {
        Args: { p_book_id: string }
        Returns: {
          deleted_book_id: string
          seed_unlocked: number
          status_was: string
          texts_unlinked: number
          word_sets_deleted: number
        }[]
      }
      admin_delete_comic: { Args: { p_book_id: string }; Returns: undefined }
      admin_enqueue_article: {
        Args: {
          p_audio_url?: string
          p_author?: string
          p_content?: string
          p_feed_id?: string
          p_feed_label?: string
          p_license?: string
          p_published_at?: string
          p_source: string
          p_source_id: string
          p_title: string
          p_url?: string
        }
        Returns: string
      }
      admin_enqueue_book: {
        Args: {
          p_author?: string
          p_author_birth_year?: number
          p_author_death_year?: number
          p_license?: string
          p_source: string
          p_source_id: string
          p_title: string
        }
        Returns: string
      }
      admin_force_publish_article: {
        Args: { p_article_id: string }
        Returns: undefined
      }
      admin_force_publish_book: { Args: { p_book_id: string }; Returns: string }
      admin_requeue_article: {
        Args: { p_article_id: string }
        Returns: undefined
      }
      admin_requeue_book: { Args: { p_book_id: string }; Returns: string }
      admin_revert_published_article: {
        Args: { p_article_id: string }
        Returns: {
          deleted_word_sets: number
          reverted_article_id: string
        }[]
      }
      admin_revert_published_book: {
        Args: { p_book_id: string }
        Returns: {
          deleted_word_sets: number
          reverted_book_id: string
        }[]
      }
      admin_set_comic_published: {
        Args: { p_book_id: string; p_published: boolean }
        Returns: undefined
      }
      admin_vrl_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          jobid: number
          jobname: string
          schedule: string
        }[]
      }
      admin_vrl_cron_runs: {
        Args: never
        Returns: {
          end_time: string
          job_name: string
          return_message: string
          runid: number
          start_time: string
          status: string
        }[]
      }
      admin_vrl_diagnostic_use: {
        Args: never
        Returns: {
          name_ko: string
          taken_count: number
          test_id: string
          test_type: string
        }[]
      }
      admin_vrl_snapshot_counts: {
        Args: never
        Returns: {
          count: number
          scope: string
          taken_reason: string
        }[]
      }
      admin_vrl_track_distribution: {
        Args: never
        Returns: {
          level: number
          track_id: string
          user_count: number
        }[]
      }
      admin_vrl_v_level_distribution: {
        Args: never
        Returns: {
          count: number
          v_level: number
        }[]
      }
      analyze_and_apply_comprehensive_diagnostic_result: {
        Args: { p_result_id: string }
        Returns: {
          confidence: number
          estimated_track_levels: Json
          estimated_v_level: number
          per_level: Json
          user_id: string
        }[]
      }
      analyze_and_apply_diagnostic_result: {
        Args: { p_result_id: string }
        Returns: {
          confidence: number
          estimated_v_level: number
          per_level: Json
          snapshot_id: string
        }[]
      }
      analyze_and_apply_track_diagnostic_result: {
        Args: { p_result_id: string }
        Returns: {
          confidence: number
          estimated_track_level: number
          per_level: Json
          track_id: string
          user_id: string
        }[]
      }
      analyze_book_vrl: { Args: { p_book_id: string }; Returns: Json }
      analyze_diagnostic_result: {
        Args: { p_result_id: string }
        Returns: {
          confidence: number
          estimated_v_level: number
          per_level: Json
        }[]
      }
      analyze_track_diagnostic_result: {
        Args: { p_result_id: string }
        Returns: {
          confidence: number
          estimated_track_level: number
          per_level: Json
          track_id: string
        }[]
      }
      apply_diagnostic_result: {
        Args: { p_diagnostic_id: string }
        Returns: string
      }
      archive_book_pipeline_messages: {
        Args: { p_book_id: string }
        Returns: number
      }
      audit_book_extraction: { Args: { p_book_id: string }; Returns: number }
      auto_curate_book: { Args: { p_book_id: string }; Returns: string }
      auto_promote_track_level_for_user: {
        Args: { p_track_id: string; p_user_id: string }
        Returns: {
          mastered_count: number
          new_level: number
          old_level: number
          promoted: boolean
          reason: string
          threshold: number
          track_id: string
        }[]
      }
      auto_promote_v_level_for_user: {
        Args: { p_user_id: string }
        Returns: {
          mastered_count: number
          new_level: number
          old_level: number
          promoted: boolean
          reason: string
          threshold: number
        }[]
      }
      backfill_book_lemmas: { Args: { p_book_id: string }; Returns: number }
      book_comic_available: { Args: { p_book_id: string }; Returns: boolean }
      book_quiz_coverage: {
        Args: { p_book_id: string }
        Returns: {
          chapters_total: number
          chapters_with_quiz: number
          questions_total: number
        }[]
      }
      books_needing_audit: {
        Args: { p_limit?: number }
        Returns: {
          computed_at: string
          library_book_id: string
          title: string
        }[]
      }
      bulk_compute_cefrj_for_all_sources: {
        Args: never
        Returns: {
          cefrj_assigned: number
          errors: number
          source: string
          total_books: number
        }[]
      }
      calc_domain_level: {
        Args: { p_domain: string; p_word: string }
        Returns: number
      }
      calc_skill_level: { Args: { p_word: string }; Returns: number }
      calc_track_level: {
        Args: { p_track: string; p_word: string }
        Returns: number
      }
      calc_v_level: { Args: { p_word: string }; Returns: number }
      calculate_next_review_due:
        | {
            Args: {
              p_activity_score: number
              p_confidence: number
              p_source: string
            }
            Returns: string
          }
        | { Args: { p_user_id: string }; Returns: string }
      calculate_user_v_level_from_mastery: {
        Args: { p_user_id: string }
        Returns: {
          confidence: number
          evidence: Json
          sample_size: number
          suggested_level: number
        }[]
      }
      classify_archaic_candidates: {
        Args: never
        Returns: {
          marked_addable: number
          marked_processed: number
          remaining_pending: number
        }[]
      }
      collect_archaic_candidates: {
        Args: { p_book_id: string }
        Returns: number
      }
      collect_content_gate_metrics: { Args: never; Returns: number }
      collect_quality_metrics: { Args: never; Returns: number }
      commit_chapter_vocab: {
        Args: { p_book_id: string; p_chapter_idx: number }
        Returns: number
      }
      compute_article_syntax: {
        Args: { p_article_id: string }
        Returns: undefined
      }
      compute_article_vrl: {
        Args: { p_article_id: string }
        Returns: undefined
      }
      compute_book_cefrj: { Args: { p_book_id: string }; Returns: undefined }
      compute_book_chapter_v_levels: {
        Args: { p_book_id: string }
        Returns: undefined
      }
      compute_book_coverage: { Args: { p_book_id: string }; Returns: undefined }
      compute_book_difficulty: {
        Args: { p_book_id: string }
        Returns: undefined
      }
      compute_book_syntax: { Args: { p_book_id: string }; Returns: undefined }
      compute_book_vrl: { Args: { p_book_id: string }; Returns: undefined }
      compute_frequency_tier: { Args: { p_raw_count: number }; Returns: number }
      compute_syntax_score: { Args: { p_content: string }; Returns: Json }
      content_gate_publishable: {
        Args: { p_id: string; p_scope: string }
        Returns: boolean
      }
      cron_auto_promote_all_users: {
        Args: never
        Returns: {
          base_promoted: number
          failed: number
          total_users: number
          track_promoted: number
        }[]
      }
      daitch_mokotoff: { Args: { "": string }; Returns: string[] }
      decode_entities_in_stored_sentences: {
        Args: { p_book_id: string }
        Returns: {
          ghost_vocab_deleted: number
          lbv_sentences: number
          word_set_sentences: number
        }[]
      }
      decode_html_entities: { Args: { p_text: string }; Returns: string }
      decr_chunk_refs: { Args: { p_hashes: string[] }; Returns: undefined }
      deliver_chapter_vocab: {
        Args: { p_book_id: string; p_chapter_idx: number }
        Returns: {
          cefr_level: string
          chapter_word_count: number
          composite_score: number
          delivered_rank: number
          effective_v_level: number
          example_en: string
          level_source: string
          meaning_ko: string
          part_of_speech: string
          pool_size: number
          pronunciation: string
          reason: string
          source_sentence: string
          target_count: number
          v_level: number
          word: string
        }[]
      }
      derive_learner_stage: { Args: { p_user_id: string }; Returns: string }
      dict_categorical_distributions: { Args: never; Returns: Json }
      dict_inflections_by_pos: { Args: never; Returns: Json }
      dict_polysemy_count: { Args: never; Returns: Json }
      dictation_overview: { Args: never; Returns: Json }
      dictation_recent_misses: {
        Args: { p_limit?: number }
        Returns: {
          accuracy: number
          attempted_at: string
          expected: string
          session_title: string
          target_words: string[]
        }[]
      }
      dictation_weakness: {
        Args: { p_days?: number }
        Returns: {
          hits: number
          sample_actual: string
          sample_expected: string
          tag: string
        }[]
      }
      dmetaphone: { Args: { "": string }; Returns: string }
      dmetaphone_alt: { Args: { "": string }; Returns: string }
      effective_confidence: { Args: { p_meta: Json }; Returns: number }
      en_derivational_bases: { Args: { p: string }; Returns: string[] }
      en_inflection_bases: { Args: { p: string }; Returns: string[] }
      en_negation_preserved: {
        Args: { p_headword: string; p_surface: string }
        Returns: boolean
      }
      en_spelling_variants: { Args: { p: string }; Returns: string[] }
      enqueue_comic_jobs: {
        Args: { p_book_ids: string[] }
        Returns: {
          queued: number
          skipped: number
        }[]
      }
      enqueue_curation_jobs: {
        Args: { p_book_ids: string[] }
        Returns: {
          queued: number
          skipped: number
        }[]
      }
      enqueue_quiz_jobs: {
        Args: { p_book_ids: string[] }
        Returns: {
          queued: number
          skipped: number
        }[]
      }
      enqueue_review_jobs: {
        Args: { p_book_ids: string[]; p_task_type: string }
        Returns: {
          queued: number
          skipped: number
        }[]
      }
      enrich_shared_dictionary: { Args: { p_words: Json }; Returns: number }
      enroll_library_book: { Args: { p_book_id: string }; Returns: string[] }
      extract_book_vocabulary_admin: {
        Args: { p_book_id: string; p_percentile?: number }
        Returns: {
          book_v_level: number
          cefr_level: string
          chapter_idx: number
          composite_score: number
          example_en: string
          frequency_in_chapter: number
          frequency_rank: number
          meaning_ko: string
          percentile_used: number
          pos: string
          rank: number
          score_breakdown: Json
          skill_level: number
          total_candidates: number
          v_level: number
          v_threshold: number
          word: string
          word_register: string
        }[]
      }
      extract_vocabulary_for_user: {
        Args: {
          p_level_strategy?: string
          p_user_id: string
          p_words: string[]
        }
        Returns: {
          auto_n: number
          cefr_level: string
          composite_score: number
          effective_user_v: number
          example_en: string
          frequency_rank: number
          gap: number
          level_source: string
          meaning_ko: string
          pos: string
          rank: number
          score_breakdown: Json
          skill_level: number
          text_v_level: number
          track_levels: Json
          user_v_level: number
          v_level: number
          word: string
        }[]
      }
      extract_vocabulary_for_user_v2: {
        Args: {
          p_level_strategy?: string
          p_limit?: number
          p_user_id: string
          p_words: string[]
        }
        Returns: {
          auto_n: number
          cefr_level: string
          composite_score: number
          effective_user_v: number
          example_en: string
          frequency_rank: number
          gap: number
          level_source: string
          match_layer: number
          matched_via_surface: string
          meaning_ko: string
          pos: string
          rank: number
          score_breakdown: Json
          skill_level: number
          text_v_level: number
          total_candidates: number
          track_levels: Json
          user_v_level: number
          v_level: number
          v_threshold: number
          word: string
        }[]
      }
      fill_lbv_resolution: {
        Args: { p_book_id?: string; p_only_new?: boolean }
        Returns: number
      }
      find_derivational_candidates: {
        Args: never
        Returns: {
          base: string
          base_cefr: string
          base_meaning: string
          base_pos: string
          base_v_level: number
          books_seen: number
          suffix: string
          total_occurrence: number
          variant: string
        }[]
      }
      find_unbound_book_lemmas: {
        Args: { p_book_id: string; p_limit?: number }
        Returns: {
          archaic_class: string
          book_occurrences: number
          cluster_base: string
          deriv_base: string
          dict_classified_by: string
          dict_meaning_ko: string
          dict_v_level: number
          inflection_base: string
          lemma: string
          reason: string
          resolved_lang: string
          resolved_via: string
          variant_hit: string
        }[]
      }
      find_unmatched_lemmas: {
        Args: { p_words: string[] }
        Returns: {
          lemma: string
        }[]
      }
      fix_chapter_html_entities: {
        Args: { p_book_id: string }
        Returns: {
          chapter_idx: number
          entities: number
          new_len: number
          old_len: number
        }[]
      }
      get_category_path: { Args: { cat_id: string }; Returns: string[] }
      get_chapter_content: { Args: { p_text_id: string }; Returns: string }
      get_comic_format: { Args: { p_book_id: string }; Returns: string }
      get_judgment_sample: {
        Args: {
          p_chapter_idx?: number
          p_source_id: string
          p_source_kind: string
        }
        Returns: {
          first_sentence: string
          lemma: string
          meaning_ko: string
          pos: string
          v_level: number
          word: string
        }[]
      }
      get_lcp_config: {
        Args: never
        Returns: {
          internal_token: string
          vercel_base_url: string
        }[]
      }
      grade_dcp_item: {
        Args: { p_answer: Json; p_item_id: string }
        Returns: Json
      }
      incr_chunk_refs: { Args: { p_hashes: string[] }; Returns: undefined }
      infer_form_pos: {
        Args: { p_base: string; p_surface: string }
        Returns: string
      }
      insert_book_analysis: {
        Args: { p_book_id: string; p_chapters: Json; p_words: Json }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_curator: { Args: never; Returns: boolean }
      is_class_member: {
        Args: { p_class_id: string; p_uid: string }
        Returns: boolean
      }
      is_class_teacher: {
        Args: { p_class_id: string; p_uid: string }
        Returns: boolean
      }
      is_quoted_foreign_citation: {
        Args: { p_sentence: string; p_word: string }
        Returns: boolean
      }
      join_class_by_code: { Args: { p_code: string }; Returns: string }
      library_seed_dedup_key: {
        Args: { p_author: string; p_title: string }
        Returns: string
      }
      list_book_chapter_quiz_catalog: {
        Args: never
        Returns: {
          book_id: string
          book_title: string
          book_v_level: number
          chapter_idx: number
          chapter_title: string
          question_count: number
        }[]
      }
      list_book_comic_catalog: {
        Args: never
        Returns: {
          author: string
          book_v_level: number
          library_book_id: string
          panels_total: number
          title: string
        }[]
      }
      list_book_support_vocab: {
        Args: { p_book_id: string; p_limit?: number }
        Returns: {
          first_sentence: string
          meaning_ko: string
          occurrences: number
          word: string
        }[]
      }
      list_comic_catalog: {
        Args: never
        Returns: {
          author: string
          book_chapter_count: number
          book_v_level: number
          chapters_total: number
          cover_url: string
          feature_rank: number
          genre_norm: string
          has_audio: boolean
          is_picture_book: boolean
          lexical_coverage: Json
          library_book_id: string
          panels_total: number
          published_at: string
          reading_minutes: number
          title: string
        }[]
      }
      list_pd_comics: {
        Args: never
        Returns: {
          cover_url: string
          id: string
          issue_no: number
          library_book_id: string
          panels_total: number
          published_year: number
          series_title: string
          slug: string
          title: string
          v_level: number
        }[]
      }
      lookup_lexicon_clean: {
        Args: { p_surface: string }
        Returns: {
          found: boolean
          gloss_en: string
          gloss_source: string
          ipa: string
          ko_source: string
          meaning_ko: string
          pos: string
          resolved_word: string
          surface: string
        }[]
      }
      lookup_word_meaning: {
        Args: { p_surface: string }
        Returns: {
          cefr_level: string
          example_en: string
          found: boolean
          gloss_en: string
          lang: string
          match_via: string
          meaning_ko: string
          pos: string
          resolved_word: string
          surface: string
          v_level: number
          word_register: string
        }[]
      }
      maintain_reference_stats: {
        Args: never
        Returns: {
          action: string
          analyzed_at: string
          live_tuples: number
          table_name: string
        }[]
      }
      pg_relpages:
        | {
            Args: { relname: unknown }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pg_relpages(relname => text), public.pg_relpages(relname => regclass). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { relname: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pg_relpages(relname => text), public.pg_relpages(relname => regclass). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      pgmq_archive: {
        Args: { p_msg_id: number; p_queue_name: string }
        Returns: boolean
      }
      pgstatginindex: {
        Args: { relname: unknown }
        Returns: Record<string, unknown>
      }
      pgstathashindex: {
        Args: { relname: unknown }
        Returns: Record<string, unknown>
      }
      pgstatindex:
        | {
            Args: { relname: unknown }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgstatindex(relname => text), public.pgstatindex(relname => regclass). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { relname: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.pgstatindex(relname => text), public.pgstatindex(relname => regclass). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      pgstattuple:
        | { Args: { relname: string }; Returns: Record<string, unknown> }
        | { Args: { reloid: unknown }; Returns: Record<string, unknown> }
      pgstattuple_approx: {
        Args: { reloid: unknown }
        Returns: Record<string, unknown>
      }
      prescribe_today: { Args: { p_user_id: string }; Returns: Json }
      preview_book_comic: {
        Args: { p_book_id: string; p_limit?: number }
        Returns: {
          bubbles: Json
          chapter_idx: number
          image_url: string
          page_order: number
          stave_label: string
        }[]
      }
      process_library_pipeline_batch: {
        Args: { p_batch_size?: number }
        Returns: number
      }
      publish_article_word_set: {
        Args: { p_article_id: string; p_cap?: number }
        Returns: string
      }
      publish_book_word_sets: {
        Args: { p_book_id: string; p_cap?: number }
        Returns: {
          chapter_idx: number
          set_id: string
          word_count: number
        }[]
      }
      purge_ghost_vocab: { Args: { p_book_id?: string }; Returns: number }
      queue_seed_catalog_for_curation: {
        Args: {
          p_limit?: number
          p_not_imported_only?: boolean
          p_source?: string
        }
        Returns: {
          queued: number
          total_pending: number
          total_queued: number
        }[]
      }
      quiz_target_per_chapter: { Args: { p_v_level: number }; Returns: number }
      recommend_word_sets_for_user: {
        Args: { p_interests?: string[]; p_user_id: string }
        Returns: {
          category: string
          cover_emoji: string
          priority: number
          reason: string
          recommendation_type: string
          set_id: string
          slug: string
          title: string
          word_count: number
        }[]
      }
      record_pending_words: {
        Args: { p_lemmas: string[]; p_text_id?: string; p_user_id: string }
        Returns: number
      }
      refresh_lemma_dominant_pos: { Args: never; Returns: undefined }
      refresh_user_known_word_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      regenerate_auto_curated_set: {
        Args: { p_set_id: string }
        Returns: number
      }
      republish_article_word_set: {
        Args: { p_article_id: string; p_cap?: number }
        Returns: number
      }
      republish_book_word_sets: {
        Args: { p_book_id: string; p_cap?: number }
        Returns: number
      }
      resolve_dict_headword: { Args: { p_surface: string }; Returns: string }
      run_content_quality_gate_details: {
        Args: { p_id: string; p_scope: string }
        Returns: {
          extra: Json
          fix_hint: string
          invariant: string
          issue: string
          meaning_shown: string
          word: string
        }[]
      }
      run_content_quality_gates: {
        Args: { p_id?: string; p_scope?: string }
        Returns: {
          detail: Json
          fail_count: number
          invariant: string
          pipeline: string
          severity: string
          verdict: string
        }[]
      }
      save_comic_progress: {
        Args: {
          p_book_id: string
          p_completed: boolean
          p_last_index: number
          p_total: number
        }
        Returns: undefined
      }
      save_extraction_judgment: {
        Args: {
          p_chapter_idx: number
          p_mode?: string
          p_pair_wins?: boolean
          p_pair_word?: string
          p_source_id: string
          p_source_kind: string
          p_verdict: string
          p_word: string
        }
        Returns: {
          in_cap: boolean
          sort_order_at: number
        }[]
      }
      select_article_coverage: {
        Args: { p_article_id: string }
        Returns: {
          first_sentence: string
          frequency_in_article: number
          frequency_rank: number
          gloss_en: string
          meaning_ko: string
          pos: string
          word: string
        }[]
      }
      select_article_vocab: {
        Args: { p_article_id: string }
        Returns: {
          cefr_level: string
          composite_score: number
          example_en: string
          first_sentence: string
          frequency_in_article: number
          frequency_rank: number
          lemma: string
          meaning_ko: string
          pos: string
          skill_level: number
          sort_order: number
          v_level: number
          word: string
          word_register: string
        }[]
      }
      select_book_chapter_coverage: {
        Args: { p_book_id: string; p_chapter_idx?: number }
        Returns: {
          chapter_idx: number
          first_sentence: string
          frequency_in_chapter: number
          frequency_rank: number
          gloss_en: string
          meaning_ko: string
          pos: string
          word: string
        }[]
      }
      select_book_chapter_quiz: {
        Args: { p_book_id: string; p_chapter_idx: number }
        Returns: {
          correct_index: number
          id: string
          options: Json
          q_order: number
          question: string
          question_ko: string
          source_sentence_idx: number
          source_snippet: string
          type: string
        }[]
      }
      select_book_chapter_vocab: {
        Args: { p_book_id: string }
        Returns: {
          cefr_level: string
          chapter_idx: number
          composite_score: number
          example_en: string
          first_sentence: string
          frequency_in_chapter: number
          frequency_rank: number
          lemma: string
          library_book_vocabulary_id: string
          meaning_ko: string
          pos: string
          skill_level: number
          sort_order: number
          v_level: number
          word: string
          word_register: string
        }[]
      }
      select_book_comic: {
        Args: { p_book_id: string; p_chapter_idx: number }
        Returns: {
          book_v_level: number
          bubbles: Json
          chapter_idx: number
          image_url: string
          page_order: number
          stave_label: string
          target_vocab: string[]
        }[]
      }
      select_book_comic_all: {
        Args: { p_book_id: string }
        Returns: {
          book_v_level: number
          bubbles: Json
          chapter_idx: number
          image_url: string
          page_order: number
          stave_label: string
          target_vocab: string[]
        }[]
      }
      select_coverage_for_words: {
        Args: { p_words: string[] }
        Returns: {
          frequency_rank: number
          gloss_en: string
          matched_surface: string
          meaning_ko: string
          pos: string
          word: string
        }[]
      }
      select_extraction_residual: {
        Args: never
        Returns: {
          context: string
          freq: number
          sources: string
          word: string
        }[]
      }
      select_pd_comic: {
        Args: { p_slug: string }
        Returns: {
          bubbles: Json
          image_url: string
          panel_order: number
          source_page_no: number
          target_vocab: string[]
        }[]
      }
      select_pd_comic_provenance: {
        Args: { p_slug: string }
        Returns: {
          issue_no: number
          pd_basis: string
          published_year: number
          series_title: string
          source_adapter: string
          source_url: string
          title: string
        }[]
      }
      set_word_familiarity: {
        Args: { p_lemma: string; p_v_level?: number; p_verdict: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soundex: { Args: { "": string }; Returns: string }
      stage_book_dict_candidates: {
        Args: { p_book_id: string }
        Returns: {
          already_addable: number
          book_pending_remaining: number
          staged: number
        }[]
      }
      store_content_chunk: { Args: { p_content: string }; Returns: string }
      subscribe_article_word_set: {
        Args: { p_article_id: string }
        Returns: undefined
      }
      surface_variants: { Args: { s: string }; Returns: string[] }
      text_soundex: { Args: { "": string }; Returns: string }
      unenroll_library_book: {
        Args: { p_book_id: string }
        Returns: {
          subs_deleted: number
          texts_deleted: number
          vocabs_deleted: number
        }[]
      }
      unresolved_dict_words: { Args: { p_words: string[] }; Returns: string[] }
      update_pending_word_status: {
        Args: { p_admin_note?: string; p_id: string; p_status: string }
        Returns: {
          admin_note: string | null
          context_snippet: string | null
          created_at: string | null
          encounter_count: number
          id: string
          lemma: string
          resolved_at: string | null
          status: string
          surface: string | null
          text_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pending_words"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_user_v_level: {
        Args: {
          p_confidence: number
          p_diagnostic_id?: string
          p_new_level: number
          p_reason: string
          p_source: string
          p_trigger_details?: Json
          p_triggered_by?: string
          p_user_id: string
        }
        Returns: string
      }
      validate_axis_level_entry: {
        Args: { p_axis_id: string; p_axis_type: string; p_level: number }
        Returns: boolean
      }
      vcb_publish_commit: {
        Args: {
          p_category: string
          p_published_by?: string
          p_run_id: number
          p_slug: string
          p_source_attributions: Json
          p_title: string
          p_version: number
          p_words: Json
        }
        Returns: Json
      }
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
        | "cascade"
        | "connections"
        | "word-economy"
        | "daily-blitz"
        | "letter-forge"
        | "ghost-race"
        | "glyph-tongue"
        | "word-customs"
        | "lexicon-hands"
        | "lexicon-detective"
        | "morpheme-rules"
        | "silent-rule"
        | "lexicon-estate"
        | "word-orrery"
        | "wordsmith-vigil"
        | "morphmerge"
        | "wordfall-cadence"
        | "pirate-quest"
        | "echo"
      text_source: "library" | "direct-script" | "direct-file" | "shared-set"
      vcb_license_tier: "T1" | "T2" | "T3"
      vcb_queue_status:
        | "pending"
        | "exported"
        | "enriched"
        | "enriched_flagged"
        | "failed"
        | "skipped"
      vcb_run_status:
        | "created"
        | "ingesting"
        | "normalized"
        | "extracted"
        | "looked_up"
        | "enriching"
        | "qa"
        | "curating"
        | "publishing"
        | "published"
        | "failed"
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
        "cascade",
        "connections",
        "word-economy",
        "daily-blitz",
        "letter-forge",
        "ghost-race",
        "glyph-tongue",
        "word-customs",
        "lexicon-hands",
        "lexicon-detective",
        "morpheme-rules",
        "silent-rule",
        "lexicon-estate",
        "word-orrery",
        "wordsmith-vigil",
        "morphmerge",
        "wordfall-cadence",
        "pirate-quest",
        "echo",
      ],
      text_source: ["library", "direct-script", "direct-file", "shared-set"],
      vcb_license_tier: ["T1", "T2", "T3"],
      vcb_queue_status: [
        "pending",
        "exported",
        "enriched",
        "enriched_flagged",
        "failed",
        "skipped",
      ],
      vcb_run_status: [
        "created",
        "ingesting",
        "normalized",
        "extracted",
        "looked_up",
        "enriching",
        "qa",
        "curating",
        "publishing",
        "published",
        "failed",
      ],
    },
  },
} as const
