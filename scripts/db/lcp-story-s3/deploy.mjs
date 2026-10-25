// scripts/db/lcp-story-s3/deploy.mjs
//
// LCP Story S3 SQL 의 승인형 배포 러너. authored-supply · r5-bind 러너와 같은 승인 계약을 그대로 쓴다:
//   · apply 는 Claude Code 승인 창(db-approval 훅이 덧붙인 1회용 --approval-nonce) 또는 TTY 에서 `APPLY <stage> <sha>` 입력으로만.
//     자동화(VFC_AUTOMATED_RUN · AGENT_GUARD_ASK=0 · CI) · 비TTY 난수 없음 · SHA 불일치 · 정본 경로가 아닌 실행은 DB 접속 전에 차단.
//   · 본문은 저장소 파일 바이트 그대로(supabase/migrations/_pending_lcp_story_s3_*.sql) · 전체 SHA 가 STAGES 상수와 같을 때만.
//     사용자 입력으로 SQL 을 받지 않는다.
//   · 한 트랜잭션: 이력 잠금 → 순서 판정 → 원본 지문(도서 · 프로필 · texts · content_chunks · reading_sessions) → 본문 →
//     원본 지문 재측정(다르면 롤백) → 이력 행 → commit. 실패는 롤백, 커밋 확인 불가는 결과 불명(종료 4, 재시도 금지).
//   · quarantine 단계는 schema 이력 SHA 가 승인값과 같을 때만 — 권한만 회수하고 표 · 이력은 남긴다.
//
//   node scripts/db/lcp-story-s3/deploy.mjs preflight --stage schema|quarantine --deps <dir> [--db-url-env KEY]   # 읽기 전용
//   node scripts/db/lcp-story-s3/deploy.mjs apply     --stage schema|quarantine --deps <dir> [--db-url-env KEY] --confirm-sha <sha>
//   node scripts/db/lcp-story-s3/deploy.mjs verify    --stage schema|quarantine --deps <dir> [--db-url-env KEY]   # 읽기 전용
//
// 종료 코드: 0 성공 · 1 사용법 · 2 적용 전 차단 · 3 롤백됨 · 4 결과 불명/검증 실패(재시도 금지 · /db-incident)
// 정책: 중앙 development_policy.db_apply(2026-10-25) — 사용자 대화 승인 뒤 이 러너로만 적용한다. MCP SQL 도구로 쓰지 않는다.

import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { consumeTicket, NONCE_FLAG } from '../../../agents/scripts/db-approval.mjs'
import { redactText, resolveDbUrl, targetOf, ticketApprovalRecord, writeAuthorizationBlocks } from '../factory-i1/deploy.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const LOG_DIR = 'scripts/db/lcp-story-s3/logs'
const RUNNER = 'lcp-story-s3'

export const STAGES = {
  schema: {
    version: '20261025140000', name: 'lcp_story_s3_schema',
    path: 'supabase/migrations/_pending_lcp_story_s3_schema.sql',
    sha256: 'bf83c38ea183988568491d9818994f1ade1a96a34d31190199ce9c261a17791c',
    after: null,
  },
  quarantine: {
    version: '20261025140100', name: 'lcp_story_s3_quarantine',
    path: 'supabase/migrations/_pending_lcp_story_s3_quarantine.sql',
    sha256: 'd409cc587523e888534322b09bb808fee53aa76933b3b49ba84d8ab3591199e3',
    after: 'schema',
  },
}

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex')
const OUR_VERSIONS = Object.values(STAGES).map((s) => `'${s.version}'`).join(',')

export const HISTORY_SQL = `select version, name, encode(sha256(convert_to(array_to_string(statements, ''), 'UTF8')), 'hex') as sha256
  from supabase_migrations.schema_migrations where version in (${OUR_VERSIONS}) order by version`

/** 적용 전 읽기 전용 전제 — 각 행 (check, ok, detail). schema 단계만. */
export const PREFLIGHT_SQL = {
  schema: [
    `select 'story_schema_absent', to_regnamespace('story') is null, null`,
    `select 'no_public_story_functions', count(*) = 0, string_agg(p.proname, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'story\\_%'`,
    `select 'prereq_auth_uid', to_regprocedure('auth.uid()') is not null, null`,
    `select 'prereq_user_profiles', to_regclass('public.user_profiles') is not null, null`,
    `select 'prereq_library_books', to_regclass('public.library_books') is not null, null`,
    `select 'prereq_roles', count(*) = 3, string_agg(rolname, ',') from pg_roles where rolname in ('anon','authenticated','service_role')`,
  ],
  quarantine: [
    `select 'story_schema_present', to_regnamespace('story') is not null, null`,
  ],
}

