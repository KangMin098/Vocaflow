-- P2 (LEARNER_MANAGEMENT.md §2-3) — 주간 Report Card (리틀팍스 월리포트 이식)
--   daily_activity(P0) 주간 집계 + Empathetic 코멘트(§철학3). 추가·비파괴 + 본인 RLS.
-- 롤백: docs/AI_CONTEXT/rollback/P2_weekly_reports_원본.sql

CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,                          -- 주 시작(월요일, KST)
  total_minutes integer NOT NULL DEFAULT 0,
  total_words integer NOT NULL DEFAULT 0,
  total_reviews integer NOT NULL DEFAULT 0,
  by_module jsonb NOT NULL DEFAULT '{}'::jsonb,
  empathetic_note text,                               -- Lora italic 격려 코멘트(템플릿, 압박 X)
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS weekly_reports_owner ON public.weekly_reports;
CREATE POLICY weekly_reports_owner ON public.weekly_reports
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
