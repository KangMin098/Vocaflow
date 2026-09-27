-- supabase/migrations/20260927153152_csat_exams_hakpyeong.sql
--
-- 교육청 전국연합학력평가(학평)를 기출 분석 체계에 **보조·검증 집합**으로 들인다.
--
-- ── 무엇이 바뀌나 ─────────────────────────────────────────────────────
--   · csat_exams: kind 에 'hakpyeong' 추가 · organizer(kice|edu_office) · grade(1~3) · exam_year(시행연도)
--   · 회차 id 문법(앱 `lib/csat/exam-id.ts` 정본): 학평 = `H{시행YY}{MM}G{학년}` — CHECK 로 못박는다
--   · csat_items_public: **평가원 회차만** 보인다. 학습자 화면 전부가 이 뷰를 읽으므로
--     학평 문항이 유형 비중·«최근 N개년»·세션 카탈로그에 조용히 섞이지 않는다
--   · csat_coverage(): 평가원 회차만 센다(본 집합의 분석 완결도 — 학평이 들어와도 29/29 판정 불변)
--
-- 기존 행: 전부 평가원이라 default('kice', 3) 그대로, exam_year 만 id 에서 채운다.
-- 되돌리기: 학평 행을 지운 뒤 컬럼·CHECK 를 원래대로(아래 맨 끝 주석).

begin;

alter table public.csat_exams
  add column if not exists organizer text not null default 'kice',
  add column if not exists grade smallint not null default 3,
  add column if not exists exam_year int;

update public.csat_exams
   set exam_year = year - 1
 where exam_year is null;           -- 수능·모평: 학년도 전해 시행

alter table public.csat_exams alter column exam_year set not null;

alter table public.csat_exams drop constraint if exists csat_exams_kind_check;
alter table public.csat_exams
  add constraint csat_exams_kind_check check (kind in ('suneung', 'mock', 'hakpyeong')),
  add constraint csat_exams_organizer_check check (organizer in ('kice', 'edu_office')),
  add constraint csat_exams_grade_check check (grade between 1 and 3),
  add constraint csat_exams_month_check check (month between 1 and 12),
  -- 종류·주관·학년·id 문법이 서로 어긋나지 않게 — 앱의 exam-id 판정과 같은 규칙
  add constraint csat_exams_kind_shape_check check (
    (kind = 'suneung'   and organizer = 'kice'       and grade = 3 and id ~ '^[0-9]{4}[AB]?$')
 or (kind = 'mock'      and organizer = 'kice'       and grade = 3 and id ~ '^M[0-9]{4}$')
 or (kind = 'hakpyeong' and organizer = 'edu_office' and id ~ '^H[0-9]{4}G[123]$'
       and substr(id, 7, 1)::int = grade
       and exam_year = 2000 + substr(id, 2, 2)::int
       and month = substr(id, 4, 2)::int
       and year = exam_year + 1)
  );

comment on column public.csat_exams.organizer is
  'kice = 평가원(수능·모평, 본 근거 집합) · edu_office = 교육청 학평(보조·검증 집합)';
comment on column public.csat_exams.grade is '대상 학년. 수능·모평은 3';
comment on column public.csat_exams.exam_year is
  '시행연도. year 는 학년도(정렬 축) — 학평은 year = exam_year + 1 로 수능·모평과 한 줄에 선다';

-- 학습자 뷰: 평가원 회차만. 컬럼 목록은 현행 그대로(stem 비공개 정책 유지)
-- reloptions(security_invoker=false)·권한(service_role 만)은 현행과 같게 명시·유지한다
create or replace view public.csat_items_public with (security_invoker = false) as
  select i.id, i.exam_id, i.no, i.section, i.in_scope, i.type_id, i.stem, i.answer, i.points, i.high_score
    from public.csat_items i
    join public.csat_exams e on e.id = i.exam_id
   where e.organizer = 'kice';

-- 분석 완결도: 본 집합(평가원)만
create or replace function public.csat_coverage()
 returns table(exam_id text, label text, kind text, in_scope_items integer, analyzed integer, published integer,
               scope_points integer, covered_points integer, covers_99 boolean)
 language sql stable security definer
 set search_path to 'public'
as $function$
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
  where e.organizer = 'kice'
  group by e.id, e.label, e.kind
  order by e.year desc, e.month desc, e.id;
$function$;

commit;

-- 되돌리기(학평 행이 없을 때):
--   delete from csat_items where exam_id like 'H%'; delete from csat_exams where kind = 'hakpyeong';
--   alter table csat_exams drop constraint csat_exams_kind_shape_check, drop constraint csat_exams_month_check,
--     drop constraint csat_exams_grade_check, drop constraint csat_exams_organizer_check,
--     drop constraint csat_exams_kind_check, drop column organizer, drop column grade, drop column exam_year;
--   alter table csat_exams add constraint csat_exams_kind_check check (kind in ('suneung','mock'));
--   뷰·csat_coverage 는 where 절만 뺀 이전 정의로 되돌린다.
