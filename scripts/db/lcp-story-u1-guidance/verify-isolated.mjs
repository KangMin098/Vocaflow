#!/usr/bin/env node
// scripts/db/lcp-story-u1-guidance/verify-isolated.mjs
//
// LCP Story D2 U1(T-0187) — _pending_lcp_story_u1_guidance.sql(+ recovery) 격리 PostgreSQL 시험. 공유 개발 DB 에 접속하지 않는다.
//
// 무엇을 하는가
//   임시 embedded-postgres 클러스터(127.0.0.1 · 빈 포트 · 고유 임시 폴더 · 출력하지 않는 임시 비밀번호)를 띄우고, Supabase 와 비슷한 바탕
//   (역할 anon · authenticated · service_role, JWT 주장에서 읽는 auth.uid(), public.user_profiles · library_books)을 만든 뒤
//   개발 DB 에 실제 적용된 S3(20261025094450 · sha 09fb0dc4…) · S5(20261025143031 · sha a57ef729…) 파일 바이트를 그대로 적용한다
//   (S5 의 funnel_events 확장 전제를 위해 public.funnel_events 는 합성 fixture 표 — 실제 허용 목록이 아니다).
//   발행본은 실제 S3 RPC 경로(원천 등록 → 권리 confirmed → 기준 등록 → 판 제출 → 다른 스태프 검수 → service_role 증명 → admin 발행)로만 만든다.
//   그다음 forward · recovery 파일 바이트를 각각 한 BEGIN/COMMIT 안에서(러너 흉내) 적용하고 G01.. 을 시험한다.
//   결속 변조 시험은 롤백되는 트랜잭션 안에서 superuser 가 session_replication_role=replica 로 불변 트리거를 끄고 저장값을 바꾼다
//   (= 정본 §15 의 「service_role 키로 트리거를 우회한 변조」 모형 — 그 트랜잭션은 언제나 롤백된다).
//
//   r2(독립 검토 보정): 주의 개수 · 길이 상한을 두지 않는다는 양성 회귀(G13 — 501자 · 2,000자 · 21개 · 유니코드)와 forward D 의
//   `notify pgrst, 'reload schema'` 가 커밋된 적용에서만 한 번 전달되는지(G00n · G00 · G12 · R01 — 다른 연결의 LISTEN pgrst)를 본다.
// 경계: 이 시험은 격리 PostgreSQL 위에서 BEGIN/COMMIT 으로 감싼 SQL 동작만 증명한다. 승인 러너 · 원장 · Supabase apply_migration 원자성 ·
//   PostgREST(스키마 캐시 · 기본 인자 호출 · 오류 모양) · 공유 DB 동작은 증명하지 않는다(not_run 으로 남긴다).
// 안전: 띄운 루프백 클러스터 외 네트워크 없음 · PG*/DATABASE_URL/SUPABASE_* 환경 변수 이름을 이 프로세스에서 지운다(값을 읽지 않는다) ·
//   .env · 자격 증명을 읽지 않는다 · 자기가 띄운 postmaster 만 pg_ctl -D <자기 폴더> 로 멈추고 폴더를 지운다.
//
// 재사용: embedded-postgres 시작 · 역할/부트스트랩 · S3 발행 경로 · 문장 분리기는 S5 SQL 격리 시험
//   (AI-Control runtime/lcp-story-20261025/s5-proposal-test.mjs sha d7417c80…)의 같은 부분을 옮겨 적었다.
//
// CLI
//   node scripts/db/lcp-story-u1-guidance/verify-isolated.mjs [--deps <embedded-postgres + pg 폴더>] [--out <json>]
//        [--forward <sql>] [--recovery <sql>] [--expect-forward-sha <hex>] [--expect-recovery-sha <hex>]
// 종료: 0 전부 통과 · 1 실패 있음 · 3 실패 없음 + not_run 있음 · 2 하네스 충돌(가능하면 JSON 에도 기록).

