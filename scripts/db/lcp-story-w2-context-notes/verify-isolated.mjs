#!/usr/bin/env node
// scripts/db/lcp-story-w2-context-notes/verify-isolated.mjs
//
// LCP Story D3 W2(T-0189) — _pending_lcp_story_w2_context_notes.sql(+ recovery) 격리 PostgreSQL 시험. 공유 개발 DB 에 접속하지 않는다.
//
// 무엇을 하는가
//   임시 embedded-postgres 클러스터(127.0.0.1 · 빈 포트 · 고유 임시 폴더 · 출력하지 않는 임시 비밀번호)에 Supabase 와 비슷한 바탕(역할 anon ·
//   authenticated · service_role, JWT 주장에서 읽는 auth.uid(), public.user_profiles · library_books)을 만들고, 개발 DB 에 실제 적용된
//   S3(20261025094450 · 09fb0dc4…) · S5(20261025143031 · a57ef729…) · U1(20261026110732 · 8648c24c…) 파일 바이트를 그대로 적용한다
//   (S5 의 funnel_events 확장 전제를 위해 public.funnel_events 는 합성 fixture 표).
//   발행본은 실제 S3 RPC 경로(원천 등록 → 권리 confirmed → 기준 등록 → 판 제출 → 다른 스태프 검수 → service_role 증명 → admin 발행)로만 만든다.
//   그다음 forward · recovery 파일 바이트를 각각 한 BEGIN/COMMIT 안에서(러너 흉내) 적용하고 W00.. 을 시험한다.
//   결속 · 모양 변조 시험은 롤백되는 트랜잭션 안에서 superuser 가 session_replication_role=replica 로 불변 트리거를 끄고 저장값을 바꾼다.
//   재사용: 엔진 · 부트스트랩 · S3 발행 경로 · 문장 분리기는 U1 격리 시험(scripts/db/lcp-story-u1-guidance/verify-isolated.mjs)의 같은 부분을 옮겨 적었다.
//
// 경계: 격리 PostgreSQL 위에서 BEGIN/COMMIT 으로 감싼 SQL 동작만 증명한다. 승인 러너 · 원장 · Supabase apply_migration 원자성 ·
//   PostgREST(스키마 캐시 · 오류 모양) · 공유 DB 동작은 증명하지 않는다(not_run). 합성 fixture 의 주의 · 맥락 문장은 시험용이며 실제 C01 콘텐츠가 아니다.
// 안전: 띄운 루프백 클러스터 외 네트워크 없음 · PG*/DATABASE_URL/SUPABASE_* 환경 변수 이름을 지운다(값을 읽지 않는다) · .env · 자격 증명을 읽지 않는다.
//
// CLI
//   node scripts/db/lcp-story-w2-context-notes/verify-isolated.mjs [--deps <embedded-postgres + pg 폴더>] [--out <json>]
//        [--forward <sql>] [--recovery <sql>] [--expect-forward-sha <hex>] [--expect-recovery-sha <hex>]
// 종료: 0 전부 통과 · 1 실패 있음 · 3 실패 없음 + not_run 있음 · 2 하네스 충돌.

import { createHash, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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
  forward: resolve(arg('--forward', join(MIGRATIONS, '_pending_lcp_story_w2_context_notes.sql'))),
  recovery: resolve(arg('--recovery', join(MIGRATIONS, '_pending_lcp_story_w2_context_notes_recovery.sql'))),
  s3: join(MIGRATIONS, '20261025094450_lcp_story_s3_schema.sql'),
  s5: join(MIGRATIONS, '20261025143031_lcp_story_s5_reader_context.sql'),
  u1: join(MIGRATIONS, '20261026110732_lcp_story_u1_guidance.sql'),
  out: resolve(arg('--out', join(tmpdir(), 'lcp-story-w2-context-notes-isolated.json'))),
  expectForwardSha: arg('--expect-forward-sha', null),
  expectRecoverySha: arg('--expect-recovery-sha', null),
}
const APPLIED = {
  s3: '09fb0dc48e49530c50f8fbe0cb1f06ef128fc5be9be103b1bdc6e8b3d85b560c',
  s5: 'a57ef729cedddc9f6271370fa5f93595a1dca6e273230b741bdfffc535f161ab',
  u1: '8648c24cd4e58237be8fdf736a2cf7aee8fcd22f2b01407dab1d90fc17f22eac',
}
const FN = 'public.story_unit_context_notes(text,integer)'
const NOTES = 'select public.story_unit_context_notes($1, $2) as c'

let scrubbedEnv = 0
for (const k of Object.keys(process.env)) {
  if (/^(PG[A-Z_]*|DATABASE_URL|SUPABASE_[A-Z_]*|POSTGRES_[A-Z_]*)$/i.test(k)) { delete process.env[k]; scrubbedEnv++ }
}
const SECRETS = []
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const log = (...a) => console.log(`[w2-notes ${new Date().toISOString()}]`, ...a)

// ── 결과 ─────────────────────────────────────────────────────────────────────

