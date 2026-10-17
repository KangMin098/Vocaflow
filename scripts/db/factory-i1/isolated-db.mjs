// scripts/db/factory-i1/isolated-db.mjs
//
// Factory I1 배포 — 격리 PostgreSQL 17(embedded-postgres) 임시 클러스터. 개발 DB 에 닿지 않는다.
// 의존 객체는 PR #280 시험과 같은 최소 사본(supply-stub.sql · supply-i1-stub.sql)을 쓰고,
// 2026-10-17 개발 DB 읽기 전용 실측에 맞춰 세 가지를 더 맞춘다:
//   · is_admin() search_path = public · 정의자(실측 proconfig {search_path=public}) — is_admin_or_curator() 는 i1 stub 이 실측과 같다
//   · 새 표 기본 ACL = anon/authenticated ALL(실측 pg_default_acl)
//   · supabase_migrations.schema_migrations 열 6개(version · statements · name · created_by · idempotency_key · rollback)
// 준비(저장소 의존성에 넣지 않는다): mkdir <tmp>/deps && cd <tmp>/deps && npm i embedded-postgres@17.10.0-beta.17 pg@8.13.1
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

export const ROOT = path.resolve(import.meta.dirname, '../../..')

export async function loadDeps(deps) {
  if (!deps || !fs.existsSync(path.join(deps, 'node_modules'))) throw new Error('--deps <embedded-postgres · pg 를 설치한 폴더> 가 필요하다')
  const req = createRequire(path.join(deps, 'package.json'))
  const { default: EmbeddedPostgres } = await import(pathToFileURL(req.resolve('embedded-postgres')).href)
  return { EmbeddedPostgres, pg: req('pg'), deps }
}

/** 클러스터 하나를 띄운다. newDb(name) 은 의존 사본을 깐 새 DB 의 Pool 을 돌려준다. */
export async function startCluster({ EmbeddedPostgres, pg, deps }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-i1-deploy-'))
  const port = 55000 + Math.floor(Math.random() * 900)
  const server = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'pw', port, persistent: false, onLog: () => {}, onError: () => {} })
  await server.initialise()
  const BIN = path.join(deps, 'node_modules', '@embedded-postgres', `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`, 'native', 'bin')
  const pgctl = (args) => execFileSync(path.join(BIN, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl'), args, { stdio: 'ignore' })
  pgctl(['-D', dir, '-o', `-p ${port}`, '-w', 'start'])
  const conn = (database) => ({ host: 'localhost', port, user: 'postgres', password: 'pw', database })
  const admin = new pg.Client(conn('postgres'))
  await admin.connect()
  let rolesMade = false
  const pools = []
  async function newDb(name) {
    await admin.query(`create database ${name}`)
    const pool = new pg.Pool({ ...conn(name), max: 30 })
    pools.push(pool)
    await bootstrap(pool, !rolesMade)
    rolesMade = true
    return pool
  }
  async function stop() {
    for (const p of pools) await p.end().catch(() => {})
    await admin.end().catch(() => {})
    try { pgctl(['-D', dir, '-m', 'immediate', 'stop']) } catch { /* 이미 멈춤 */ }
    fs.rmSync(dir, { recursive: true, force: true })
  }
  return { newDb, stop, port, version: (await admin.query('show server_version')).rows[0].server_version }
}

const T = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

async function bootstrap(pool, makeRoles) {
  let stub = T('apps/web/src/lib/csat/map/v62/__tests__/supply-stub.sql')
  // 역할은 클러스터 전역이라 두 번째 DB 부터는 만들지 않는다.
  if (!makeRoles) stub = stub.replace('create role anon nologin; create role authenticated nologin;', '')
  await pool.query(stub)
  await pool.query(T('apps/web/src/lib/csat/map/v62/__tests__/supply-i1-stub.sql'))
  await pool.query(`alter function public.is_admin() security definer;
    alter function public.is_admin() set search_path to 'public';
    alter default privileges in schema public grant all on tables to anon, authenticated;
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text,
      created_by text, idempotency_key text, rollback text[]);
    insert into supabase_migrations.schema_migrations (version, name) values ('20261014091841', 'funnel_allow_csat_meaning');`)
}
