-- supabase/migrations/20261001130000_knowledge_evidence_observed.sql
-- 학습 원리 — 강사 영상 주장 적재 준비 (Codex 리뷰 2026-10-01).
--
-- ① 근거 귀속에 「수업 진행 관찰(observed)」을 더한다.
--    전: stated(출처가 직접 말함) · inferred(분석자 추론) 둘뿐이라, 영상의 **수업 순서**에서 보이는 것을
--        「강사가 권고했다(stated)」로 넣거나 「추론」으로 뭉갤 수밖에 없었다. 수업 순서는 권고가 아니다.
--    후: stated · observed · inferred — 주장 종류(권고 / 관찰 / 추론)와 1:1 (scripts/knowledge/claims-lib.mjs).
--
-- ② knowledge_import_claim(item, evidence) — 항목과 근거를 **한 트랜잭션**으로 넣는다.
--    전: 적재기가 항목 INSERT 뒤 근거 INSERT 를 따로 보냈다. 근거가 실패하면 근거 없는 항목만 남고,
--        재실행은 slug 가 이미 있다며 건너뛰어 **영영 복구되지 않았다**(Codex 모의 DB 재현, P1).
--    후: 함수 한 번 = 트랜잭션 하나. 근거가 실패하면 항목도 되돌려진다. slug 가 이미 있으면 아무것도 안 하고
--        'exists' — 사람이 바꾼 판정·문장을 덮지 않는다.
--
-- 테이블 구조 변경 없음. 적용 시점 근거 0 행이라 기존 값 영향 없음.
begin;

alter table public.knowledge_evidence drop constraint knowledge_evidence_attribution_check;
alter table public.knowledge_evidence
  add constraint knowledge_evidence_attribution_check check (attribution in ('stated', 'observed', 'inferred'));

create function public.knowledge_import_claim(p_item jsonb, p_evidence jsonb) returns text
language plpgsql set search_path = public as $$
declare
  v_id uuid;
begin
  insert into public.knowledge_items
    (layer, slug, title, statement, skill_ids, condition_ids, status, created_by, updated_by)
  values (
    p_item->>'layer',
    p_item->>'slug',
    p_item->>'title',
    p_item->>'statement',
    coalesce(array(select jsonb_array_elements_text(p_item->'skill_ids')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_item->'condition_ids')), '{}'),
    p_item->>'status',
    p_item->>'created_by',
    p_item->>'updated_by'
  )
  on conflict (slug) do nothing
  returning id into v_id;

  if v_id is null then
    return 'exists'; -- 이미 있다 — 덮지 않는다
  end if;

  -- 여기서 실패하면 위 항목 INSERT 도 함께 되돌려진다(같은 트랜잭션)
  insert into public.knowledge_evidence
    (item_id, grade, attribution, source_type, external_url, external_title, locator, note, created_by)
  values (
    v_id,
    p_evidence->>'grade',
    p_evidence->>'attribution',
    p_evidence->>'source_type',
    p_evidence->>'external_url',
    p_evidence->>'external_title',
    p_evidence->>'locator',
    p_evidence->>'note',
    p_evidence->>'created_by'
  );
  return 'created';
end $$;

revoke all on function public.knowledge_import_claim(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.knowledge_import_claim(jsonb, jsonb) to service_role;

commit;
