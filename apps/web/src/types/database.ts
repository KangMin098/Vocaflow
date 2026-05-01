// apps/web/src/types/database.ts

export type Database = {
  public: {
    Tables: {
      texts: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: string;
          source: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          content: string;
          source?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          title: string;
          content: string;
          source: string | null;
        }>;
      };
      vocabularies: {
        Row: {
          id: string;
          text_id: string;
          user_id: string;
          word: string;
          meaning: string;
          example_sentence: string | null;
          pronunciation: string | null;
          difficulty: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          text_id: string;
          user_id: string;
          word: string;
          meaning: string;
          example_sentence?: string | null;
          pronunciation?: string | null;
          difficulty?: number;
          created_at?: string;
        };
        Update: Partial<{
          word: string;
          meaning: string;
          example_sentence: string | null;
          pronunciation: string | null;
          difficulty: number;
        }>;
      };
      learning_records: {
        Row: {
          id: string;
          user_id: string;
          vocabulary_id: string;
          module: 'flashcard' | 'spellforge' | 'wordblitz' | 'scriptquiz';
          is_correct: boolean;
          response_time_ms: number | null;
          attempted_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vocabulary_id: string;
          module: 'flashcard' | 'spellforge' | 'wordblitz' | 'scriptquiz';
          is_correct: boolean;
          response_time_ms?: number | null;
          attempted_at?: string;
        };
        Update: Partial<{
          is_correct: boolean;
          response_time_ms: number | null;
        }>;
      };
      quiz_questions: {
        Row: {
          id: string;
          text_id: string;
          user_id: string;
          type: 'multiple' | 'truefalse' | 'blank';
          question: string;
          options: { text: string }[];
          correct_index: number;
          source_snippet: string | null;
          source_sentence_idx: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          text_id: string;
          user_id: string;
          type?: 'multiple' | 'truefalse' | 'blank';
          question: string;
          options: { text: string }[];
          correct_index: number;
          source_snippet?: string | null;
          source_sentence_idx?: number | null;
          created_at?: string;
        };
        Update: Partial<{
          question: string;
          options: { text: string }[];
          correct_index: number;
        }>;
      };
      scores: {
        Row: {
          id: string;
          user_id: string;
          text_id: string | null;
          module: 'flashcard' | 'spellforge' | 'wordblitz' | 'scriptquiz';
          score: number;
          total_questions: number;
          accuracy: number | null;
          duration_seconds: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          text_id?: string | null;
          module: 'flashcard' | 'spellforge' | 'wordblitz' | 'scriptquiz';
          score: number;
          total_questions: number;
          accuracy?: number | null;
          duration_seconds?: number | null;
          created_at?: string;
        };
        Update: Partial<{
          score: number;
          accuracy: number | null;
          duration_seconds: number | null;
        }>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
