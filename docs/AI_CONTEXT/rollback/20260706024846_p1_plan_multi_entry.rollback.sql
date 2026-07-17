-- 롤백: 20260706024846_p1_plan_multi_entry
-- 학습 계획 다중 엔트리 → 자료당 1행(UNIQUE) 복원.
-- 주의: 같은 (user_id, material_type, material_id) 중복 행이 쌓였으면 UNIQUE 재생성이 실패한다.
--   먼저 중복을 정리(가장 최근 updated_at 만 남기고 삭제)한 뒤 제약을 다시 건다. 데이터 손실 가능 — 사전 백업 필수.

-- 1) 중복 제거 (자료별 최신 1행 유지)
DELETE FROM public.study_plan_items s
USING public.study_plan_items d
WHERE s.user_id = d.user_id
  AND s.material_type = d.material_type
  AND s.material_id = d.material_id
  AND (s.updated_at, s.id) < (d.updated_at, d.id);

-- 2) UNIQUE 재생성
ALTER TABLE public.study_plan_items
  ADD CONSTRAINT study_plan_items_user_id_material_type_material_id_key
  UNIQUE (user_id, material_type, material_id);

COMMENT ON TABLE public.study_plan_items IS '학습 계획 — 자료별 선택 활동. P1 재설계(수능 폐기).';
