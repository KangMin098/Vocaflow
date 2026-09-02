-- supabase/migrations/_pending_csat_analysis.sql
--
-- 평가원 기출 분석 파이프라인 — 원장 6표 + 검수 게이트 + 커버리지 RPC
--
-- ⚠️ **아직 적용하지 않았다.** CLAUDE.md 의 "마이그레이션 자동 적용 금지" 에 따라
--    승인 뒤 `apply_migration` 으로 올린다. 파일명이 `_pending_` 인 이유가 그것이다.
--
-- 설계 원칙 셋:
--   ① **검수 3인을 스키마가 강제한다.** `status='published'` 는 서로 다른 페르소나 3인이
--      pass 를 준 분석에만 허용된다(트리거). 코드가 실수해도 DB 가 막는다 —
--      여기가 뚫리면 "검수했다" 는 통계가 거짓이 되고, 그 거짓이 학습자에게 그대로 간다.
--   ② **지문 원문은 학습자에게 열지 않는다.** 평가원 저작물이다. RLS 로 인증 사용자에게는
--      분석(우리 저작물)만 열고, `passage`·`raw_block` 은 service_role 에만 보인다.
--      학습자 화면은 분석 안의 `answer_locus.quote`(짧은 인용)로 충분하다.
--   ③ **memory_state 류의 파생 컬럼을 두지 않는다.** 커버리지는 뷰·RPC 가 그때 센다.

-- ── 1. 유형 원장 ──────────────────────────────────────────────────────
create table if not exists csat_types (
  id            text primary key,                         -- 'R-BLANK'
  name          text not null,                            -- '빈칸 추론'
  section       text not null check (section in ('듣기', '독해', '장문')),
  in_scope      boolean not null default true,            -- 듣기 제외 사정권
  status        text not null default 'active' check (status in ('active', 'retired')),
  match_pattern text,                                     -- 발문 정규식 (classify-types.mjs 정본)
  created_at    timestamptz not null default now()
);
comment on table csat_types is '수능 영어 문항 유형 원장. 정본은 scripts/csat/classify-types.mjs 의 규칙표.';

-- ── 2. 회차 원장 ──────────────────────────────────────────────────────
create table if not exists csat_exams (
  id             text primary key,                        -- '2026' | '2014A' | 'M2606'
  label          text not null,                           -- '2026학년도 수능'
  kind           text not null check (kind in ('suneung', 'mock')),
  year           int not null,
  month          int not null,
  form           text,                                    -- '홀수' | 'A' | null
  -- 듣기 마지막 번호. 2015학년도부터 17, **2014학년도는 22** (A/B 수준별 시행).
  -- 상수로 두면 2014 두 회차의 듣기 10문항이 독해로 새어 들어온다 — 실제로 겪었다.
  listening_end  int not null default 17 check (listening_end between 10 and 25),
  item_count     int not null default 0,
  has_answer_key boolean not null default false,
  source_note    text,                                    -- 원본 공백 기록 ('정답표 PDF 가 듣기 대본' 등)
  created_at     timestamptz not null default now()
);

-- ── 3. 문항 원장 ──────────────────────────────────────────────────────
create table if not exists csat_items (
  id           text primary key,                          -- '2026#31'
  exam_id      text not null references csat_exams (id) on delete cascade,
  no           int not null check (no between 1 and 45),
  section      text not null check (section in ('듣기', '독해', '장문')),
  in_scope     boolean not null default true,
  type_id      text references csat_types (id),
  stem         text not null,
  passage      text,                                      -- 평가원 저작물 — RLS 로 service_role 전용
  choices      jsonb,                                     -- string[5]
  answer       int check (answer between 1 and 5),
  answers      int[],                                     -- 복수정답 회차
  points       int check (points in (2, 3)),
  high_score   boolean not null default false,
  body_ok      boolean not null default true,             -- 지문·선지 추출 성공 여부
  raw_block    text,                                      -- body_ok=false 일 때 원문 블록
  created_at   timestamptz not null default now(),
  unique (exam_id, no)
);
create index if not exists csat_items_type_idx on csat_items (type_id) where in_scope;
create index if not exists csat_items_exam_idx on csat_items (exam_id, no);

-- ── 4. 문항 분석 ──────────────────────────────────────────────────────
create table if not exists csat_item_analyses (
  id               uuid primary key default gen_random_uuid(),
  item_id          text not null references csat_items (id) on delete cascade,
  version          int not null default 1,
  measured_ability text not null,
  design_intent    text not null,
  answer_locus     jsonb,                                 -- {sentence_index:int[], quote, reasoning}
  choice_analysis  jsonb not null default '[]'::jsonb,    -- [{n, verdict, trap, why_tempting, how_to_reject}]
  solve_procedure  jsonb not null default '[]'::jsonb,    -- [{step, on_fail}]
  time_budget_sec  int check (time_budget_sec between 20 and 400),
  difficulty       jsonb,                                 -- {predicted:0~1, drivers:text[]}
  required_vocab   text[] not null default '{}',
  answer_unknown   boolean not null default false,        -- 정답표 없는 회차
  body_recovered   boolean not null default false,        -- raw_block 에서 복원
  status           text not null default 'draft'
                     check (status in ('draft', 'in_review', 'published', 'rejected')),
  source           text not null default 'claude-code-drain',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (item_id, version)
);
create index if not exists csat_analyses_item_idx on csat_item_analyses (item_id);
create index if not exists csat_analyses_status_idx on csat_item_analyses (status);