import { createHash, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ── CLI ──────────────────────────────────────────────────────────────────────

const ARGV = process.argv.slice(2)
function arg(name, def) {
  const i = ARGV.indexOf(name)
  return i >= 0 && ARGV[i + 1] !== undefined ? ARGV[i + 1] : def
}
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')
const MIGRATIONS = join(REPO, 'supabase', 'migrations')
const OPT = {
  deps: resolve(arg('--deps', join(tmpdir(), 'vf-lcp-story-regression-deps'))),
  forward: resolve(arg('--forward', join(MIGRATIONS, '_pending_lcp_story_u1_guidance.sql'))),
  recovery: resolve(arg('--recovery', join(MIGRATIONS, '_pending_lcp_story_u1_guidance_recovery.sql'))),
  s3: join(MIGRATIONS, '20261025094450_lcp_story_s3_schema.sql'),
  s5: join(MIGRATIONS, '20261025143031_lcp_story_s5_reader_context.sql'),
  out: resolve(arg('--out', join(tmpdir(), 'lcp-story-u1-guidance-isolated.json'))),
  expectForwardSha: arg('--expect-forward-sha', null),
  expectRecoverySha: arg('--expect-recovery-sha', null),
}
const APPLIED = {
  s3: '09fb0dc48e49530c50f8fbe0cb1f06ef128fc5be9be103b1bdc6e8b3d85b560c',
  s5: 'a57ef729cedddc9f6271370fa5f93595a1dca6e273230b741bdfffc535f161ab',
}
const FN = 'public.story_release_guidance(text)'
const GUIDE_ALL = 'select * from public.story_release_guidance()'
const GUIDE_ONE = 'select * from public.story_release_guidance($1)'
const OUT_COLS = ['release_key', 'target_cefr', 'cognitive_demand', 'background_load', 'cautions']

let scrubbedEnv = 0
for (const k of Object.keys(process.env)) {
  if (/^(PG[A-Z_]*|DATABASE_URL|SUPABASE_[A-Z_]*|POSTGRES_[A-Z_]*)$/i.test(k)) { delete process.env[k]; scrubbedEnv++ }
}

const SECRETS = []
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const log = (...a) => console.log(`[u1-guidance ${new Date().toISOString()}]`, ...a)

// ── 결과 ─────────────────────────────────────────────────────────────────────

const results = []
const gate = { forward: false }
function errText(e) {
  if (!e) return String(e)
  return `${e.code ? `[${e.code}] ` : ''}${e.message ?? String(e)}`
}
async function check(id, title, fn) {
  const t = Date.now()
  try {
    const evidence = await fn()
    results.push({ id, title, status: 'pass', ms: Date.now() - t, ...(evidence !== undefined ? { evidence } : {}) })
    log(`PASS ${id}`)
  } catch (e) {
    results.push({ id, title, status: 'fail', ms: Date.now() - t, detail: errText(e) })
    log(`FAIL ${id}: ${errText(e)}`)
  }
}
function notRun(id, title, why) {
  results.push({ id, title, status: 'not_run', detail: why })
  log(`NOT_RUN ${id}: ${why}`)
}
async function gated(id, title, fn) {
  if (!gate.forward) return notRun(id, title, 'forward SQL was not applied (see G00)')
  return check(id, title, fn)
}
function need(cond, msg) { if (!cond) throw new Error(msg) }
function canon(v) {
  if (v instanceof Date) return JSON.stringify(v.toISOString())
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`
  return v === undefined ? 'undefined' : JSON.stringify(v)
}
function eq(a, b, label) { if (a !== b) throw new Error(`${label}: got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`) }
function deepEq(a, b, label) {
  const x = canon(a); const y = canon(b)
  if (x !== y) throw new Error(`${label}: got ${x.slice(0, 700)} expected ${y.slice(0, 700)}`)
}
async function expectError(p, re, label, code) {
  try { await p } catch (e) {
    const msg = errText(e)
    if (!re.test(msg)) throw new Error(`${label}: unexpected error "${msg}" (wanted ${re})`)
    if (code && e.code !== code) throw new Error(`${label}: SQLSTATE ${e.code} (wanted ${code}) for "${msg}"`)
    return msg
  }
  throw new Error(`${label}: expected failure ${re} but it succeeded`)
}

// ── 입력 파일 ────────────────────────────────────────────────────────────────

/** 최상위 문장 분리: -- · 블록 주석, '…'(''), "…", $tag$…$tag$ 본문을 지킨다. */
function splitStatements(sql) {
  const out = []
  let cur = ''
  let i = 0
  while (i < sql.length) {
    const c = sql[i]; const n = sql[i + 1]
    if (c === '-' && n === '-') { const j = sql.indexOf('\n', i); const e = j < 0 ? sql.length : j; cur += sql.slice(i, e); i = e; continue }
    if (c === '/' && n === '*') { const j = sql.indexOf('*/', i + 2); const e = j < 0 ? sql.length : j + 2; cur += sql.slice(i, e); i = e; continue }
    if (c === "'") {
      let j = i + 1
      while (j < sql.length) { if (sql[j] === "'") { if (sql[j + 1] === "'") { j += 2; continue } break } j++ }
      cur += sql.slice(i, j + 1); i = j + 1; continue
    }
    if (c === '"') { const j = sql.indexOf('"', i + 1); const e = j < 0 ? sql.length : j + 1; cur += sql.slice(i, e); i = e; continue }
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 80))
      if (m) { const j = sql.indexOf(m[0], i + m[0].length); const e = j < 0 ? sql.length : j + m[0].length; cur += sql.slice(i, e); i = e; continue }
    }
    if (c === ';') { out.push(`${cur};`); cur = ''; i++; continue }
    cur += c; i++
  }
  if (cur.trim()) out.push(cur)
  const lead = (s) => {
    let t = s
    for (;;) {
      const u = t.replace(/^\s+/, '').replace(/^--[^\n]*(\n|$)/, '').replace(/^\/\*[\s\S]*?\*\//, '')
      if (u === t) return t
      t = u
    }
  }
  return out.map((raw) => ({ raw, code: lead(raw) })).filter((s) => s.code && s.code !== ';')
}

function readInput(path, expect) {
  if (!existsSync(path)) return { path, exists: false }
  const buf = readFileSync(path)
  const text = buf.toString('utf8')
  const stmts = splitStatements(text)
  return {
    path, exists: true, bytes: buf.length, sha256: sha256(buf), expected_sha256: expect ?? null,
    expected_match: expect ? sha256(buf) === expect : null, has_bom: buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf,
    top_level_statements: stmts.length,
    own_transaction: stmts.some((s) => /^(begin|start\s+transaction|commit|end|rollback|abort)\b/i.test(s.code)),
    destructive: stmts.some((s) => /^(drop|delete|truncate|update|insert|alter\s+table)\b/i.test(s.code)), text, stmts,
  }
}

// ── 합성 fixture(시험 전용 글 · 실제 도서 아님) ─────────────────────────────────

const WORK_KEY = 'u1-lantern-keeper'
const WORK_TITLE = 'The Lantern Keeper (U1 isolated test text)'
const P = [
  'Mira kept the lantern on the pier and wrote every ship name in a small blue notebook.',
  'One night a stranger asked to borrow the notebook, and Mira said no without knowing why.',
  'In the morning the notebook was gone, and a muddy boot print waited by the door.',
  'Mira followed the prints to the market, where a fish seller laughed at the wrong question.',
  'LEAKMARK-SOURCE-P4 The last paragraph is never quoted by any unit anchor.',
]
const TEXT = P.join('\n\n')
const TEXT_SHA = sha256(Buffer.from(TEXT, 'utf8'))
function anchor(quote) {
  const start = TEXT.indexOf(quote)
  if (start < 0 || TEXT.lastIndexOf(quote) !== start) throw new Error(`fixture quote not unique/present: ${quote}`)
  return { source_sha256: TEXT_SHA, paragraph: TEXT.slice(0, start).split('\n\n').length - 1, start, end: start + quote.length, quote }
}
const Q = {
  hook: 'Mira kept the lantern on the pier',
  u0: 'wrote every ship name in a small blue notebook',
  u1: 'Mira said no without knowing why',
  u2: 'a muddy boot print waited by the door',
  u3: 'a fish seller laughed at the wrong question',
  p4: 'LEAKMARK-SOURCE-P4 The last paragraph',
}
// 공개되는 값(주의 문장)은 실제처럼 보이는 한국어 시험 문장, 공개되지 않아야 할 값에는 LEAKMARK 를 넣는다.
const CAUTIONS_STORY = [
  '거리 시비: 낯선 사람이 문을 세게 두드리는 장면(시험 문장)',
  '물건을 잃어버린 인물이 울먹이는 장면 — 따옴표 "인용"과 역슬래시 \\ 포함(시험 문장)',
]
const CAUTIONS_REVISED = ['다시 등록한 기준의 다른 주의 문장 — 이 값은 발행본 안내에 나오면 안 된다(시험 문장)']
function target(cefr, { demand, load, cautions }) {
  return {
    language: { cefr, v_level_min: 3, v_level_max: 7, basis: 'editorial_target' },
    cognitive: { demand, basis: 'editorial_judgment', note: 'LEAKMARK-COGNITIVE-NOTE' },
    background_knowledge: { load, supports: ['LEAKMARK-SUPPORT-INTENT'] },
    emotional_suitability: { note: 'LEAKMARK-EMOTIONAL-NOTE 범인이 누구인지 밝히는 줄거리 설명', cautions },
    goals: ['LEAKMARK-GOAL'],
  }
}
function makeSnapshot(snapshotId) {
  return {
    schema: 'lcp-story/source-snapshot@1',
    snapshot_id: snapshotId,
    synthetic: false,
    work: { work_key: WORK_KEY, title: WORK_TITLE, author: null, original_language: 'en' },
    edition: {
      source_kind: 'external_file', library_book_id: null, source: null, source_id: null,
      source_url: 'https://example.org/u1/lantern-keeper', edition_label: `U1 isolated test text ${snapshotId} (not a real book)`,
      revision: 'r1', text_language: 'en', translator: null,
    },
    captured_at: '2026-10-26T00:00:00+09:00',
    normalization: 'story-text-v1',
    coverage: 'complete_work',
    coverage_note: `Test-only five-paragraph text written for the isolated U1 harness (${snapshotId}).`,
    text: TEXT,
    text_sha256: TEXT_SHA,
    rights: [{ asset: 'source_text', status: 'claimed_by_source', basis: 'LEAKMARK-RIGHTS-CLAIM', evidence_ref: 'LEAKMARK-RIGHTS-EVIDENCE', checked_by: null, checked_at: null }],
  }
}
function makePolicy(storyCautions, policyId = 'u1-lantern-policy') {
  return {
    schema: 'lcp-story/editorial-policy@1',
    policy_id: policyId,
    policy_version: 1,
    work_key: WORK_KEY,
    source_sha256: TEXT_SHA,
    reason_to_read: 'LEAKMARK-POLICY-REASON',
    preserve: { events: [], motivations: [], causality: [], foreshadowing: [], tone_devices: [] },
    changeable: [],
    sensitive_content: [],
    entry_scene: { anchors: [anchor(Q.hook)], spoiler_free: true, rationale: 'LEAKMARK-ENTRY-RATIONALE' },
    review_concerns: ['LEAKMARK-REVIEW-CONCERN'],
    production: [
      { edition_key: 'u1-story', kind: 'story_edition', transformation: 'language_modernization', coverage: 'complete_work',
        scope: { first_paragraph: 0, last_paragraph: 4 }, target: target('B2', { demand: 'high', load: 'moderate', cautions: storyCautions }),
        activities: [] },
      { edition_key: 'u1-easy', kind: 'easy_reader', transformation: 'level_adaptation', coverage: 'episode',
        scope: { first_paragraph: 0, last_paragraph: 2 }, target: target('A2', { demand: 'low', load: 'low', cautions: [] }), activities: [] },
    ],
  }
}
const SPEC = {
  'u1-story': {
    title: 'The Lantern Keeper', hookText: 'Who took the notebook from the pier?',
    units: [
      { title: 'The pier', text: 'LEAKMARK-UNIT-0 Mira kept a lantern and a notebook.', quotes: [Q.u0] },
      { title: 'A stranger', text: 'LEAKMARK-UNIT-1 A stranger asked for the notebook.', quotes: [Q.u1] },
      { title: 'Boot prints', text: 'LEAKMARK-UNIT-2 The notebook was gone.', quotes: [Q.u2] },
      { title: 'The market', text: 'LEAKMARK-UNIT-3 Mira went to the market.', quotes: [Q.u3] },
    ],
  },
  'u1-easy': {
    title: 'Mira and the Notebook', hookText: 'Mira has a blue notebook.',
    units: [
      { title: 'Easy 1', text: 'LEAKMARK-EASY-0 Mira writes names.', quotes: [Q.u0] },
      { title: 'Easy 2', text: 'LEAKMARK-EASY-1 Mira says no.', quotes: [Q.u1] },
    ],
  },
}
function makeEdition(key, binding, variant = 0) {
  const spec = SPEC[key]
  return {
    schema: 'lcp-story/edition@1',
    task_id: `${WORK_KEY}:${key}`,
    binding,
    edition_key: key,
    kind: key === 'u1-story' ? 'story_edition' : 'easy_reader',
    produced_by: { agent: 'claude-code', session_id: 'LEAKMARK-PRODUCER-SESSION', provenance: 'ai_generated' },
    title: variant ? `${spec.title} (draft ${variant})` : spec.title,
    hook: { text: spec.hookText, source_anchors: [anchor(Q.hook)], spoiler_free: true },
    units: spec.units.map((u, i) => ({ unit_id: `u${i + 1}`, order: i + 1, title: u.title, text: variant ? `${u.text} v${variant}` : u.text,
      source_anchors: u.quotes.map(anchor), preserves: [] })),
    change_log: [{ change_id: 'c-1', type: 'language_modernization', operation: 'rewrite', unit_ids: ['u1'], source_anchors: [anchor(Q.p4)],
      sensitive_ref: null, rationale: 'LEAKMARK-CHANGE-RATIONALE', learner_note: null }],
    activities: [],
    assets: [],
  }
}
const REQUIRED_CHECKS = ['source_alignment', 'meaning_preservation', 'preserve_items', 'language_target', 'cognitive_target',
  'background_supports', 'sensitivity_handling', 'hook_spoiler_free', 'naturalness']

// ── 행위자 ───────────────────────────────────────────────────────────────────

const uid = (n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
const U = { admin: uid(0x0a), producer: uid(0x0b), reviewer: uid(0x0c), learner: uid(0x0d) }
const au = (sub) => ({ role: 'authenticated', sub })
const A = {
  admin: au(U.admin), producer: au(U.producer), reviewer: au(U.reviewer), learner: au(U.learner),
  anon: { role: 'anon', sub: null }, service: { role: 'service_role', sub: null }, owner: { role: 'postgres', sub: null },
}
function claimParams(who) {
  return [who.sub ?? '', '', JSON.stringify(who.sub ? { sub: who.sub, role: who.role } : { role: who.role })]
}
const CLAIM = (local) => `select set_config('request.jwt.claim.sub', $1, ${local}), set_config('request.jwt.claim.role', $2, ${local}),
  set_config('request.jwt.claims', $3, ${local})`

const ROLES = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role u1_applier_nb nologin nosuperuser nobypassrls inherit nocreaterole nocreatedb;
`
const BOOTSTRAP_SUPER = `
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
create table auth.users (id uuid primary key);
insert into auth.users (id) values ${Object.values(U).map((u) => `('${u}')`).join(', ')};
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create table public.user_profiles (
  user_id uuid primary key, role text not null default 'user', status text not null default 'active', display_name text);
create table public.library_books (
  id uuid primary key default gen_random_uuid(), source text not null, source_id text, status text not null default 'queued',
  title text not null, copyright_safe_in_kr boolean not null default false, published_at timestamptz, unique (source, source_id));
insert into public.user_profiles (user_id, role, status) values
  ('${U.admin}', 'admin', 'active'), ('${U.producer}', 'curator', 'active'), ('${U.reviewer}', 'curator', 'active'),
  ('${U.learner}', 'user', 'active');
-- 합성 fixture: S5 파일의 funnel_events 확장 전제(이 표의 event 열 CHECK 하나). 실제 허용 목록이 아니다.
create table public.funnel_events (id bigserial primary key, event text not null, created_at timestamptz not null default now(),
  constraint funnel_events_event_check check (event = any (array['fixture_visit', 'fixture_signup']::text[])));
`

// ── 엔진 ─────────────────────────────────────────────────────────────────────

async function freePort() {
  return new Promise((res, rej) => {
    const s = createServer()
    s.unref()
    s.on('error', rej)
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)) })
  })
}

