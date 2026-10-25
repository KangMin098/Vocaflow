// scripts/db/lcp-story-s3/verify-isolated.ts
//
// LCP Story S3 SQL 격리 검증 — 임시 DB 에만 적용한다. 공유 개발 DB 에 접속하지 않는다.
//
//   pnpm exec tsx scripts/db/lcp-story-s3/verify-isolated.ts                                  # PGlite(메모리, 연결 1)
//   pnpm exec tsx scripts/db/lcp-story-s3/verify-isolated.ts --engine pg17 --deps <dir>       # 실제 PostgreSQL 17 임시 클러스터
//     <dir> = embedded-postgres@17 + pg 를 설치한 폴더(저장소 의존성 아님 — scripts/db/factory-i1/isolated-db.mjs 와 같은 준비).
//
// 1) Supabase 와 비슷한 바탕(역할 anon · authenticated · service_role, auth.uid(), public 기본 권한, 원본 도서 · 프로필 ·
//    texts · content_chunks · reading_sessions 표, supabase_migrations.schema_migrations)을 만들고
// 2) supabase/migrations/_pending_lcp_story_s3_schema.sql 파일 바이트를 그대로 적용한다(pg17 은 승인형 러너의 applyStage 로)
// 3) S2 TypeScript(packages/library-pipeline/src/story)가 계산한 해시 · release_key 와 DB 가 다시 계산한 값을 대조하고
// 4) 권한 · 행위자 위조 · 결속 변조 · 자기 승인 · 보류 발행 · 직접 행 조작 · 철회 · 불변 · 격리(quarantine) · 원본 무변경을 시험한다.
// 5) pg17 만: 러너 사후 검증 · 재적용 차단 · 원본 지문 롤백, 그리고 두 연결의 실제 동시 발행 · 철회 · 진도 경합.
// 결과는 JSON 한 개(stdout). 실패가 하나라도 있으면 종료 1. 실행하지 못한 항목은 not_run 으로 따로 센다(통과가 아니다).

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import * as S from '../../../packages/library-pipeline/src/story/index'
import { sourceIdentity } from '../../../packages/library-pipeline/src/story/validate'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')
const SCHEMA_SQL = join(REPO, 'supabase', 'migrations', '_pending_lcp_story_s3_schema.sql')
const QUARANTINE_SQL = join(REPO, 'supabase', 'migrations', '_pending_lcp_story_s3_quarantine.sql')
const FIXTURES = join(REPO, 'packages', 'library-pipeline', 'src', 'story', 'fixtures')

interface Db {
  exec(sql: string): Promise<unknown>
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}

interface PgClient extends Db {
  connect(): Promise<void>
  end(): Promise<void>
  processID?: number
}

interface Engine {
  name: 'pglite' | 'pg17'
  version: string
  db: Db
  /** pg17 만 — 같은 DB 에 새 연결(동시성 시험) */
  connect?: (database?: string) => Promise<PgClient>
  createDatabase?: (name: string) => Promise<void>
  stop(): Promise<void>
}

interface RunnerModule {
  STAGES: Record<string, { version: string; sha256: string; path: string }>
  offlineCheck(stage: string): { blocks: string[]; text: string | null }
  applyStage(client: unknown, stage: string, o: { text: string; approvedBy: string }): Promise<{
    ok: boolean
    outcome: string
    legacy: { unchanged: boolean } | null
    error?: { message: string }
  }>
  runVerify(client: unknown, stage: string): Promise<{ ok: boolean; rows: Array<{ check: string; ok: boolean; detail: unknown }> }>
  readHistory(client: unknown): Promise<Array<{ version: string; sha256: string }>>
}

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function startPglite(): Promise<Engine> {
  // PGlite 는 apps/web 이 이미 가진 devDependency 를 그대로 쓴다(의존성 · lockfile 변경 없음).
  const requireFromWeb = createRequire(join(REPO, 'apps', 'web', 'package.json'))
  const { PGlite } = requireFromWeb('@electric-sql/pglite') as {
    PGlite: new () => Db & { close(): Promise<void> }
  }
  const db = new PGlite()
  const version = (await db.query<{ v: string }>("select current_setting('server_version') as v")).rows[0]!.v
  return { name: 'pglite', version: `PGlite 0.5.8 (PostgreSQL ${version})`, db, stop: () => db.close() }
}