const results = []
const gate = { forward: false }
function errText(e) {
  if (!e) return String(e)
  return `${e.code ? `[${e.code}] ` : ''}${e.message ?? String(e)}${e.detail ? ` (detail: ${e.detail})` : ''}`
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
  if (!gate.forward) return notRun(id, title, 'forward SQL was not applied (see W00)')
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

const WORK_KEY = 'w2-lantern-keeper'
const WORK_TITLE = 'The Lantern Keeper (W2 isolated test text)'
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
// 공개되어야 할 값 = 시험용 맥락 문장(NOTE-A · NOTE-B). 공개되면 안 되는 값에는 LEAKMARK.
const NOTE_A = '시대 맥락 A(시험): 당시에는 이런 추론이 흔했지만 오늘날의 근거와는 다르다는 설명.'
const NOTE_B = '시대 맥락 B(시험): 당시의 역할 관념에 기댄 짐작이라 증거로 확인된 사실이 아니라는 설명.'
function target(cefr) {
  return {
    language: { cefr, v_level_min: 3, v_level_max: 7, basis: 'editorial_target' },
    cognitive: { demand: 'high', basis: 'editorial_judgment', note: 'LEAKMARK-COGNITIVE-NOTE' },
    background_knowledge: { load: 'moderate', supports: ['LEAKMARK-SUPPORT'] },
    emotional_suitability: { note: 'LEAKMARK-EMOTIONAL-NOTE', cautions: ['주의(시험)'] },
    goals: ['LEAKMARK-GOAL'],
  }
}
const SENSITIVE = [
  { id: 'se-period-a', anchors: [anchor(Q.u1)], issue: 'LEAKMARK-ISSUE-A', handling: 'retain_with_context', rationale: 'LEAKMARK-SENS-RATIONALE-A' },
  { id: 'se-period-b', anchors: [anchor(Q.u2)], issue: 'LEAKMARK-ISSUE-B', handling: 'retain_with_context', rationale: 'LEAKMARK-SENS-RATIONALE-B' },
  { id: 'se-revise', anchors: [anchor(Q.u3)], issue: 'LEAKMARK-ISSUE-R', handling: 'revise_with_note', rationale: 'LEAKMARK-SENS-RATIONALE-R' },
]
function makeSnapshot(snapshotId) {
  return {
    schema: 'lcp-story/source-snapshot@1', snapshot_id: snapshotId, synthetic: false,
    work: { work_key: WORK_KEY, title: WORK_TITLE, author: null, original_language: 'en' },
    edition: { source_kind: 'external_file', library_book_id: null, source: null, source_id: null, source_url: 'https://example.org/w2/lantern',
      edition_label: `W2 isolated test text ${snapshotId} (not a real book)`, revision: 'r1', text_language: 'en', translator: null },
    captured_at: '2026-10-27T00:00:00+09:00', normalization: 'story-text-v1', coverage: 'complete_work',
    coverage_note: `Test-only five-paragraph text written for the isolated W2 harness (${snapshotId}).`,
    text: TEXT, text_sha256: TEXT_SHA,
    rights: [{ asset: 'source_text', status: 'claimed_by_source', basis: 'LEAKMARK-RIGHTS', evidence_ref: 'LEAKMARK-RIGHTS-EVIDENCE', checked_by: null, checked_at: null }],
  }
}
function makePolicy(policyId = 'w2-lantern-policy', storyCefr = 'B2') {
  return {
    schema: 'lcp-story/editorial-policy@1', policy_id: policyId, policy_version: 1, work_key: WORK_KEY, source_sha256: TEXT_SHA,
    reason_to_read: 'LEAKMARK-POLICY-REASON',
    preserve: { events: [], motivations: [], causality: [], foreshadowing: [], tone_devices: [] },
    changeable: [], sensitive_content: SENSITIVE,
    entry_scene: { anchors: [anchor(Q.hook)], spoiler_free: true, rationale: 'LEAKMARK-ENTRY' },
    review_concerns: ['LEAKMARK-REVIEW-CONCERN'],
    production: [
      { edition_key: 'w2-story', kind: 'story_edition', transformation: 'language_modernization', coverage: 'complete_work',
        scope: { first_paragraph: 0, last_paragraph: 4 }, target: target(storyCefr), activities: [] },
    ],
  }
}
const UNITS = [
  { title: 'The pier', text: 'LEAKMARK-UNIT-0 Mira kept a lantern and a notebook.', quotes: [Q.u0] },
  { title: 'A stranger', text: 'LEAKMARK-UNIT-1 A stranger asked for the notebook.', quotes: [Q.u1] },
  { title: 'Boot prints', text: 'LEAKMARK-UNIT-2 The notebook was gone.', quotes: [Q.u2] },
  { title: 'The market', text: 'LEAKMARK-UNIT-3 Mira went to the market.', quotes: [Q.u3] },
]
function changeLog(variant) {
  return [
    { change_id: 'c-1', type: 'language_modernization', operation: 'rewrite', unit_ids: ['u1'], source_anchors: [anchor(Q.p4)],
      sensitive_ref: null, rationale: 'LEAKMARK-CHANGE-RATIONALE', learner_note: null },
    { change_id: 'note-a', type: 'editorial_note', operation: 'context_note', unit_ids: ['u2'], source_anchors: [anchor(Q.u1)],
      sensitive_ref: 'se-period-a', rationale: 'LEAKMARK-NOTE-A-RATIONALE', learner_note: variant ? `LEAKMARK-REVISED-${NOTE_A}` : NOTE_A },
    { change_id: 'note-plain', type: 'editorial_note', operation: 'context_note', unit_ids: ['u2'], source_anchors: [anchor(Q.u1)],
      sensitive_ref: null, rationale: 'LEAKMARK-PLAIN-RATIONALE', learner_note: 'LEAKMARK-PLAIN-NOTE-SPOILER 범인은 시장 상인이다' },
    { change_id: 'note-b', type: 'editorial_note', operation: 'context_note', unit_ids: ['u2', 'u3'], source_anchors: [anchor(Q.u2)],
      sensitive_ref: 'se-period-b', rationale: 'LEAKMARK-NOTE-B-RATIONALE', learner_note: NOTE_B },
    { change_id: 'rw-revise', type: 'language_modernization', operation: 'rewrite', unit_ids: ['u2'], source_anchors: [anchor(Q.u3)],
      sensitive_ref: 'se-revise', rationale: 'LEAKMARK-REVISE-RATIONALE', learner_note: 'LEAKMARK-REVISE-NOTE' },
    { change_id: 'gloss-a', type: 'editorial_note', operation: 'gloss', unit_ids: ['u3'], source_anchors: [anchor(Q.u1)],
      sensitive_ref: 'se-period-a', rationale: 'LEAKMARK-GLOSS-RATIONALE', learner_note: 'LEAKMARK-GLOSS-NOTE' },
  ]
}
function makeEdition(binding, variant = 0) {
  return {
    schema: 'lcp-story/edition@1', task_id: `${WORK_KEY}:w2-story`, binding, edition_key: 'w2-story', kind: 'story_edition',
    produced_by: { agent: 'claude-code', session_id: 'LEAKMARK-PRODUCER-SESSION', provenance: 'ai_generated' },
    title: variant ? `The Lantern Keeper (draft ${variant})` : 'The Lantern Keeper',
    hook: { text: 'Who took the notebook from the pier?', source_anchors: [anchor(Q.hook)], spoiler_free: true },
    units: UNITS.map((u, i) => ({ unit_id: `u${i + 1}`, order: i + 1, title: u.title, text: variant ? `${u.text} v${variant}` : u.text,
      source_anchors: u.quotes.map(anchor), preserves: [] })),
    change_log: changeLog(variant),
    activities: [], assets: [],
  }
}
const REQUIRED_CHECKS = ['source_alignment', 'meaning_preservation', 'preserve_items', 'language_target', 'cognitive_target',
  'background_supports', 'sensitivity_handling', 'hook_spoiler_free', 'naturalness']

// ── 행위자 ───────────────────────────────────────────────────────────────────

const uid = (n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
const U = { admin: uid(0x0a), producer: uid(0x0b), reviewer: uid(0x0c), learner: uid(0x0d), suspended: uid(0x0e) }
const au = (sub) => ({ role: 'authenticated', sub })
const A = {
  admin: au(U.admin), producer: au(U.producer), reviewer: au(U.reviewer), learner: au(U.learner), suspended: au(U.suspended),
  noSub: { role: 'authenticated', sub: null }, anon: { role: 'anon', sub: null }, service: { role: 'service_role', sub: null },
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
create role w2_applier_nb nologin nosuperuser nobypassrls inherit nocreaterole nocreatedb;
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
  ('${U.learner}', 'user', 'active'), ('${U.suspended}', 'user', 'suspended');
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
  const dir = mkdtempSync(join(tmpdir(), 'vf-w2-notes-test-'))
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
      const c = new pg.Client({ host: '127.0.0.1', port: state.port, user: 'postgres', password, database, ssl: false, application_name: 'w2-notes-test' })
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
    await client.query(`set role ${who.role}`)
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
  async function txAs(who, setup, sql, params = []) {
    await client.query('begin')
    try {
      for (const s of setup) await client.query(s.sql, s.params ?? [])
      await client.query(CLAIM(true), claimParams(who))
      await client.query(`set local role ${who.role}`)
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

async function applySql(client, file, isolation = null, beforeCommit = null) {
  client.notices.length = 0
  const own = file.own_transaction
  try {
    if (!own) await client.query(isolation ? `begin isolation level ${isolation}` : 'begin')
    await client.query(file.text)
    const seen = beforeCommit ? (await client.query(beforeCommit)).rows : null
    if (!own) await client.query('commit')
    return { ok: true, notices: [...client.notices], seen }
  } catch (e) {
    await client.query('rollback').catch(() => {})
    return { ok: false, code: e.code, message: e.message, text: errText(e), notices: [...client.notices] }
  }
}

async function objSnapshot(db) {
  return db.q(`select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig,
      md5(pg_get_functiondef(p.oid)) as def, coalesce(p.proacl::text, '<default>') as acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('story', 'public', 'auth') and p.proname <> 'story_unit_context_notes'
   order by 1`)
}
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
  async function lane(snapshotId, policy = makePolicy()) {
    const s = await registerSource(makeSnapshot(snapshotId))
    await rights(s.source_id, 'confirmed')
    const rows = await registerPolicy(s.source_id, policy)
    return { sourceId: s.source_id, identity: s.identity_sha256, textSha: s.text_sha256, slots: Object.fromEntries(rows.map((r) => [r.edition_key, r])) }
  }
  const bindingFor = (l) => ({ source_sha256: l.textSha, source_identity_sha256: l.identity,
    policy_sha256: l.slots['w2-story'].policy_sha256, target_sha256: l.slots['w2-story'].target_sha256 })
  async function submitReviewed(l, variant = 0) {
    const art = makeEdition(bindingFor(l), variant)
    const sub = await submit(l.slots['w2-story'].slot_id, art)
    const rv = {
      schema: 'lcp-story/review@1', review_id: `review-w2-${sub.edition_sha256.slice(0, 8)}`,
      binding: { task_id: art.task_id, edition_key: 'w2-story', ...bindingFor(l), edition_sha256: sub.edition_sha256, activities_sha256: sub.activities_sha256 },
      reviewer: { kind: 'ai_model', agent: 'codex', session_id: 'LEAKMARK-REVIEWER-SESSION', role: 'isolated test reviewer' },
      provenance: 'ai_review',
      checks: REQUIRED_CHECKS.map((c) => ({ check: c, verdict: 'pass', note: 'LEAKMARK-REVIEW-NOTE' })),
      issues: [], verdict: 'approve', reviewed_at: '2026-10-27T01:30:00+09:00',
    }
    const r = await review(sub.edition_version_id, rv)
    need(r.qualifies === true, 'review does not qualify')
    return { versionId: sub.edition_version_id }
  }
  async function publishLane(l) {
    const v = await submitReviewed(l)
    await attest(v.versionId)
    const rel = await publish(v.versionId)
    return { versionId: v.versionId, releaseKey: rel.release_key }
  }
  const withdraw = (key) => db.one(A.admin, `select * from public.story_admin_withdraw($1, $2)`, [key, 'w2 isolated test withdrawal'])
  return { lane, rights, registerPolicy, submitReviewed, publishLane, withdraw }
}

const REPLICA = { sql: `set local session_replication_role = replica` }
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`
/** 발행본이 가리키는 판의 artifact 를 바꾼다(edition_sha256 는 그대로 — 해시 결속 대신 모양 방어만 시험). */
const editArtifact = (releaseKey, expr) => {
  need(/^lsr_[0-9a-f]{32}$/.test(releaseKey), 'release key format')
  return [REPLICA, { sql: `update story.edition_versions ev set artifact = ${expr} from story.releases rl where rl.edition_version_id = ev.id and rl.release_key = ${lit(releaseKey)}` }]
}
const editPolicy = (releaseKey, expr) => {
  need(/^lsr_[0-9a-f]{32}$/.test(releaseKey), 'release key format')
  return [REPLICA, { sql: `update story.policies p set policy = ${expr} from story.releases rl join story.edition_slots es on es.id = rl.slot_id where p.id = es.policy_id and rl.release_key = ${lit(releaseKey)}` }]
}
/** change_log 에서 change_id 로 원소 하나를 바꾸는 식(artifact 에 대해). */
const setChange = (id, setExpr) => `jsonb_set(ev.artifact, '{change_log}', (select jsonb_agg(case when e ->> 'change_id' = ${lit(id)} then ${setExpr} else e end order by o) from jsonb_array_elements(ev.artifact -> 'change_log') with ordinality as x(e, o)))`

// ── 본 시험 ──────────────────────────────────────────────────────────────────

const report = {
  harness: 'scripts/db/lcp-story-w2-context-notes/verify-isolated.mjs',
  harness_sha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
  started_at: new Date().toISOString(),
  node: process.version,
  boundary: 'Proves only BEGIN/COMMIT-wrapped SQL behavior on an isolated embedded PostgreSQL cluster with a Supabase-like bootstrap and fixture funnel_events. Fixture notes are synthetic. Does NOT prove approval-runner/ledger/apply_migration atomicity, PostgREST behavior or shared-DB behavior.',
  env_names_scrubbed: scrubbedEnv,
}
let cluster = null

async function main() {
  const F = { s3: readInput(OPT.s3, APPLIED.s3), s5: readInput(OPT.s5, APPLIED.s5), u1: readInput(OPT.u1, APPLIED.u1),
    forward: readInput(OPT.forward, OPT.expectForwardSha), recovery: readInput(OPT.recovery, OPT.expectRecoverySha) }
  report.files = Object.fromEntries(Object.entries(F).map(([k, v]) => { const { text, stmts, ...meta } = v; return [k, meta] }))
  await check('H01', 'inputs: applied S3/S5/U1 bytes match live-applied SHA · forward/recovery present · no own BEGIN/COMMIT · no destructive statements · forward declares the SET LOCAL timeouts and NOTIFY it documents', async () => {
    for (const k of ['s3', 's5', 'u1']) need(F[k].exists && F[k].expected_match, `${k} missing or SHA differs from the applied file`)
    need(F.forward.exists && F.recovery.exists, 'forward/recovery missing')
    if (OPT.expectForwardSha) need(F.forward.expected_match, 'forward SHA differs from --expect-forward-sha')
    if (OPT.expectRecoverySha) need(F.recovery.expected_match, 'recovery SHA differs from --expect-recovery-sha')
    need(!F.forward.own_transaction && !F.recovery.own_transaction, 'forward/recovery must not contain BEGIN/COMMIT')
    need(!F.forward.destructive && !F.recovery.destructive, 'forward/recovery contain DROP/DELETE/TRUNCATE/UPDATE/INSERT/ALTER TABLE')
    const codes = F.forward.stmts.map((s) => s.code.replace(/\s+/g, ' ').trim())
    need(codes[0] === "set local lcp_story_w2.in_txn = 'on';", 'first statement is the tripwire')
    need(codes.includes("set local lock_timeout = '3s';") && codes.includes("set local statement_timeout = '60s';"), 'SET LOCAL timeouts present as documented')
    need(codes.at(-1) === "notify pgrst, 'reload schema';", 'last statement is the NOTIFY')
    need(!/\bgrant\b/i.test(F.recovery.text.replace(/--[^\n]*/g, '')) && !/\bdrop\s/i.test(F.recovery.text.replace(/--[^\n]*/g, '')), 'recovery has no grant/drop')
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
  await admin.q(`create database w2_main`)
  const db = wrap(await cluster.connect('w2_main'))
  const api = storyApi(db)
  const REL = {}
  const IDS = {}

  await check('H02', 'bootstrap + applied S3 + S5 + U1 (each one BEGIN/COMMIT, bytes verbatim)', async () => {
    await db.q(BOOTSTRAP_SUPER)
    for (const k of ['s3', 's5', 'u1']) {
      const r = await applySql(db.client, F[k])
      if (!r.ok) throw new Error(`${k} apply failed: ${r.text}`)
    }
  })
  await check('H03', 'seed via the real S3 RPC path: live release · withdrawn · rights-held · re-registered policy draft with different notes', async () => {
    const live = await api.lane('w2-live-r1')
    REL.live = (await api.publishLane(live)).releaseKey
    IDS.live = live
    const revisedRows = await api.registerPolicy(live.sourceId, makePolicy('w2-lantern-policy-revised', 'B1'))
    const revised = { ...live, slots: Object.fromEntries(revisedRows.map((r) => [r.edition_key, r])) }
    need(revised.slots['w2-story'].slot_id !== live.slots['w2-story'].slot_id, 'revised policy did not create a new slot')
    IDS.revisedVersion = (await api.submitReviewed(revised, 2)).versionId
    const wd = await api.lane('w2-withdrawn-r1')
    REL.withdrawn = (await api.publishLane(wd)).releaseKey
    await api.withdraw(REL.withdrawn)
    const held = await api.lane('w2-held-r1')
    REL.held = (await api.publishLane(held)).releaseKey
    await api.rights(held.sourceId, 'hold')
    IDS.held = held
    return { releases: REL }
  })
  if (!(REL.live && REL.withdrawn && REL.held)) { notRun('ALL', 'database checks', 'seed failed (H03)'); return }

  const objBefore = await objSnapshot(db)
  const dataBefore = await dataSnapshot(db)
  const listener = await cluster.connect('w2_main')
  const pgrst = []
  listener.on('notification', (n) => pgrst.push({ channel: n.channel, payload: n.payload }))
  await listener.query('listen pgrst')
  const settle = () => new Promise((r) => setTimeout(r, 400))
  const fnExists = async () => (await db.q(`select to_regprocedure($1) is not null as e`, [FN]))[0].e

  await check('W00a', 'guard: statement-by-statement autocommit application fails at the tripwire and creates nothing', async () => {
    let failedAt = null
    for (const [i, s] of F.forward.stmts.entries()) {
      try { await db.client.query(s.raw) } catch (e) { failedAt = { index: i, error: errText(e) }; break }
    }
    need(failedAt && /tripwire|한 트랜잭션/.test(failedAt.error), `autocommit run did not fail at tripwire: ${JSON.stringify(failedAt)}`)
    eq(await fnExists(), false, 'function created under autocommit')
    return failedAt
  })
  await check('W00b', 'guard: REPEATABLE READ application rejected; nothing created', async () => {
    const r = await applySql(db.client, F.forward, 'repeatable read')
    need(!r.ok && /read committed/.test(r.text), `repeatable read not rejected: ${r.ok ? 'applied' : r.text}`)
    eq(await fnExists(), false, 'function created')
  })
  await check('W00c', 'guard: S5 learner door quarantined (authenticated EXECUTE on story_reader_context revoked) → forward refuses', async () => {
    await db.client.query('begin')
    try {
      await db.client.query(`revoke execute on function public.story_reader_context(text, integer) from authenticated`)
      let msg = null
      try { await db.client.query(F.forward.text) } catch (e) { msg = errText(e) }
      need(msg && /quarantine/.test(msg), `forward did not refuse under quarantine: ${msg ?? 'applied'}`)
    } finally { await db.client.query('rollback') }
  })
  await check('W00d', 'guard: applier without RLS exemption (not owner, NOBYPASSRLS) is rejected before creating the function', async () => {
    await db.client.query('begin')
    try {
      await db.client.query(`grant usage, create on schema public to w2_applier_nb`)
      await db.client.query(`grant usage on schema story to w2_applier_nb`)
      await db.client.query(`grant select on story.releases, story.release_units, story.edition_versions, story.edition_slots, story.policies, story.sources to w2_applier_nb`)
      await db.client.query(`grant execute on function story.require_learner(), story.source_rights_ok(uuid) to w2_applier_nb`)
      await db.client.query(`set local role w2_applier_nb`)
      let msg = null
      try { await db.client.query(F.forward.text) } catch (e) { msg = errText(e) }
      need(msg && /RLS/.test(msg), `non-exempt applier not rejected: ${msg ?? 'applied'}`)
    } finally { await db.client.query('rollback') }
  })
  await check('W00n', 'NOTIFY: refused/guarded applications delivered no pgrst notification', async () => {
    await settle()
    deepEq(pgrst, [], 'notifications before a committed apply')
  })
  await check('W00', 'forward applied once inside BEGIN/COMMIT; inside the transaction lock_timeout=3s and statement_timeout=1min are in force; exactly one pgrst "reload schema" on commit', async () => {
    const r = await applySql(db.client, F.forward, null, `select current_setting('lock_timeout') as lock_timeout, current_setting('statement_timeout') as statement_timeout`)
    if (!r.ok) throw new Error(r.text)
    gate.forward = true
    deepEq(r.seen, [{ lock_timeout: '3s', statement_timeout: '1min' }], 'transaction-scoped timeouts')
    const after = (await db.q(`select current_setting('lock_timeout') as l, current_setting('statement_timeout') as s`))[0]
    deepEq(after, { l: '0', s: '0' }, 'timeouts did not leak past the transaction')
    await settle()
    deepEq(pgrst, [{ channel: 'pgrst', payload: 'reload schema' }], 'notification on commit')
    return { in_txn: r.seen[0], after_commit: after, notifications: [...pgrst] }
  })
  await gated('W01', 'attributes: SECURITY DEFINER · STABLE · search_path pinned · EXECUTE = authenticated only (effective)', async () => {
    const p = (await db.q(`select p.prosecdef, p.provolatile::text as vol, p.proconfig, pg_get_function_result(p.oid) as res from pg_proc p where p.oid = to_regprocedure($1)`, [FN]))[0]
    eq(p.prosecdef, true, 'prosecdef'); eq(p.vol, 's', 'provolatile'); eq(p.res, 'jsonb', 'result')
    deepEq(p.proconfig, ['search_path=pg_catalog, pg_temp'], 'proconfig')
    for (const [role, want] of [['authenticated', true], ['anon', false], ['service_role', false], ['public', false]]) {
      eq((await db.q(`select has_function_privilege($1, $2, 'EXECUTE') as p`, [role, FN]))[0].p, want, `${role} EXECUTE`)
    }
  })
  const notesOf = async (who, key, unit) => (await db.as(who, NOTES, [key, unit]))[0].c
  await gated('W02', 'learner: unit u2 → [note-a, note-b] · u3 → [note-b] · u1/u4 → [] · exact keys · stored text verbatim in change_log order', async () => {
    const out = {}
    for (const [unit, want] of [[0, []], [1, [{ id: 'note-a', text: NOTE_A }, { id: 'note-b', text: NOTE_B }]], [2, [{ id: 'note-b', text: NOTE_B }]], [3, []]]) {
      const c = await notesOf(A.learner, REL.live, unit)
      deepEq(Object.keys(c).sort(), ['notes', 'release_key', 'unit_index'], 'top keys')
      eq(c.release_key, REL.live, 'release_key'); eq(c.unit_index, unit, 'unit_index')
      deepEq(c.notes, want, `unit ${unit} notes`)
      for (const n of c.notes) deepEq(Object.keys(n).sort(), ['id', 'text'], 'note keys')
      out[unit] = c.notes.map((n) => n.id)
    }
    return out
  })
  await gated('W03', 'auth: anon / service_role → 42501 · authenticated without sub → story:auth_required · suspended → story:account_blocked', async () => {
    await expectError(db.as(A.anon, NOTES, [REL.live, 1]), /permission denied/, 'anon', '42501')
    await expectError(db.as(A.service, NOTES, [REL.live, 1]), /permission denied/, 'service_role', '42501')
    await expectError(db.as(A.noSub, NOTES, [REL.live, 1]), /story:auth_required/, 'no sub')
    await expectError(db.as(A.suspended, NOTES, [REL.live, 1]), /story:account_blocked/, 'suspended')
  })
  await gated('W04', 'unavailable: withdrawn · rights hold · unknown key → story:release_unavailable · unit out of range / null → story:unit_not_found', async () => {
    for (const k of [REL.withdrawn, REL.held, `lsr_${'0'.repeat(32)}`, 'not-a-key']) {
      await expectError(db.as(A.learner, NOTES, [k, 1]), /story:release_unavailable/, `key ${k.slice(0, 12)}`)
    }
    for (const u of [-1, 4, 9999, null]) await expectError(db.as(A.learner, NOTES, [REL.live, u]), /story:unit_not_found/, `unit ${u}`)
  })
  await gated('W05', 'no private leakage across all units: no LEAKMARK (plain note · revise note · gloss · rationale · issue · body · policy · review), no UUID, no sha256', async () => {
    const all = []
    for (let u = 0; u < 4; u++) all.push(await notesOf(A.learner, REL.live, u))
    const text = JSON.stringify(all)
    need(!/LEAKMARK/.test(text), 'LEAKMARK leaked')
    need(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text), 'UUID leaked')
    need(!/[0-9a-f]{64}/.test(text), 'sha256 leaked')
    return { bytes: text.length }
  })
  await gated('W06', 'reads only the release version: the unpublished draft of a re-registered policy (different note text) never appears', async () => {
    for (let u = 0; u < 4; u++) need(!JSON.stringify(await notesOf(A.learner, REL.live, u)).includes('LEAKMARK-REVISED'), `draft note leaked at unit ${u}`)
  })
  await gated('W07', 'rights: hold closes notes (release_unavailable) with the reader context; confirmed reopens', async () => {
    const r = await db.txAs(A.learner, [
      { sql: `insert into story.rights_decisions (source_id, asset, status, basis, decided_by) values ($1, 'source_text', 'hold', 'w2 test hold', $2)`, params: [IDS.live.sourceId, U.admin] },
    ], NOTES, [REL.live, 1])
    need(!r.ok && /story:release_unavailable/.test(r.text), `hold: ${r.ok ? 'returned' : r.text}`)
    const r2 = await db.txAs(A.learner, [
      { sql: `insert into story.rights_decisions (source_id, asset, status, basis, evidence_ref, decided_by) values ($1, 'source_text', 'confirmed', 'w2 reopen', 'w2-test', $2)`, params: [IDS.held.sourceId, U.admin] },
    ], NOTES, [REL.held, 1])
    need(r2.ok && r2.rows[0].c.notes.length === 2, `reopen: ${r2.ok ? JSON.stringify(r2.rows[0].c.notes) : r2.text}`)
  })
  const TAMPER = [
    ['edition version edition_sha256 changed', [REPLICA, { sql: `update story.edition_versions ev set edition_sha256 = repeat('e', 64) from story.releases rl where ev.id = rl.edition_version_id and rl.release_key = $1` }], /edition_version/],
    ['release points to the unpublished draft version', [REPLICA, { sql: `update story.releases rl set edition_version_id = $2 where rl.release_key = $1`, extra: 'DRAFT' }], /edition_version/],
    ['artifact edition_key changed', (k) => editArtifact(k, `jsonb_set(ev.artifact, '{edition_key}', '"w2-other"'::jsonb)`), /edition_version/],
    ['artifact units shortened', (k) => editArtifact(k, `jsonb_set(ev.artifact, '{units}', (ev.artifact -> 'units') - 3)`), /unit_count/],
    ['release unit_id differs from artifact unit_id', [REPLICA, { sql: `update story.release_units ru set unit_id = 'u9' from story.releases rl where ru.release_id = rl.id and rl.release_key = $1 and ru.unit_index = 1` }], /unit_id/],
    ['slot target_sha256 changed', [REPLICA, { sql: `update story.edition_slots es set target_sha256 = repeat('b', 64) from story.releases rl where rl.slot_id = es.id and rl.release_key = $1` }], /binding/],
    ['policy policy_sha256 changed', [REPLICA, { sql: `update story.policies p set policy_sha256 = repeat('c', 64) from story.releases rl join story.edition_slots es on es.id = rl.slot_id where p.id = es.policy_id and rl.release_key = $1` }], /binding/],
    ['policy source_sha256 changed', (k) => editPolicy(k, `jsonb_set(p.policy, '{source_sha256}', to_jsonb(repeat('d', 64)))`), /binding/],
    ['source text_sha256 changed', [REPLICA, { sql: `update story.sources s set text_sha256 = repeat('f', 64) from story.releases rl where s.id = rl.source_id and rl.release_key = $1` }], /binding/],
    ['release source identity changed', [REPLICA, { sql: `update story.releases set source_identity_sha256 = repeat('1', 64) where release_key = $1` }], /binding/],
    ['slot policy moved to another source policy', [REPLICA, { sql: `update story.edition_slots es set source_id = gen_random_uuid() from story.releases rl where rl.slot_id = es.id and rl.release_key = $1` }], /binding/],
  ]
  await gated('W08', 'binding tamper (rolled back, triggers bypassed): every mismatch fails the call with story:context_notes_mismatch (never an empty list)', async () => {
    const out = []
    for (const [label, setup, re] of TAMPER) {
      const steps = typeof setup === 'function' ? setup(REL.live) : setup
      const s = steps.map((x) => {
        if (x === REPLICA) return x
        const params = /\$1/.test(x.sql) ? [REL.live, ...(x.extra === 'DRAFT' ? [IDS.revisedVersion] : [])] : []
        return { sql: x.sql, params }
      })
      const r = await db.txAs(A.learner, s, NOTES, [REL.live, 1])
      need(!r.ok && /story:context_notes_mismatch/.test(r.text) && re.test(r.text), `${label}: ${r.ok ? `returned ${JSON.stringify(r.rows[0].c)}` : r.text}`)
      out.push(label)
    }
    return { tampers: out.length }
  })
  const SHAPES = [
    ['change_log not an array', `jsonb_set(ev.artifact, '{change_log}', '{}'::jsonb)`, 'artifact', /shape/],
    ['duplicate change_id (S2 duplicate_id)', setChange('note-plain', `jsonb_set(e, '{change_id}', '"note-a"')`), 'artifact', /change_ids/],
    ['change_id not a string', setChange('c-1', `jsonb_set(e, '{change_id}', '1')`), 'artifact', /change_ids/],
    ['sensitive_ref unknown (S2 sensitive_unknown)', setChange('note-plain', `jsonb_set(e, '{sensitive_ref}', '"se-unknown"')`), 'artifact', /sensitive_ref/],
    ['selected note learner_note null (S2 sensitive_note_missing)', setChange('note-a', `jsonb_set(e, '{learner_note}', 'null')`), 'artifact', /context_note/],
    ['selected note learner_note blank', setChange('note-a', `jsonb_set(e, '{learner_note}', '"   "')`), 'artifact', /context_note/],
    ['selected note learner_note not a string', setChange('note-b', `jsonb_set(e, '{learner_note}', '7')`), 'artifact', /context_note/],
    ['selected note unit_ids point to a missing unit (S2 change_unit_missing)', setChange('note-b', `jsonb_set(e, '{unit_ids}', '["u2","u9"]')`), 'artifact', /context_note/],
    ['selected note unit_ids not an array', setChange('note-a', `jsonb_set(e, '{unit_ids}', '"u2"')`), 'artifact', /context_note/],
    ['policy sensitive_content not an array', `jsonb_set(p.policy, '{sensitive_content}', '{}'::jsonb)`, 'policy', /shape/],
    ['policy sensitive_content duplicate id', `jsonb_set(p.policy, '{sensitive_content}', (p.policy -> 'sensitive_content') || jsonb_build_array((p.policy -> 'sensitive_content') -> 0))`, 'policy', /sensitive_content/],
  ]
  await gated('W09', 'shape tamper consistent with S2 (duplicate · unknown ref · blank/null/non-string note · wrong unit) fails closed; valid long/unicode notes and a non-retain handling are positive controls', async () => {
    const out = []
    for (const [label, expr, where, re] of SHAPES) {
      const setup = where === 'artifact' ? editArtifact(REL.live, expr) : editPolicy(REL.live, expr)
      const r = await db.txAs(A.learner, setup, NOTES, [REL.live, 1])
      need(!r.ok && /story:context_notes_mismatch/.test(r.text) && re.test(r.text), `${label}: ${r.ok ? `returned ${JSON.stringify(r.rows[0].c)}` : r.text}`)
      out.push(label)
    }
    // 양성 대조: S2 Text 에 상한이 없으므로 긴 · 유니코드 설명도 그대로.
    const long = `${'가'.repeat(2000)} 🌊👋🏽 é ZWJ 👩‍💻 NBSP  탭\t 따옴표 " 역슬래시 \\ 줄바꿈\n끝`
    const p1 = await db.txAs(A.learner, editArtifact(REL.live, setChange('note-a', `jsonb_set(e, '{learner_note}', to_jsonb(${lit(long)}::text))`)), NOTES, [REL.live, 1])
    need(p1.ok, `long note: ${p1.text}`)
    deepEq(p1.rows[0].c.notes, [{ id: 'note-a', text: long }, { id: 'note-b', text: NOTE_B }], 'long/unicode note verbatim')
    // 처리 방침이 retain_with_context 가 아니면(omit_with_note) 그 설명은 고르지 않는다(오류 아님).
    const p2 = await db.txAs(A.learner, editPolicy(REL.live, `jsonb_set(p.policy, '{sensitive_content,0,handling}', '"omit_with_note"')`), NOTES, [REL.live, 1])
    need(p2.ok, `non-retain handling: ${p2.text}`)
    deepEq(p2.rows[0].c.notes, [{ id: 'note-b', text: NOTE_B }], 'non-retain excluded')
    return { shapes: out.length, positive_long_unicode: true, positive_non_retain_excluded: true }
  })
  await gated('W10', 'read-only: calls change no story row; existing functions/ACL unchanged by forward', async () => {
    for (let u = 0; u < 4; u++) await notesOf(A.learner, REL.live, u)
    deepEq(await dataSnapshot(db), dataBefore, 'story data')
    deepEq(await objSnapshot(db), objBefore, 'existing functions/ACL')
  })
  await gated('W11', 'cost (informative): unit-call timing on the fixture scale', async () => {
    const t = Date.now()
    for (let i = 0; i < 20; i++) await notesOf(A.learner, REL.live, 1)
    return { calls: 20, avg_ms: (Date.now() - t) / 20, note: 'fixture scale only — live artifact (~300 KB) not measured' }
  })
  await gated('W12', 're-application is refused (already exists), changes nothing and sends no extra notification', async () => {
    const r = await applySql(db.client, F.forward)
    need(!r.ok && /already exists/.test(r.text), `re-apply not refused: ${r.ok ? 'applied' : r.text}`)
    deepEq(await dataSnapshot(db), dataBefore, 'story data')
    await settle()
    eq(pgrst.length, 1, 'no extra notification')
  })
  await gated('R01', 'recovery (one BEGIN/COMMIT): EXECUTE revoked from every client role, definition kept, reader RPCs and data unchanged, idempotent, no notification', async () => {
    const def = (await db.q(`select md5(pg_get_functiondef(to_regprocedure($1))) as d`, [FN]))[0].d
    const r = await applySql(db.client, F.recovery)
    if (!r.ok) throw new Error(r.text)
    for (const role of ['anon', 'authenticated', 'service_role', 'public']) {
      eq((await db.q(`select has_function_privilege($1, $2, 'EXECUTE') as p`, [role, FN]))[0].p, false, `${role} EXECUTE after recovery`)
    }
    eq((await db.q(`select md5(pg_get_functiondef(to_regprocedure($1))) as d`, [FN]))[0].d, def, 'definition kept')
    await expectError(db.as(A.learner, NOTES, [REL.live, 1]), /permission denied/, 'learner call after recovery', '42501')
    const ctx = await db.one(A.learner, `select public.story_reader_context($1, 1) as c`, [REL.live])
    eq(ctx.c.release_key, REL.live, 'reader context still works')
    deepEq(await objSnapshot(db), objBefore, 'existing functions/ACL after recovery')
    deepEq(await dataSnapshot(db), dataBefore, 'story data after recovery')
    const again = await applySql(db.client, F.recovery)
    need(again.ok, `recovery not idempotent: ${again.text}`)
    await settle()
    eq(pgrst.length, 1, 'recovery sends no pgrst notification')
  })
  await check('R02', 'recovery before forward fails without changing anything (fresh database)', async () => {
    await admin.q(`create database w2_recovery_only`)
    const d2 = wrap(await cluster.connect('w2_recovery_only'))
    await d2.q(BOOTSTRAP_SUPER)
    for (const k of ['s3', 's5', 'u1']) {
      const r = await applySql(d2.client, F[k])
      if (!r.ok) throw new Error(`${k} apply failed: ${r.text}`)
    }
    const r = await applySql(d2.client, F.recovery)
    need(!r.ok && /does not exist/.test(r.text), `recovery without forward: ${r.ok ? 'applied' : r.text}`)
  })
  notRun('N01', 'PostgREST: schema cache reload actually observed, RPC exposure, error JSON shape', 'no PostgREST in the isolated harness — verify after an approved apply (read-only)')
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
