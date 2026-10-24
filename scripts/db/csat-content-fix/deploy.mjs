// scripts/db/csat-content-fix/deploy.mjs
//
// 기출 분석 **콘텐츠 교정 DML**(새 버전 행 적재 등)의 승인형 배포 러너. authored-supply 러너와 같은 승인 계약:
//   · apply 는 Claude Code 승인 창(db-approval 훅이 붙인 1회용 --approval-nonce) 또는 TTY 에서 `APPLY <stage> <sha>` 입력으로만.
//   · 본문 SQL 의 전체 SHA-256 이 이 파일의 STAGES 에 고정한 승인값과 같을 때만 · 한 트랜잭션 · 실패 시 롤백 · 적용 뒤 검증 SQL.
//   · **마이그레이션 이력(schema_migrations)에 행을 남기지 않는다** — 스키마가 아니라 콘텐츠다. 재적용 차단은 본문 SQL 의 가드가 맡고,
//     실행 기록은 logs/ 에 남긴다.
//   · 본문 SQL 은 저장소 밖에 둔다(--sql): 학평 분석 문장에 지문 인용이 들어 있다(EBSi 무단 전재·재배포 금지 — lib-drain-set.mjs 참조).
//
//   node scripts/db/csat-content-fix/deploy.mjs preflight --stage <s> --sql <file> --deps <dir> [--db-url-env KEY]   # 읽기 전용
//   node scripts/db/csat-content-fix/deploy.mjs apply     --stage <s> --sql <file> --deps <dir> [--db-url-env KEY] [--ca <CA 파일>] --confirm-sha <sha>
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
const LOG_DIR = 'supabase/deploy/csat-content-fix/logs'
const RUNNER = 'csat-content-fix'

/** 단계 = 승인된 SQL 하나. sha256 은 사용자가 대화에서 승인한 값 그대로. verify 는 (ok boolean, detail) 한 행. */
export const STAGES = {
  'hk-meta-r2': {
    sha256: '03a9c004fdfe4548c5e010e1daefdd006cf9fb4854a2f23abcecf9563fa0f11c',
    verify: `select count(*) = 14, count(*)::text from public.csat_item_analyses where analyst_run = 'vf-20261025-fix-round2' and status = 'in_review'`,
  },
  'hk-content-r3': {
    sha256: '9583f2a551102eee5520354bec8d9e0610bcede15fdd4aca209244a0cc2c49ce',
    verify: `select count(*) = 29, count(*)::text from public.csat_item_analyses where analyst_run = 'vf-20261025-fix-round3' and status = 'in_review'`,
  },
}

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex')

/** --sql 파일이 승인 SHA 와 같은가 */
export function offlineCheck(stage, sqlPath) {
  const st = STAGES[stage]
  if (!sqlPath || !fs.existsSync(sqlPath)) return { blocks: [`DEPLOY_BLOCKED[sha] --sql 파일이 없다: ${sqlPath}`], text: null }
  const buf = fs.readFileSync(sqlPath)
  if (sha256(buf) !== st.sha256) return { blocks: [`DEPLOY_BLOCKED[sha] ${path.basename(sqlPath)} sha256 이 승인값과 다르다`], text: null }
  return { blocks: [], text: buf.toString('utf8') }
}

/** apply 권한 차단 — 자동화/CI 거절 · SHA 일치 · 비TTY 는 난수 필수. 티켓 소비 · 프롬프트 전에 부른다. */
export function applyAuthorizationBlocks(o, { tty, env = process.env }) {
  const b = writeAuthorizationBlocks({}, { env, stdinIsTTY: tty, stdoutIsTTY: tty, ticket: !tty && Boolean(o.approvalNonce) })
  if (o.confirmSha !== STAGES[o.stage]?.sha256) b.push('DEPLOY_BLOCKED[sha] --confirm-sha 가 승인 SHA 와 다르다')
  return b
}

function canonicalBlock() {
  const self = fs.realpathSync(fileURLToPath(import.meta.url))
  let invoked = null
  try { invoked = process.argv[1] ? fs.realpathSync(process.argv[1]) : null } catch { /* 없는 경로 */ }
  const want = path.join(fs.realpathSync(ROOT), 'scripts', 'db', 'csat-content-fix', 'deploy.mjs')
  const same = (a, b) => (process.platform === 'win32' ? a?.toLowerCase() === b?.toLowerCase() : a === b)
  return same(invoked, self) && same(self, want) ? null : 'DEPLOY_BLOCKED[permission] approval-nonce mode requires running the canonical scripts/db/csat-content-fix/deploy.mjs directly'
}

