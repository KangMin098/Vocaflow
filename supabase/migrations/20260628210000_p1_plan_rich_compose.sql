-- 20260628210000_p1_plan_rich_compose.sql
-- P1 리치 구성 (2026-06-28): 학습 계획 자료 다양화 + 도서 챕터 + 주당 학습 리듬.
--   · material_type += 'article' (스크립트 = library_articles, ACP 발행 글)
--   · study_plan_items.chapters int[] — 도서 선택 챕터 idx (빈 배열=전체)
--   · study_plan_schedule — 주당 학습 리듬 (weekly_days 1=월..7=일 + 하루 목표 분), 전역 1개/사용자

ALTER TABLE public.study_plan_items DROP CONSTRAINT IF EXISTS study_plan_items_material_type_check;
ALTER TABLE public.study_plan_items ADD CONSTRAINT study_plan_items_material_type_check
  CHECK (material_type IN ('book','article','word_set','script'));

ALTER TABLE public.study_plan_items ADD COLUMN IF NOT EXISTS chapters int[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.study_plan_items.chapters IS '도서 선택 챕터 idx (빈 배열=전체). book 외 타입은 미사용.';

CREATE TABLE IF NOT EXISTS public.study_plan_schedule (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_days   int[] NOT NULL DEFAULT '{}',   -- 1=월 .. 7=일 (ISO)
  daily_minutes int NOT NULL DEFAULT 20,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.study_plan_schedule IS '주당 학습 리듬 — weekly_days(1=월..7=일) + 하루 목표 분. 전역 1개/사용자.';
ALTER TABLE public.study_plan_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS study_plan_schedule_own ON public.study_plan_schedule;
CREATE POLICY study_plan_schedule_own ON public.study_plan_schedule
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
