-- supabase/migrations/20261001110017_csat_hakpyeong_learner_exposure.sql
--
-- 학평을 기출 분석 시스템 전체에 — P2: 학습자에게 «발행된 학평만» 연다(2026-10-01 사용자 결정).
--
-- 1) csat_items_public — 평가원 문항 + **독립 검수를 통과해 발행된 분석이 있는** 학평 문항.
--    무엇이 학습자에게 보이는지는 코드가 아니라 이 뷰가 정한다(로더가 실수해도 미발행 학평이 새지 않게).
--    끝에 organizer · grade 열을 더한다(출처 필터용). 기존 열 순서·열 단위 권한(stem 제외)은 그대로다 —
--    `create or replace view` 는 열을 끝에만 붙일 수 있고, 기존 열 권한은 유지된다. 새 두 열만 권한을 준다.
-- 2) csat_item_skeletons — 학평 지문 골격(문장 길이 + 해설 인용 조각). 학평 원문 조각은 저장소에 커밋하지 않는다
--    (EBSi 재배포 금지 · 사용자 결정) → 평가원처럼 파일이 아니라 이 표에 굽는다. 학습자는 «발행된 분석이 있는
--    문항»의 행만 읽는다(RLS). 쓰기는 서비스 역할(굽기 스크립트)만.

begin;

create or replace view public.csat_items_public as
  select i.id, i.exam_id, i.no, i.section, i.in_scope, i.type_id, i.stem, i.answer, i.points, i.high_score,
         e.organizer, e.grade
    from csat_items i
    join csat_exams e on e.id = i.exam_id
   where e.organizer = 'kice'
      or (e.organizer = 'edu_office'
          and exists (select 1 from csat_item_analyses a where a.item_id = i.id and a.status = 'published'));

grant select (organizer, grade) on public.csat_items_public to authenticated;

create table if not exists public.csat_item_skeletons (
  item_id    text primary key references public.csat_items(id) on delete cascade,
  exam_id    text not null references public.csat_exams(id) on delete cascade,
  exam_label text not null,
  data       jsonb not null check (jsonb_typeof(data) = 'object'),
  -- 무엇으로 구웠는가 — 지문·분석이 바뀌면 다시 굽는다(굽기 스크립트가 비교)
  source_hash text not null,
  built_at   timestamptz not null default now(),
  constraint csat_item_skeletons_hakpyeong_only check (item_id like 'H%')
);
create index if not exists csat_item_skeletons_exam_idx on public.csat_item_skeletons(exam_id);

alter table public.csat_item_skeletons enable row level security;
revoke all on public.csat_item_skeletons from anon, authenticated;
grant select on public.csat_item_skeletons to authenticated;

drop policy if exists csat_item_skeletons_read_published on public.csat_item_skeletons;
create policy csat_item_skeletons_read_published on public.csat_item_skeletons
  for select to authenticated
  using (exists (select 1 from public.csat_item_analyses a
                  where a.item_id = csat_item_skeletons.item_id and a.status = 'published'));

comment on table public.csat_item_skeletons is
  '학평 지문 골격(문장 길이·해설 인용). 학평 원문 조각을 저장소에 커밋하지 않으려고 DB 에 둔다. 학습자는 발행된 분석이 있는 문항만(RLS)';

commit;