const STORY_TABLES = "array['sources','policies','edition_slots','edition_versions','reviews','rights_decisions','releases','release_units','reading_progress','action_log']"
const STORY_FNS = "array['story_admin_register_source','story_admin_register_policy','story_admin_submit_edition','story_admin_submit_review','story_admin_record_rights','story_admin_publish','story_admin_withdraw','story_admin_list_slots','story_admin_get_bundle','story_catalog','story_read_unit','story_record_progress','story_my_progress']"

/** 단계별 사후 검증 — 각 행 (check, ok, detail) */
export const VERIFY_SQL = {
  schema: [
    `select 'tables_exist_rls', bool_and(coalesce((select relrowsecurity from pg_class where oid = to_regclass('story.'||t)), false)), string_agg(t, ',') from unnest(${STORY_TABLES}) t`,
    `select 'no_client_schema_usage', not (has_schema_privilege('anon','story','USAGE') or has_schema_privilege('authenticated','story','USAGE') or has_schema_privilege('service_role','story','USAGE')), null`,
    `select 'no_client_table_privileges', bool_and(not has_table_privilege('anon','story.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') and not has_table_privilege('authenticated','story.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') and not has_table_privilege('service_role','story.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')), null from unnest(${STORY_TABLES}) t`,
    `select 'rpc_count', count(*) = 13, string_agg(p.proname, ',' order by p.proname) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any(${STORY_FNS})`,
    `select 'rpc_definer_search_path_pg_temp', bool_and(p.prosecdef and array_to_string(p.proconfig, ',') = 'search_path=pg_catalog, pg_temp'), string_agg(p.proname, ',') from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any(${STORY_FNS})`,
    `select 'anon_only_catalog', bool_and(has_function_privilege('anon', p.oid, 'EXECUTE') = (p.proname = 'story_catalog')), string_agg(p.proname, ',') filter (where has_function_privilege('anon', p.oid, 'EXECUTE')) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any(${STORY_FNS})`,
    `select 'service_role_no_rpc', bool_and(not has_function_privilege('service_role', p.oid, 'EXECUTE')), null from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any(${STORY_FNS})`,
    `select 'authenticated_all_rpc', bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE')), null from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any(${STORY_FNS})`,
    `select 'story_internal_not_executable', bool_and(not has_function_privilege('anon', p.oid, 'EXECUTE') and not has_function_privilege('authenticated', p.oid, 'EXECUTE') and not has_function_privilege('service_role', p.oid, 'EXECUTE')), null from pg_proc p where p.pronamespace = 'story'::regnamespace`,
    `select 'story_rows_empty', (select count(*) from story.sources) + (select count(*) from story.releases) + (select count(*) from story.reading_progress) = 0, null`,
  ],
  quarantine: [
    `select 'tables_kept', bool_and(to_regclass('story.'||t) is not null), string_agg(t, ',') from unnest(${STORY_TABLES}) t`,
    `select 'rpc_closed', bool_and(not has_function_privilege('anon', p.oid, 'EXECUTE') and not has_function_privilege('authenticated', p.oid, 'EXECUTE') and not has_function_privilege('service_role', p.oid, 'EXECUTE')), string_agg(p.proname, ',') from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any(${STORY_FNS})`,
  ],
}

/** 원본 지문 — 본문 전후로 같아야 한다(영향 0 확인). 각 행 (name, fingerprint). */
export const LEGACY_FINGERPRINT_SQL = `select 'library_books', count(*) || ':' || coalesce(md5(string_agg(id::text || '|' || status || '|' || coalesce(published_at::text, '') || '|' || copyright_safe_in_kr::text, ',' order by id)), '') from public.library_books
  union all select 'user_profiles', count(*) || ':' || coalesce(md5(string_agg(user_id::text || '|' || role || '|' || status, ',' order by user_id)), '') from public.user_profiles
  union all select 'texts', count(*) || ':' || coalesce(md5(string_agg(id::text || '|' || coalesce(status, '') || '|' || coalesce(progress_percent::text, '') || '|' || coalesce(library_book_id::text, ''), ',' order by id)), '') from public.texts
  union all select 'content_chunks', count(*) || ':' || coalesce(sum(byte_size), 0) from public.content_chunks
  union all select 'reading_sessions', count(*)::text from public.reading_sessions`

