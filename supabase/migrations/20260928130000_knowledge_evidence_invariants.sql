-- supabase/migrations/20260928130000_knowledge_evidence_invariants.sql
-- 학습 원리 등록부 — 근거 불변식을 DB 가 지킨다 (Codex 리뷰 2026-09-28 지적 2).
-- 앱(Server Action)의 검사는 추가 시점뿐이고, 씨앗 재실행(import-seed.mjs upsert)처럼 앱을 거치지 않는 쓰기가 있다.
--
-- 불변식
--   ① 기출 원천 근거의 등급 = 원천의 등급. 미확인(G) 원천은 근거가 될 수 없다.
--   ② 원천 등급이 내려가면(A→B·C, 또는 G) 그 근거에 기대 채택·적용된 항목은 「검토 중」으로 돌아간다.
--      G 가 되면 그 근거 행은 지운다(등급 A/B/C CHECK 를 만족할 수 없다). 이유는 항목의 status_reason 에 남고,
--      상태 전이 기록(knowledge_reviews)은 기존 트리거 knowledge_items_track 이 자동으로 남긴다.
--   ③ 어떤 이유로든 근거가 지워져 0 개가 되면, 채택·적용 항목은 「검토 중」으로 돌아간다(근거 0 채택 금지).
-- 기존 테이블 구조 변경 없음 — 함수 3 · 트리거 3 만 더한다. 적용 시점 데이터: knowledge_evidence 0 행.
begin;

create function public.knowledge_grade_rank(g text) returns int
language sql immutable set search_path = public as $$
  select case g when 'A' then 3 when 'B' then 2 when 'C' then 1 else 0 end
$$;

-- ① 넣거나 바꿀 때: 기출 원천 근거의 등급을 원천에 맞추고 G 를 거부한다
create function public.knowledge_evidence_sync_csat_grade() returns trigger
language plpgsql set search_path = public as $$
declare
  origin_grade text;
begin
  if new.source_type <> 'csat_origin' then return new; end if;
  select grade into origin_grade from public.knowledge_csat_origins where passage_sha256 = new.csat_passage_sha256;
  if origin_grade is null then
    raise exception '기출 원천을 찾지 못했다: %', new.csat_passage_sha256;
  end if;
  if origin_grade = 'G' then
    raise exception '미확인(G) 기출 원천은 근거가 될 수 없다: %', new.csat_passage_sha256;
  end if;
  new.grade := origin_grade;
  return new;
end $$;
create trigger knowledge_evidence_sync_csat_grade before insert or update on public.knowledge_evidence
  for each row execute function public.knowledge_evidence_sync_csat_grade();

-- ② 원천 등급이 바뀔 때: 근거 등급을 따라가게 하고, 내려갔으면 채택 항목을 재검토로
create function public.knowledge_csat_origin_regrade() returns trigger
language plpgsql set search_path = public as $$
declare
  why text;
begin
  if new.grade = old.grade then return new; end if;

  why := format('기출 원천(%s) 등급이 %s → %s 로 바뀌어 재검토', array_to_string(new.item_ids, '·'), old.grade, new.grade);

  if public.knowledge_grade_rank(new.grade) < public.knowledge_grade_rank(old.grade) then
    update public.knowledge_items i
       set status = 'in_review', status_reason = why, updated_by = 'system:csat-origin-regrade'
     where i.status in ('adopted', 'applied')
       and exists (select 1 from public.knowledge_evidence e
                    where e.item_id = i.id and e.csat_passage_sha256 = new.passage_sha256);
  end if;

  if new.grade = 'G' then
    delete from public.knowledge_evidence where csat_passage_sha256 = new.passage_sha256;
  else
    update public.knowledge_evidence set grade = new.grade where csat_passage_sha256 = new.passage_sha256;
  end if;
  return new;
end $$;
create trigger knowledge_csat_origin_regrade after update of status on public.knowledge_csat_origins
  for each row execute function public.knowledge_csat_origin_regrade();

-- ③ 근거가 지워져 0 개가 되면 채택 항목을 재검토로
create function public.knowledge_evidence_after_delete() returns trigger
language plpgsql set search_path = public as $$
begin
  update public.knowledge_items i
     set status = 'in_review',
         status_reason = '근거가 모두 빠져 재검토 — 근거 0 으로는 채택을 유지하지 않는다',
         updated_by = 'system:evidence-removed'
   where i.id = old.item_id
     and i.status in ('adopted', 'applied')
     and not exists (select 1 from public.knowledge_evidence e where e.item_id = i.id);
  return old;
end $$;
create trigger knowledge_evidence_after_delete after delete on public.knowledge_evidence
  for each row execute function public.knowledge_evidence_after_delete();

revoke all on function public.knowledge_grade_rank(text) from public, anon, authenticated;
revoke all on function public.knowledge_evidence_sync_csat_grade() from public, anon, authenticated;
revoke all on function public.knowledge_csat_origin_regrade() from public, anon, authenticated;
revoke all on function public.knowledge_evidence_after_delete() from public, anon, authenticated;

commit;
