-- ROLLBACK: 20260628220000_p1_plan_weekday_per_item

ALTER TABLE public.study_plan_items DROP COLUMN IF EXISTS weekdays;

-- study_plan_schedule 재생성 (전역 주당 리듬 원형 — 복원 필요 시만, 데이터는 복구 불가)
CREATE TABLE IF NOT EXISTS public.study_plan_schedule (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_days   int[] NOT NULL DEFAULT '{}',
  daily_minutes int NOT NULL DEFAULT 20,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.study_plan_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY study_plan_schedule_own ON public.study_plan_schedule
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
