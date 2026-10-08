-- supabase/migrations/_pending_20261008150000_knowledge_statement_review_fix.sql
--
-- **제안 · 미적용(승인 대기).** 20261008140000 의 I2(채택 문장 변경 → 재검토) 구멍을 막는다(Codex 커밋 리뷰 P1 · 2026-10-08).
-- 구멍: 한 UPDATE 로 문장과 상태를 함께 바꾸면(예: adopted → applied + statement 변경) 기존 함수는 `new.status = old.status` 조건이라
--       건너뛴다 — 바뀐 문장이 살아 있는 채 남고, 아래 층 · 적용도 그대로다.
-- 고침: 살아 있던(adopted · applied) 항목의 문장이 바뀌고, 새 상태도 살아 있는 상태(adopted · applied)로 요청되면 in_review 로 덮는다.
--       새 상태가 이미 in_review · rejected · extracted 면 그대로 둔다(요청이 이미 살아 있지 않다).
-- in_review 로 덮이면 같은 UPDATE 의 AFTER 트리거들이 이어서 돈다: 연쇄(knowledge_items_cascade_review) · 적용 자동 중단(knowledge_items_pause_applications).
-- 기존 데이터 영향: 없음(함수 본문만 교체 · 트리거 그대로). 되돌리기: 맨 끝 주석(20261008140000 의 원래 본문).

begin;

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

commit;

-- rollback(20261008140000 본문으로):
-- create or replace function public.knowledge_items_statement_review() returns trigger
-- language plpgsql set search_path = public as $$
-- begin
--   if new.statement is distinct from old.statement and old.status in ('adopted','applied') and new.status = old.status then
--     new.status := 'in_review';
--     new.status_reason := '문장 변경 — 채택한 문장이 아니다(재검토)';
--   end if;
--   return new;
-- end $$;
