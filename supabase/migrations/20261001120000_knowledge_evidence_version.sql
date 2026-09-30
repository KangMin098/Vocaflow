-- supabase/migrations/20261001120000_knowledge_evidence_version.sql
-- 학습 원리 등록부 — 근거 집합 버전 (Codex 리뷰 후속, 2026-10-01).
--
-- 문제: 관리자가 화면에서 본 근거와, 채택하는 순간 DB 의 근거가 다를 수 있다(그 사이 근거 추가·삭제·원천 재등급).
--       DB 는 순서를 지키지만(20260928140000·150000), 사람이 **본 것**을 기준으로 채택했다는 보장은 없었다.
-- 해결: knowledge_items.evidence_version — 그 항목의 근거가 추가·삭제·변경될 때마다 트리거가 1 올린다.
--       앱은 화면에 실린 버전을 채택 요청에 싣고, 「상태 = 본 상태 AND 버전 = 본 버전」 인 한 문장 UPDATE 로 바꾼다.
--       비교와 변경이 같은 문장(같은 트랜잭션)이라 사이에 끼어들 틈이 없다.
-- 경쟁: 버전을 올리는 UPDATE 가 항목 행 잠금을 잡으므로, 채택과 근거 변경이 같은 행에서 줄을 선다.
--       뒤에 온 채택은 앞의 커밋 뒤 행을 다시 평가해 버전이 달라졌으면 0 행 → 앱이 거부로 알린다.
-- 잠금 순서: 원천 → 항목(재등급·근거 추가) · 항목만(채택). 기존 순서와 같아 새 순환이 없다.
-- 기존 행: 0 에서 시작한다(근거 0 행 · 적용 시점에 채택 항목 0).
begin;

alter table public.knowledge_items
  add column evidence_version bigint not null default 0 check (evidence_version >= 0);

create function public.knowledge_evidence_bump_version() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update public.knowledge_items set evidence_version = evidence_version + 1 where id = new.item_id;
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.item_id is distinct from new.item_id) then
    update public.knowledge_items set evidence_version = evidence_version + 1 where id = old.item_id;
  end if;
  return null;
end $$;
create trigger knowledge_evidence_bump_version after insert or update or delete on public.knowledge_evidence
  for each row execute function public.knowledge_evidence_bump_version();

revoke all on function public.knowledge_evidence_bump_version() from public, anon, authenticated;

commit;