async function startCluster(deps) {
  const req = createRequire(join(deps, 'package.json'))
  const { default: EmbeddedPostgres } = await import(pathToFileURL(req.resolve('embedded-postgres')).href)
  const pg = req('pg')
  const platform = process.platform === 'win32' ? 'windows' : process.platform
  const bin = join(deps, 'node_modules', '@embedded-postgres', `${platform}-${process.arch}`, 'native', 'bin')
  const pgctl = join(bin, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl')
  const dir = mkdtempSync(join(tmpdir(), 'vf-u1-guidance-test-'))
  const password = randomBytes(18).toString('hex')
  SECRETS.push(password)
  const state = { dir, port: null, pid: null, started: false, clients: [], stopped: false }
  const stop = async () => {
    if (state.stopped) return state.cleanup
    state.stopped = true
    for (const c of state.clients) await c.end().catch(() => {})
    let stopError = null
    if (state.started) {
      try { execFileSync(pgctl, ['-D', dir, '-m', 'fast', '-w', '-t', '60', 'stop'], { stdio: 'ignore' }) } catch (e) {
        stopError = errText(e)
        try { execFileSync(pgctl, ['-D', dir, '-m', 'immediate', '-w', '-t', '30', 'stop'], { stdio: 'ignore' }) } catch { /* 아래 보고 */ }
      }
    }
    let alive = false
    if (state.pid) { try { process.kill(state.pid, 0); alive = true } catch { alive = false } }
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }) } catch { /* 아래 보고 */ }
    state.cleanup = { postmaster_pid: state.pid, pid_alive_after_stop: alive, stop_error: stopError, data_dir_removed: !existsSync(dir) }
    return state.cleanup
  }
  try {
    const server = new EmbeddedPostgres({
      databaseDir: dir, user: 'postgres', password, port: await freePort(), persistent: false,
      initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {}, onError: () => {},
    })
    await server.initialise()
    let lastErr = null
    for (let attempt = 0; attempt < 3 && !state.started; attempt++) {
      const port = await freePort()
      try {
        execFileSync(pgctl, ['-D', dir, '-o', `-p ${port} -c listen_addresses=127.0.0.1`, '-w', '-t', '60', 'start'], { stdio: 'ignore' })
        state.port = port
        state.started = true
      } catch (e) { lastErr = e }
    }
    if (!state.started) throw new Error(`pg_ctl start failed: ${errText(lastErr)}`)
    state.pid = Number(readFileSync(join(dir, 'postmaster.pid'), 'utf8').split(/\r?\n/)[0])
    const connect = async (database = 'postgres') => {
      const c = new pg.Client({ host: '127.0.0.1', port: state.port, user: 'postgres', password, database, ssl: false, application_name: 'u1-guidance-test' })
      c.notices = []
      c.on('notice', (n) => c.notices.push(n.message))
      c.on('error', () => {})
      await c.connect()
      state.clients.push(c)
      return c
    }
    return { state, connect, stop }
  } catch (e) {
    await stop()
    throw e
  }
}