/** 이력 행으로 적용 전 차단 판정. history = [{version, name, sha256}] (이 러너의 버전만) */
export function evaluate(stage, history, { mode }) {
  const st = STAGES[stage]
  if (!st) return [`DEPLOY_BLOCKED[stage] 알 수 없는 단계 ${stage}`]
  const b = []
  const by = Object.fromEntries(history.map((h) => [h.version, h]))
  if (st.after) {
    const prev = STAGES[st.after]
    if (by[prev.version]?.sha256 !== prev.sha256) b.push(`DEPLOY_BLOCKED[order] ${st.after}(${prev.version}) 이력이 없거나 SHA 가 승인값과 다르다`)
  }
  if (mode === 'apply' && by[st.version]) b.push(`DEPLOY_BLOCKED[already] ${stage}(${st.version}) 는 이미 적용됐다 — 재적용하지 않는다`)
  if (mode === 'verify' && by[st.version]?.sha256 !== st.sha256) b.push(`DEPLOY_BLOCKED[history] ${stage} 이력 SHA 가 승인값과 다르다`)
  return b
}

/** 저장소 본문이 승인 SHA 와 같은가 */
export function offlineCheck(stage, { root = ROOT } = {}) {
  const st = STAGES[stage]
  if (!st) return { blocks: [`DEPLOY_BLOCKED[stage] 알 수 없는 단계 ${stage}`], text: null }
  const abs = path.join(root, st.path)
  if (!fs.existsSync(abs)) return { blocks: [`DEPLOY_BLOCKED[sha] ${st.path} 가 없다`], text: null }
  const buf = fs.readFileSync(abs)
  if (sha256(buf) !== st.sha256) return { blocks: [`DEPLOY_BLOCKED[sha] ${st.path} sha256 이 승인값과 다르다`], text: null }
  return { blocks: [], text: buf.toString('utf8') }
}

/** apply 권한 차단 — 자동화/CI 거절 · SHA 일치 · 비TTY 는 난수 필수. 티켓 소비 · 프롬프트 전에 부른다. */
export function applyAuthorizationBlocks(o, { tty, env = process.env }) {
  const b = writeAuthorizationBlocks({}, { env, stdinIsTTY: tty, stdoutIsTTY: tty, ticket: !tty && Boolean(o.approvalNonce) })
  if (!STAGES[o.stage]) b.push(`DEPLOY_BLOCKED[stage] 알 수 없는 단계 ${o.stage}`)
  else if (o.confirmSha !== STAGES[o.stage].sha256) b.push('DEPLOY_BLOCKED[sha] --confirm-sha 가 승인 SHA 와 다르다')
  return b
}

function canonicalBlock() {
  const self = fs.realpathSync(fileURLToPath(import.meta.url))
  let invoked = null
  try { invoked = process.argv[1] ? fs.realpathSync(process.argv[1]) : null } catch { /* 없는 경로 */ }
  const want = path.join(fs.realpathSync(ROOT), 'scripts', 'db', 'lcp-story-s3', 'deploy.mjs')
  const same = (a, b) => (process.platform === 'win32' ? a?.toLowerCase() === b?.toLowerCase() : a === b)
  return same(invoked, self) && same(self, want) ? null : 'DEPLOY_BLOCKED[permission] approval-nonce mode requires running the canonical scripts/db/lcp-story-s3/deploy.mjs directly'
}