-- ── 5. 3인 검수 ───────────────────────────────────────────────────────
-- persona 를 unique 로 묶는다. 같은 입장이 두 번 세어지면 "3인" 이 1인 3회가 된다.
create table if not exists csat_analysis_reviews (
  id          uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references csat_item_analyses (id) on delete cascade,
  persona     text not null check (persona in ('setter', 'analyst', 'tutor')),
  verdict     text not null check (verdict in ('pass', 'revise', 'fail')),
  findings    jsonb not null default '[]'::jsonb,
  checked     jsonb not null default '[]'::jsonb,         -- 무엇을 실제로 대조했는지
  reviewed_at timestamptz not null default now(),
  unique (analysis_id, persona)
);
create index if not exists csat_reviews_analysis_idx on csat_analysis_reviews (analysis_id);

-- ── 6. 검수 게이트 — published 는 3인 pass 없이는 불가 ────────────────
create or replace function csat_guard_published() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n_pass int;
begin
  if new.status <> 'published' then
    return new;
  end if;
  select count(distinct persona) into n_pass
    from csat_analysis_reviews
   where analysis_id = new.id and verdict = 'pass';
  if n_pass < 3 then
    raise exception
      '분석 %: 서로 다른 페르소나 3인의 pass 가 필요하다 (현재 %)', new.item_id, n_pass
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists csat_guard_published_trg on csat_item_analyses;
create trigger csat_guard_published_trg
  before insert or update of status on csat_item_analyses
  for each row execute function csat_guard_published();

-- 검수가 취소·강등되면 published 도 내려간다. 안 그러면 게이트가 삽입 시점에만 사는 문이 된다.
create or replace function csat_demote_on_review_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  aid uuid := coalesce(new.analysis_id, old.analysis_id);
  n_pass int;
begin
  select count(distinct persona) into n_pass
    from csat_analysis_reviews
   where analysis_id = aid and verdict = 'pass';
  if n_pass < 3 then
    update csat_item_analyses set status = 'in_review', updated_at = now()
     where id = aid and status = 'published';
  end if;
  return null;
end;
$$;

drop trigger if exists csat_demote_on_review_change_trg on csat_analysis_reviews;
create trigger csat_demote_on_review_change_trg
  after insert or update or delete on csat_analysis_reviews
  for each row execute function csat_demote_on_review_change();

-- ── 7. 유형별 분석 결과 ───────────────────────────────────────────────
create table if not exists csat_type_reports (
  type_id              text primary key references csat_types (id) on delete cascade,
  n_analyzed           int not null default 0,
  recurring_traps      jsonb not null default '[]'::jsonb,
  answer_locus_pattern text,
  procedure_steps      jsonb not null default '[]'::jsonb,
  failure_modes        jsonb not null default '[]'::jsonb,
  time_budget_sec      int,
  open_questions       jsonb not null default '[]'::jsonb,
  status               text not null default 'draft' check (status in ('draft', 'published')),
  updated_at           timestamptz not null default now()
);

-- ── 8. 커버리지 — 저장하지 않고 그때 센다 ─────────────────────────────
-- 99점 커버의 정의: 총점 100 = 듣기 37 + 독해 63, 배점 단위 2·3점 → **독해 실점 0**.
-- 곧 회차마다 사정권 문항이 전부 published 여야 한다. `covered_points` 가 그 회차의
-- 사정권 배점 합과 같은지로 본다.
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
as $$
  select
    e.id,
    e.label,
    e.kind,
    count(*) filter (where i.in_scope)::int,
    count(*) filter (where i.in_scope and a.id is not null)::int,
    count(*) filter (where i.in_scope and a.status = 'published')::int,
    coalesce(sum(i.points) filter (where i.in_scope), 0)::int,
    coalesce(sum(i.points) filter (where i.in_scope and a.status = 'published'), 0)::int,
    coalesce(sum(i.points) filter (where i.in_scope), 0)
      = coalesce(sum(i.points) filter (where i.in_scope and a.status = 'published'), 0)
      and count(*) filter (where i.in_scope) > 0
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
$$;

-- ── 9. RLS — 지문 원문은 학습자에게 열지 않는다 ───────────────────────
alter table csat_types            enable row level security;
alter table csat_exams            enable row level security;
alter table csat_items            enable row level security;
alter table csat_item_analyses    enable row level security;
alter table csat_analysis_reviews enable row level security;
alter table csat_type_reports     enable row level security;

-- 유형·회차 메타는 공개해도 된다 (저작물이 아니다)
drop policy if exists csat_types_read on csat_types;
create policy csat_types_read on csat_types for select to anon, authenticated using (true);
drop policy if exists csat_exams_read on csat_exams;
create policy csat_exams_read on csat_exams for select to anon, authenticated using (true);

-- 문항 행은 열되, **지문 원문 컬럼은 뷰로 가린다** (컬럼 단위 RLS 가 없으므로 뷰가 유일한 수단)
drop policy if exists csat_items_read on csat_items;
create policy csat_items_read on csat_items for select to authenticated using (false);

create or replace view csat_items_public
with (security_invoker = true) as
  select id, exam_id, no, section, in_scope, type_id, stem, answer, points, high_score
    from csat_items;
comment on view csat_items_public is
  '학습자용 문항 메타. passage·choices·raw_block(평가원 저작물)은 일부러 뺐다.';

-- 분석은 우리 저작물 — published 만 인증 사용자에게 연다
drop policy if exists csat_analyses_read on csat_item_analyses;
create policy csat_analyses_read on csat_item_analyses
  for select to authenticated using (status = 'published');

drop policy if exists csat_type_reports_read on csat_type_reports;
create policy csat_type_reports_read on csat_type_reports
  for select to authenticated using (status = 'published');

-- 검수 기록은 운영 자료다. 학습자에게 열지 않는다(정책 없음 = service_role 만).