function wrap(client) {
  const q = async (sql, params = []) => (await client.query(sql, params)).rows
  async function as(who, sql, params = []) {
    await client.query(CLAIM(false), claimParams(who))
    await client.query(who.role === 'postgres' ? 'reset role' : `set role ${who.role}`)
    try { return (await client.query(sql, params)).rows } finally {
      await client.query('reset role')
      await client.query(CLAIM(false), ['', '', ''])
    }
  }
  async function one(who, sql, params = []) {
    const r = await as(who, sql, params)
    if (!r.length) throw new Error(`no row: ${sql}`)
    return r[0]
  }
  /** 한 트랜잭션(언제나 롤백): setup 은 소유자(superuser)로, sql 은 who 로. */
  async function txAs(who, setup, sql, params = []) {
    await client.query('begin')
    try {
      for (const s of setup) await client.query(s.sql, s.params ?? [])
      await client.query(CLAIM(true), claimParams(who))
      if (who.role !== 'postgres') await client.query(`set local role ${who.role}`)
      const r = await client.query(sql, params)
      return { ok: true, rows: r.rows }
    } catch (e) {
      return { ok: false, code: e.code, message: e.message, text: errText(e) }
    } finally {
      await client.query('rollback')
    }
  }
  return { client, q, as, one, txAs }
}

/** 러너 흉내: 파일 바이트 그대로를 한 BEGIN/COMMIT 안에서(파일 자신의 트랜잭션이 있으면 감싸지 않는다). */
async function applySql(client, file, isolation = null) {
  client.notices.length = 0
  const own = file.own_transaction
  try {
    if (!own) await client.query(isolation ? `begin isolation level ${isolation}` : 'begin')
    await client.query(file.text)
    if (!own) await client.query('commit')
    return { ok: true, notices: [...client.notices] }
  } catch (e) {
    await client.query('rollback').catch(() => {})
    return { ok: false, code: e.code, message: e.message, text: errText(e), notices: [...client.notices] }
  }
}

// ── 스냅숏 ───────────────────────────────────────────────────────────────────

/** 함수 정의 · ACL(새 함수 제외) — 기존 객체 무변경 확인. */
async function objSnapshot(db) {
  return db.q(`select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig,
      md5(pg_get_functiondef(p.oid)) as def, coalesce(p.proacl::text, '<default>') as acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('story', 'public', 'auth') and p.proname <> 'story_release_guidance'
   order by 1`)
}
/** story 표 전체 행의 지문 — 읽기 전용 확인. */
async function dataSnapshot(db) {
  const out = {}
  for (const t of ['sources', 'policies', 'edition_slots', 'edition_versions', 'reviews', 'validation_attestations', 'rights_decisions',
    'releases', 'release_units', 'reading_progress', 'reading_unit_completions', 'action_log']) {
    out[t] = (await db.q(`select count(*)::int as n, coalesce(md5(string_agg(md5(t::text), ',' order by md5(t::text))), '') as h from story.${t} t`))[0]
  }
  return out
}

// ── S3 발행 경로 ─────────────────────────────────────────────────────────────

function storyApi(db) {
  const registerSource = (snap) => db.one(A.producer, `select * from public.story_admin_register_source($1::jsonb)`, [JSON.stringify(snap)])
  const registerPolicy = (src, pol) => db.as(A.producer, `select * from public.story_admin_register_policy($1, $2::jsonb)`, [src, JSON.stringify(pol)])
  const rights = (src, status) => db.one(A.admin, `select public.story_admin_record_rights($1, 'source_text', $2, $3, $4) as id`,
    [src, status, 'LEAKMARK-DECISION-BASIS', status === 'confirmed' ? 'LEAKMARK-DECISION-EVIDENCE' : null])
  const submit = (slot, art) => db.one(A.producer, `select * from public.story_admin_submit_edition($1, $2::jsonb)`, [slot, JSON.stringify(art)])
  const review = (version, rv) => db.one(A.reviewer, `select * from public.story_admin_submit_review($1, $2::jsonb)`, [version, JSON.stringify(rv)])
  const attest = async (version) => {
    const b = (await db.q(`select story.attestation_binding($1) as b, story.current_validator() as v`, [version]))[0]
    const att = { schema: 'lcp-story/validation-attestation@1', validator: b.v, checks: { snapshot: 'valid', policy: 'valid', edition: 'valid', reviews: 'valid' },
      validated_at: new Date(Date.now() - 1000).toISOString(), binding: b.b }
    return db.one(A.service, `select * from public.story_service_attest_validation($1, $2::jsonb)`, [version, JSON.stringify(att)])
  }
  const publish = (version) => db.one(A.admin, `select * from public.story_admin_publish($1)`, [version])
  async function lane(snapshotId, cautions) {
    const s = await registerSource(makeSnapshot(snapshotId))
    await rights(s.source_id, 'confirmed')
    const rows = await registerPolicy(s.source_id, makePolicy(cautions))
    return { sourceId: s.source_id, identity: s.identity_sha256, textSha: s.text_sha256, slots: Object.fromEntries(rows.map((r) => [r.edition_key, r])) }
  }
  const bindingFor = (l, key) => ({ source_sha256: l.textSha, source_identity_sha256: l.identity,
    policy_sha256: l.slots[key].policy_sha256, target_sha256: l.slots[key].target_sha256 })
  async function submitReviewed(l, key, variant = 0) {
    const art = makeEdition(key, bindingFor(l, key), variant)
    const sub = await submit(l.slots[key].slot_id, art)
    const rv = {
      schema: 'lcp-story/review@1', review_id: `review-${key}-${sub.edition_sha256.slice(0, 8)}`,
      binding: { task_id: art.task_id, edition_key: key, ...bindingFor(l, key), edition_sha256: sub.edition_sha256, activities_sha256: sub.activities_sha256 },
      reviewer: { kind: 'ai_model', agent: 'codex', session_id: 'LEAKMARK-REVIEWER-SESSION', role: 'isolated test reviewer' },
      provenance: 'ai_review',
      checks: REQUIRED_CHECKS.map((c) => ({ check: c, verdict: 'pass', note: 'LEAKMARK-REVIEW-NOTE' })),
      issues: [], verdict: 'approve', reviewed_at: '2026-10-26T01:30:00+09:00',
    }
    const r = await review(sub.edition_version_id, rv)
    need(r.qualifies === true, `review for ${key} does not qualify`)
    return { versionId: sub.edition_version_id }
  }
  async function publishKey(l, key) {
    const v = await submitReviewed(l, key)
    await attest(v.versionId)
    const rel = await publish(v.versionId)
    return { versionId: v.versionId, releaseKey: rel.release_key }
  }
  const withdraw = (key) => db.one(A.admin, `select * from public.story_admin_withdraw($1, $2)`, [key, 'u1 isolated test withdrawal'])
  return { lane, rights, registerPolicy, submitReviewed, publishKey, withdraw, attest, publish }
}

// ── 변조 도구(롤백되는 트랜잭션 안 · 불변 트리거를 replica 모드로 우회) ─────────────────

