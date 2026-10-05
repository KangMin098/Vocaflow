-- scripts/csat/error-evidence/isolated-pg/bootstrap.sql
-- 격리 PostgreSQL 17 에 Supabase 환경을 재현한다(운영 DB 2026-10-03 실측값 기준).
-- superuser = supabase_admin. 마이그레이션은 postgres(비 superuser · BYPASSRLS)로 적용한다 — 운영과 같은 소유 · 권한 조건.

create role postgres login nosuperuser bypassrls createrole inherit password 'postgres';
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit password 'auth';
grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, service_role to postgres;
grant create on database ec to postgres;   -- Supabase 와 같다(postgres 가 스키마를 만든다 — 20261005170000 csat_ec_private)

create schema extensions;
create extension pgcrypto with schema extensions;
grant usage on schema extensions to postgres, anon, authenticated, service_role;

create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
grant usage on schema auth to postgres, anon, authenticated, service_role;
grant select on auth.users to postgres;
grant references on auth.users to postgres;
grant execute on function auth.uid() to public;

-- public 스키마: 운영과 같은 기본 권한(postgres 가 만든 표 · 함수)
alter schema public owner to postgres;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant execute on functions to postgres, authenticated, service_role;

set role postgres;

-- 기존 표 7개(운영 정의 — 이 검증과 무관한 FK 대상 csat_types · vocaflow_levels 는 뺐다)
create table public.csat_exams (
  id text primary key, label text not null, kind text not null, year integer not null, month integer not null, form text,
  listening_end integer not null default 17, item_count integer not null default 0, has_answer_key boolean not null default false,
  source_note text, created_at timestamptz not null default now(), paper_form text, organizer text not null default 'kice',
  grade smallint not null default 3, exam_year integer not null, official_grade1_ratio numeric, official_stats_source text,
  diagnosis_ready boolean not null default false
);
create table public.csat_items (
  id text primary key, exam_id text not null references public.csat_exams(id) on delete cascade, no integer not null,
  section text not null, in_scope boolean not null default true, type_id text, stem text not null, passage text, choices jsonb,
  answer integer check (answer between 1 and 5), answers integer[], points integer, high_score boolean not null default false,
  body_ok boolean not null default true, raw_block text, created_at timestamptz not null default now(), official_error_rate numeric,
  ebs_linked boolean, unique (exam_id, no)
);
create table public.csat_dx_session (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  exam_id text references public.csat_exams(id), mode text not null check (mode in ('live', 'retake', 'app', 'diagnostic')),
  taken_at date not null, total_minutes smallint, entered_by text not null default 'learner', client_key uuid not null,
  raw_score smallint, grade smallint, created_at timestamptz not null default now(),
  check ((mode = 'diagnostic') = (exam_id is null)), constraint csat_dx_session_once unique (user_id, client_key)
);
create table public.csat_dx_response (
  session_id uuid not null references public.csat_dx_session(id) on delete cascade, item_no smallint not null check (item_no between 1 and 45),
  item_id text references public.csat_items(id), chosen_option smallint check (chosen_option between 1 and 5), is_correct boolean not null,
  confidence text not null default 'sure' check (confidence in ('sure', 'unsure', 'guess', 'timeout')),
  primary key (session_id, item_no)
);
create table public.csat_dx_answer_key (
  exam_id text not null references public.csat_exams(id) on delete cascade, no smallint not null, answers smallint[] not null,
  points smallint not null, source text not null, primary key (exam_id, no)
);
create table public.csat_dx_option_trap (
  item_id text not null references public.csat_items(id) on delete cascade, option_no smallint not null, trap_key text not null,
  source text not null check (source in ('analysis', 'admin')), analysis_version integer, reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null, primary key (item_id, option_no)
);
-- 앱 이벤트(허용 목록 CHECK 만 마이그레이션이 바꾼다 — 20261005150000)
create table public.funnel_events (id bigserial primary key, occurred_at timestamptz not null default now(), user_id uuid references auth.users(id) on delete set null,
  event text not null, surface text, meta jsonb not null default '{}', created_at timestamptz not null default now(),
  constraint funnel_events_event_check check (event = any (array[
        'teacher_hub_view', 'invite_shared',
        'fit_viewed', 'fit_analyzed', 'fit_shared', 'fit_share_opened', 'fit_signup_clicked',
        'fit_worksheet_printed', 'fit_level_moved', 'fit_sheet_opened',
        'landing_viewed', 'landing_cta_clicked', 'landing_demo_moved', 'landing_section_reached',
        'hub_promo_clicked', 'hub_hero_moved', 'catalog_viewed', 'volume_previewed',
        'wayfinder_opened', 'wayfinder_cta_clicked', 'screen_viewed', 'video_started', 'video_completed',
        'csat_evidence_opened', 'csat_atlas_scoped', 'csat_plan_speed_set', 'csat_plan_ordered',
        'csat_drill_answered', 'csat_drill_finished', 'csat_trap_opened',
        'csat_overlay_loaded', 'csat_overlay_located', 'csat_overlay_answered', 'csat_overlay_revealed',
        'csat_lecture_played', 'csat_lecture_ended',
        'csat_session_started', 'csat_session_answered', 'csat_session_explained', 'csat_session_marked',
        'csat_session_finished', 'csat_paper_read', 'csat_space_scoped', 'csat_space_opened',
        'csat_home_viewed', 'csat_resume_clicked', 'csat_review_started', 'csat_review_done',
        'csat_path_chosen', 'csat_item_back',
        'csat_workspace_created', 'csat_workspace_opened', 'csat_workspace_session_started', 'csat_workspace_edited',
        'csat_workspace_suggestion_applied',
        'csat_dx_viewed', 'csat_dx_profile_saved', 'csat_dx_attempt_saved', 'csat_dx_test_submitted',
        'csat_dx_habit_answered', 'csat_dx_history_compared',
        'csat_map_viewed', 'csat_map_node_opened', 'csat_map_goal_set', 'csat_map_task_toggled'
      ]::text[])));   -- 2026-10-05 라이브 목록(65) — 20261005150000 적용 전
