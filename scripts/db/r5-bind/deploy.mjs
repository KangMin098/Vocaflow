// scripts/db/r5-bind/deploy.mjs
//
// R5 결속 2단위(I2 주석 결속 → 납품↔G2 결속)의 승인형 배포 러너. factory-i1 러너와 같은 승인 계약을 쓴다:
//   · apply 는 Claude Code 승인 창(db-approval 훅이 덧붙인 1회용 --approval-nonce) 또는 TTY 에서 `APPLY <stage> <sha>` 입력으로만.
//   · 본문은 저장소 파일 그대로 · 전체 SHA 가 승인 SHA 와 같을 때만 · 한 트랜잭션(본문 + 이력 행) · 실패 시 롤백.
//   · 순서 고정: i2 는 DB-2 이력 뒤 · g2 는 i2 이력(SHA 일치) 뒤. 이미 있는 단계는 다시 적용하지 않는다.
//
//   node scripts/db/r5-bind/deploy.mjs preflight --stage i2|g2 --deps <dir> [--db-url-env KEY]   # 읽기 전용
//   node scripts/db/r5-bind/deploy.mjs apply     --stage i2|g2 --deps <dir> [--db-url-env KEY] --confirm-sha <sha>
//   node scripts/db/r5-bind/deploy.mjs verify    --stage i2|g2 --deps <dir> [--db-url-env KEY]   # 읽기 전용
//
// 종료 코드: 0 성공 · 1 사용법 · 2 적용 전 차단 · 3 롤백됨 · 4 결과 불명/검증 실패(재시도 금지 · /db-incident)

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
const LOG_DIR = 'supabase/deploy/r5-bind/logs'
const RUNNER = 'r5-bind'
const DB2_VERSION = '20261017200100'

export const STAGES = {
  i2: {
    version: '20261018120000', name: 'workspace_supply_c_annotation_binding',
    path: 'supabase/migrations/_pending_workspace_supply_c_annotation_binding.sql',
    sha256: 'e7f7c16facd30124ec8a668701037d926a67c61dc1c5283c9ccbc79ce00c0b8c',
    after: DB2_VERSION,
  },
  g2: {
    version: '20261018120100', name: 'r5_delivery_g2_binding',
    path: 'supabase/deploy/r5-bind/20261018120100_r5_delivery_g2_binding.sql',
    sha256: '8043ce3bc712c26c0d0e42b11db2f2f7144848af2f2c7077fa57edc953dd4c2f',
    after: '20261018120000',
  },
}

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex')

const HISTORY_SQL = `select version, name, encode(sha256(convert_to(array_to_string(statements, ''), 'UTF8')), 'hex') as sha256
  from supabase_migrations.schema_migrations where version >= '${DB2_VERSION}' order by version`