const REPLICA = { sql: `set local session_replication_role = replica` }
/** SQL 문자열 리터럴(작은따옴표 이중화). CREATE TABLE AS 는 바인드 파라미터를 받지 않는다. */
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`
/** production 의 target 을 바꾸고 자리 · 기준 production 원소 · 자리/발행본 target_sha256 를 함께 맞춘다(모양 검사만 남게). */
function retargetSetup(releaseKey, mutateSql) {
  need(/^lsr_[0-9a-f]{32}$/.test(releaseKey), 'release key format')
  return [
    REPLICA,
    { sql: `create temp table u1_t on commit drop as
              select rl.id as release_id, es.id as slot_id, es.policy_id, es.production as old_prod,
                     ${mutateSql} as new_prod
                from story.releases rl join story.edition_slots es on es.id = rl.slot_id where rl.release_key = ${lit(releaseKey)}` },
    { sql: `update story.edition_slots es set production = t.new_prod, target_sha256 = story.canonical_sha256(t.new_prod)
              from u1_t t where es.id = t.slot_id` },
    { sql: `update story.releases rl set target_sha256 = story.canonical_sha256(t.new_prod),
                   target_cefr = t.new_prod #>> '{target,language,cefr}'
              from u1_t t where rl.id = t.release_id` },
    { sql: `update story.policies p set policy = jsonb_set(p.policy, '{production}',
                   (select jsonb_agg(case when e = t.old_prod then t.new_prod else e end order by o)
                      from jsonb_array_elements(p.policy -> 'production') with ordinality as x(e, o)))
              from u1_t t where p.id = t.policy_id` },
  ]
}

// ── 본 시험 ──────────────────────────────────────────────────────────────────

const report = {
  harness: 'scripts/db/lcp-story-u1-guidance/verify-isolated.mjs',
  harness_sha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
  started_at: new Date().toISOString(),
  node: process.version,
  boundary: 'Proves only BEGIN/COMMIT-wrapped SQL behavior on an isolated embedded PostgreSQL cluster with a Supabase-like bootstrap and fixture funnel_events. Does NOT prove approval-runner/ledger/apply_migration atomicity, PostgREST behavior (schema cache, default-arg calls, error shape) or shared-DB behavior.',
  env_names_scrubbed: scrubbedEnv,
}
let cluster = null

async function main() {
  const F = {
    s3: readInput(OPT.s3, APPLIED.s3),
    s5: readInput(OPT.s5, APPLIED.s5),
    forward: readInput(OPT.forward, OPT.expectForwardSha),
    recovery: readInput(OPT.recovery, OPT.expectRecoverySha),
  }
  report.files = Object.fromEntries(Object.entries(F).map(([k, v]) => {
    const { text, stmts, ...meta } = v
    return [k, meta]
  }))
  await check('H01', 'inputs: applied S3/S5 bytes match live-applied SHA, forward/recovery present, no own BEGIN/COMMIT, no destructive statements', async () => {
    need(F.s3.exists && F.s3.expected_match, 'S3 file missing or SHA differs from the applied file')
    need(F.s5.exists && F.s5.expected_match, 'S5 file missing or SHA differs from the applied file')
    need(F.forward.exists && F.recovery.exists, 'forward/recovery missing')
    if (OPT.expectForwardSha) need(F.forward.expected_match, 'forward SHA differs from --expect-forward-sha')
    if (OPT.expectRecoverySha) need(F.recovery.expected_match, 'recovery SHA differs from --expect-recovery-sha')
    need(!F.forward.own_transaction && !F.recovery.own_transaction, 'forward/recovery must not contain BEGIN/COMMIT')
    need(!F.forward.destructive && !F.recovery.destructive, 'forward/recovery contain DROP/DELETE/TRUNCATE/UPDATE/INSERT/ALTER TABLE')
    need(!/\bdrop\s|\btruncate\b|\bdelete\s+from\b/i.test(F.forward.text.replace(/--[^\n]*/g, '')), 'forward mentions drop/truncate/delete')
    need(!/\bdrop\s|\btruncate\b|\bdelete\s+from\b|\bgrant\b/i.test(F.recovery.text.replace(/--[^\n]*/g, '')), 'recovery mentions drop/truncate/delete/grant')
    return { forward_statements: F.forward.top_level_statements, recovery_statements: F.recovery.top_level_statements }
  })
  if (results.some((r) => r.status === 'fail')) { notRun('ALL', 'database checks', 'input precondition failed (H01)'); return }

  cluster = await startCluster(OPT.deps)
  const admin = wrap(await cluster.connect('postgres'))
  const version = (await admin.q(`select current_setting('server_version') as v, version() as full`))[0]
  report.engine = { kind: 'embedded-postgres isolated cluster (temp data dir, loopback only)', server_version: version.v, version: version.full,
    host: '127.0.0.1', port: cluster.state.port, postmaster_pid: cluster.state.pid }
  log(`cluster up: PostgreSQL ${version.v} pid ${cluster.state.pid}`)
  await admin.q(ROLES)
  await admin.q(`create database u1_main`)
  const db = wrap(await cluster.connect('u1_main'))
  const api = storyApi(db)
  const REL = {}
  const IDS = {}

  await check('H02', 'bootstrap + applied S3 + applied S5 (each one BEGIN/COMMIT, bytes verbatim)', async () => {
    await db.q(BOOTSTRAP_SUPER)
    for (const k of ['s3', 's5']) {
      const r = await applySql(db.client, F[k])
      if (!r.ok) throw new Error(`${k} apply failed: ${r.text}`)
    }
    need((await db.q(`select to_regprocedure('public.story_reader_context(text,integer)') is not null as e`))[0].e, 'S5 function missing')
    return { roles_superuser: (await db.q(`select rolname, rolsuper from pg_roles where rolname in ('anon','authenticated','service_role') order by 1`)) }
  })

  await check('H03', 'seed via the real S3 RPC path: live story+easy, withdrawn, rights-held, re-registered policy (changed target) with unpublished draft', async () => {
    const live = await api.lane('u1-live-r1', CAUTIONS_STORY)
    const s = await api.publishKey(live, 'u1-story')
    const e = await api.publishKey(live, 'u1-easy')
    REL.story = s.releaseKey; REL.easy = e.releaseKey
    IDS.live = live
    // 같은 원천에 기준을 다시 등록(story-b2 의 주의 문장만 바뀜) → 새 자리 + 초안(발행 안 함). 안내는 발행본의 자리에서만 와야 한다.
    const revisedRows = await api.registerPolicy(live.sourceId, makePolicy(CAUTIONS_REVISED, 'u1-lantern-policy-revised'))
    const revised = { ...live, slots: Object.fromEntries(revisedRows.map((r) => [r.edition_key, r])) }
    need(revised.slots['u1-story'].slot_id !== live.slots['u1-story'].slot_id, 'revised policy did not create a new slot')
    need(revised.slots['u1-story'].target_sha256 !== live.slots['u1-story'].target_sha256, 'revised target hash did not change')
    await api.submitReviewed(revised, 'u1-story', 2)
    IDS.revised = revised
    const wd = await api.lane('u1-withdrawn-r1', CAUTIONS_STORY)
    REL.withdrawn = (await api.publishKey(wd, 'u1-story')).releaseKey
    await api.withdraw(REL.withdrawn)
    const held = await api.lane('u1-held-r1', CAUTIONS_STORY)
    REL.held = (await api.publishKey(held, 'u1-story')).releaseKey
    await api.rights(held.sourceId, 'hold')
    IDS.held = held
    const cat = (await db.as(A.anon, `select release_key from public.story_catalog()`)).map((r) => r.release_key).sort()
    deepEq(cat, [REL.story, REL.easy].sort(), 'anon catalog = live releases only')
    return { releases: REL }
  })
  const seeded = Boolean(REL.story && REL.easy && REL.withdrawn && REL.held)
  if (!seeded) { notRun('ALL', 'database checks', 'seed failed (H03)'); return }

  // ── forward 적용 전: 가드 ──
  const objBefore = await objSnapshot(db)
  const dataBefore = await dataSnapshot(db)
  // forward D 의 NOTIFY 관찰 — 다른 연결이 LISTEN pgrst(PostgREST 가 듣는 채널). 커밋된 적용에서만 한 번 와야 한다.
  const listener = await cluster.connect('u1_main')
  const pgrst = []
  listener.on('notification', (n) => pgrst.push({ channel: n.channel, payload: n.payload }))
  await listener.query('listen pgrst')
  const settle = () => new Promise((r) => setTimeout(r, 400))
  await check('G00a', 'guard: statement-by-statement autocommit application fails at the tripwire and creates nothing', async () => {
    let failedAt = null
    for (const [i, s] of F.forward.stmts.entries()) {
      try { await db.client.query(s.raw) } catch (e) { failedAt = { index: i, error: errText(e) }; break }
    }
    need(failedAt && /tripwire|한 트랜잭션/.test(failedAt.error), `autocommit run did not fail at tripwire: ${JSON.stringify(failedAt)}`)
    eq((await db.q(`select to_regprocedure($1) is not null as e`, [FN]))[0].e, false, 'function created under autocommit')
    return failedAt
  })
  await check('G00b', 'guard: REPEATABLE READ application rejected; nothing created', async () => {
    const r = await applySql(db.client, F.forward, 'repeatable read')
    need(!r.ok && /read committed/.test(r.text), `repeatable read not rejected: ${r.ok ? 'applied' : r.text}`)
    eq((await db.q(`select to_regprocedure($1) is not null as e`, [FN]))[0].e, false, 'function created')
  })
  await check('G00c', 'guard: S3 public catalog quarantined (anon EXECUTE revoked) → forward refuses to open a new public door', async () => {
    await db.client.query('begin')
    try {
      await db.client.query(`revoke execute on function public.story_catalog() from anon`)
      let msg = null
      try { await db.client.query(F.forward.text) } catch (e) { msg = errText(e) }
      need(msg && /quarantine/.test(msg), `forward did not refuse under quarantine: ${msg ?? 'applied'}`)
    } finally { await db.client.query('rollback') }
    eq((await db.q(`select has_function_privilege('anon', 'public.story_catalog()', 'EXECUTE') as p`))[0].p, true, 'catalog grant restored by rollback')
  })
  await check('G00d', 'guard: applier without RLS exemption (not owner, NOBYPASSRLS) is rejected before creating the function', async () => {
    await db.client.query('begin')
    try {
      await db.client.query(`grant usage, create on schema public to u1_applier_nb`)
      await db.client.query(`grant usage on schema story to u1_applier_nb`)
      await db.client.query(`grant select on story.releases, story.edition_slots, story.policies, story.edition_versions, story.sources to u1_applier_nb`)
      await db.client.query(`grant execute on function story.canonical_sha256(jsonb), story.source_rights_ok(uuid) to u1_applier_nb`)
      await db.client.query(`set local role u1_applier_nb`)
      let msg = null
      try { await db.client.query(F.forward.text) } catch (e) { msg = errText(e) }
      need(msg && /RLS/.test(msg), `non-exempt applier not rejected: ${msg ?? 'applied'}`)
    } finally { await db.client.query('rollback') }
  })

  // ── forward 적용 ──
  await check('G00n', 'NOTIFY: refused/guarded applications (autocommit · repeatable read · quarantine · non-exempt applier) delivered no pgrst notification', async () => {
    await settle()
    deepEq(pgrst, [], 'notifications before a committed apply')
  })
  await check('G00', 'forward applied once inside BEGIN/COMMIT (simulated runner, owner = superuser); exactly one pgrst "reload schema" delivered on commit', async () => {
    const r = await applySql(db.client, F.forward)
    if (!r.ok) throw new Error(r.text)
    gate.forward = true
    await settle()
    deepEq(pgrst, [{ channel: 'pgrst', payload: 'reload schema' }], 'notification on commit')
    return { notices: r.notices, notifications: [...pgrst] }
  })
  await gated('G01', 'attributes: SECURITY DEFINER · STABLE · search_path pinned · EXECUTE = anon + authenticated only (effective)', async () => {
    const p = (await db.q(`select p.prosecdef, p.provolatile::text as vol, p.proconfig, pg_get_function_result(p.oid) as res,
        pg_get_function_arguments(p.oid) as args from pg_proc p where p.oid = to_regprocedure($1)`, [FN]))[0]
    eq(p.prosecdef, true, 'prosecdef'); eq(p.vol, 's', 'provolatile')
    deepEq(p.proconfig, ['search_path=pg_catalog, pg_temp'], 'proconfig')
    for (const [role, want] of [['anon', true], ['authenticated', true], ['service_role', false], ['public', false]]) {
      eq((await db.q(`select has_function_privilege($1, $2, 'EXECUTE') as p`, [role, FN]))[0].p, want, `${role} EXECUTE`)
    }
    return { result: p.res, args: p.args }
  })
  await gated('G02', 'anon (no key): exactly the available releases (= anon story_catalog), allowlisted columns, stored target values, stored caution order', async () => {
    const rows = await db.as(A.anon, GUIDE_ALL)
    deepEq(rows.map((r) => Object.keys(r).sort()), rows.map(() => [...OUT_COLS].sort()), 'columns')
    const cat = (await db.as(A.anon, `select release_key, target_cefr from public.story_catalog()`))
    deepEq(rows.map((r) => r.release_key).sort(), cat.map((r) => r.release_key).sort(), 'guidance set = catalog set')
    const byKey = Object.fromEntries(rows.map((r) => [r.release_key, r]))
    deepEq(byKey[REL.story], { release_key: REL.story, target_cefr: 'B2', cognitive_demand: 'high', background_load: 'moderate', cautions: CAUTIONS_STORY }, 'story row')
    deepEq(byKey[REL.easy], { release_key: REL.easy, target_cefr: 'A2', cognitive_demand: 'low', background_load: 'low', cautions: [] }, 'easy row (empty cautions = [])')
    for (const c of cat) eq(byKey[c.release_key].target_cefr, c.target_cefr, 'cefr = catalog target_cefr')
    return { rows: rows.length }
  })
  await gated('G03', 'authenticated learner sees the same rows as anon; specific key = one row', async () => {
    deepEq(await db.as(A.learner, GUIDE_ALL), await db.as(A.anon, GUIDE_ALL), 'auth = anon')
    const one = await db.as(A.learner, GUIDE_ONE, [REL.story])
    eq(one.length, 1, 'one row'); eq(one[0].release_key, REL.story, 'key')
    deepEq(await db.as(A.anon, GUIDE_ONE, [REL.easy]), (await db.as(A.anon, GUIDE_ALL)).filter((r) => r.release_key === REL.easy), 'anon key = filtered all')
  })
  await gated('G04', 'unavailable/unknown/malformed keys → 0 rows, no error (withdrawn · rights hold · unknown · malformed · null all)', async () => {
    for (const [label, key] of [['withdrawn', REL.withdrawn], ['rights_hold', REL.held], ['unknown', `lsr_${'0'.repeat(32)}`],
      ['malformed', "lsr_x' or '1'='1"], ['upper', REL.story.toUpperCase()], ['empty', '']]) {
      eq((await db.as(A.anon, GUIDE_ONE, [key])).length, 0, `${label} rows`)
    }
    const all = (await db.as(A.anon, GUIDE_ONE, [null])).map((r) => r.release_key).sort()
    deepEq(all, [REL.story, REL.easy].sort(), 'explicit null = all available')
  })
  await gated('G05', 'no private leakage: no LEAKMARK (notes · supports · goals · policy · review · rights · bodies), no UUID, no other hash', async () => {
    const rows = [...await db.as(A.anon, GUIDE_ALL), ...await db.as(A.learner, GUIDE_ONE, [REL.story])]
    const text = JSON.stringify(rows)
    need(!/LEAKMARK/.test(text), 'LEAKMARK leaked')
    need(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text), 'UUID leaked')
    need(!/[0-9a-f]{64}/.test(text), 'sha256 leaked')
    return { bytes: text.length }
  })
  await gated('G06', 'release guidance comes from the release slot, not the re-registered (latest) policy/slot or its draft', async () => {
    const r = (await db.as(A.anon, GUIDE_ONE, [REL.story]))[0]
    deepEq(r.cautions, CAUTIONS_STORY, 'cautions from release slot')
    need(!JSON.stringify(await db.as(A.anon, GUIDE_ALL)).includes(CAUTIONS_REVISED[0]), 'revised (unpublished) caution leaked')
  })
  await gated('G07', 'rights: hold closes guidance with the catalog, confirmed reopens; withdrawn stays closed', async () => {
    const live = IDS.live
    const r = await db.txAs(A.anon, [
      { sql: `insert into story.rights_decisions (source_id, asset, status, basis, decided_by) values ($1, 'source_text', 'hold', 'u1 test hold', $2)`, params: [live.sourceId, U.admin] },
    ], `select (select count(*) from public.story_release_guidance())::int as g, (select count(*) from public.story_catalog())::int as c`)
    need(r.ok, r.text)
    deepEq(r.rows[0], { g: 0, c: 0 }, 'hold closes both')
    const r2 = await db.txAs(A.anon, [
      { sql: `insert into story.rights_decisions (source_id, asset, status, basis, evidence_ref, decided_by) values ($1, 'source_text', 'confirmed', 'u1 reopen', 'u1-test', $2)`, params: [IDS.held.sourceId, U.admin] },
    ], `select release_key from public.story_release_guidance() order by 1`)
    need(r2.ok, r2.text)
    deepEq(r2.rows.map((x) => x.release_key).sort(), [REL.story, REL.easy, REL.held].sort(), 'confirmed reopens held release (not withdrawn)')
  })
  // 결속 변조(롤백) — 하나라도 어긋나면 호출 전체가 story:guidance_mismatch(빈 결과 · 주의 없음으로 바꾸지 않는다).
  const TAMPER = [
    ['production cautions changed (hash not updated)', [REPLICA, { sql: `update story.edition_slots es set production = jsonb_set(es.production, '{target,emotional_suitability,cautions}', '[]'::jsonb) from story.releases rl where rl.slot_id = es.id and rl.release_key = $1`, params: [] }], /target_binding/],
    ['release target_sha256 changed', [REPLICA, { sql: `update story.releases set target_sha256 = repeat('a', 64) where release_key = $1`, params: [] }], /binding/],
    ['slot target_sha256 changed', [REPLICA, { sql: `update story.edition_slots es set target_sha256 = repeat('b', 64) from story.releases rl where rl.slot_id = es.id and rl.release_key = $1`, params: [] }], /binding/],
    ['policy policy_sha256 changed', [REPLICA, { sql: `update story.policies p set policy_sha256 = repeat('c', 64) from story.releases rl join story.edition_slots es on es.id = rl.slot_id where p.id = es.policy_id and rl.release_key = $1`, params: [] }], /binding/],
    ['policy source_sha256 changed', [REPLICA, { sql: `update story.policies p set policy = jsonb_set(p.policy, '{source_sha256}', to_jsonb(repeat('d', 64))) from story.releases rl join story.edition_slots es on es.id = rl.slot_id where p.id = es.policy_id and rl.release_key = $1`, params: [] }], /binding/],
    ['production removed from policy production array', [REPLICA, { sql: `update story.policies p set policy = jsonb_set(p.policy, '{production}', '[]'::jsonb) from story.releases rl join story.edition_slots es on es.id = rl.slot_id where p.id = es.policy_id and rl.release_key = $1`, params: [] }], /target_binding/],
    ['release points to another slot', [REPLICA, { sql: `update story.releases rl set slot_id = (select es.id from story.edition_slots es join story.releases r2 on r2.release_key = $1 where es.source_id = r2.source_id and es.edition_key = 'u1-easy' and es.policy_id = (select policy_id from story.edition_slots where id = r2.slot_id)) where rl.release_key = $1`, params: [] }], /binding/],
    ['edition version edition_sha256 changed', [REPLICA, { sql: `update story.edition_versions ev set edition_sha256 = repeat('e', 64) from story.releases rl where ev.id = rl.edition_version_id and rl.release_key = $1`, params: [] }], /binding/],
    ['release edition_version_id points to the unpublished draft (other slot)', [REPLICA, { sql: `update story.releases rl set edition_version_id = (select ev.id from story.edition_versions ev where ev.slot_id = $2) where rl.release_key = $1`, params: ['REVISED_SLOT'] }], /binding/],
    ['source text_sha256 changed', [REPLICA, { sql: `update story.sources s set text_sha256 = repeat('f', 64) from story.releases rl where s.id = rl.source_id and rl.release_key = $1`, params: [] }], /binding/],
    ['release source identity changed', [REPLICA, { sql: `update story.releases set source_identity_sha256 = repeat('1', 64) where release_key = $1`, params: [] }], /binding/],
    ['slot edition_key changed', [REPLICA, { sql: `update story.edition_slots es set edition_key = 'u1-other' from story.releases rl where rl.slot_id = es.id and rl.release_key = $1`, params: [] }], /binding/],
  ]
  await gated('G08', 'binding tamper (rolled back, triggers bypassed as in a service-key tamper): every mismatch fails the whole call with story:guidance_mismatch', async () => {
    const out = []
    for (const [label, setup, re] of TAMPER) {
      const s = setup.map((x) => ({ sql: x.sql, params: x.params ? x.params.map((p) => (p === 'REVISED_SLOT' ? IDS.revised.slots['u1-story'].slot_id : p)) : undefined }))
      const withKey = s.map((x, i) => (i === 0 ? x : { sql: x.sql, params: [REL.story, ...(x.params ?? [])] }))
      for (const who of [A.anon, A.learner]) {
        const r = await db.txAs(who, withKey, GUIDE_ALL)
        need(!r.ok && /story:guidance_mismatch/.test(r.text), `${label} (${who.role}): ${r.ok ? `returned ${r.rows.length} rows` : r.text}`)
        const d = await db.txAs(who, withKey, GUIDE_ONE, [REL.story])
        need(!d.ok && /story:guidance_mismatch/.test(d.text), `${label} single-key (${who.role}): ${d.ok ? 'ok' : d.text}`)
      }
      out.push(label)
    }
    // 다른 발행본만 변조됐을 때 그 발행본을 지정하지 않은 단일 조회는 영향이 없다(관련 없는 행을 읽지 않는다).
    const iso = await db.txAs(A.anon, [REPLICA, { sql: `update story.releases set target_sha256 = repeat('a', 64) where release_key = $1`, params: [REL.easy] }], GUIDE_ONE, [REL.story])
    need(iso.ok && iso.rows.length === 1, `single-key lookup affected by another release: ${iso.ok ? iso.rows.length : iso.text}`)
    return { tampers: out.length, isolated_single_key_ok: true }
  })
  // 모양 변조(자리 · 기준 · 해시를 함께 맞춰 결속은 통과 — 모양 검사만 남게) + 양성 대조(정상 값으로 바꾸면 그 값이 그대로 나온다).
  const SHAPES = [
    ['caution element is a number', `jsonb_set(es.production, '{target,emotional_suitability,cautions}', '[1]'::jsonb)`],
    ['caution element blank', `jsonb_set(es.production, '{target,emotional_suitability,cautions}', '["   "]'::jsonb)`],
    ['cautions not an array', `jsonb_set(es.production, '{target,emotional_suitability,cautions}', '"주의"'::jsonb)`],
    ['cautions missing', `es.production #- '{target,emotional_suitability,cautions}'`],
    ['cognitive.demand out of enum', `jsonb_set(es.production, '{target,cognitive,demand}', '"extreme"'::jsonb)`],
    ['cognitive.basis measured', `jsonb_set(es.production, '{target,cognitive,basis}', '"measured"'::jsonb)`],
    ['language.basis measured', `jsonb_set(es.production, '{target,language,basis}', '"measured"'::jsonb)`],
    ['background load missing', `es.production #- '{target,background_knowledge,load}'`],
    ['target not an object', `jsonb_set(es.production, '{target}', '[]'::jsonb)`],
  ]
  await gated('G09', 'target shape tamper with hashes re-aligned: invalid public fields fail closed; a valid change is returned verbatim (positive control)', async () => {
    const out = []
    for (const [label, mutate] of SHAPES) {
      const r = await db.txAs(A.anon, retargetSetup(REL.story, mutate), GUIDE_ONE, [REL.story])
      need(!r.ok && /story:guidance_mismatch/.test(r.text), `${label}: ${r.ok ? `returned ${JSON.stringify(r.rows)}` : r.text}`)
      out.push(label)
    }
    // cefr 가 서가(발행본 target_cefr)와 다르면 닫는다 — 발행본 cefr 는 그대로 두고 production 만 바꾼다(해시는 맞춘다).
    const cefrSetup = retargetSetup(REL.story, `jsonb_set(es.production, '{target,language,cefr}', '"C1"'::jsonb)`)
    cefrSetup.push({ sql: `update story.releases set target_cefr = 'B2' where release_key = $1`, params: [REL.story] })
    const c = await db.txAs(A.anon, cefrSetup, GUIDE_ONE, [REL.story])
    need(!c.ok && /story:guidance_mismatch/.test(c.text), `cefr mismatch: ${c.ok ? 'ok' : c.text}`)
    const valid = ['다른 정상 주의 문장', '줄바꿈 없는 두 번째 문장']
    const pos = await db.txAs(A.anon, retargetSetup(REL.story, `jsonb_set(es.production, '{target,emotional_suitability,cautions}', ${lit(JSON.stringify(valid))}::jsonb)`),
      GUIDE_ONE, [REL.story])
    need(pos.ok && pos.rows.length === 1, `positive control failed: ${pos.ok ? pos.rows.length : pos.text}`)
    deepEq(pos.rows[0].cautions, valid, 'positive control cautions')
    const empty = await db.txAs(A.anon, retargetSetup(REL.story, `jsonb_set(es.production, '{target,emotional_suitability,cautions}', '[]'::jsonb)`), GUIDE_ONE, [REL.story])
    need(empty.ok && empty.rows.length === 1, `empty control failed: ${empty.ok ? empty.rows.length : empty.text}`)
    deepEq(empty.rows[0].cautions, [], 'empty cautions control')
    return { shapes: out.length + 1, positive_control: true, empty_control: true }
  })
  // S2 Text 계약(개수 · 길이 상한 없음)을 받는가 — 이 함수가 임의 상한으로 유효한 발행 데이터를 거부하지 않는다(양성 회귀).
  await gated('G13', 'no invented limits: 501-char caution · 21 cautions · 2,000-char caution · unicode (surrogate pairs · combining · ZWJ · NBSP · tab · quotes · newline) returned byte-identical in order', async () => {
    const cases = [
      ['501-char caution', ['가'.repeat(501)]],
      ['2000-char caution ending in an emoji', [`${'A'.repeat(1999)}🌊`]],
      ['21 cautions', Array.from({ length: 21 }, (_, i) => `주의 문장 ${i + 1}`)],
      ['unicode', ['이모지 🌊👋🏽 합자', 'é 결합 문자', '앞 탭\t· NBSP 포함', 'ZWJ 👩‍💻', '따옴표 " 역슬래시 \\ 줄바꿈\n있음']],
    ]
    const out = {}
    for (const [label, cautions] of cases) {
      for (const [who, sql, params] of [[A.anon, GUIDE_ONE, [REL.story]], [A.learner, GUIDE_ALL, []]]) {
        const r = await db.txAs(who, retargetSetup(REL.story, `jsonb_set(es.production, '{target,emotional_suitability,cautions}', ${lit(JSON.stringify(cautions))}::jsonb)`), sql, params)
        need(r.ok, `${label} (${who.role}): ${r.text}`)
        const row = r.rows.find((x) => x.release_key === REL.story)
        need(row, `${label}: release row missing`)
        deepEq(row.cautions, cautions, `${label} (${who.role})`)
      }
      out[label] = { count: cautions.length, max_code_points: Math.max(...cautions.map((c) => [...c].length)) }
    }
    // S2 Text 는 JS trim 뒤 비어 있지 않아야 한다 — 유니코드 공백만인 문장은 S2 가 이미 거부한다. 이 함수는 U+0020 만 지워 보므로 그런 값을 거부하지 않는다
    // (S2 보다 엄격하지 않다는 기록 · 실제 발행 데이터에는 올 수 없다).
    const ideo = await db.txAs(A.anon, retargetSetup(REL.story, `jsonb_set(es.production, '{target,emotional_suitability,cautions}', ${lit(JSON.stringify(['　']))}::jsonb)`), GUIDE_ONE, [REL.story])
    need(ideo.ok && ideo.rows.length === 1, `ideographic-space-only caution: ${ideo.ok ? ideo.rows.length : ideo.text}`)
    return { ...out, sql_accepts_unicode_space_only_value_that_s2_rejects: true }
  })
  await gated('G10', 'read-only: calling the RPC (anon · learner · each key) changes no story row; existing functions/ACL unchanged by forward', async () => {
    for (const who of [A.anon, A.learner]) {
      await db.as(who, GUIDE_ALL)
      for (const k of Object.values(REL)) await db.as(who, GUIDE_ONE, [k])
    }
    deepEq(await dataSnapshot(db), dataBefore, 'story data')
    deepEq(await objSnapshot(db), objBefore, 'existing functions/ACL')
  })
  await gated('G11', 'cost (informative): one all-releases call timing on the fixture scale', async () => {
    const t = Date.now()
    for (let i = 0; i < 20; i++) await db.as(A.anon, GUIDE_ALL)
    return { calls: 20, avg_ms: (Date.now() - t) / 20, releases_available: 2, note: 'fixture scale only — live scale not measured' }
  })
  await gated('G12', 're-application is refused (already exists) and changes nothing', async () => {
    const r = await applySql(db.client, F.forward)
    need(!r.ok && /already exists/.test(r.text), `re-apply not refused: ${r.ok ? 'applied' : r.text}`)
    deepEq(await dataSnapshot(db), dataBefore, 'story data')
    await settle()
    eq(pgrst.length, 1, 'refused re-apply delivered no extra notification')
  })

  // ── recovery ──
  await gated('R01', 'recovery (one BEGIN/COMMIT): anon/authenticated EXECUTE revoked, function definition kept, catalog/reader RPCs and data unchanged', async () => {
    const def = (await db.q(`select md5(pg_get_functiondef(to_regprocedure($1))) as d`, [FN]))[0].d
    const r = await applySql(db.client, F.recovery)
    if (!r.ok) throw new Error(r.text)
    for (const role of ['anon', 'authenticated', 'service_role', 'public']) {
      eq((await db.q(`select has_function_privilege($1, $2, 'EXECUTE') as p`, [role, FN]))[0].p, false, `${role} EXECUTE after recovery`)
    }
    eq((await db.q(`select md5(pg_get_functiondef(to_regprocedure($1))) as d`, [FN]))[0].d, def, 'definition kept')
    await expectError(db.as(A.anon, GUIDE_ALL), /permission denied/, 'anon call after recovery', '42501')
    await expectError(db.as(A.learner, GUIDE_ONE, [REL.story]), /permission denied/, 'learner call after recovery', '42501')
    eq((await db.as(A.anon, `select count(*)::int as n from public.story_catalog()`))[0].n, 2, 'catalog still works for anon')
    deepEq(await objSnapshot(db), objBefore, 'existing functions/ACL after recovery')
    deepEq(await dataSnapshot(db), dataBefore, 'story data after recovery')
    const again = await applySql(db.client, F.recovery)
    need(again.ok, `recovery not idempotent: ${again.text}`)
    await settle()
    eq(pgrst.length, 1, 'recovery sends no pgrst notification')
  })
  await check('R02', 'recovery before forward fails without changing anything (fresh database)', async () => {
    await admin.q(`create database u1_recovery_only`)
    const d2 = wrap(await cluster.connect('u1_recovery_only'))
    await d2.q(BOOTSTRAP_SUPER)
    for (const k of ['s3', 's5']) {
      const r = await applySql(d2.client, F[k])
      if (!r.ok) throw new Error(`${k} apply failed: ${r.text}`)
    }
    const r = await applySql(d2.client, F.recovery)
    need(!r.ok && /does not exist/.test(r.text), `recovery without forward: ${r.ok ? 'applied' : r.text}`)
  })
  notRun('N01', 'PostgREST: schema cache exposure, default-argument call shape, error JSON shape', 'no PostgREST in the isolated harness — verify after an approved apply (read-only)')
  notRun('N02', 'approval runner / apply_migration ledger atomicity on the shared DB', 'not applied — SQL is pending explicit user approval')
}

let exitCode = 2
try {
  await main()
  const fail = results.filter((r) => r.status === 'fail').length
  const nr = results.filter((r) => r.status === 'not_run').length
  exitCode = fail ? 1 : nr ? 3 : 0
} catch (e) {
  results.push({ id: 'CRASH', title: 'harness crash', status: 'fail', detail: errText(e) })
  log(`CRASH: ${errText(e)}`)
  exitCode = 2
} finally {
  if (cluster) report.cleanup = await cluster.stop()
  report.ended_at = new Date().toISOString()
  report.summary = {
    pass: results.filter((r) => r.status === 'pass').length,
    fail: results.filter((r) => r.status === 'fail').length,
    not_run: results.filter((r) => r.status === 'not_run').length,
    exit_code: exitCode,
  }
  report.results = results
  let json = JSON.stringify(report, null, 2)
  for (const s of SECRETS) json = json.split(s).join('<redacted>')
  writeFileSync(OPT.out, `${json}\n`)
  log(`result ${OPT.out} · pass ${report.summary.pass} · fail ${report.summary.fail} · not_run ${report.summary.not_run} · exit ${exitCode}`)
  process.exit(exitCode)
}
