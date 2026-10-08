-- supabase/migrations/_pending_20261008150000_knowledge_statement_review_fix.sql
--
-- **제안 · 미적용(승인 대기).** 20261008140000 재검토 가드의 구멍 3개를 막는다(Codex 커밋 리뷰 · 2026-10-08). 함수 본문 교체만 — 트리거 · 데이터 그대로.
--   ① (P1) 문장 + 상태를 한 UPDATE 로 바꾸면(예: adopted → applied + 문장 변경) I2 가 건너뛰었다(`new.status = old.status` 조건)
--      → 살아 있던 항목의 문장이 바뀌고 새 상태도 살아 있는 상태(adopted · applied)면 in_review 로 덮는다. 요청 상태가 이미 살아 있지 않으면 그대로.
--   ② (P1) 근거를 다른 항목으로 옮기면(item_id UPDATE) 새 주인만 재검토됐다 → 옛 주인 · 새 주인 둘 다 잠그고 재검토(근거 집합이 둘 다 바뀌었다).
--   ③ (P2) 연쇄가 살아 있지 않은 중간 층(이미 검토 중인 방법)에서 멈췄다 → implements 아래 층 전체를 재귀로 훑고 살아 있는 것만 in_review.
-- in_review 로 바뀐 항목은 같은 UPDATE 의 AFTER 트리거(knowledge_items_pause_applications)가 active 적용을 자동 중단한다.
-- 되돌리기: 맨 끝 주석(20261008140000 의 원래 본문 3개).

begin;

-- ① 문장 변경
create or replace function public.knowledge_items_statement_review() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.statement is distinct from old.statement
     and old.status in ('adopted','applied')
     and new.status in ('adopted','applied') then
    new.status := 'in_review';
    new.status_reason := '문장 변경 — 채택한 문장이 아니다(재검토)';
  end if;
  return new;
end $$;

-- ② 근거 변경 — 옛 주인과 새 주인 모두
create or replace function public.knowledge_evidence_review_item() returns trigger
language plpgsql set search_path = public as $$
declare
  owners uuid[];
  what text := case tg_op when 'INSERT' then '추가' when 'DELETE' then '철회' else '축 변경' end;
begin
  if tg_op = 'UPDATE' and new.applicability is not distinct from old.applicability
     and new.evidence_level is not distinct from old.evidence_level and new.grade is not distinct from old.grade
     and new.item_id is not distinct from old.item_id then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.item_id is distinct from old.item_id then what := '이동'; end if;
  owners := case tg_op
    when 'INSERT' then array[new.item_id]
    when 'DELETE' then array[old.item_id]
    else array(select distinct x from unnest(array[old.item_id, new.item_id]) x where x is not null) end;
  -- 잠금 순서를 id 순으로 고정(두 주인을 동시에 잠글 때 교착을 피한다)
  perform 1 from public.knowledge_items where id = any(owners) order by id for update;
  update public.knowledge_items set status = 'in_review',
    status_reason = '근거 ' || what || ' — 채택 근거 집합이 바뀌었다(재검토)',
    updated_by = 'system:evidence'
    where id = any(owners) and status in ('adopted','applied');
  return null;
end $$;

-- ③ 연쇄 — 살아 있지 않은 중간 층도 훑는다
create or replace function public.knowledge_items_cascade_review() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('in_review','rejected') then
    with recursive below(id) as (
      select l.from_id from public.knowledge_links l where l.kind = 'implements' and l.to_id = new.id
      union
      select l.from_id from public.knowledge_links l join below b on l.to_id = b.id where l.kind = 'implements'
    )
    update public.knowledge_items c set status = 'in_review',
      status_reason = '상위 「' || new.slug || '」 ' || case new.status when 'rejected' then '반려' else '재검토' end || ' — 연쇄 재검토',
      updated_by = 'system:cascade'
      where c.id in (select id from below) and c.id <> new.id and c.status in ('adopted','applied');
  end if;
  return null;
end $$;

commit;

-- rollback(20261008140000 본문으로):
-- create or replace function public.knowledge_items_statement_review() returns trigger language plpgsql set search_path = public as $$
-- begin
--   if new.statement is distinct from old.statement and old.status in ('adopted','applied') and new.status = old.status then
--     new.status := 'in_review'; new.status_reason := '문장 변경 — 채택한 문장이 아니다(재검토)';
--   end if;
--   return new;
-- end $$;
-- create or replace function public.knowledge_evidence_review_item() returns trigger language plpgsql set search_path = public as $$
-- declare iid uuid := case when tg_op = 'DELETE' then old.item_id else new.item_id end; st text;
-- begin
--   if tg_op = 'UPDATE' and new.applicability is not distinct from old.applicability and new.evidence_level is not distinct from old.evidence_level
--      and new.grade is not distinct from old.grade and new.item_id is not distinct from old.item_id then return null; end if;
--   select status into st from public.knowledge_items where id = iid for update;
--   if st in ('adopted','applied') then
--     update public.knowledge_items set status = 'in_review', status_reason = '근거 ' || case tg_op when 'INSERT' then '추가' when 'DELETE' then '철회' else '축 변경' end || ' — 채택 근거 집합이 바뀌었다(재검토)', updated_by = 'system:evidence' where id = iid;
--   end if;
--   return null;
-- end $$;
-- create or replace function public.knowledge_items_cascade_review() returns trigger language plpgsql set search_path = public as $$
-- begin
--   if new.status is distinct from old.status and new.status in ('in_review','rejected') then
--     update public.knowledge_items c set status = 'in_review', status_reason = '상위 「' || new.slug || '」 ' || case new.status when 'rejected' then '반려' else '재검토' end || ' — 연쇄 재검토', updated_by = 'system:cascade'
--       from public.knowledge_links l where l.kind = 'implements' and l.to_id = new.id and c.id = l.from_id and c.status in ('adopted','applied');
--   end if;
--   return null;
-- end $$;