/** 단계별 사후 검증 — 각 행 (check, ok, detail) */
export const VERIFY_SQL = {
  i2: [
    `select 'content_qualification_record_single', count(*) = 1, count(*)::text from pg_proc where proname = 'content_qualification_record'`,
    `select 'record_has_annotation_args', count(*) = 1, null from pg_proc where proname = 'content_qualification_record' and pg_get_function_identity_arguments(oid) like '%p_annotation_ref text, p_annotation_hash text%'`,
    `select 'annotation_columns', count(*) = 2, null from information_schema.columns where table_schema = 'public' and table_name = 'content_qualification' and column_name in ('annotation_ref', 'annotation_hash')`,
    `select 'annotation_bound_check', count(*) = 1, null from pg_constraint where conname = 'content_qualification_annotation_bound'`,
    `select 'sca_exists_rls', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.supply_current_annotation')), false), null`,
    `select 'sca_no_client_privs', not (has_table_privilege('authenticated', 'public.supply_current_annotation', 'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('anon', 'public.supply_current_annotation', 'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('service_role', 'public.supply_current_annotation', 'SELECT,INSERT,UPDATE,DELETE')), null`,
    `select 'sca_empty', (select count(*) from public.supply_current_annotation) = 0, null`,
    `select 'internal_fns_not_callable', bool_and(not has_function_privilege('authenticated', f, 'EXECUTE') and not has_function_privilege('anon', f, 'EXECUTE')), string_agg(f, ',')
       from unnest(array['public.supply_annotation_matches(uuid)', 'public.supply_delivery_valid_i1(uuid)', 'public.supply_delivery_valid(uuid)', 'public.workspace_delivery_record_i1(uuid,uuid,uuid,uuid,uuid)']) f`,
    `select 'writer_rpcs_auth_not_anon', bool_and(has_function_privilege('authenticated', f, 'EXECUTE') and not has_function_privilege('anon', f, 'EXECUTE')), string_agg(f, ',')
       from unnest(array['public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid)', 'public.content_qualification_record(text,text,text,text,text,text,jsonb,text,text,text,text,text,text,text,text[],text[],text,uuid)']) f`,
    `select 'definer_search_path_pg_temp', bool_and(prosecdef and array_to_string(proconfig, ',') like '%pg_temp%'), string_agg(proname, ',')
       from pg_proc where pronamespace = 'public'::regnamespace and proname in ('content_qualification_record', 'supply_annotation_matches', 'workspace_delivery_record', 'supply_delivery_valid')`,
  ],
  g2: [
    `select 'wda_exists_rls', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.workspace_delivery_attempt')), false), null`,
    `select 'first_exposure_partial_unique', count(*) = 1, max(indexdef) from pg_indexes where indexname = 'workspace_delivery_attempt_first_exposure' and indexdef like '%UNIQUE%' and indexdef like '%WHERE first_exposure%'`,
    `select 'request_key_unique', count(*) = 1, null from pg_constraint where conrelid = to_regclass('public.workspace_delivery_attempt') and contype = 'u' and pg_get_constraintdef(oid) = 'UNIQUE (user_id, request_key)'`,
    `select 'attempt_unique', count(*) = 1, null from pg_constraint where conrelid = to_regclass('public.workspace_delivery_attempt') and contype = 'u' and pg_get_constraintdef(oid) = 'UNIQUE (attempt_id)'`,
    `select 'append_only_triggers', count(*) = 2, string_agg(tgname, ',') from pg_trigger where tgrelid = to_regclass('public.workspace_delivery_attempt') and not tgisinternal`,
    `select 'owner_read_policy_select_only', count(*) = 1 and bool_and(cmd = 'SELECT'), string_agg(policyname || ':' || cmd, ',') from pg_policies where tablename = 'workspace_delivery_attempt'`,
    `select 'no_client_writes', not (has_table_privilege('authenticated', 'public.workspace_delivery_attempt', 'INSERT,UPDATE,DELETE,TRUNCATE') or has_table_privilege('anon', 'public.workspace_delivery_attempt', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')), null`,
    `select 'record_rpc_auth_not_anon', has_function_privilege('authenticated', 'public.workspace_delivery_attempt_record(uuid,bigint,uuid)', 'EXECUTE') and not has_function_privilege('anon', 'public.workspace_delivery_attempt_record(uuid,bigint,uuid)', 'EXECUTE'), null`,
    `select 'exposure_key_internal', not has_function_privilege('authenticated', 'public.r5_exposure_key(text,text)', 'EXECUTE') and not has_function_privilege('anon', 'public.r5_exposure_key(text,text)', 'EXECUTE'), null`,
    `select 'definer_search_path_pg_temp', bool_and(prosecdef and array_to_string(proconfig, ',') like '%pg_temp%'), string_agg(proname, ',') from pg_proc where pronamespace = 'public'::regnamespace and proname in ('workspace_delivery_attempt_record', 'r5_exposure_key')`,
    `select 'wda_empty', (select count(*) from public.workspace_delivery_attempt) = 0, null`,
  ],
}

