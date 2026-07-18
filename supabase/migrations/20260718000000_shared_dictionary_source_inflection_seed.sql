-- supabase/migrations/20260718000000_shared_dictionary_source_inflection_seed.sql
-- ✅ 적용 완료(2026-07-18) — 원격 마이그레이션 shared_dictionary_source_inflection_seed. 사용자 승인.
--
-- ADR 0001 Phase 6 (굴절형 헤드워드화 개정) — source CHECK 에 'inflection-seed' 추가.
--   파생형이 'derivational-seed' provenance 를 갖듯, 불규칙/어휘화 굴절형(went·children·better…)을
--   독립 학습 표제어로 등록할 때의 출처 마커. 추적·롤백용(WHERE source='inflection-seed').
--   classified_by 는 실제 모델(claude_code_opus_4_8, 기존 허용값) 사용.
--
-- 배경: ADR 0001 D1 은 굴절형을 별도 row 로 만들지 않기로 결정했으나, "학습자에게 불규칙
--   굴절형(과거형·복수형·비교급)을 그 형태의 뜻 그대로 학습시킨다"는 요구로 Phase 6 개정.
--   전면 반전(모든 굴절형 row화)이 아니라 **불규칙+어휘화만**(attested·bounded ~487) 등록 —
--   규칙형(walked·cats)은 D1 대로 통합 유지. D2 attested 게이트 준수.

ALTER TABLE shared_dictionary DROP CONSTRAINT shared_dictionary_source_check;
ALTER TABLE shared_dictionary ADD CONSTRAINT shared_dictionary_source_check
  CHECK (source = ANY (ARRAY[
    'oxford5000'::text, 'cefrj'::text, 'coca'::text, 'ngsl'::text,
    'ai-generated'::text, 'manual'::text, 'imported'::text,
    'kice-orphan'::text, 'derivational-seed'::text, 'inflection-seed'::text
  ]));
