-- P1 (LEARNER_MANAGEMENT.md §2-2·§4) — Study Plan 목표 (Busuu study plan 이식)
--   수능 D-day + 주당 목표 → Study Plan 역산. 수능생 단일 집중(goal_type='csat').
-- 추가·비파괴 신규 테이블 + 본인 행 RLS. 롤백: docs/AI_CONTEXT/rollback/P1_learning_goals_원본.sql

CREATE TABLE IF NOT EXISTS public.learning_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type text NOT NULL DEFAULT 'csat',          -- 수능 단일 집중 (향후 확장)
  target_date date NOT NULL,                         -- 수능 D-day
  target_v_level smallint NOT NULL DEFAULT 7,        -- 수능 ≈ B1~B2 (track/i+1 맥락)
  target_word_count integer NOT NULL DEFAULT 4000,   -- 수능 핵심 어휘 근사 (Study Plan 역산 대상)
  weekly_target_days smallint NOT NULL DEFAULT 5,
  weekly_target_minutes smallint NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, goal_type)                        -- 활성 목표 1개
);
ALTER TABLE public.learning_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS learning_goals_owner ON public.learning_goals;
CREATE POLICY learning_goals_owner ON public.learning_goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