create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade, role text not null default 'user' check (role in ('user', 'admin', 'curator'))
);
alter table public.csat_dx_session enable row level security;
alter table public.csat_dx_response enable row level security;
-- 운영과 같은 이름 · SELECT 전용(2026-10-05 실측)
create policy csat_dx_session_own_select on public.csat_dx_session for select to authenticated using (user_id = (select auth.uid()));
create policy csat_dx_response_own_select on public.csat_dx_response for select to authenticated
  using (exists (select 1 from public.csat_dx_session s where s.id = csat_dx_response.session_id and s.user_id = (select auth.uid())));
alter table public.csat_items enable row level security;
create policy csat_items_read on public.csat_items for select to authenticated using (false);
-- 보류 대상(운영 정의의 요지 — 정책 이름 · 조건은 운영과 같다)
create table public.csat_item_analyses (id bigserial primary key, item_id text not null references public.csat_items(id) on delete cascade,
  status text not null default 'draft', answer_locus jsonb, choice_analysis jsonb, solve_procedure jsonb, design_intent jsonb);
alter table public.csat_item_analyses enable row level security;
create policy csat_analyses_read on public.csat_item_analyses for select to authenticated using (status = 'published');
create table public.csat_item_skeletons (item_id text primary key references public.csat_items(id) on delete cascade, exam_id text, data jsonb not null default '{}');
alter table public.csat_item_skeletons enable row level security;
create policy csat_item_skeletons_read_published on public.csat_item_skeletons for select to authenticated
  using (exists (select 1 from public.csat_item_analyses a where a.item_id = csat_item_skeletons.item_id and a.status = 'published'));
create table public.csat_type_reports (type_id text primary key, status text not null default 'draft', failure_modes jsonb, open_questions jsonb,
  recurring_traps jsonb, procedure_steps jsonb, answer_locus_pattern jsonb);
alter table public.csat_type_reports enable row level security;
create policy csat_type_reports_read on public.csat_type_reports for select to authenticated using (status = 'published');
create table public.csat_dx_snapshot (id bigserial primary key, user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.csat_dx_session(id) on delete cascade, raw_score smallint, evidence jsonb not null default '{}');
alter table public.csat_dx_snapshot enable row level security;
create policy csat_dx_snapshot_own_select on public.csat_dx_snapshot for select to authenticated using (user_id = (select auth.uid()));
create table public.csat_session_attempts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, item_id text not null, type_id text, correct boolean not null, answered_at timestamptz not null default now());
alter table public.csat_session_attempts enable row level security;
create policy csat_session_attempts_own on public.csat_session_attempts for all to authenticated using (user_id = (select auth.uid()));
create table public.csat_trap_attempts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, item_id text not null, choice smallint, answer_trap text, picked_trap text, is_correct boolean not null, answered_at timestamptz not null default now());
alter table public.csat_trap_attempts enable row level security;
create policy csat_trap_attempts_own_insert on public.csat_trap_attempts for insert to authenticated with check (true);
create policy csat_trap_attempts_own_select on public.csat_trap_attempts for select to authenticated using ((select auth.uid()) = user_id);
create view public.csat_items_public as
 select i.id, i.exam_id, i.no, i.section, i.in_scope, i.type_id, i.stem, i.answer, i.points, i.high_score, e.organizer, e.grade
   from public.csat_items i join public.csat_exams e on e.id = i.exam_id
  where e.organizer = 'kice' or (e.organizer = 'edu_office' and exists (select 1 from public.csat_item_analyses a where a.item_id = i.id and a.status = 'published'));
revoke all on public.csat_items_public from anon, authenticated;
grant select (id, exam_id, no, section, in_scope, type_id, answer, points, high_score, organizer, grade) on public.csat_items_public to authenticated;

create function public.is_admin() returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from user_profiles where user_id = auth.uid() and role = 'admin')
$$;
grant execute on function public.is_admin() to anon, authenticated, service_role;
-- 기록 저장(운영 정의 그대로 — 2026-10-05 pg_get_functiondef). service_role 전용
CREATE OR REPLACE FUNCTION public.csat_dx_record_session(p_session jsonb, p_responses jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO csat_dx_session (user_id, exam_id, mode, taken_at, total_minutes, entered_by, client_key, raw_score, grade)
  VALUES ((p_session->>'user_id')::uuid, p_session->>'exam_id', p_session->>'mode', (p_session->>'taken_at')::date,
          (p_session->>'total_minutes')::smallint, coalesce(p_session->>'entered_by', 'learner'),
          (p_session->>'client_key')::uuid, (p_session->>'raw_score')::smallint, (p_session->>'grade')::smallint)
  ON CONFLICT ON CONSTRAINT csat_dx_session_once DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM csat_dx_session
     WHERE user_id = (p_session->>'user_id')::uuid AND client_key = (p_session->>'client_key')::uuid;
    RETURN v_id;
  END IF;

  INSERT INTO csat_dx_response (session_id, item_no, item_id, chosen_option, is_correct, confidence)
  SELECT v_id, (r->>'item_no')::smallint, r->>'item_id', (r->>'chosen_option')::smallint,
         (r->>'is_correct')::boolean, coalesce(r->>'confidence', 'sure')
    FROM jsonb_array_elements(p_responses) r;

  RETURN v_id;
END;
$function$;
revoke all on function public.csat_dx_record_session(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.csat_dx_record_session(jsonb,jsonb) to service_role;

reset role;
