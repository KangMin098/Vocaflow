// apps/web/src/lib/csat/map/v62/__tests__/supply-sql-harness.ts
//
// v6.2 P-F7b/c — 보류 마이그레이션(C → B)을 **격리된 Postgres(PGlite, 프로세스 안 WASM)** 에 적용해 본다.
// 개발 DB 에 닿지 않는다. 의존 객체(auth · Workspace · 목표 · PLAN · DCP 문항 · 권한 함수)는 실제 정의의 최소 사본(스텁)이다.
// ⚠️ 한계: 연결이 하나라 진짜 동시 트랜잭션은 못 만든다 — 동시성은 「낡은 기대 상태 → 충돌」 · 고유 인덱스로 순차 검증한다.
import fs from 'node:fs'
import path from 'node:path'

import { PGlite } from '@electric-sql/pglite'

const MIG = path.resolve(__dirname, '../../../../../../../../supabase/migrations')
export const C_SQL = fs.readFileSync(path.join(MIG, '_pending_workspace_supply_c_qualification.sql'), 'utf8')
export const B_SQL = fs.readFileSync(path.join(MIG, '_pending_workspace_supply_b_orders.sql'), 'utf8')

/** 실제 스키마의 최소 사본 — 열 · 제약은 개발 DB 실측(2026-10-15) 그대로, 쓰지 않는 열은 뺐다 */
const STUB = `
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

create table public.csat_dcp_items (id uuid primary key, kind text not null, ref_id uuid not null);
create table public.csat_item_attempts (id bigserial primary key, user_id uuid not null, dcp_item_id uuid not null);
create table public.ineligible_sources (article_id uuid primary key);
create function public.csat_source_is_eligible(p_article_id uuid) returns boolean language sql stable as $$
  select not exists (select 1 from public.ineligible_sources where article_id = p_article_id) $$;
`

export async function openSupplyDb(opts: { withB?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(STUB)
  await db.exec(C_SQL)
  if (opts.withB !== false) await db.exec(B_SQL)
  return db
}

/** 이 세션의 auth.uid() 를 바꾼다(null = 로그아웃) */
export async function as(db: PGlite, uid: string | null): Promise<void> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
}

/** 오류 메시지(없으면 null) — 기대한 거절인지 문자열로 본다 */
export async function errorOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p
    return null
  } catch (e) {
    return (e as Error).message
  }
}

export const AXES = (o: Partial<Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H', string>> = {}) =>
  Object.fromEntries((['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const).map((k) => [k, { state: o[k] ?? 'pass' }]))
