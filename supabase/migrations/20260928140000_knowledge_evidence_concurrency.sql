-- supabase/migrations/20260928140000_knowledge_evidence_concurrency.sql
-- 학습 원리 근거 불변식 — 두 세션 경쟁 조건 보정 (Codex 재리뷰 2026-09-28, P2 두 건).
-- 20260928130000 은 이미 적용됐으므로 고치지 않고, 함수를 교체·추가한다.
--
-- P2-1 채택 ↔ 마지막 근거 삭제
--   전: 채택 UPDATE 는 앱이 미리 센 근거 수에 기대고, 삭제 트리거는 「채택인 행」만 UPDATE 했다.
--       삭제가 먼저 끝나지 않은 채 채택이 근거를 보면(MVCC) 둘 다 커밋 → 근거 0 인 채택이 남는다.
--   후: ⓐ 채택·적용으로 가는 INSERT/UPDATE 자체가 BEFORE 트리거에서 근거 존재를 검사한다.
--          BEFORE ROW 트리거는 행 잠금을 잡은 뒤 실행되고, plpgsql 의 각 질의는 새 스냅샷을 쓴다.
--       ⓑ 삭제 트리거는 상태와 무관하게 먼저 항목 행을 FOR UPDATE 로 잠근다.
--       → 두 작업이 같은 항목 행에서 줄을 선다. 뒤에 온 쪽은 앞의 커밋을 보고 판단한다.
--
-- P2-2 기출 근거 추가 ↔ 원천 재등급
--   전: 추가 트리거가 원천 등급을 잠금 없이 읽었다(FK 의 KEY SHARE 는 비키 UPDATE 와 충돌하지 않는다).
--   후: 원천 행을 FOR SHARE 로 읽는다 — 재등급 UPDATE 와 충돌한다.
--       추가가 기다리면 새 등급(G 면 거부)을 보고, 재등급이 기다리면 그 트리거가 새 근거까지 처리한다.
--
-- 테이블 구조 변경 없음. 적용 시점 데이터: knowledge_evidence 0 행 · 채택 항목 0.
begin;

-- P2-2: 원천 등급을 FOR SHARE 로 읽는다
create or replace function public.knowledge_evidence_sync_csat_grade() returns trigger
language plpgsql set search_path = public as $$
declare
  origin_grade text;
begin
  if new.source_type <> 'csat_origin' then return new; end if;
  select grade into origin_grade
    from public.knowledge_csat_origins
   where passage_sha256 = new.csat_passage_sha256
     for share;
  if origin_grade is null then
    raise exception '기출 원천을 찾지 못했다: %', new.csat_passage_sha256;
  end if;
  if origin_grade = 'G' then
    raise exception '미확인(G) 기출 원천은 근거가 될 수 없다: %', new.csat_passage_sha256;
  end if;
  new.grade := origin_grade;
  return new;
end $$;

-- P2-1 ⓑ: 삭제 트리거는 항목 행부터 잠근다
create or replace function public.knowledge_evidence_after_delete() returns trigger
language plpgsql set search_path = public as $$
begin
  -- 상태와 무관하게 잠근다 — 「채택인 행만」 UPDATE 하면 채택 전 행에는 잠금이 안 걸려 경쟁이 뚫린다
  perform 1 from public.knowledge_items where id = old.item_id for update;
  update public.knowledge_items i
     set status = 'in_review',
         status_reason = '근거가 모두 빠져 재검토 — 근거 0 으로는 채택을 유지하지 않는다',
         updated_by = 'system:evidence-removed'
   where i.id = old.item_id
     and i.status in ('adopted', 'applied')
     and not exists (select 1 from public.knowledge_evidence e where e.item_id = i.id);
  return old;
end $$;

-- P2-1 ⓐ: 채택·적용으로 가는 쓰기 자체가 근거를 검사한다
create function public.knowledge_items_require_evidence() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status not in ('adopted', 'applied') then return new; end if;
  if tg_op = 'UPDATE' and old.status in ('adopted', 'applied') and new.status = old.status then
    return new; -- 문장·메모만 고치는 쓰기는 막지 않는다(근거 0 채택은 삭제 트리거가 이미 되돌렸다)
  end if;
  if not exists (select 1 from public.knowledge_evidence e where e.item_id = new.id) then
    raise exception '근거가 없는 항목은 채택할 수 없다 (%)', new.slug
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger knowledge_items_require_evidence before insert or update on public.knowledge_items
  for each row execute function public.knowledge_items_require_evidence();

revoke all on function public.knowledge_items_require_evidence() from public, anon, authenticated;

commit;