/** 이력 행으로 적용 전 차단 판정. history = [{version, name, sha256}] (DB-2 이후) */
export function evaluate(stage, history, { mode }) {
  const st = STAGES[stage]
  const b = []
  const by = Object.fromEntries(history.map((h) => [h.version, h]))
  if (!by[DB2_VERSION]) b.push(`DEPLOY_BLOCKED[order] DB-2(${DB2_VERSION}) 이력이 없다`)
  if (stage === 'g2' && by[STAGES.i2.version]?.sha256 !== STAGES.i2.sha256) b.push('DEPLOY_BLOCKED[order] I2 이력이 없거나 SHA 가 승인값과 다르다')
  const unknown = history.map((h) => h.version).filter((v) => v > DB2_VERSION && !Object.values(STAGES).some((s) => s.version === v))
  if (unknown.length) b.push(`DEPLOY_BLOCKED[history] 예상 밖 원격 이력 ${unknown.join(',')}`)
  if (mode === 'apply' && by[st.version]) b.push(`DEPLOY_BLOCKED[already] ${stage}(${st.version}) 는 이미 적용됐다 — 재적용하지 않는다`)
  if (mode === 'verify' && by[st.version]?.sha256 !== st.sha256) b.push(`DEPLOY_BLOCKED[history] ${stage} 이력 SHA 가 승인값과 다르다`)
  return b
}

/** 저장소 본문이 승인 SHA 와 같은가 */
export function offlineCheck(stage) {
  const st = STAGES[stage]
  const abs = path.join(ROOT, st.path)
  if (!fs.existsSync(abs)) return { blocks: [`DEPLOY_BLOCKED[sha] ${st.path} 가 없다`], text: null }
  const buf = fs.readFileSync(abs)
  if (sha256(buf) !== st.sha256) return { blocks: [`DEPLOY_BLOCKED[sha] ${st.path} sha256 이 승인값과 다르다`], text: null }
  return { blocks: [], text: buf.toString('utf8') }
}

/** apply 권한 차단 — 자동화/CI 는 난수·TTY 어느 경로든 거절(factory-i1 과 같은 판정) · SHA 일치 · 비TTY 는 난수 필수. 티켓 소비 · 프롬프트 전에 부른다. */
export function applyAuthorizationBlocks(o, { tty, env = process.env }) {
  const b = writeAuthorizationBlocks({}, { env, stdinIsTTY: tty, stdoutIsTTY: tty, ticket: !tty && Boolean(o.approvalNonce) })
  if (o.confirmSha !== STAGES[o.stage]?.sha256) b.push('DEPLOY_BLOCKED[sha] --confirm-sha 가 승인 SHA 와 다르다')
  return b
}

function canonicalBlock() {
  const self = fs.realpathSync(fileURLToPath(import.meta.url))
  let invoked = null
  try { invoked = process.argv[1] ? fs.realpathSync(process.argv[1]) : null } catch { /* 없는 경로 */ }
  const want = path.join(fs.realpathSync(ROOT), 'scripts', 'db', 'r5-bind', 'deploy.mjs')
  const same = (a, b) => (process.platform === 'win32' ? a?.toLowerCase() === b?.toLowerCase() : a === b)
  return same(invoked, self) && same(self, want) ? null : 'DEPLOY_BLOCKED[permission] approval-nonce mode requires running the canonical scripts/db/r5-bind/deploy.mjs directly'
}

