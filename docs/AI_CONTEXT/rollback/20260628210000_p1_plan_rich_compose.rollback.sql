-- ROLLBACK: 20260628210000_p1_plan_rich_compose
-- 주의: chapters / study_plan_schedule 에 학습자 데이터가 쌓였다면 복구 불가 — 사전 백업 필요.
-- 'article' 타입 plan item 이 존재하면 CHECK 원복 전 삭제 필요.

DROP TABLE IF EXISTS public.study_plan_schedule CASCADE;

DELETE FROM public.study_plan_items WHERE material_type = 'article';
ALTER TABLE public.study_plan_items DROP CONSTRAINT IF EXISTS study_plan_items_material_type_check;
ALTER TABLE public.study_plan_items ADD CONSTRAINT study_plan_items_material_type_check
  CHECK (material_type IN ('book','script','word_set'));

ALTER TABLE public.study_plan_items DROP COLUMN IF EXISTS chapters;
