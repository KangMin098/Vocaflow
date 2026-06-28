-- 20260628220000_p1_plan_weekday_per_item.sql
-- P1 요일 결합 (2026-06-28): 학습 요일을 항목별로 + 시간(분) 제거.
--   · study_plan_items.weekdays int[] (1=월..7=일, 빈 배열=요일 미정) — 자료 선택과 요일을 한 흐름에 결합
--   · 전역 study_plan_schedule 폐기 — 따로 선택하면 이질감/계획성 약함 (사용자 피드백)

ALTER TABLE public.study_plan_items ADD COLUMN IF NOT EXISTS weekdays int[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.study_plan_items.weekdays IS '학습 요일 1=월..7=일 (빈 배열=요일 미정).';

DROP TABLE IF EXISTS public.study_plan_schedule CASCADE;
