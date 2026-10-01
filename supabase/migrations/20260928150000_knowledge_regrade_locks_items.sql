-- supabase/migrations/20260928150000_knowledge_regrade_locks_items.sql
-- 학습 원리 근거 불변식 — 원천 재등급 ↔ 항목 채택 경쟁 보정 (Codex 재리뷰 2026-09-28, P2).
--
-- 전: knowledge_csat_origin_regrade() 는 「그 순간 adopted/applied 로 보이는 항목」만 UPDATE 했다.
--     커밋 전 채택은 옛 상태(in_review)로 보여 WHERE 에 걸리지 않고, 걸리지 않은 행에는 잠금도 안 잡힌다.
--     → 채택이 A 근거를 보고 진행하는 동안 재등급이 끼어들어, 둘 다 기다림 없이 커밋 → adopted/B 가 재검토 없이 남았다.
-- 후: 그 원천을 근거로 가진 항목 행을 **상태와 무관하게** 먼저 FOR UPDATE 로 잠근 뒤 판정한다(id 순 — 교착 방지).
--     채택 UPDATE 도 같은 항목 행 잠금을 잡으므로 두 작업이 줄을 선다.
--       채택 먼저  → 재등급이 기다렸다가 커밋된 채택을 보고 재검토로 되돌린다.
--       재등급 먼저 → 채택이 기다렸다가 이미 내려간 등급의 근거를 본다(직렬 순서 「재등급 → 채택」과 같은 결과).
-- 잠금 순서: 원천 행(재등급 UPDATE) → 항목 행. 채택은 항목 행만, 근거 추가는 원천 행(FOR SHARE)만 잡으므로 순환이 없다.
-- 테이블 구조 변경 없음 — 함수 1 개 교체.
begin;

create or replace function public.knowledge_csat_origin_regrade() returns trigger
language plpgsql set search_path = public as $$
declare
  why text;
begin
  if new.grade = old.grade then return new; end if;

  -- 상태와 무관하게 먼저 잠근다 — 「채택인 행만」 고르면 커밋 전 채택을 놓치고 잠금도 안 걸린다
  perform 1
     from public.knowledge_items i
    where i.id in (select e.item_id from public.knowledge_evidence e where e.csat_passage_sha256 = new.passage_sha256)
    order by i.id
      for update;

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

revoke all on function public.knowledge_csat_origin_regrade() from public, anon, authenticated;

commit;
