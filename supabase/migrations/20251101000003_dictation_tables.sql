-- ============================================================
-- Migration: 20251101000003_dictation_tables.sql
-- Source: CLAUDE.md §"🗄 Supabase DB 스키마"
-- Created: 2025-11-01
-- ============================================================
--
-- Dictation 도메인 테이블 (★Phase 2 — 현재 localStorage)
--   dictation_sessions  — 세션 헤더 + DictationConfig (JSONB)
--   dictation_items     — 문항별 + ScoringResult (JSONB)
--
-- 의존성:
--   - texts (20251101000002) — text_id FK
--   - auth.users — user_id FK
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- dictation_sessions — 세션 헤더 (DictationSession · DictationConfig 통합)
-- ────────────────────────────────────────────────────────────
CREATE TABLE dictation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text_id UUID REFERENCES texts(id) ON DELETE SET NULL,
  resource_title TEXT NOT NULL,

  -- DictationConfig 직렬화
  --   { unit, count, order, scoring, cefr, speed, autoRepeat, hintsAllowed, voice }
  config JSONB NOT NULL,

  current_index INT DEFAULT 0,
  total_accuracy NUMERIC(5,2),
  total_time_ms INT,
  total_hints_used INT DEFAULT 0,

  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);


-- ────────────────────────────────────────────────────────────
-- dictation_items — 문항별 (DictationItem)
-- ────────────────────────────────────────────────────────────
CREATE TABLE dictation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES dictation_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  index INT NOT NULL,
  expected_text TEXT NOT NULL,
  user_input TEXT,

  -- ScoringResult 직렬화
  --   { wordResults[], errorPatterns[], accuracy, feedback }
  result JSONB,

  attempt_count INT DEFAULT 0,
  hints_used INT DEFAULT 0,
  time_ms INT,

  created_at TIMESTAMPTZ DEFAULT now()
);