let secretUrl
function writeLog(obj, existing) {
  const dir = path.join(ROOT, LOG_DIR)
  fs.mkdirSync(dir, { recursive: true })
  const f = existing ? path.join(ROOT, existing) : path.join(dir, `${obj.stage}-${obj.command}-${obj.target}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(f, redactText(JSON.stringify(obj, null, 2), secretUrl) + '\n')
  return path.relative(ROOT, f).replaceAll('\\', '/')
}

export async function readHistory(client) {
  return (await client.query(HISTORY_SQL)).rows
}

async function checkRows(client, list) {
  const rows = []
  for (const q of list) {
    const r = await client.query({ text: q, rowMode: 'array' })
    const [check, ok, detail] = r.rows[0]
    rows.push({ check, ok: ok === true, detail })
  }
  return { ok: rows.every((r) => r.ok), rows }
}

export const runPreflight = (client, stage) => checkRows(client, PREFLIGHT_SQL[stage])
export const runVerify = (client, stage) => checkRows(client, VERIFY_SQL[stage])

export async function legacyFingerprint(client) {
  const r = await client.query({ text: LEGACY_FINGERPRINT_SQL, rowMode: 'array' })
  return Object.fromEntries(r.rows.map(([name, fp]) => [name, String(fp)]))
}

/** 단계 적용 — 한 트랜잭션. 격리 시험(verify-pg17.mjs)도 이 함수를 그대로 부른다. */
export async function applyStage(client, stage, { text, approvedBy }) {
  const st = STAGES[stage]
  const t0 = new Date().toISOString()
  let committing = false
  let legacy = null
  await client.query('begin')
  try {
    await client.query("set local lock_timeout = '15s'; set local statement_timeout = '120s'")
    await client.query('lock table supabase_migrations.schema_migrations in share row exclusive mode')
    const blocks = evaluate(stage, await readHistory(client), { mode: 'apply' })
    if (blocks.length) throw Object.assign(new Error(blocks.join('\n')), { code: 'P0001' })
    const before = await legacyFingerprint(client)
    await client.query(text)
    const after = await legacyFingerprint(client)
    legacy = { before, after, unchanged: JSON.stringify(before) === JSON.stringify(after) }
    if (!legacy.unchanged) throw Object.assign(new Error('DEPLOY_BLOCKED[impact] 원본 지문이 바뀌었다 — 롤백'), { code: 'P0001' })
    await client.query(`insert into supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key)
      values ($1, $2, $3, $4, $5)`, [st.version, st.name, [text], `${RUNNER}-deploy:${approvedBy}`, st.sha256])
    committing = true
    const committed = await client.query('commit')
    if (committed.command !== 'COMMIT') throw Object.assign(new Error('server did not confirm COMMIT'), { code: '40003' })
    return { ok: true, outcome: 'committed', legacy, started_at: t0, ended_at: new Date().toISOString() }
  } catch (e) {
    const serverRejection = /^(23|40|P0|22|25|42|0A)[0-9A-Z]{3}$/.test(e.code ?? '') && e.code !== '40003'
    let unknown = committing && !serverRejection
    await client.query('rollback').catch(() => { unknown = true })
    return { ok: false, outcome: unknown ? 'unknown' : 'rolled_back', legacy, started_at: t0, ended_at: new Date().toISOString(), error: { code: e.code ?? null, message: e.message } }
  }
}

export function parseArgs(a = process.argv.slice(2)) {
  const get = (n) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined }
  return { cmd: a[0], stage: get('--stage'), deps: get('--deps'), urlEnv: get('--db-url-env') ?? 'VF_DEPLOY_DB_URL',
    confirmSha: get('--confirm-sha'), approvalNonce: get(NONCE_FLAG) }
}

async function main() {
  const o = parseArgs()
  if (!['preflight', 'apply', 'verify'].includes(o.cmd) || !Object.prototype.hasOwnProperty.call(STAGES, o.stage ?? '')) {
    console.error('preflight|apply|verify --stage schema|quarantine')
    process.exit(1)
  }
  const st = STAGES[o.stage]
  const off = offlineCheck(o.stage)
  if (off.blocks.length) { console.error(off.blocks.join('\n')); process.exit(2) }
  let approvedBy = null
  if (o.cmd === 'apply') {
    const tty = Boolean(process.stdin.isTTY && process.stdout.isTTY)
    const b = applyAuthorizationBlocks(o, { tty })
    if (!tty && !b.length) { const c = canonicalBlock(); if (c) b.push(c) }
    if (!tty && !b.length) {
      const r = consumeTicket({ runner: RUNNER, stage: o.stage, sha: o.confirmSha, nonce: o.approvalNonce })
      if (!r.ticket) b.push(`DEPLOY_BLOCKED[permission] ${r.reason}`)
      else approvedBy = ticketApprovalRecord(r.ticket)
    }
    if (b.length) { console.error(b.join('\n')); process.exit(2) }
    if (tty) {
      const term = createInterface({ input: process.stdin, output: process.stdout })
      try {
        const expected = `APPLY ${o.stage} ${st.sha256}`
        if (await term.question(`Confirm reviewed full SHA by typing ${expected}: `) !== expected) { console.error('DEPLOY_BLOCKED[permission] confirmation mismatch'); process.exit(2) }
        approvedBy = `tty ${new Date().toISOString()}`
      } finally { term.close() }
    } else console.log(`Claude Code 승인 확인 — ${approvedBy}`)
  }
  if (!o.deps) { console.error('--deps <pg 설치 폴더>'); process.exit(1) }
  const url = resolveDbUrl(o.urlEnv)
  secretUrl = url
  if (!url) { console.error(`접속 문자열 ${o.urlEnv} 가 없다`); process.exit(2) }
  const target = targetOf(url)
  if (!target.ok) { console.error(target.why); process.exit(2) }
  const pg = createRequire(path.join(o.deps, 'package.json'))('pg')
  const client = new pg.Client({ connectionString: url, application_name: 'vf-lcp-story-s3-deploy', ssl: { rejectUnauthorized: true } })
  await client.connect()
  const log = { package: 'lcp-story-s3-deploy', stage: o.stage, command: o.cmd, target: target.target, stage_sha256: st.sha256,
    git_head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', windowsHide: true }).trim(),
    runner_sha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))) }
  try {
    const history = await readHistory(client)
    if (o.cmd === 'preflight') {
      const blocks = evaluate(o.stage, history, { mode: 'apply' })
      const pre = await runPreflight(client, o.stage)
      const legacy = await legacyFingerprint(client)
      Object.assign(log, { history, blocks, preflight: pre, legacy })
      const ok = !blocks.length && pre.ok
      console.log(JSON.stringify({ ok, blocks, preflight: pre.rows, legacy, log: writeLog(log) }, null, 2))
      process.exit(ok ? 0 : 2)
    }
    if (o.cmd === 'verify') {
      const blocks = evaluate(o.stage, history, { mode: 'verify' })
      const v = await runVerify(client, o.stage)
      const ok = v.ok && !blocks.length
      Object.assign(log, { history, blocks, verify: { ...v, ok } })
      console.log(JSON.stringify({ ok, blocks, rows: v.rows, log: writeLog(log) }, null, 2))
      process.exit(ok ? 0 : 4)
    }
    const pre = evaluate(o.stage, history, { mode: 'apply' })
    const pf = await runPreflight(client, o.stage)
    if (pre.length || !pf.ok) {
      Object.assign(log, { history, blocks: pre, preflight: pf })
      console.error([...pre, ...pf.rows.filter((r) => !r.ok).map((r) => `DEPLOY_BLOCKED[preflight] ${r.check}`)].join('\n'))
      console.error(`log ${writeLog(log)}`)
      process.exit(2)
    }
    Object.assign(log, { approved_by: approvedBy, history, preflight: pf, state: 'applying' })
    const logPath = writeLog(log)
    const r = await applyStage(client, o.stage, { text: off.text, approvedBy })
    Object.assign(log, { apply: r, state: r.outcome })
    writeLog(log, logPath)
    if (!r.ok) {
      console.error(redactText(`${r.outcome === 'unknown' ? 'INCIDENT: COMMIT outcome unknown; do not retry' : '적용 실패 — 롤백됨'}: ${r.error.message}`, url))
      console.error(`log ${logPath}`); process.exit(r.outcome === 'unknown' ? 4 : 3)
    }
    let v
    try { v = await runVerify(client, o.stage) } catch (e) { v = { ok: false, rows: [], error: { code: e.code ?? null, message: e.message } } }
    Object.assign(log, { verify: v, state: v.ok ? 'verified' : 'committed_verify_failed' })
    console.log(redactText(JSON.stringify({ applied: true, legacy: r.legacy, verify: v, log: writeLog(log, logPath) }, null, 2), url))
    process.exit(v.ok ? 0 : 4)
  } finally { await client.end().catch(() => {}) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) await main().catch((e) => {
  console.error(redactText(`DEPLOY_ERROR ${e.code ?? ''} ${e.message}`, secretUrl)); process.exitCode = 4
})