let secretUrl
function writeLog(obj, existing) {
  const dir = path.join(ROOT, LOG_DIR)
  fs.mkdirSync(dir, { recursive: true })
  const f = existing ? path.join(ROOT, existing) : path.join(dir, `${obj.stage}-${obj.command}-${obj.target}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(f, redactText(JSON.stringify(obj, null, 2), secretUrl) + '\n')
  return path.relative(ROOT, f).replaceAll('\\', '/')
}

async function runVerify(client, stage) {
  const r = await client.query({ text: STAGES[stage].verify, rowMode: 'array' })
  const [ok, detail] = r.rows[0]
  return { ok: ok === true, detail }
}

async function applyStage(client, text) {
  const t0 = new Date().toISOString()
  let committing = false
  await client.query('begin')
  try {
    await client.query("set local lock_timeout = '15s'; set local statement_timeout = '120s'")
    await client.query(text)
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
  return { cmd: a[0], stage: get('--stage'), sql: get('--sql'), deps: get('--deps'), urlEnv: get('--db-url-env') ?? 'VF_DEPLOY_DB_URL',
    ca: get('--ca'), confirmSha: get('--confirm-sha'), approvalNonce: get(NONCE_FLAG) }
}

async function main() {
  const o = args()
  if (!['preflight', 'apply'].includes(o.cmd) || !STAGES[o.stage]) { console.error(`preflight|apply --stage ${Object.keys(STAGES).join('|')} --sql <file>`); process.exit(1) }
  const st = STAGES[o.stage]
  const off = offlineCheck(o.stage, o.sql)
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
  // --ca: Supabase 는 자체 루트(Supabase Root 2021 CA)로 서명한다 — 검증은 끄지 않고 신뢰할 루트만 준다(apply-approved-sql.mjs 와 같은 방식).
  //   URL 의 sslmode 는 떼어 낸다 — pg 가 sslmode 를 읽으면 아래 ssl 설정을 덮는다.
  const ssl = o.ca ? { ca: fs.readFileSync(o.ca, 'utf8'), rejectUnauthorized: true } : { rejectUnauthorized: true }
  const client = new pg.Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ''), application_name: 'vf-csat-content-fix-deploy', ssl })
  await client.connect()
  const log = { package: 'csat-content-fix-deploy', stage: o.stage, command: o.cmd, target: target.target, stage_sha256: st.sha256,
    git_head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', windowsHide: true }).trim(),
    runner_sha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))) }
  try {
    if (o.cmd === 'preflight') {
      const v = await runVerify(client, o.stage)
      Object.assign(log, { verify_before: v })
      console.log(JSON.stringify({ blocks: [], verify_before: v, log: writeLog(log) }, null, 2))
      process.exit(0)
    }
    Object.assign(log, { approved_by: approvedBy, state: 'applying' })
    const logPath = writeLog(log)
    const r = await applyStage(client, off.text)
    Object.assign(log, { apply: r, state: r.outcome })
    writeLog(log, logPath)
    if (!r.ok) {
      console.error(redactText(`${r.outcome === 'unknown' ? 'INCIDENT: COMMIT outcome unknown; do not retry' : '적용 실패 — 롤백됨'}: ${r.error.message}`, url))
      console.error(`log ${logPath}`); process.exit(r.outcome === 'unknown' ? 4 : 3)
    }
    let v
    try { v = await runVerify(client, o.stage) } catch (e) { v = { ok: false, error: { code: e.code ?? null, message: e.message } } }
    Object.assign(log, { verify: v, state: v.ok ? 'verified' : 'committed_verify_failed' })
    console.log(redactText(JSON.stringify({ applied: true, verify: v, log: writeLog(log, logPath) }, null, 2), url))
    process.exit(v.ok ? 0 : 4)
  } finally { await client.end().catch(() => {}) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) await main().catch((e) => {
  console.error(redactText(`DEPLOY_ERROR ${e.code ?? ''} ${e.message}`, secretUrl)); process.exitCode = 4
})
