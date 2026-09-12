-- supabase/migrations/20260902063650_csat_coverage_fix_false_positive.sql
--
-- `csat_coverage().covers_99` 가 **거짓 양성**을 냈다. 같은 날 만든 함수의 결함이다.
--
-- 원래 조건은 「사정권 배점 합 == published 배점 합」 하나였다. 그런데 평가원 정답표가 없는
-- 회차는 문항의 `points` 가 전부 null 이라 두 합이 **0 = 0** 이 되어 조건이 참이 된다.
-- 그래서 **분석이 한 건도 없는 7개 회차가 「99점 가능」으로 표시됐다** — 정확히 정답표가 없는
-- 회차 수와 같았고, 그 우연이 없었다면 눈치채기 어려웠다.
--
-- 이 화면의 유일한 주장이 "이 회차를 지금 풀면 99점이 나오나" 인데 그 주장이 거짓이었다.
-- 관리자가 덜 된 회차를 끝난 것으로 보고 다음 배치를 다른 데로 돌렸을 것이다.
--
-- 고친 조건 셋. 하나라도 빠지면 다시 거짓 양성이 난다:
--   ① 사정권 문항이 **전부** published — 배점만 보면 points 가 null 인 문항이 공짜로 통과한다
--   ② 사정권 배점 합 > 0 — 정답표 없는 회차를 걸러낸다
--   ③ 덮은 배점 == 사정권 배점 — 원래 조건(99점 = 독해 실점 0)

create or replace function csat_coverage()
returns table (
  exam_id        text,
  label          text,
  kind           text,
  in_scope_items int,
  analyzed       int,
  published      int,
  scope_points   int,
  covered_points int,
  covers_99      boolean
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    e.id,
    e.label,
    e.kind,
    count(*) filter (where i.in_scope)::int,
    count(*) filter (where i.in_scope and a.id is not null)::int,
    count(*) filter (where i.in_scope and a.status = 'published')::int,
    coalesce(sum(i.points) filter (where i.in_scope), 0)::int,
    coalesce(sum(i.points) filter (where i.in_scope and a.status = 'published'), 0)::int,
    count(*) filter (where i.in_scope) > 0
      and count(*) filter (where i.in_scope and a.status = 'published')
          = count(*) filter (where i.in_scope)
      and coalesce(sum(i.points) filter (where i.in_scope), 0) > 0
      and coalesce(sum(i.points) filter (where i.in_scope), 0)
          = coalesce(sum(i.points) filter (where i.in_scope and a.status = 'published'), 0)
  from csat_exams e
  join csat_items i on i.exam_id = e.id
  left join lateral (
    select a2.id, a2.status
      from csat_item_analyses a2
     where a2.item_id = i.id
     order by a2.version desc
     limit 1
  ) a on true
  group by e.id, e.label, e.kind
  order by e.year desc, e.month desc, e.id;
$fn$;
