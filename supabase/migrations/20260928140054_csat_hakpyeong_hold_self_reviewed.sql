-- supabase/migrations/20260928140054_csat_hakpyeong_hold_self_reviewed.sql
--
-- **학평 분석 328건 공개 보류** — 적용 2026-09-28(사용자 승인) — 학평 published 0 · in_review 328 · 검수 984 불변 · 평가원 발행 802 불변 확인.
--
-- ── 왜 ────────────────────────────────────────────────────────────────
-- 2026-09-28 학평 드레인: 분석을 쓴 에이전트가 3인 검수도 스스로 적었고, 4문항 이상 청크 42개 중 40개에서
-- 검수 소견이 문항 절반 이상에 글자 그대로 반복됐다(반려 이력까지 12문항에 동일). 평가원 81청크는 0건.
-- 누출이 많아서가 아니라 **검수가 독립적으로 수행됐다는 보장이 없어서** 보류한다. 삭제·재작성은 하지 않는다.
--
-- ── 대상(스냅샷으로 확정) ─────────────────────────────────────────────
-- 학평(회차 organizer='edu_office') 문항의 분석 중 status='published' · version=1 인 328행 = 328문항
--   · 첫 묶음 300 (적재 2026-09-28 13:29:52~13:30:23 UTC) · 파일럿 28 (H2603G3#18~45) — 겹침 0
--   · 검수 기록 984행은 **건드리지 않는다**(재검수는 별도 회차로 추가한다 — 과거 기록 덮어쓰기·소급 금지)
-- 스냅샷: scripts/csat/analysis-drain-hakpyeong/_hold/snapshot-2026-09-28.json (gitignore — 학평 인용 포함)
--         대상 목록 _hold/hold-targets-2026-09-28.json (analysis id · item_id · version · status · batch)
--
-- ── 전제 ──────────────────────────────────────────────────────────────
-- 적용 전 학평 import 를 멈춘다(analysis-drain-import --set hakpyeong 를 돌리지 않는다). 옛 .out.json 을
-- 다시 적재하면 내용이 같다는 이유로 published 로 되돌아간다 — 그 경로는 다음 마이그레이션(발행 게이트)이 막는다.
-- 이 보류는 발행 게이트보다 **먼저** 적용해도 안전하다(보류는 published → in_review 방향이라 게이트가 막지 않는다).

begin;

-- 대상이 예상과 다르면 아무것도 바꾸지 않고 멈춘다
do $$
declare n int;
begin
  select count(*) into n
    from public.csat_item_analyses a
    join public.csat_items i on i.id = a.item_id
    join public.csat_exams e on e.id = i.exam_id
   where e.organizer = 'edu_office' and a.status = 'published';
  if n <> 328 then
    raise exception '보류 대상이 328 이 아니다(현재 %) — 스냅샷 이후 바뀌었다. 대상을 다시 확정할 것', n;
  end if;
end $$;

update public.csat_item_analyses a
   set status = 'in_review', updated_at = now()
  from public.csat_items i, public.csat_exams e
 where i.id = a.item_id and e.id = i.exam_id
   and e.organizer = 'edu_office' and a.status = 'published' and a.version = 1;

-- 결과 확인: 학평 published 0 · in_review 328 · 평가원 published 불변
do $$
declare hp_pub int; hp_hold int;
begin
  select count(*) filter (where a.status = 'published'), count(*) filter (where a.status = 'in_review')
    into hp_pub, hp_hold
    from public.csat_item_analyses a join public.csat_items i on i.id = a.item_id
    join public.csat_exams e on e.id = i.exam_id where e.organizer = 'edu_office';
  if hp_pub <> 0 or hp_hold <> 328 then
    raise exception '보류 결과가 기대와 다르다 (published %, in_review %)', hp_pub, hp_hold;
  end if;
end $$;

commit;

-- ── 되돌리기 ──────────────────────────────────────────────────────────
-- 발행 게이트 마이그레이션 **적용 전**에만 그대로 된다(적용 뒤에는 새 게이트가 옛 자기 검수를 막는다 — 의도).
--   update public.csat_item_analyses a set status = 'published', updated_at = now()
--     from public.csat_items i, public.csat_exams e
--    where i.id = a.item_id and e.id = i.exam_id and e.organizer = 'edu_office'
--      and a.status = 'in_review' and a.version = 1
--      and a.id in (<_hold/hold-targets-2026-09-28.json 의 id 328개>);