async function startPg17(deps: string): Promise<Engine> {
  const req = createRequire(join(deps, 'package.json'))
  const { default: EmbeddedPostgres } = (await import(pathToFileURL(req.resolve('embedded-postgres')).href)) as {
    default: new (o: Record<string, unknown>) => { initialise(): Promise<void> }
  }
  const pg = req('pg') as { Client: new (o: Record<string, unknown>) => PgClient }
  const dir = mkdtempSync(join(tmpdir(), 'vf-lcp-story-s3-'))
  const port = 55000 + Math.floor(Math.random() * 900)
  const server = new EmbeddedPostgres({
    databaseDir: dir, user: 'postgres', password: 'pw', port, persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {}, onError: () => {},
  })
  await server.initialise()
  const platform = process.platform === 'win32' ? 'windows' : process.platform
  const bin = join(deps, 'node_modules', '@embedded-postgres', `${platform}-${process.arch}`, 'native', 'bin')
  const pgctl = (args: string[]) =>
    execFileSync(join(bin, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl'), args, { stdio: 'ignore' })
  pgctl(['-D', dir, '-o', `-p ${port}`, '-w', 'start'])
  const clients: PgClient[] = []
  const connect = async (database = 'postgres'): Promise<PgClient> => {
    const c = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'pw', database })
    await c.connect()
    clients.push(c)
    return c
  }
  const main = await connect()
  const db: Db = { exec: (sql) => main.query(sql), query: (sql, params) => main.query(sql, params) }
  const version = (await main.query<{ v: string }>("select current_setting('server_version') as v")).rows[0]!.v
  return {
    name: 'pg17',
    version: `PostgreSQL ${version} (embedded-postgres, isolated cluster)`,
    db,
    connect,
    createDatabase: async (name) => { await main.query(`create database ${name}`) },
    stop: async () => {
      for (const c of clients) await c.end().catch(() => {})
      try { pgctl(['-D', dir, '-m', 'immediate', 'stop']) } catch { /* 이미 멈춤 */ }
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Status = 'pass' | 'fail' | 'not_run'
interface Result {
  id: string
  title: string
  status: Status
  detail?: string
}

const results: Result[] = []
const NOW = new Date()

async function check(id: string, title: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
    results.push({ id, title, status: 'pass' })
  } catch (e) {
    results.push({ id, title, status: 'fail', detail: e instanceof Error ? e.message : String(e) })
  }
}

function notRun(id: string, title: string, detail: string): void {
  results.push({ id, title, status: 'not_run', detail })
}

function eq(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: got ${String(actual)} expected ${String(expected)}`)
}

async function rejects(p: Promise<unknown>, pattern: RegExp, label: string): Promise<void> {
  try {
    await p
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (pattern.test(msg)) return
    throw new Error(`${label}: unexpected error "${msg}" (wanted ${pattern})`)
  }
  throw new Error(`${label}: expected failure ${pattern} but it succeeded`)
}

function fixture(name: string): Json {
  return JSON.parse(readFileSync(join(FIXTURES, `gull-rock.${name}.json`), 'utf8')) as Json
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

// ── S2 쪽 기대값 ─────────────────────────────────────────────────────────────

const WORK = 'gull-rock-r1'
const realSnapshot = fixture('snapshot')
realSnapshot.synthetic = false
realSnapshot.snapshot_id = 'gull-rock-db-test'
realSnapshot.edition.source_kind = 'external_file'
realSnapshot.edition.edition_label = 'Isolated DB test copy of the synthetic Gull Rock text (test-only)'
realSnapshot.rights = [
  {
    asset: 'source_text',
    status: 'claimed_by_source',
    basis: '격리 시험용 주장 기록 — 실제 권리 심사 아님',
    evidence_ref: 'test-only-evidence',
    checked_by: null,
    checked_at: null,
  },
]

function must<T>(c: S.Checked<T>, label: string): T {
  if (!c.value) throw new Error(`${label}: ${JSON.stringify(c.errors)}`)
  return c.value
}

const source = must(S.validateSnapshot(realSnapshot, NOW), 'S2 snapshot')
const policyJson = fixture('policy')
const policy = must(S.validatePolicy(policyJson, source), 'S2 policy')

function produce(key: string, art: Json, sessionId = 'producer-session'): Json {
  art.produced_by = { agent: 'claude-code', session_id: sessionId, provenance: 'ai_generated' }
  art.binding = {
    source_sha256: source.sha256,
    source_identity_sha256: source.identity_sha256,
    policy_sha256: policy.policy_sha256,
    target_sha256: policy.items.get(key)!.target_sha256,
  }
  return art
}

function editionResult(key: string, art: Json): S.EditionResult {
  return must(S.validateEdition(art, { source, policy, edition_key: key, task_id: `${WORK}:${key}` }), `S2 edition ${key}`)
}

function review(key: string, result: S.EditionResult, over: Json = {}): Json {
  return {
    schema: 'lcp-story/review@1',
    review_id: `review-${key}-${(over.review_id as string | undefined) ?? 'a'}`,
    binding: S.reviewBindingFor({ source, policy, edition_key: key, task_id: `${WORK}:${key}` }, result),
    reviewer: { kind: 'ai_model', agent: 'codex', session_id: 'reviewer-session', role: '독립 내용 검수(격리 시험)' },
    provenance: 'ai_review',
    checks: S.requiredChecks(result.edition).map((check) => ({ check, verdict: 'pass', note: '격리 시험 입력' })),
    issues: [],
    verdict: 'approve',
    reviewed_at: '2026-10-25T01:30:00+09:00',
    ...over,
  }
}

const storyV1 = produce('story-b1', fixture('story-b1.edition.out'))
const storyV1Result = editionResult('story-b1', storyV1)
const storyV2 = produce('story-b1', fixture('story-b1.edition.out'))
storyV2.units[3].text = storyV2.units[3].text.replace('could not get up', 'could not stand up')
const storyV2Result = editionResult('story-b1', storyV2)
const easyV1 = produce('easy-a2', fixture('easy-a2.edition.out'))
const easyV1Result = editionResult('easy-a2', easyV1)
const easyV2 = produce('easy-a2', fixture('easy-a2.edition.out'), 'admin-producer-session')
easyV2.units[0].text = easyV2.units[0].text.replace('Mara was twelve.', 'Mara was twelve years old.')
const easyV2Result = editionResult('easy-a2', easyV2)
const easyV3 = produce('easy-a2', fixture('easy-a2.edition.out'))
easyV3.units[2].text = easyV3.units[2].text.replace('a big storm', 'a very big storm')
easyV3.assets = [
  { asset_id: 'a-voice', kind: 'audio', origin: 'newly_produced', unit_ids: ['e1'], rights_status: 'confirmed', rights_evidence_ref: 'x', alignment: 'verified' },
]
const easyV3Result = editionResult('easy-a2', easyV3)
const storyV3 = produce('story-b1', fixture('story-b1.edition.out'))
storyV3.units[5].text = storyV3.units[5].text.replace("She didn't stop to be afraid.", 'She did not stop to be afraid.')
const storyV3Result = editionResult('story-b1', storyV3)

// ── 실행 ────────────────────────────────────────────────────────────────────

const U = {
  admin: '00000000-0000-4000-8000-00000000000a',
  producer: '00000000-0000-4000-8000-00000000000b',
  reviewer: '00000000-0000-4000-8000-00000000000c',
  learner: '00000000-0000-4000-8000-00000000000d',
  suspended: '00000000-0000-4000-8000-00000000000e',
}
type Actor = { role: 'anon' | 'authenticated' | 'service_role'; sub: string | null }
const A = {
  admin: { role: 'authenticated', sub: U.admin } as Actor,
  producer: { role: 'authenticated', sub: U.producer } as Actor,
  reviewer: { role: 'authenticated', sub: U.reviewer } as Actor,
  learner: { role: 'authenticated', sub: U.learner } as Actor,
  suspended: { role: 'authenticated', sub: U.suspended } as Actor,
  noSub: { role: 'authenticated', sub: null } as Actor,
  anon: { role: 'anon', sub: null } as Actor,
  service: { role: 'service_role', sub: null } as Actor,
}

const ROLES = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
`

const BOOTSTRAP = `
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.user_profiles (
  user_id uuid primary key, role text not null default 'user', status text not null default 'active', display_name text);
create table public.library_books (
  id uuid primary key default gen_random_uuid(), source text not null, source_id text, status text not null default 'queued',
  title text not null, copyright_safe_in_kr boolean not null default false, published_at timestamptz,
  unique (source, source_id));
alter table public.library_books enable row level security;
create policy anyone_read_published_safe on public.library_books for select using (status = 'published' and copyright_safe_in_kr = true);
create table public.texts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, title text not null, status text default 'in_progress',
  progress_percent numeric default 0, library_book_id uuid references public.library_books (id), chapter_idx integer);
create table public.content_chunks (hash text primary key, content text not null, byte_size integer not null, ref_count integer not null default 0);
create table public.reading_sessions (id uuid primary key default gen_random_uuid(), text_id uuid references public.texts (id));
create schema supabase_migrations;
create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text,
  created_by text, idempotency_key text, rollback text[]);
insert into supabase_migrations.schema_migrations (version, name) values ('20261023082930', 'existing_history_row');
insert into public.user_profiles (user_id, role, status) values
  ('${U.admin}', 'admin', 'active'), ('${U.producer}', 'curator', 'active'), ('${U.reviewer}', 'curator', 'active'),
  ('${U.learner}', 'user', 'active'), ('${U.suspended}', 'curator', 'suspended');
insert into public.library_books (id, source, source_id, status, title, copyright_safe_in_kr, published_at) values
  ('10000000-0000-4000-8000-000000000001', 'standard_ebooks', 'test-se-1', 'published', 'Legacy Published', true, now()),
  ('10000000-0000-4000-8000-000000000002', 'gutenberg', 'test-pg-2', 'ready', 'Legacy Ready', true, null),
  ('10000000-0000-4000-8000-000000000003', 'manual', 'test-m-3', 'archived', 'Legacy Archived', false, null);
insert into public.texts (id, user_id, title, status, progress_percent, library_book_id, chapter_idx) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000d', 'Legacy Ch 1', 'completed', 100,
   '10000000-0000-4000-8000-000000000001', 1);
insert into public.content_chunks (hash, content, byte_size, ref_count) values ('legacy-chunk-1', 'Legacy chapter body.', 20, 1);
insert into public.reading_sessions (text_id) values ('20000000-0000-4000-8000-000000000001');
`

async function main(): Promise<void> {
  const schemaSql = readFileSync(SCHEMA_SQL, 'utf8')
  const quarantineSql = readFileSync(QUARANTINE_SQL, 'utf8')
  const engineName = argValue('--engine') ?? 'pglite'
  if (engineName !== 'pglite' && engineName !== 'pg17') throw new Error('--engine pglite|pg17')
  const deps = argValue('--deps')
  if (engineName === 'pg17' && !deps) throw new Error('--engine pg17 needs --deps <embedded-postgres + pg folder>')
  const engine = engineName === 'pg17' ? await startPg17(deps!) : await startPglite()
  const runner = (await import(pathToFileURL(join(HERE, 'deploy.mjs')).href)) as RunnerModule
  const db = engine.db
  await db.exec(ROLES)
  await db.exec(BOOTSTRAP)

  async function as<T = Json>(who: Actor, sql: string, params: unknown[] = []): Promise<T[]> {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [who.sub ?? ''])
    await db.exec(`set role ${who.role}`)
    try {
      return (await db.query<T>(sql, params)).rows
    } finally {
      await db.exec('reset role')
    }
  }
  const one = async <T = Json>(who: Actor, sql: string, params: unknown[] = []): Promise<T> => {
    const rows = await as<T>(who, sql, params)
    if (rows.length === 0) throw new Error(`no row: ${sql}`)
    return rows[0]!
  }
  const legacyHash = async (): Promise<string> =>
    (
      await db.query<{ h: string }>(
        `select md5(coalesce((select string_agg(row_to_json(b)::text, '|' order by b.id) from public.library_books b), '')
              || '#' || coalesce((select string_agg(row_to_json(p)::text, '|' order by p.user_id) from public.user_profiles p), '')
              || '#' || (select count(*) from pg_attribute where attrelid = 'public.library_books'::regclass and attnum > 0)
              || '#' || (select count(*) from pg_policies where schemaname = 'public')) as h`,
      )
    ).rows[0]!.h

  const legacyBefore = await legacyHash()

  await check('T01', engine.name === 'pg17'
    ? '승인형 러너 applyStage 로 초안 SQL 을 한 트랜잭션에 적용 · 원본 지문 불변 · 이력 SHA = 승인값 · 러너 사후 검증 통과'
    : '초안 SQL 이 Supabase 유사 바탕에 그대로 적용된다', async () => {
    if (engine.name === 'pglite') {
      await db.exec(schemaSql)
      return
    }
    const off = runner.offlineCheck('schema')
    if (off.blocks.length || !off.text) throw new Error(off.blocks.join('; '))
    eq(off.text, schemaSql, 'runner body = pending file')
    const r = await runner.applyStage(db, 'schema', { text: off.text, approvedBy: 'isolated-pg17-test' })
    if (!r.ok) throw new Error(`apply ${r.outcome}: ${r.error?.message ?? ''}`)
    eq(r.legacy?.unchanged, true, 'legacy fingerprint unchanged')
    const history = await runner.readHistory(db)
    eq(history.find((h) => h.version === runner.STAGES.schema!.version)?.sha256, runner.STAGES.schema!.sha256, 'history sha')
    const v = await runner.runVerify(db, 'schema')
    if (!v.ok) throw new Error(`runner verify: ${JSON.stringify(v.rows.filter((x) => !x.ok))}`)
  })

  await check('T02', '원본 도서 · 프로필 행 · 열 · 정책이 적용 전후 같다(영향 0)', async () => {
    eq(await legacyHash(), legacyBefore, 'legacy hash')
  })

  const tables = ['sources', 'policies', 'edition_slots', 'edition_versions', 'reviews', 'rights_decisions', 'releases',
    'release_units', 'reading_progress', 'action_log']
  await check('T03', 'story 표: RLS 켜짐 · anon/authenticated/service_role 에 스키마 USAGE · 표 권한 없음', async () => {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const usage = await db.query<{ u: boolean }>(`select has_schema_privilege($1, 'story', 'USAGE') as u`, [role])
      eq(usage.rows[0]!.u, false, `${role} schema usage`)
      for (const t of tables) {
        const r = await db.query<{ p: boolean }>(
          `select has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') as p`, [role, `story.${t}`])
        eq(r.rows[0]!.p, false, `${role} story.${t}`)
      }
    }
    const rls = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'story' and c.relkind = 'r' and c.relrowsecurity`)
    eq(rls.rows[0]!.n, tables.length, 'rls tables')
  })

  await check('T04', 'RPC 실행 권한 행렬(관리=authenticated · 서가=anon+authenticated · 나머지 없음 · story.* 내부 함수 없음)', async () => {
    const expected: Record<string, Record<string, boolean>> = {
      'public.story_admin_register_source(jsonb)': { anon: false, authenticated: true, service_role: false },
      'public.story_admin_register_policy(uuid,jsonb)': { anon: false, authenticated: true, service_role: false },
      'public.story_admin_submit_edition(uuid,jsonb)': { anon: false, authenticated: true, service_role: false },
      'public.story_admin_submit_review(uuid,jsonb)': { anon: false, authenticated: true, service_role: false },
      'public.story_admin_record_rights(uuid,text,text,text,text)': { anon: false, authenticated: true, service_role: false },
      'public.story_admin_publish(uuid)': { anon: false, authenticated: true, service_role: false },
      'public.story_admin_withdraw(text,text)': { anon: false, authenticated: true, service_role: false },
      'public.story_admin_list_slots()': { anon: false, authenticated: true, service_role: false },
      'public.story_admin_get_bundle(uuid)': { anon: false, authenticated: true, service_role: false },
      'public.story_catalog()': { anon: true, authenticated: true, service_role: false },
      'public.story_read_unit(text,integer)': { anon: false, authenticated: true, service_role: false },
      'public.story_record_progress(text,integer)': { anon: false, authenticated: true, service_role: false },
      'public.story_my_progress()': { anon: false, authenticated: true, service_role: false },
    }
    for (const [fn, roles] of Object.entries(expected)) {
      for (const [role, want] of Object.entries(roles)) {
        const r = await db.query<{ p: boolean }>(`select has_function_privilege($1, $2, 'EXECUTE') as p`, [role, fn])
        eq(r.rows[0]!.p, want, `${role} ${fn}`)
      }
    }
    const internal = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'story' and (has_function_privilege('anon', p.oid, 'EXECUTE')
          or has_function_privilege('authenticated', p.oid, 'EXECUTE') or has_function_privilege('service_role', p.oid, 'EXECUTE'))`)
    eq(internal.rows[0]!.n, 0, 'story internal functions executable')
    const definers = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'story\\_%' and p.prosecdef
          and coalesce(array_to_string(p.proconfig, ','), '') = 'search_path=pg_catalog, pg_temp'`)
    eq(definers.rows[0]!.n, Object.keys(expected).length, 'definer + search_path pg_catalog, pg_temp(마지막)')
  })

  await check('T05', 'DB 정본 직렬화 = S2 canonicalJson(정책 · 판본 · 정체 · 까다로운 문자열)', async () => {
    const tricky = { a: 'q" b\\ c\u0001\u001f t\t n\n emoji\u{1F600} ls  é del\u007f', b: [1, -2, 0, true, false, null, { z: 1, A: 2, _: 3 }], K: '' }
    const samples: unknown[] = [policyJson, storyV1, S.policyCore(policy.policy), tricky,
      { identity: sourceIdentity(source.snapshot, source.sha256) }]
    for (const [i, v] of samples.entries()) {
      const r = await db.query<{ c: string }>(`select story.canonical_json($1::jsonb) as c`, [JSON.stringify(v)])
      eq(r.rows[0]!.c, S.canonicalJson(v), `sample ${i}`)
    }
    await rejects(db.query(`select story.canonical_json('{"x":1.5}'::jsonb)`), /story:canonical_unsupported_number/, 'float')
    // jsonb 는 1.0 의 소수 자릿수를 남기지만 JS 는 1 로 쓴다 — 표기가 갈리므로 거부해야 한다.
    await rejects(db.query(`select story.canonical_json('{"x":1.0}'::jsonb)`), /story:canonical_unsupported_number/, 'scale')
    // 1e3 은 jsonb · JS 모두 1000 으로 정규화된다 — 같은 정본이어야 한다.
    const exp = await db.query<{ c: string }>(`select story.canonical_json('{"x":1e3}'::jsonb) as c`)
    eq(exp.rows[0]!.c, S.canonicalJson(JSON.parse('{"x":1e3}')), 'exponent parity')
  })

  let sourceId = ''
  await check('T06', '원천 등록: DB 본문 해시 · 정체 해시 = S2, 키 순서만 다른 재등록은 같은 행', async () => {
    const r = await one<Json>(A.producer, `select * from public.story_admin_register_source($1::jsonb)`, [JSON.stringify(realSnapshot)])
    eq(r.text_sha256, source.sha256, 'text sha')
    eq(r.identity_sha256, source.identity_sha256, 'identity sha')
    eq(r.created, true, 'created')
    sourceId = r.source_id as string
    const reversed = Object.fromEntries(Object.entries(realSnapshot).reverse())
    const again = await one<Json>(A.reviewer, `select * from public.story_admin_register_source($1::jsonb)`, [JSON.stringify(reversed)])
    eq(again.source_id, sourceId, 'same row')
    eq(again.created, false, 'created again')
  })

  await check('T07', '원천 등록 거부: 해시 조작 · 합성 · 대응 도서 없음/불일치 · 학습자 · 사용자 없음 · 정지 · service_role', async () => {
    const bad = (mut: (s: Json) => void): string => {
      const s = structuredClone(realSnapshot)
      mut(s)
      return JSON.stringify(s)
    }
    const call = (who: Actor, body: string) => as(who, `select * from public.story_admin_register_source($1::jsonb)`, [body])
    await rejects(call(A.producer, bad((s) => { s.text_sha256 = 'a'.repeat(64) })), /story:text_hash_mismatch/, 'hash')
    await rejects(call(A.producer, bad((s) => { s.text = `${s.text} extra` })), /story:text_hash_mismatch/, 'text edit')
    await rejects(call(A.producer, bad((s) => { s.synthetic = true })), /story:synthetic_not_allowed/, 'synthetic')
    const lb = (id: string, sourceIdClaim: string) => bad((s) => {
      s.snapshot_id = 'gull-rock-lb'
      s.edition.source_kind = 'library_book'
      s.edition.library_book_id = id
      s.edition.source = 'standard_ebooks'
      s.edition.source_id = sourceIdClaim
    })
    await rejects(call(A.producer, lb('10000000-0000-4000-8000-0000000000ff', 'test-se-1')), /story:library_book_not_found/, 'lb missing')
    await rejects(call(A.producer, lb('10000000-0000-4000-8000-000000000001', 'other-id')), /story:library_book_mismatch/, 'lb mismatch')
    const ok = await one<Json>(A.producer, `select * from public.story_admin_register_source($1::jsonb)`,
      [lb('10000000-0000-4000-8000-000000000001', 'test-se-1')])
    eq(ok.created, true, 'lb match registered')
    const corr = await db.query<{ c: string; s: string }>(
      `select correspondence as c, correspondence_library_status as s from story.sources where id = $1`, [ok.source_id])
    eq(corr.rows[0]!.c, 'library_book_id_source_match', 'correspondence')
    eq(corr.rows[0]!.s, 'published', 'library status recorded')
    await rejects(call(A.learner, JSON.stringify(realSnapshot)), /story:staff_required/, 'learner')
    await rejects(call(A.noSub, JSON.stringify(realSnapshot)), /story:auth_required/, 'no sub')
    await rejects(call(A.suspended, JSON.stringify(realSnapshot)), /story:staff_required/, 'suspended')
    await rejects(call(A.service, JSON.stringify(realSnapshot)), /permission denied/, 'service_role')
    await rejects(call(A.anon, JSON.stringify(realSnapshot)), /permission denied/, 'anon')
  })

  const slots: Record<string, string> = {}
  await check('T08', '편집 기준 등록: 기준 · 목표 해시 = S2, 낡은 원문 · 재서사 거부, 재등록 멱등', async () => {
    const rows = await as<Json>(A.producer, `select * from public.story_admin_register_policy($1, $2::jsonb)`, [sourceId, JSON.stringify(policyJson)])
    eq(rows.length, 2, 'slots')
    for (const r of rows) {
      eq(r.policy_sha256, policy.policy_sha256, 'policy sha')
      eq(r.target_sha256, policy.items.get(r.edition_key as string)!.target_sha256, `target ${String(r.edition_key)}`)
      slots[r.edition_key as string] = r.slot_id as string
    }
    const again = await as<Json>(A.reviewer, `select * from public.story_admin_register_policy($1, $2::jsonb)`, [sourceId, JSON.stringify(policyJson)])
    eq(again.every((r) => r.created === false), true, 'idempotent')
    const stale = structuredClone(policyJson)
    stale.source_sha256 = 'b'.repeat(64)
    await rejects(as(A.producer, `select * from public.story_admin_register_policy($1, $2::jsonb)`, [sourceId, JSON.stringify(stale)]),
      /story:policy_source_stale/, 'stale')
    const ren = structuredClone(policyJson)
    ren.production[0].transformation = 'renarration'
    ren.production[0].edition_key = 'story-renarrated'
    await rejects(as(A.producer, `select * from public.story_admin_register_policy($1, $2::jsonb)`, [sourceId, JSON.stringify(ren)]),
      /story:renarration_excluded/, 'renarration')
  })

  const submit = (who: Actor, slot: string, art: Json) =>
    one<Json>(who, `select * from public.story_admin_submit_edition($1, $2::jsonb)`, [slot, JSON.stringify(art)])
  const submitReview = (who: Actor, version: string, rv: Json) =>
    one<Json>(who, `select * from public.story_admin_submit_review($1, $2::jsonb)`, [version, JSON.stringify(rv)])
  const publish = (who: Actor, version: string) => one<Json>(who, `select * from public.story_admin_publish($1)`, [version])
  const rights = (who: Actor, asset: string, status: string, evidence: string | null) =>
    as(who, `select public.story_admin_record_rights($1, $2, $3, $4, $5) as id`, [sourceId, asset, status, '격리 시험 결정', evidence])

  let storyV1Id = ''
  await check('T09', '판본 제출: 낡은 결속(합성 원천에 묶인 결과물) 거부, DB 판본 · 활동 해시 = S2, 재제출 멱등', async () => {
    await rejects(submit(A.producer, slots['story-b1']!, fixture('story-b1.edition.out')), /story:edition_binding_stale|story:producer_provenance/, 'stale')
    const r = await submit(A.producer, slots['story-b1']!, storyV1)
    eq(r.edition_sha256, storyV1Result.edition_sha256, 'edition sha')
    eq(r.activities_sha256, storyV1Result.activities_sha256, 'activities sha')
    storyV1Id = r.edition_version_id as string
    const again = await submit(A.reviewer, slots['story-b1']!, storyV1)
    eq(again.edition_version_id, storyV1Id, 'same version')
    eq(again.created, false, 'idempotent')
  })

  await check('T10', '검수 거부: 생산 계정 자기 검수 · 다른 판본 결속 · 모순 · 미래 시각 · 합성 출처 · 생산 세션 주장', async () => {
    await rejects(submitReview(A.producer, storyV1Id, review('story-b1', storyV1Result)), /story:self_review/, 'self account')
    await rejects(submitReview(A.reviewer, storyV1Id, review('easy-a2', easyV1Result)), /story:review_binding_mismatch/, 'other edition')
    const inconsistent = review('story-b1', storyV1Result)
    inconsistent.checks[0].verdict = 'fail'
    await rejects(submitReview(A.reviewer, storyV1Id, inconsistent), /story:review_inconsistent/, 'inconsistent')
    await rejects(submitReview(A.reviewer, storyV1Id, review('story-b1', storyV1Result, { reviewed_at: '2999-01-01T00:00:00Z' })),
      /story:time_in_future/, 'future')
    await rejects(submitReview(A.reviewer, storyV1Id, review('story-b1', storyV1Result, { provenance: 'synthetic_fixture' })),
      /story:review_provenance/, 'synthetic')
    await rejects(submitReview(A.reviewer, storyV1Id, review('story-b1', storyV1Result, {
      reviewer: { kind: 'ai_model', agent: 'claude-code', session_id: 'producer-session', role: '생산 세션' } })),
      /story:self_review_claim/, 'producer session claim')
  })

  let storyV2Id = ''
  let storyReviewSha = ''
  let storyReviewParsed: S.ReviewArtifact | null = null
  await check('T11', '검수 적격 판정 · 해시 = S2, 최신 판이 아니면 발행 거부', async () => {
    const r1 = await submitReview(A.reviewer, storyV1Id, review('story-b1', storyV1Result))
    eq(r1.qualifies, true, 'v1 qualifies')
    storyV2Id = (await submit(A.producer, slots['story-b1']!, storyV2)).edition_version_id as string
    await rejects(publish(A.admin, storyV1Id), /story:not_latest_version/, 'not latest')
    const rv = review('story-b1', storyV2Result)
    const r2 = await submitReview(A.reviewer, storyV2Id, rv)
    eq(r2.qualifies, true, 'v2 qualifies')
    const parsed = S.validateReview(rv, {
      edition_key: 'story-b1',
      current_binding: S.reviewBindingFor({ source, policy, edition_key: 'story-b1', task_id: `${WORK}:story-b1` }, storyV2Result),
      now: NOW,
    })
    if (!parsed.value) throw new Error(JSON.stringify(parsed.errors))
    eq(r2.review_sha256, parsed.value.review_sha256, 'review sha')
    storyReviewSha = parsed.value.review_sha256
    storyReviewParsed = parsed.value.review
  })

  await check('T12', '발행 거부: curator · 권리 미결정 · 보류 결정 · 자산 · 보류 검수(손으로 만든 발행 시도 포함) · 발행자 = 생산자', async () => {
    await rejects(publish(A.reviewer, storyV2Id), /story:admin_required/, 'curator publish')
    await rejects(rights(A.reviewer, 'source_text', 'confirmed', 'x'), /story:admin_required/, 'curator rights')
    await rejects(publish(A.admin, storyV2Id), /story:rights_unconfirmed/, 'no rights')
    await rights(A.admin, 'source_text', 'hold', null)
    await rejects(publish(A.admin, storyV2Id), /story:rights_unconfirmed/, 'rights hold')
    await rejects(rights(A.admin, 'source_text', 'confirmed', null), /rights_decisions_confirmed_evidence/, 'confirmed without evidence')
    await rights(A.admin, 'source_text', 'confirmed', 'test-only-human-evidence')
    const easy1 = (await submit(A.producer, slots['easy-a2']!, easyV1)).edition_version_id as string
    const held = await submitReview(A.reviewer, easy1, review('easy-a2', easyV1Result, { verdict: 'hold' }))
    eq(held.qualifies, false, 'hold review stored, not qualifying')
    await rejects(publish(A.admin, easy1), /story:review_not_qualifying/, 'held draft')
    const easy2 = (await submit(A.admin, slots['easy-a2']!, easyV2)).edition_version_id as string
    await submitReview(A.reviewer, easy2, review('easy-a2', easyV2Result))
    await rejects(publish(A.admin, easy2), /story:publisher_is_producer/, 'publisher is producer')
    const easy3 = (await submit(A.producer, slots['easy-a2']!, easyV3)).edition_version_id as string
    await submitReview(A.reviewer, easy3, review('easy-a2', easyV3Result))
    await rejects(publish(A.admin, easy3), /story:assets_not_supported/, 'assets')
  })

  await check('T13', '직접 행 조작 거부: authenticated · service_role 이 story 표에 쓰기/읽기 불가', async () => {
    for (const who of [A.admin, A.learner, A.service, A.anon]) {
      await rejects(as(who, `insert into story.releases (release_key) values ('lsr_${'0'.repeat(32)}')`), /permission denied/, `${who.role} insert`)
      await rejects(as(who, `select body from story.release_units`), /permission denied/, `${who.role} select units`)
      await rejects(as(who, `select body from story.sources`), /permission denied/, `${who.role} select sources`)
    }
  })

  let releaseKey = ''
  await check('T14', '발행 성공: release_key = S2 decideEdition, 단위 본문 복사, 같은 자리 두 번째 발행 거부', async () => {
    const r = await publish(A.admin, storyV2Id)
    releaseKey = r.release_key as string
    const confirmedSource: S.SourceContext = {
      ...source,
      snapshot: {
        ...source.snapshot,
        rights: [{ asset: 'source_text', status: 'confirmed', basis: 'db', evidence_ref: 'db', checked_by: 'db', checked_at: '2026-10-25T00:00:00Z' }],
      },
    }
    const decision = S.decideEdition({
      source: confirmedSource,
      policy,
      edition_key: 'story-b1',
      edition_state: 'valid',
      edition: storyV2Result,
      reviews: [{ file: 'db', review: storyReviewParsed!, review_sha256: storyReviewSha, current: true }],
    })
    eq(decision.status, 'candidate', 'S2 decision')
    eq(releaseKey, decision.release!.release_key, 'release key parity')
    const units = await db.query<{ n: number }>(
      `select count(*)::int as n from story.release_units u join story.releases r on r.id = u.release_id where r.release_key = $1`, [releaseKey])
    eq(units.rows[0]!.n, storyV2.units.length, 'units copied')
    await rejects(publish(A.admin, storyV2Id), /story:live_release_exists/, 'second publish')
    const idx = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_indexes where schemaname = 'story' and indexname = 'releases_one_live_per_slot'`)
    eq(idx.rows[0]!.n, 1, 'live unique index')
  })

  await check('T15', '학습자: 서가는 anon 가능 · 본문은 로그인만 · 진도 기록 · 원문 완독 아님', async () => {
    const cat = await as<Json>(A.anon, `select * from public.story_catalog()`)
    eq(cat.length, 1, 'catalog rows')
    eq(Object.prototype.hasOwnProperty.call(cat[0], 'body') || Object.prototype.hasOwnProperty.call(cat[0], 'unit_text'), false, 'no body in catalog')
    await rejects(as(A.anon, `select * from public.story_read_unit($1, 0)`, [releaseKey]), /permission denied/, 'anon read')
    await rejects(as(A.service, `select * from public.story_read_unit($1, 0)`, [releaseKey]), /permission denied/, 'service read')
    await rejects(as(A.noSub, `select * from public.story_read_unit($1, 0)`, [releaseKey]), /story:auth_required/, 'no-sub read')
    const unit = await one<Json>(A.learner, `select * from public.story_read_unit($1, 0)`, [releaseKey])
    eq(unit.unit_text, storyV2.units[0].text, 'unit text')
    await rejects(as(A.learner, `select * from public.story_record_progress($1, 99)`, [releaseKey]), /story:unit_not_found/, 'out of range')
    await as(A.learner, `select * from public.story_record_progress($1, 2)`, [releaseKey])
    await as(A.learner, `select * from public.story_record_progress($1, 1)`, [releaseKey])
    const last = await one<Json>(A.learner, `select * from public.story_record_progress($1, $2)`, [releaseKey, storyV2.units.length - 1])
    eq(last.completed, true, 'completed')
    eq(last.completion_label, 'adapted_full_work', 'completion label')
    const mine = await one<Json>(A.learner, `select * from public.story_my_progress()`)
    eq(mine.counts_as_original_text_completion, false, 'not original text completion')
    eq(mine.release_available, true, 'available')
    eq(mine.furthest_unit_index, storyV2.units.length - 1, 'furthest never decreases')
  })

  await check('T16', '철회: curator 거부 · 멱등 · 서가/본문/진도 기록 차단 · 진도 이력 보존 · 같은 내용 재발행은 새 검수 필요', async () => {
    await rejects(as(A.reviewer, `select * from public.story_admin_withdraw($1, 'x')`, [releaseKey]), /story:admin_required/, 'curator withdraw')
    await rejects(as(A.admin, `select * from public.story_admin_withdraw($1, ' ')`, [releaseKey]), /story:withdraw_reason_required/, 'reason')
    const before = await db.query<{ n: number }>(`select count(*)::int as n from story.reading_progress`)
    const w = await one<Json>(A.admin, `select * from public.story_admin_withdraw($1, '격리 시험 철회')`, [releaseKey])
    eq(w.changed, true, 'changed')
    const w2 = await one<Json>(A.admin, `select * from public.story_admin_withdraw($1, '두 번째')`, [releaseKey])
    eq(w2.changed, false, 'idempotent')
    eq((await as<Json>(A.anon, `select * from public.story_catalog()`)).length, 0, 'catalog hides')
    await rejects(as(A.learner, `select * from public.story_read_unit($1, 0)`, [releaseKey]), /story:release_unavailable/, 'read blocked')
    await rejects(as(A.learner, `select * from public.story_record_progress($1, 0)`, [releaseKey]), /story:release_unavailable/, 'progress blocked')
    const mine = await one<Json>(A.learner, `select * from public.story_my_progress()`)
    eq(mine.release_available, false, 'history shows withdrawn')
    const after = await db.query<{ n: number }>(`select count(*)::int as n from story.reading_progress`)
    eq(after.rows[0]!.n, before.rows[0]!.n, 'progress preserved')
    await rejects(publish(A.admin, storyV2Id), /story:release_key_exists/, 'republish same content')
  })

  await check('T17', '불변: 소유자라도 원천 수정 · 발행본 내용 수정 · 진도 삭제/후퇴 · 기록 TRUNCATE 거부', async () => {
    await rejects(db.query(`update story.sources set work_key = 'x' where id = $1`, [sourceId]), /story:immutable_row/, 'source update')
    await rejects(db.query(`delete from story.reviews`), /story:immutable_row/, 'review delete')
    await rejects(db.query(`update story.releases set title = 'x' where release_key = $1`, [releaseKey]), /story:already_withdrawn/, 'withdrawn release update')
    await rejects(db.query(`delete from story.reading_progress`), /story:immutable_row/, 'progress delete')
    await rejects(db.query(`update story.reading_progress set furthest_unit_index = 0`), /story:progress_regression/, 'progress regression')
    await rejects(db.query(`truncate story.action_log`), /story:immutable_row/, 'truncate log')
  })

  if (engine.name === 'pg17') {
    const connect = engine.connect!
    const actorClient = async (who: Actor): Promise<PgClient> => {
      const c = await connect()
      await c.query(`select set_config('request.jwt.claim.sub', $1, false)`, [who.sub ?? ''])
      await c.query(`set role ${who.role}`)
      return c
    }
    const waitForLock = async (pid: number | undefined): Promise<boolean> => {
      for (let i = 0; i < 200; i++) {
        const r = await db.query<{ w: string | null }>(`select wait_event_type as w from pg_stat_activity where pid = $1`, [pid])
        if (r.rows[0]?.w === 'Lock') return true
        await new Promise((res) => setTimeout(res, 25))
      }
      return false
    }
    const settle = (p: Promise<unknown>): Promise<string> => p.then(() => 'ok', (e: unknown) => (e instanceof Error ? e.message : String(e)))
    let liveKey = ''

    await check('T21', '실제 PG17 두 연결 동시 발행: 두 번째는 자리 잠금을 기다린 뒤 live_release_exists — 살아 있는 발행본 1개', async () => {
      const v3 = (await submit(A.producer, slots['story-b1']!, storyV3)).edition_version_id as string
      await submitReview(A.reviewer, v3, review('story-b1', storyV3Result))
      const c1 = await actorClient(A.admin)
      const c2 = await actorClient(A.admin)
      await c1.query('begin')
      const first = await c1.query<Json>(`select * from public.story_admin_publish($1)`, [v3])
      await c2.query('begin')
      const second = settle(c2.query(`select * from public.story_admin_publish($1)`, [v3]))
      eq(await waitForLock(c2.processID), true, 'second publish waited on the slot lock')
      await c1.query('commit')
      const msg = await second
      await c2.query('rollback')
      if (!/story:live_release_exists/.test(msg)) throw new Error(`second publish: ${msg}`)
      liveKey = first.rows[0]!.release_key as string
      const live = await db.query<{ n: number }>(`select count(*)::int as n from story.releases where slot_id = $1 and withdrawn_at is null`, [slots['story-b1']])
      eq(live.rows[0]!.n, 1, 'one live release')
    })

    await check('T22', '실제 PG17 같은 학습자 두 연결 동시 첫 진도 기록: 충돌 없이 가장 먼 위치로 합쳐진다', async () => {
      const c1 = await actorClient(A.learner)
      const c2 = await actorClient(A.learner)
      await c1.query('begin')
      await c1.query(`select * from public.story_record_progress($1, 3)`, [liveKey])
      await c2.query('begin')
      const second = settle(c2.query(`select * from public.story_record_progress($1, 5)`, [liveKey]))
      eq(await waitForLock(c2.processID), true, 'second insert waited')
      await c1.query('commit')
      eq(await second, 'ok', 'second progress')
      await c2.query('commit')
      const r = await one<Json>(A.learner, `select * from public.story_my_progress()`)
      eq(r.release_key, liveKey, 'latest progress row')
      eq(r.furthest_unit_index, 5, 'greatest wins')
    })

    await check('T23', '실제 PG17 두 관리자 동시 철회: 한 번만 바뀌고 두 번째는 멱등(changed=false) · 철회 기록 1건', async () => {
      const c1 = await actorClient(A.admin)
      const c2 = await actorClient(A.admin)
      await c1.query('begin')
      const first = await c1.query<Json>(`select * from public.story_admin_withdraw($1, '동시 철회 1')`, [liveKey])
      await c2.query('begin')
      const secondP = c2.query<Json>(`select * from public.story_admin_withdraw($1, '동시 철회 2')`, [liveKey])
      eq(await waitForLock(c2.processID), true, 'second withdraw waited')
      await c1.query('commit')
      const second = await secondP
      await c2.query('commit')
      eq(first.rows[0]!.changed, true, 'first changed')
      eq(second.rows[0]!.changed, false, 'second idempotent')
      const logs = await db.query<{ n: number }>(
        `select count(*)::int as n from story.action_log l join story.releases r on r.id = l.target_id where l.action = 'withdraw' and r.release_key = $1`, [liveKey])
      eq(logs.rows[0]!.n, 1, 'one withdraw log')
    })

    await check('T24', '러너: 이미 적용된 schema 재적용은 트랜잭션 안에서 DEPLOY_BLOCKED[already] 로 롤백', async () => {
      const r = await runner.applyStage(db, 'schema', { text: schemaSql, approvedBy: 'isolated-pg17-test' })
      eq(r.ok, false, 'blocked')
      eq(r.outcome, 'rolled_back', 'outcome')
      if (!/DEPLOY_BLOCKED\[already\]/.test(r.error?.message ?? '')) throw new Error(r.error?.message ?? 'no error')
    })

    await check('T25', '러너: 본문이 원본 행을 바꾸면 원본 지문이 달라져 전체 롤백(story 스키마 · 이력 · 원본 모두 원래대로)', async () => {
      await engine.createDatabase!('lcp_story_impact')
      const c = await connect('lcp_story_impact')
      await c.query(BOOTSTRAP)
      const before = (await c.query<{ s: boolean }>(`select copyright_safe_in_kr as s from public.library_books where id = '10000000-0000-4000-8000-000000000002'`)).rows[0]!.s
      const tampered = `${schemaSql}\nupdate public.library_books set copyright_safe_in_kr = not copyright_safe_in_kr where id = '10000000-0000-4000-8000-000000000002';\n`
      const r = await runner.applyStage(c, 'schema', { text: tampered, approvedBy: 'isolated-pg17-test' })
      eq(r.outcome, 'rolled_back', 'rolled back')
      if (!/DEPLOY_BLOCKED\[impact\]/.test(r.error?.message ?? '')) throw new Error(r.error?.message ?? 'no error')
      const after = await c.query<{ s: boolean; story: string | null; h: number }>(
        `select (select copyright_safe_in_kr from public.library_books where id = '10000000-0000-4000-8000-000000000002') as s,
                to_regnamespace('story')::text as story,
                (select count(*)::int from supabase_migrations.schema_migrations where version = $1) as h`, [runner.STAGES.schema!.version])
      eq(after.rows[0]!.s, before, 'legacy row restored')
      eq(after.rows[0]!.story, null, 'no story schema')
      eq(after.rows[0]!.h, 0, 'no history row')
    })
  }

  await check('T18', '복구(격리) SQL: 모든 story RPC 실행 회수 · 표 · 이력 행 수 보존', async () => {
    const counts = async () => (await db.query<{ c: string }>(
      `select (select count(*) from story.sources) || '/' || (select count(*) from story.releases) || '/'
           || (select count(*) from story.reading_progress) || '/' || (select count(*) from story.action_log) as c`)).rows[0]!.c
    const before = await counts()
    if (engine.name === 'pg17') {
      const off = runner.offlineCheck('quarantine')
      if (off.blocks.length || !off.text) throw new Error(off.blocks.join('; '))
      const r = await runner.applyStage(db, 'quarantine', { text: off.text, approvedBy: 'isolated-pg17-test' })
      if (!r.ok) throw new Error(`quarantine apply ${r.outcome}: ${r.error?.message ?? ''}`)
      const v = await runner.runVerify(db, 'quarantine')
      if (!v.ok) throw new Error(`quarantine verify: ${JSON.stringify(v.rows.filter((x) => !x.ok))}`)
    } else {
      await db.exec(quarantineSql)
    }
    for (const who of [A.anon, A.learner, A.admin]) {
      await rejects(as(who, `select * from public.story_catalog()`), /permission denied/, `${who.sub ?? who.role} catalog`)
    }
    await rejects(as(A.admin, `select * from public.story_admin_list_slots()`), /permission denied/, 'admin list')
    eq(await counts(), before, 'rows preserved')
  })

  await check('T19', '원본 도서 · 프로필은 전 과정 뒤에도 그대로다', async () => {
    eq(await legacyHash(), legacyBefore, 'legacy hash after all')
  })

  if (engine.name === 'pglite') {
    notRun('T20', '동시 발행 · 진도 · 철회 경합과 러너 applyStage 실제 실행', 'PGlite 는 연결 하나뿐이라 두 트랜잭션을 동시에 돌릴 수 없다 — '
      + '같은 시험을 --engine pg17 --deps <dir> 로 실행하면 T21~T25 가 실제 PostgreSQL 17 에서 돈다')
  }

  await engine.stop()
  const summary = {
    schema_sql: { path: 'supabase/migrations/_pending_lcp_story_s3_schema.sql', sha256: sha256File(SCHEMA_SQL) },
    quarantine_sql: { path: 'supabase/migrations/_pending_lcp_story_s3_quarantine.sql', sha256: sha256File(QUARANTINE_SQL) },
    runner_stage_sha256: { schema: runner.STAGES.schema!.sha256, quarantine: runner.STAGES.quarantine!.sha256 },
    engine: engine.version,
    passed: results.filter((r) => r.status === 'pass').length,
    failed: results.filter((r) => r.status === 'fail').length,
    not_run: results.filter((r) => r.status === 'not_run').length,
    results,
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  process.exitCode = summary.failed > 0 ? 1 : 0
}

main().catch((e: unknown) => {
  process.stderr.write(`verify-isolated crashed: ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`)
  process.exitCode = 1
})
