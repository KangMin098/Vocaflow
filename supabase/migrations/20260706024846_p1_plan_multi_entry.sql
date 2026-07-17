-- 20260706024846_p1_plan_multi_entry.sql
-- 학습 계획 다중 엔트리: 한 자료를 여러 배치(요일×챕터)로 담을 수 있게 UNIQUE(자료) 제거.
--   기존: study_plan_items 1행 = 자료 1개 → 요일·챕터가 자료에 종속(챕터를 날짜별로 못 쪼갬)
--   변경: 자료가 여러 행(배치)으로 → '월=Alice Ch1 / 수=Alice Ch2' 가능. 챕터=최하위 단위, 일별 배치.
-- 무손실: 기존 행은 각각 한 배치로 그대로 유효. 데이터 이관 불필요.
--   (UNIQUE 제거 시 백킹 인덱스도 함께 제거됨. 조회는 idx_study_plan_items_user 로 커버.)

ALTER TABLE public.study_plan_items
  DROP CONSTRAINT IF EXISTS study_plan_items_user_id_material_type_material_id_key;

COMMENT ON TABLE public.study_plan_items IS
  '학습 계획 — 자료×활동 배치. 한 자료가 여러 행(요일×챕터 배치)으로 존재 가능(다중 엔트리, UNIQUE 제거 2026-07-06). 챕터=최하위 단위, 일별 배치.';
