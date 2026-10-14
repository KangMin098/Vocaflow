-- apps/web/src/lib/csat/map/v62/__tests__/supply-stub.sql
-- v6.2 P-F7/F8 — 보류 마이그레이션 격리 시험용 의존 객체 최소 사본(개발 DB 실측 2026-10-15 열 · 제약). PGlite 테스트와 실제 Postgres 동시성 스크립트가 같이 쓴다.
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role anon nologin; create role authenticated nologin;

create table public.admins (user_id uuid primary key, role text not null);
create function public.is_admin_or_curator() returns boolean language sql stable as $$
  select exists (select 1 from public.admins where user_id = auth.uid()) $$;
create function public.is_admin() returns boolean language sql stable as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and role = 'admin') $$;

create table public.csat_map_goal_version (
  id bigserial primary key, user_id uuid not null references auth.users(id) on delete cascade,
  target_score smallint not null default 80, client_key uuid not null default gen_random_uuid(), created_at timestamptz not null default now());
create table public.learner_workspace (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  template_id text not null default 'ws.reading', canon_version text not null default 'v6.2',
  status text not null default 'active' check (status in ('active','paused','closed')), created_at timestamptz not null default now());
create table public.learner_workspace_plan (
  id bigserial primary key, workspace_id uuid not null references public.learner_workspace(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, plan_version integer not null,
  plan jsonb not null default '{"tasks":[],"order":[]}', reason text not null default 'initial',
  canon_version text not null default 'v6.2', goal_version_id bigint references public.csat_map_goal_version(id),
  client_key uuid not null default gen_random_uuid(), created_at timestamptz not null default now(),
  unique (workspace_id, plan_version));

create table public.csat_dcp_items (id uuid primary key, kind text not null, ref_id uuid, type text not null default 'vocab_choice',
  payload jsonb not null default '{}', answer_key jsonb);
create table public.csat_items (id text primary key, exam_id text not null, no integer, stem text, passage text, choices jsonb, answer integer);
create table public.csat_dx_session (id uuid primary key default gen_random_uuid(), user_id uuid not null, exam_id text not null);
create table public.csat_dx_response (session_id uuid not null references public.csat_dx_session(id), item_no smallint, item_id text);
create table public.csat_item_attempts (id bigserial primary key, user_id uuid not null, dcp_item_id uuid not null);
create table public.ineligible_sources (article_id uuid primary key);
create function public.csat_source_is_eligible(p_article_id uuid) returns boolean language sql stable as $$
  select not exists (select 1 from public.ineligible_sources where article_id = p_article_id) $$;