let secretUrl
function writeLog(obj, existing) {
  const dir = path.join(ROOT, LOG_DIR)
  fs.mkdirSync(dir, { recursive: true })
  const f = existing ? path.join(ROOT, existing) : path.join(dir, `${obj.stage}-${obj.command}-${obj.target}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(f, redactText(JSON.stringify(obj, null, 2), secretUrl) + '\n')
  return path.relative(ROOT, f).replaceAll('\\', '/')
}

async function readHistory(client) {
  return (await client.query(HISTORY_SQL)).rows
}

async function runVerify(client, stage) {
  const rows = []
  for (const q of VERIFY_SQL[stage]) {
    const r = await client.query({ text: q, rowMode: 'array' })
    const [check, ok, detail] = r.rows[0]
    rows.push({ check, ok: ok === true, detail })
  }
  return { ok: rows.every((r) => r.ok), rows }
}

async function applyStage(client, stage, { text, approvedBy }) {
  const st = STAGES[stage]
  const t0 = new Date().toISOString()
  let committing = false
  await client.query('begin')
  try {
    await client.query("set local lock_timeout = '15s'; set local statement_timeout = '120s'")
    await client.query('lock table supabase_migrations.schema_migrations in share row exclusive mode')
    const blocks = evaluate(stage, await readHistory(client), { mode: 'apply' })
    if (blocks.length) throw Object.assign(new Error(blocks.join('\n')), { code: 'P0001' })
    await client.query(text)
    await client.query(`insert into supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key)
      values ($1, $2, $3, $4, $5)`, [st.version, st.name, [text], `r5-bind-deploy:${approvedBy}`, st.sha256])
    committing = true
    const committed = await client.query('commit')
    if (committed.command !== 'COMMIT') throw Object.assign(new Error('server did not confirm COMMIT'), { code: '40003' })
    return { ok: true, outcome: 'committed', started_at: t0, ended_at: new Date().toISOString() }
  } catch (e) {
    const serverRejection = /^(23|40|P0|22|25|42|0A)[0-9A-Z]{3}$/.test(e.code ?? '') && e.code !== '40003'
    let unknown = committing && !serverRejection
    await client.query('rollback').catch(() => { unknown = true })
    return { ok: false, outcome: unknown ? 'unknown' : 'rolled_back', started_at: t0, ended_at: new Date().toISOString(), error: { code: e.code ?? null, message: e.message } }
  }
}

function args(a = process.argv.slice(2)) {
  const get = (n) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined }
  return { cmd: a[0], stage: get('--stage'), deps: get('--deps'), urlEnv: get('--db-url-env') ?? 'VF_DEPLOY_DB_URL',
    confirmSha: get('--confirm-sha'), approvalNonce: get(NONCE_FLAG) }
}

async function main() {
  const o = args()
  if (!['preflight', 'apply', 'verify'].includes(o.cmd) || !STAGES[o.stage]) { console.error('preflight|apply|verify --stage i2|g2'); process.exit(1) }
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
  const client = new pg.Client({ connectionString: url, application_name: 'vf-r5-bind-deploy', ssl: { rejectUnauthorized: true } })
  await client.connect()
  const log = { package: 'r5-bind-deploy', stage: o.stage, command: o.cmd, target: target.target, stage_sha256: st.sha256,
    git_head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', windowsHide: true }).trim(),
    runner_sha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))) }
  try {
    const history = await readHistory(client)
    if (o.cmd === 'preflight') {
      const blocks = evaluate(o.stage, history, { mode: 'apply' })
      Object.assign(log, { history, blocks })
      console.log(JSON.stringify({ blocks, history, log: writeLog(log) }, null, 2))
      process.exit(blocks.length ? 2 : 0)
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
    if (pre.length) { Object.assign(log, { history, blocks: pre }); console.error(pre.join('\n')); console.error(`log ${writeLog(log)}`); process.exit(2) }
    Object.assign(log, { approved_by: approvedBy, history, state: 'applying' })
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
    console.log(redactText(JSON.stringify({ applied: true, verify: v, log: writeLog(log, logPath) }, null, 2), url))
    process.exit(v.ok ? 0 : 4)
  } finally { await client.end().catch(() => {}) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) await main().catch((e) => {
  console.error(redactText(`DEPLOY_ERROR ${e.code ?? ''} ${e.message}`, secretUrl)); process.exitCode = 4
})
