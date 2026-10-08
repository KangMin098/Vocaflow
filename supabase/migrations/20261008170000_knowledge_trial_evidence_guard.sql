-- supabase/migrations/_pending_20261008170000_knowledge_trial_evidence_guard.sql
--
-- **제안 · 미적용(승인 대기 · 적용 담당 vocaflow-18).** methodology PR 머지 리뷰(Codex · 2026-10-08)의 DB P1 2건을 막는다. 트리거 · 함수만 — 데이터 그대로.
--   ① 합성 검증을 실제 효과 근거로 승격: synthetic=true 로 만들어 analyzed · supported 로 둔 뒤 synthetic=false 로만 바꾸면
--      knowledge_trials_analyzed_guard 가 「analyzed 로 들어올 때만」 검사해 실제 표본 검사를 건너뛰고, efficacy 가드는 그 행을 실제 검증으로 받는다.
--      → synthetic 은 만든 뒤 바꿀 수 없다(합성 ↔ 실제는 서로 다른 검증 — 새 행으로 만든다).
--   ② 같은 등급의 다른 출처로 근거를 바꾸면(source_type · csat_passage_sha256 · external_url · research_source_id · source_id · source_batch_id · attribution)
--      20261008150000 의 「축이 그대로면 조기 반환」에 걸려 재검토가 없다 → 판단에 쓰는 출처 필드도 비교한다. 메모(note) · 위치(locator)만 바뀌면 그대로.
-- 기존 데이터 영향: 없음. 되돌리기: 맨 끝 주석.

begin;

-- ① 합성 여부 불변
create function public.knowledge_trials_synthetic_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.synthetic is distinct from old.synthetic then
    raise exception '검증의 합성 여부(synthetic)는 바꿀 수 없다 — 실제 학습자 검증은 새 검증 행으로 만든다';
  end if;
  return new;
end $$;
create trigger knowledge_trials_synthetic_immutable before update on public.knowledge_trials
  for each row execute function public.knowledge_trials_synthetic_immutable();

-- ② 근거 출처가 바뀌어도 재검토(150000 본문 + 출처 필드 비교)
create or replace function public.knowledge_evidence_review_item() returns trigger
language plpgsql set search_path = public as $$
declare
  owners uuid[];
  what text := case tg_op when 'INSERT' then '추가' when 'DELETE' then '철회' else '축 · 출처 변경' end;
begin
  if tg_op = 'UPDATE'
     and new.applicability is not distinct from old.applicability
     and new.evidence_level is not distinct from old.evidence_level
     and new.grade is not distinct from old.grade
     and new.item_id is not distinct from old.item_id
     and new.source_type is not distinct from old.source_type
     and new.csat_passage_sha256 is not distinct from old.csat_passage_sha256
     and new.external_url is not distinct from old.external_url
     and new.research_source_id is not distinct from old.research_source_id
     and new.source_id is not distinct from old.source_id
     and new.source_batch_id is not distinct from old.source_batch_id
     and new.attribution is not distinct from old.attribution then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.item_id is distinct from old.item_id then what := '이동'; end if;
  owners := case tg_op
    when 'INSERT' then array[new.item_id]
    when 'DELETE' then array[old.item_id]
    else array(select distinct x from unnest(array[old.item_id, new.item_id]) x where x is not null) end;
  perform 1 from public.knowledge_items where id = any(owners) order by id for update;
  update public.knowledge_items set status = 'in_review',
    status_reason = '근거 ' || what || ' — 채택 근거 집합이 바뀌었다(재검토)',
    updated_by = 'system:evidence'
    where id = any(owners) and status in ('adopted','applied');
  return null;
end $$;

commit;

-- rollback:
-- begin;
-- drop trigger knowledge_trials_synthetic_immutable on public.knowledge_trials; drop function public.knowledge_trials_synthetic_immutable();
-- (knowledge_evidence_review_item 은 20261008150000 의 본문으로 되돌린다 — 그 파일의 ② 블록을 다시 실행)
-- commit;
