-- apps/web/src/lib/csat/map/v62/__tests__/supply-i1-stub.sql
-- Factory I1 — supply-stub.sql 에 더하는 노출 원장 최소 사본(개발 DB information_schema 실측 2026-10-17 · 열 이름 · NULL 허용 동일).
-- PGlite 테스트(supply-i1.pglite.test.ts)와 실제 Postgres 스크립트(supply-i1-concurrency.mjs)가 같이 쓴다. 개발 DB 에 닿지 않는다.
create table public.learning_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, client_session_id uuid not null default gen_random_uuid(),
  activity text not null default 'theater', phase text not null default 'study', item_ref text not null, task_key text,
  help_level text, revealed_at timestamptz, explanation_viewed_at timestamptz, explanation_server_at timestamptz,
  help_received_at timestamptz, help_server_at timestamptz, deleted_at timestamptz, synthetic boolean not null default false);
create table public.learning_task_attempts (
  id bigserial primary key, user_id uuid not null, task_key text not null default 'r.central_meaning', item_ref text,
  session_id uuid, phase text not null default 'check', response jsonb not null default '{}', is_correct boolean,
  synthetic boolean not null default false, answered_at timestamptz not null default now());
create table public.csat_trap_attempts (id uuid primary key default gen_random_uuid(), user_id uuid not null, item_id text not null,
  choice smallint not null default 1, answer_trap text not null default 'x', picked_trap text not null default 'x', is_correct boolean,
  answered_at timestamptz not null default now());
create table public.csat_session_attempts (id uuid primary key default gen_random_uuid(), user_id uuid not null, item_id text not null,
  type_id text not null default 'R-TOPIC', correct boolean, confused boolean not null default false, sec integer not null default 1,
  answered_at timestamptz not null default now());
create table public.csat_review_queue (user_id uuid not null, item_id text not null, type_id text not null default 'R-TOPIC',
  due_at timestamptz not null default now(), stage smallint not null default 0, updated_at timestamptz not null default now());
-- 기존 Reveal Gate RPC의 최소 사본: 실제 함수는 csat_ec_private.item_answer_embargoed를 조회한다.
create table public.embargoed_items (item_id text primary key);
create function public.csat_ec_embargoed_items(p_items text[]) returns text[] language sql stable as $$
  select coalesce(array_agg(item_id), '{}') from public.embargoed_items where item_id = any(p_items)
$$;
