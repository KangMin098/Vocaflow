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
  check ((mode = 'diagnostic') = (exam_id is null)), unique (user_id, client_key)
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
create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade, role text not null default 'user' check (role in ('user', 'admin', 'curator'))
);
alter table public.csat_dx_session enable row level security;
alter table public.csat_dx_response enable row level security;
create policy own_session on public.csat_dx_session for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_response on public.csat_dx_response for all to authenticated using (exists (select 1 from public.csat_dx_session s where s.id = session_id and s.user_id = auth.uid()));

create function public.is_admin() returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from user_profiles where user_id = auth.uid() and role = 'admin')
$$;
grant execute on function public.is_admin() to anon, authenticated, service_role;

reset role;
