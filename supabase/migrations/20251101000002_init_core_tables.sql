-- ============================================================
-- Migration: 20251101000002_init_core_tables.sql
-- Source: CLAUDE.md §"🗄 Supabase DB 스키마"
-- Created: 2025-11-01
-- ============================================================
--
-- 핵심 콘텐츠 테이블 5종:
--   texts             — 스크립트 자산 (TextViewer 도메인)
--   vocabularies      — 단어 자산 (WordVault · FSRS 6 컬럼)
--   learning_records  — 모든 모듈 review 적재
--   scores            — 게임 결과 (Flashcard·SpellForge·WordBlitz·PairFlip·ScriptQuiz·Dictation 공통)
--   quiz_questions    — ScriptQuiz AI 생성 문제
--
-- 의존성:
--   - module_id ENUM (20251101000001)
--
-- 본 마이그레이션 포함:
--   ✅ FK + ON DELETE 정책 (CASCADE / SET NULL)
--   ✅ CHECK 제약 + DEFAULT 값
--   ✅ text_source ENUM (texts.source 전용)
--
-- 본 마이그레이션 제외 (다른 파일):
--   - 인덱스       → 20251101000007_indexes.sql
--   - RLS / 트리거 → 20251101000006_triggers_and_rls.sql
--   - vocabularies.shared_set_id 컬럼 → 20251101000004 (forward ref 회피)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- text_source ENUM — texts.source / DictationResource.source 정합
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE text_source AS ENUM (
    'library',         -- 공용 라이브러리에서 가져옴
    'direct-script',   -- 사용자 직접 입력
    'direct-file',     -- PDF/DOCX/TXT 업로드
    'shared-set'       -- 공용 단어 세트 연계
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ────────────────────────────────────────────────────────────
-- texts — 스크립트 자산 (TextViewer 도메인)
-- ────────────────────────────────────────────────────────────
CREATE TABLE texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,

  -- 출처 — DictationResource.source enum 정합
  source text_source DEFAULT 'direct-script',

  cefr_level TEXT CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),

  -- §17.2 [2] 스크립트 4단계 상태
  status TEXT DEFAULT 'in_progress' CHECK (status IN (
    'not_started','in_progress','extracted','conquered','completed'
  )),

  -- Workspace 마지막 열람 시각 (추천 엔진 P2: lastOpened DESC)
  last_opened TIMESTAMPTZ,

  -- 듣기/읽기 진행률 0~100
  progress_percent NUMERIC(5,2) DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),

  -- 한국어 번역 (선택) — Dictation translation
  translation TEXT,

  -- LibraryText.isBookmarked 매핑 — Library/Workspace 별표 토글
  is_bookmarked BOOLEAN DEFAULT false,

  -- TextViewer 파일 업로드 메타 — Supabase Storage 버킷 ref
  source_file_path TEXT,           -- e.g. 'uploads/{user_id}/{file_uuid}.pdf'
  source_url TEXT,                 -- URL 가져오기 시

  -- 작성자/저자 (Library curation 용)
  author TEXT,

  -- Cover gradient (UI 캐시)
  cover_from TEXT,
  cover_to TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- vocabularies — 단어 자산 (WordVault · WordItem · SrsCard 통합)
-- FSRS 6 컬럼 + UNIQUE(user_id, word) 중복 등록 방지
-- ⚠️ memory_state 컬럼 의도적 부재 — R(t) 동적 계산 (§17.2 안티패턴)
-- ⚠️ shared_set_id 컬럼은 20251101000004 에서 추가 (forward ref 회피)
-- ────────────────────────────────────────────────────────────
CREATE TABLE vocabularies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 출처 #1: 스크립트 추출 (NULL 가능)
  text_id UUID REFERENCES texts(id) ON DELETE SET NULL,

  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  example_sentence TEXT,
  pronunciation TEXT,

  -- 품사 (n. v. adj. adv. ...)
  pos TEXT,

  -- 단어 자체 CEFR (text 와 별개로 단어별 정확도)
  cefr_level TEXT CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),

  -- ── FSRS 호환 (§17.4 + §17.7) ──
  difficulty REAL DEFAULT 6.0 CHECK (difficulty BETWEEN 1.0 AND 10.0),
  stability REAL DEFAULT 0,
  last_review_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  module_history TEXT[] DEFAULT '{}',  -- ModuleId 배열 (TEXT[] — enum 배열 cardinality 작음)
  review_count INT DEFAULT 0,

  -- 가져오기 출처
  origin TEXT DEFAULT 'ai' CHECK (origin IN ('ai','shared_set','imported','manual')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- 한 사용자가 같은 단어 중복 등록 방지
  UNIQUE (user_id, word)
);


-- ────────────────────────────────────────────────────────────
-- learning_records — 모든 모듈 공통 review 적재 (FSRS rating)
-- ────────────────────────────────────────────────────────────
CREATE TABLE learning_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vocabulary_id UUID REFERENCES vocabularies(id) ON DELETE CASCADE,

  -- 10 모듈 enum (pirate_quest 포함)
  module module_id NOT NULL,

  is_correct BOOLEAN NOT NULL,

  -- FSRS 4단계 — 1=Again 2=Hard 3=Good 4=Easy
  rating SMALLINT CHECK (rating BETWEEN 1 AND 4),

  response_time_ms INT,

  -- review 직전 R(t) — 회고용
  retrievability_before NUMERIC(4,3),

  -- Stability 변화량 (양수 = 강화)
  stability_delta REAL,

  -- 부가 컨텍스트 (예: PairFlip pair_id, ScriptQuiz question_id)
  metadata JSONB,

  attempted_at TIMESTAMPTZ DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- scores — 게임 결과 (모듈별 metadata JSONB 로 차이 흡수)
-- ────────────────────────────────────────────────────────────
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module module_id NOT NULL,
  text_id UUID REFERENCES texts(id) ON DELETE SET NULL,

  score INT NOT NULL,
  total_questions INT,
  correct_count INT,
  accuracy NUMERIC(5,2) CHECK (accuracy BETWEEN 0 AND 100),
  duration_seconds INT,

  -- 모듈별 부가 메타
  --   PairFlip: { level, maxCombo, hintsUsed, totalAttempts }
  --   Dictation: { unit, scoring, autoRepeat }
  --   WordBlitz: { stage, jungle_zone }
  metadata JSONB DEFAULT '{}',

  -- 신기록 여부 — UI 강조용 캐시
  is_record BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- quiz_questions — ScriptQuiz AI 생성 문제
-- ────────────────────────────────────────────────────────────
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id UUID NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  type TEXT NOT NULL DEFAULT 'multiple' CHECK (type IN ('multiple','truefalse','blank')),
  question TEXT NOT NULL,

  -- [{ text: string }]
  options JSONB NOT NULL,
  correct_index INT NOT NULL,

  source_snippet TEXT,
  source_sentence_idx INT,

  created_at TIMESTAMPTZ DEFAULT now()
);
