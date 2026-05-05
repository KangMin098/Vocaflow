-- ============================================================
-- Migration: 20251101000004_shared_library_tables.sql
-- Source: CLAUDE.md §"🗄 Supabase DB 스키마"
-- Created: 2025-11-01
-- ============================================================
--
-- 공용 단어장 (★v06.16 PR5 — 라이브러리 분리)
--   shared_word_sets             — 공용 단어 세트 (관리자 등록)
--   shared_words                 — 세트 내 단어들
--   user_word_set_subscriptions  — 사용자 구독 (multi-set per user)
--
-- 의존성:
--   - vocabularies (20251101000002) — shared_set_id ALTER 추가
--   - auth.users — user_id FK
--
-- 추가 작업:
--   ✅ vocabularies 테이블에 shared_set_id 컬럼 ADD (forward ref 였던 것 해소)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- shared_word_sets — 공용 단어 세트 (관리자 등록)
-- 8 카테고리: elementary·middle·high·csat·eng_test·civil·business·themed
-- ────────────────────────────────────────────────────────────
CREATE TABLE shared_word_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'elementary','middle','high','csat','eng_test','civil','business','themed'
  )),
  cefr_level TEXT,
  word_count INT DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  cover_emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- shared_words — 세트 내 단어 (사용자 구독 시 vocabularies 로 복사 또는 reference)
-- ────────────────────────────────────────────────────────────
CREATE TABLE shared_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES shared_word_sets(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  meaning_ko TEXT NOT NULL,
  example_en TEXT,
  pronunciation TEXT,
  part_of_speech TEXT,
  cefr_level TEXT CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  sort_order INT DEFAULT 0
);


-- ────────────────────────────────────────────────────────────
-- user_word_set_subscriptions — 사용자 구독 (multi-set per user)
-- ────────────────────────────────────────────────────────────
CREATE TABLE user_word_set_subscriptions (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  set_id UUID REFERENCES shared_word_sets(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, set_id)
);


-- ────────────────────────────────────────────────────────────
-- vocabularies.shared_set_id — forward ref 해소 (file 2 에서 deferred)
-- 출처 #2: 공용 세트에서 가져옴 (NULL 가능)
-- ────────────────────────────────────────────────────────────
ALTER TABLE vocabularies
  ADD COLUMN shared_set_id UUID REFERENCES shared_word_sets(id) ON DELETE SET NULL;
