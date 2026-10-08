-- supabase/migrations/_pending_20261008140000_knowledge_review_cascade_guard.sql
--
-- **제안 · 미적용(승인 대기).** Phase 3 첫 수직 경로에서 앱(Server Action)으로만 지키는 재검토 불변식을 DB 로 내린다.
-- 왜: 지금은 관리자 화면(actions.ts · vnext-actions.ts → lib/knowledge/review-cascade.ts)을 거친 변경만 재검토가 전파된다.
--     SQL 편집기 · 드레인 스크립트 · 다른 service_role 쓰기로 근거 · 문장 · 상태를 바꾸면 채택 사슬이 「살아 있는 채」 남는다.
--     (학습자 노출은 읽을 때 사슬 전체 채택을 다시 보므로(live-chain) 위 층이 내려가면 숨겨지지만, 아래 층 상태 · 적용 행은 그대로다.)
-- 불변식:
--   I1 채택 · 적용 중 항목의 근거가 추가 · 축 변경 · 삭제되면 그 항목은 in_review
--   I2 채택 · 적용 중 항목의 문장이 바뀌면 그 항목은 in_review
--   I3 항목이 in_review · rejected 로 가면 그것을 implements 하는 아래 층 중 adopted · applied 는 in_review(재귀 — 아래 층 UPDATE 가 같은 트리거를 다시 탄다)
--   (I3 뒤 각 항목의 active 적용은 기존 knowledge_items_pause_applications 가 자동 중단한다)
-- 잠금: I1 은 항목 행을 FOR UPDATE 로 잠근 뒤 바꾼다(채택 액션의 조건부 UPDATE 와 직렬화).
-- 기존 데이터 영향: 없음(트리거만 추가 · 백필 없음). 적용 직후부터의 변경에만 동작.
-- 되돌리기: 맨 끝 주석 블록(트리거 · 함수 DROP — 데이터 영향 없음).
-- 적용 순서: 이 SQL 적용 뒤 앱의 review-cascade 는 남겨도 무해(조건부 UPDATE 가 0행) — 별도 정리 커밋에서 뺀다.

begin;

create function public.knowledge_evidence_review_item() returns trigger
language plpgsql set search_path = public as $$
declare iid uuid := case when tg_op = 'DELETE' then old.item_id else new.item_id end;
        st text;
begin
  if tg_op = 'UPDATE' and new.applicability is not distinct from old.applicability
     and new.evidence_level is not distinct from old.evidence_level and new.grade is not distinct from old.grade
     and new.item_id is not distinct from old.item_id then
    return null;
  end if;
  select status into st from public.knowledge_items where id = iid for update;
  if st in ('adopted','applied') then
    update public.knowledge_items set status = 'in_review',
      status_reason = '근거 ' || case tg_op when 'INSERT' then '추가' when 'DELETE' then '철회' else '축 변경' end || ' — 채택 근거 집합이 바뀌었다(재검토)',
      updated_by = 'system:evidence'
      where id = iid;
  end if;
  return null;
end $$;
create trigger knowledge_evidence_review_item after insert or update or delete on public.knowledge_evidence
  for each row execute function public.knowledge_evidence_review_item();

create function public.knowledge_items_statement_review() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.statement is distinct from old.statement and old.status in ('adopted','applied') and new.status = old.status then
    new.status := 'in_review';
    new.status_reason := '문장 변경 — 채택한 문장이 아니다(재검토)';
  end if;
  return new;
end $$;
-- knowledge_items_track(BEFORE UPDATE)보다 먼저 돌아야 검토 기록에 이 전이가 남는다 — 트리거 이름 순서(a_ < knowledge_items_track)
create trigger a_knowledge_items_statement_review before update on public.knowledge_items
  for each row execute function public.knowledge_items_statement_review();

create function public.knowledge_items_cascade_review() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('in_review','rejected') then
    update public.knowledge_items c set status = 'in_review',
      status_reason = '상위 「' || new.slug || '」 ' || case new.status when 'rejected' then '반려' else '재검토' end || ' — 연쇄 재검토',
      updated_by = 'system:cascade'
      from public.knowledge_links l
      where l.kind = 'implements' and l.to_id = new.id and c.id = l.from_id and c.status in ('adopted','applied');
  end if;
  return null;
end $$;
create trigger knowledge_items_cascade_review after update on public.knowledge_items
  for each row execute function public.knowledge_items_cascade_review();

commit;

-- rollback:
-- begin;
-- drop trigger knowledge_items_cascade_review on public.knowledge_items; drop function public.knowledge_items_cascade_review();
-- drop trigger a_knowledge_items_statement_review on public.knowledge_items; drop function public.knowledge_items_statement_review();
-- drop trigger knowledge_evidence_review_item on public.knowledge_evidence; drop function public.knowledge_evidence_review_item();
-- commit;
