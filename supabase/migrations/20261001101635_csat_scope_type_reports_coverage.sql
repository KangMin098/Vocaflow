-- supabase/migrations/20261001101635_csat_scope_type_reports_coverage.sql
--
-- 학평을 기출 분석 시스템 전체에 — P1: 통계를 «집합별로» 담는 그릇(2026-10-01 사용자 결정: 유형 통계는 집합별로 따로).
--
-- 1) csat_type_reports 에 집합 열(organizer · grade)을 더한다. 평가원 리포트는 organizer='kice', grade=0(전체),
--    학평 리포트는 organizer='edu_office', grade=1·2·3. 기존 26행은 전부 평가원 리포트라 기본값으로 kice·0(값 변화 없음).
--    ⚠️ 기본 키는 아직 (type_id) 그대로 둔다. 키를 (type_id, organizer, grade) 로 바꾸면 옛 코드의
--    upsert(onConflict 'type_id') 가 다른 워크트리에서 실패한다(Codex DB 게이트 지적 2026-10-01).
--    지금은 열만 더해 옛·새 코드가 함께 돈다. 키 확장은 학평 리포트를 실제로 쓰는 단계(P4)에서, 모든 워크트리가
--    새 코드를 받은 뒤 한다 — 그 전에는 학평 리포트 행을 넣지 않는다(type_id 가 겹친다).
-- 2) csat_coverage_scoped(p_organizer, p_grade) — 분석 완결도를 집합별로. 기존 csat_coverage() 는 손대지 않는다
--    (평가원 29/29 판정을 내는 정본 — 호출부·결과 그대로).

begin;

alter table public.csat_type_reports
  add column if not exists organizer text not null default 'kice',
  add column if not exists grade int not null default 0;

alter table public.csat_type_reports
  add constraint csat_type_reports_scope_check check (
    (organizer = 'kice' and grade = 0) or (organizer = 'edu_office' and grade between 1 and 3)
  );

comment on column public.csat_type_reports.organizer is '어느 기출 집합의 리포트인가 — kice(평가원) · edu_office(학평). 통계는 집합별로 따로';
comment on column public.csat_type_reports.grade is '평가원 0(전체) · 학평 1~3(학년별)';

create or replace function public.csat_coverage_scoped(p_organizer text default 'kice', p_grade int default null)
returns table(exam_id text, label text, kind text, grade int, in_scope_items integer, analyzed integer, published integer,
              scope_points integer, covered_points integer, covers_99 boolean)
language sql stable security definer set search_path to 'public'
as $$
  select
    e.id, e.label, e.kind, e.grade,
    count(*) filter (where i.in_scope)::int,
    count(*) filter (where i.in_scope and a.id is not null)::int,
    count(*) filter (where i.in_scope and a.status = 'published')::int,
    coalesce(sum(i.points) filter (where i.in_scope), 0)::int,
    coalesce(sum(i.points) filter (where i.in_scope and a.status = 'published'), 0)::int,
    count(*) filter (where i.in_scope) > 0
      and count(*) filter (where i.in_scope and a.status = 'published') = count(*) filter (where i.in_scope)
      and coalesce(sum(i.points) filter (where i.in_scope), 0) > 0
      and coalesce(sum(i.points) filter (where i.in_scope), 0)
          = coalesce(sum(i.points) filter (where i.in_scope and a.status = 'published'), 0)
  from csat_exams e
  join csat_items i on i.exam_id = e.id
  left join lateral (
    select a2.id, a2.status from csat_item_analyses a2
     where a2.item_id = i.id order by a2.version desc limit 1
  ) a on true
  where e.organizer = p_organizer and (p_grade is null or e.grade = p_grade)
  group by e.id, e.label, e.kind, e.grade
  order by e.year desc, e.month desc, e.id;
$$;

-- csat_coverage() 와 같은 권한(관리자 로더는 서비스 역할, 학습자는 쓰지 않는다)
revoke all on function public.csat_coverage_scoped(text, int) from public, anon, authenticated;
grant execute on function public.csat_coverage_scoped(text, int) to service_role;

commit;
