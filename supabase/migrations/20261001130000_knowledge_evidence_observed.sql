-- supabase/migrations/20261001130000_knowledge_evidence_observed.sql
-- 학습 원리 근거 귀속에 「수업 진행 관찰(observed)」을 더한다 (Codex 리뷰 2026-10-01).
--
-- 전: stated(출처가 직접 말함) · inferred(분석자 추론) 둘뿐이라, 강사 영상의 **수업 순서**에서 보이는 것을
--     「강사가 권고했다(stated)」로 넣거나 「추론」으로 뭉갤 수밖에 없었다. 수업 순서는 권고가 아니다.
-- 후: stated · observed · inferred. 주장 종류(권고 / 관찰 / 추론)와 1:1 — scripts/knowledge/claims-lib.mjs.
-- 테이블 구조 변경 없음 — CHECK 제약만 넓힌다. 적용 시점 근거 0 행이라 기존 값 영향 없음.
begin;

alter table public.knowledge_evidence drop constraint knowledge_evidence_attribution_check;
alter table public.knowledge_evidence
  add constraint knowledge_evidence_attribution_check check (attribution in ('stated', 'observed', 'inferred'));

commit;
