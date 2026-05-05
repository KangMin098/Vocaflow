-- ============================================================
-- Migration: 20251101000005_user_stats_table.sql
-- Source: CLAUDE.md §"🗄 Supabase DB 스키마"
-- Created: 2025-11-01
-- ============================================================
--
-- 사용자 관련 캐시·메타 테이블 5종
-- (filename 은 user_stats 이지만 user 도메인 모든 캐시 통합)
--
--   user_stats        — 단계 캐시 (cold/warm/hot · streak · §17.7)
--   user_profiles     — Settings (테마/TTS/locale/목표/알림)
--   daily_activity    — Dashboard 28일 sparkline + WeeklyHeatmap 정밀 집계
--   achievements      — Dashboard "신기록" 배지 + Streak 트로피
--   reports           — Admin Console /admin/reports 신고/문의
--
-- 의존성:
--   - module_id ENUM (20251101000001) — achievements.module
--   - texts, vocabularies (20251101000002) — reports FK
--   - auth.users
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- user_stats — 단계 캐시 (Hub 진입 1쿼리로 cold/warm/hot 분기)
-- UserStats 1:1 매핑
-- ────────────────────────────────────────────────────────────
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- §17.2 [2] 사용자 상태
  mastery_level TEXT DEFAULT 'cold' CHECK (mastery_level IN ('cold','warm','hot')),

  total_words INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,

  -- FSRS 한국 학습자 초기값 0.85 — review 1,000건 누적 후 fsrs-optimizer 로 자동 재최적화
  fsrs_target_retention NUMERIC(3,2) DEFAULT 0.85
    CHECK (fsrs_target_retention BETWEEN 0.5 AND 0.99),

  last_studied_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- user_profiles — Settings 화면 + 헤더 아바타 + Sidebar 사용자 영역
-- auth.users 확장
-- ────────────────────────────────────────────────────────────
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,

  -- 인터페이스 언어
  locale TEXT DEFAULT 'ko' CHECK (locale IN ('ko','en')),

  -- light/dark/system — Settings 테마
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light','dark','system')),

  -- TTS voice 지정 — Settings TTS 영역
  tts_voice TEXT,
  tts_speed NUMERIC(3,2) DEFAULT 1.0,

  -- 일일 학습 목표 (단어 수) — KPI "오늘 학습" 진행률
  daily_word_goal INT DEFAULT 30,

  -- 알림 채널
  notify_email BOOLEAN DEFAULT true,
  notify_push BOOLEAN DEFAULT false,

  -- Streak 위급 알림
  notify_streak_risk BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- daily_activity — Dashboard 28일 sparkline + WeeklyHeatmap 정밀 집계
-- learning_records 으로 derive 가능하지만 매번 GROUP BY 비용 회피
-- 매 review 후 트리거 또는 cron job 으로 일 단위 upsert
-- ────────────────────────────────────────────────────────────
CREATE TABLE daily_activity (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 활동일 (UTC 자정 기준)
  date DATE NOT NULL,

  total_minutes INT DEFAULT 0,
  total_words INT DEFAULT 0,
  total_reviews INT DEFAULT 0,

  -- 모듈별 review 카운트 — { flashcard: 12, spellforge: 5, ... }
  by_module JSONB DEFAULT '{}',

  -- 정확도 평균 0~100
  avg_accuracy NUMERIC(5,2),

  PRIMARY KEY (user_id, date)
);


-- ────────────────────────────────────────────────────────────
-- achievements — 신기록·마일스톤 (Dashboard "신기록" 배지 + Streak 트로피)
-- ────────────────────────────────────────────────────────────
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 신기록 종류
  kind TEXT NOT NULL CHECK (kind IN (
    'best_score',
    'streak_milestone',
    'total_words_milestone',
    'first_module_complete',
    'text_conquered',
    'perfect_session'
  )),

  -- 모듈 컨텍스트 (옵션)
  module module_id,

  -- 값 (점수, 일수, 단어 수 등)
  value INT,

  -- 부가 컨텍스트 (텍스트 ID 등)
  metadata JSONB,

  achieved_at TIMESTAMPTZ DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- reports — 사용자 신고/문의 (Admin Console /admin/reports)
-- ────────────────────────────────────────────────────────────
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('bug','content','feature','other')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,

  -- 관련 자원 (옵션)
  text_id UUID REFERENCES texts(id) ON DELETE SET NULL,
  vocabulary_id UUID REFERENCES vocabularies(id) ON DELETE SET NULL,

  -- 처리 상태
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  admin_note TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
