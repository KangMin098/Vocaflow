// scripts/db/factory-i1/deploy.mjs
//
// Factory I1 배포 러너 — DB-1(C→B→S) · DB-2(P) 를 **한 단계씩** 버전 관리 migration 으로 적용 · 검증한다.
// supabase db push · MCP apply_migration 을 쓰지 않는 이유: 저장소의 버전 파일 수백 개가 개발 DB 이력 이름과 달라
// db push 는 승인 밖 migration 을 함께 밀고, apply_migration 은 자기 시각으로 버전을 새로 매겨 safe-merge 이력 해시 대조가 깨진다.
//
//   node scripts/db/factory-i1/deploy.mjs check                                     # 생성물 · 정본 SHA · 세그먼트(오프라인)
//   node scripts/db/factory-i1/deploy.mjs dry-run --stage db1 --remote-history <파일> # 무엇이 적용되는가(오프라인)
//   node scripts/db/factory-i1/deploy.mjs preflight --stage db1 --deps <dir>          # 읽기 전용 checkpoint + 차단 판정
//   node scripts/db/factory-i1/deploy.mjs apply --stage db1 --deps <dir> --confirm-sha <sha> --approved-by "<승인 기록>"
//   node scripts/db/factory-i1/deploy.mjs apply --stage db2 … --db1-verify-log <DB-1 verify 로그>
//   node scripts/db/factory-i1/deploy.mjs verify --stage db1 --deps <dir>             # 읽기 전용 적용 직후 검증
// 연결: 환경 변수 VF_DEPLOY_DB_URL(이름은 --db-url-env 로 바꿀 수 있다). 값은 출력 · 로그에 남기지 않는다.
// 종료 코드: 0 통과 · 2 DEPLOY_BLOCKED(아무것도 쓰지 않음) · 3 적용 실패(롤백됨) · 4 커밋 뒤 검증 실패(복구 절차로)
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createInterface } from 'node:readline/promises'
import { execFileSync } from 'node:child_process'
import { buildAll, auxFiles, verifySegments, sha256, ROOT, MANIFEST_PATH } from './build.mjs'
import { PREFLIGHT_SQL, verifySql } from './sql.mjs'
import { STAGES, PROJECT_REF, PRIOR_MAX_VERSION, HELPERS, DB1_TARGET_TABLES, DB1_TARGET_FUNCTIONS } from './spec.mjs'

const VERSION_RE = /^(\d{14})_.+\.sql$/
export const LOG_DIR = 'supabase/deploy/factory-i1/logs'
let activeSecretUrl

export function redactText(text, url = activeSecretUrl) {
  let out = String(text).replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, '[REDACTED_CONNECTION]')
  if (url) {
    let password
    try { password = new URL(url).password } catch { /* invalid URL still redacted above */ }
    for (const secret of [url, password, password && decodeURIComponent(password)].filter(Boolean)) out = out.replaceAll(secret, '[REDACTED]')
  }
  return out
}

/** Metadata cannot grant approval. Production writes also require the policy hook and an interactive executor. */
export function writeAuthorizationBlocks(o, { env = process.env, stdinIsTTY = process.stdin.isTTY, stdoutIsTTY = process.stdout.isTTY } = {}) {
  const blocks = []
  if (env.VFC_AUTOMATED_RUN === '1' || env.AGENT_GUARD_ASK === '0' || (env.CI && env.CI !== 'false')) blocks.push('DEPLOY_BLOCKED[permission] automated environment cannot apply migrations')
  if (o.isolated) blocks.push('DEPLOY_BLOCKED[target] --isolated cannot be used with CLI apply; disposable tests use the isolated harness')
  if (!stdinIsTTY || !stdoutIsTTY) blocks.push('DEPLOY_BLOCKED[permission] interactive authorized executor required; --approved-by is audit metadata, not user approval')
  return blocks
}

/** 저장소 파일이 생성기 결과와 같은가 · 정본 SHA 가 맞는가 */
export function offlineCheck() {
  const blocks = []
  let built
  try { built = buildAll() } catch (e) { return { blocks: [e.message], manifest: null } }
  const files = [[STAGES.db1.path, built.db1.text], [STAGES.db2.path, built.db2.text], [MANIFEST_PATH, built.manifest], ...auxFiles(built.db1.sha256, built.db2.sha256)]
  for (const [p, t] of files) {
    const abs = path.join(ROOT, p)
    if (!fs.existsSync(abs) || fs.readFileSync(abs, 'utf8') !== t) blocks.push(`DEPLOY_BLOCKED[sha] ${p} 이 생성물과 다르다 — 승인된 바이트가 아니다`)
  }
  for (const [st, t] of [['db1', built.db1.text], ['db2', built.db2.text]]) {
    for (const s of verifySegments(t)) if (!s.ok) blocks.push(`DEPLOY_BLOCKED[sha] ${st} 세그먼트 ${s.id} 바이트 불일치`)
  }
  return { blocks, manifest: JSON.parse(built.manifest) }
}

/** 로컬 supabase/migrations 의 버전 파일 */
export function localVersions(dir = path.join(ROOT, 'supabase/migrations')) {
  return fs.readdirSync(dir).map((f) => f.match(VERSION_RE) ? { version: f.match(VERSION_RE)[1], file: f } : null).filter(Boolean)
}

/** 오프라인 dry-run — 원격 이력과 로컬 파일을 대조해 「무엇이 적용 대상인가」를 낸다 */
export function dryRun(stage, remoteVersions, local = localVersions()) {
  const st = STAGES[stage]
  const remote = new Set(remoteVersions)
  const remoteMax = [...remote].sort().at(-1)
  const notInRemote = local.filter((l) => !remote.has(l.version))
  const newer = local.filter((l) => l.version > remoteMax)
  const blocks = []
  const expectNewer = stage === 'db1' ? [path.basename(st.path)] : []
  const unexpected = newer.filter((l) => !expectNewer.includes(l.file))
  if (unexpected.length) blocks.push(`DEPLOY_BLOCKED[unexpected-migration] 원격 최댓값 ${remoteMax} 뒤의 로컬 migration: ${unexpected.map((l) => l.file).join(', ')}`)
  if (stage === 'db1' && !newer.some((l) => l.file === path.basename(st.path))) blocks.push(`DEPLOY_BLOCKED[history] DB-1 파일 버전 ${st.version} 이 원격 최댓값 ${remoteMax} 보다 크지 않다`)
  if (local.some((l) => l.version === STAGES.db2.version)) blocks.push(`DEPLOY_BLOCKED[db2-coupled] DB-2(${STAGES.db2.version}) 가 supabase/migrations 에 있다 — DB-1 과 함께 밀릴 수 있다`)
  if (remote.has(st.version)) blocks.push(`DEPLOY_BLOCKED[history] ${st.version} 이 이미 원격 이력에 있다`)
  if (stage === 'db2' && !remote.has(STAGES.db1.version)) blocks.push(`DEPLOY_BLOCKED[db1-first] 원격 이력에 DB-1(${STAGES.db1.version}) 이 없다`)
  const dup = local.map((l) => l.version).filter((v, i, a) => a.indexOf(v) !== i)
  return {
    stage, remote_count: remote.size, remote_max: remoteMax,
    runner_applies: [st.path],
    db_push_would_include: { count: notInRemote.length, newer_than_remote_max: newer.map((l) => l.file),
      legacy_name_mismatch: notInRemote.length - newer.length },
    duplicate_local_versions: [...new Set(dup)].length,
    db_push_verdict: notInRemote.length > (stage === 'db1' ? 1 : 0) ? 'BLOCKED — supabase db push 는 승인 밖 migration 을 함께 민다. 이 러너로만 적용한다' : 'single',
    blocks,
  }
}

/** 원격 checkpoint(PREFLIGHT_SQL 결과)로 차단 조건 판정 */
export function evaluatePreflight(stage, pre, { acceptRemoteAfter = [] } = {}) {
  const st = STAGES[stage]
  const b = []
  const h = pre.history
  if (!h.table || !(Number(h.count) > 0)) b.push('DEPLOY_BLOCKED[history] supabase_migrations.schema_migrations 가 없거나 비었다 — 대상이 개발 DB 가 아니다')
  const cols = pre.history_columns ?? []
  const needCols = ['created_by', 'idempotency_key', 'name', 'statements', 'version']
  if (!needCols.every((c) => cols.includes(c))) b.push(`DEPLOY_BLOCKED[history] 이력 표 열이 다르다: ${cols.join(',')}`)
  if (stage === 'db1' && Number(pre.g2_pairs_unresolved) > 0) b.push(`DEPLOY_BLOCKED[verify-precondition] csat_items 로 해석되지 않는 G2 쌍 ${pre.g2_pairs_unresolved} — 적용 뒤 g2_exposure_none_zero 가 실패한다`)
  if (h.max_version >= st.version) b.push(`DEPLOY_BLOCKED[history] 원격 이력 최댓값 ${h.max_version} ≥ ${st.version}`)
  const after = (h.versions_after_20261014091841 ?? []).filter((v) => !(stage === 'db2' && v === STAGES.db1.version))
  const unknown = after.filter((v) => !acceptRemoteAfter.includes(v))
  if (unknown.length) b.push(`DEPLOY_BLOCKED[history] checkpoint(${PRIOR_MAX_VERSION}) 뒤 새 원격 migration ${unknown.join(',')} — 카탈로그를 다시 보고 --accept-remote-after 로 명시`)
  if (stage === 'db1') {
    if (h.db1) b.push(`DEPLOY_BLOCKED[history] DB-1(${STAGES.db1.version}) 이 이미 이력에 있다`)
    if (h.db2) b.push(`DEPLOY_BLOCKED[history] DB-2(${STAGES.db2.version}) 가 이력에 있다`)
    if (pre.targets_present.length) b.push(`DEPLOY_BLOCKED[target] 이미 있는 대상 표: ${pre.targets_present.join(',')}`)
    if (pre.target_functions_present.length) b.push(`DEPLOY_BLOCKED[target] 이미 있는 대상 함수: ${pre.target_functions_present.join(',')}`)
    if (pre.composite_keys_present.length) b.push(`DEPLOY_BLOCKED[target] 이미 있는 복합 고유키: ${pre.composite_keys_present.join(',')}`)
    for (const [f, v] of Object.entries(HELPERS)) {
      // 실측값 또는 DB-1 이 남길 값(되돌리기 뒤 재적용) — migration 프롤로그와 같은 기준
      const got = pre.helpers?.[f]?.proconfig
      if (got !== v.before && got !== v.after) b.push(`DEPLOY_BLOCKED[drift] ${f}.proconfig=${got} ≠ checkpoint ${v.before}`)
    }
  } else {
    if (!h.db1) b.push(`DEPLOY_BLOCKED[db1-first] DB-1(${STAGES.db1.version}) 이 이력에 없다`)
    if (h.db2) b.push(`DEPLOY_BLOCKED[history] DB-2 가 이미 이력에 있다`)
    const want = new Set(DB1_TARGET_TABLES)
    if (pre.targets_present.length !== want.size || !pre.targets_present.every((t) => want.has(t))) b.push(`DEPLOY_BLOCKED[target] 표 상태가 DB-1 직후와 다르다: ${pre.targets_present.join(',')}`)
    const wantFn = new Set(DB1_TARGET_FUNCTIONS)
    if (pre.target_functions_present.length !== wantFn.size || !pre.target_functions_present.every((f) => wantFn.has(f))) b.push(`DEPLOY_BLOCKED[target] 함수 상태가 DB-1 직후와 다르다: ${pre.target_functions_present.join(',')}`)
    if (pre.partial_state) b.push('DEPLOY_BLOCKED[target] factory_order.state 에 partial 이 이미 있다')
    for (const [f, v] of Object.entries(HELPERS)) {
      if (pre.helpers?.[f]?.proconfig !== v.after) b.push(`DEPLOY_BLOCKED[drift] ${f}.proconfig=${pre.helpers?.[f]?.proconfig} ≠ DB-1 뒤 ${v.after}`)
    }
  }
  if (pre.prereq_missing.length || pre.prereq_fn_missing.length) b.push(`DEPLOY_BLOCKED[prereq] 전제 없음: ${[...pre.prereq_missing, ...pre.prereq_fn_missing].join(',')}`)
  const w = pre.writer_privileges
  if (!w.create_on_public || !w.insert_history || !w.owns_helpers || !w.owns_dependency_tables) b.push(`DEPLOY_BLOCKED[permission] 실행 역할 ${pre.current_user} 의 쓰기 권한 부족: ${JSON.stringify(w)}`)
  if (Number(pre.blocking_locks_on_dependencies) > 0) b.push(`DEPLOY_BLOCKED[lock] 의존 표에 배타 잠금 ${pre.blocking_locks_on_dependencies}건`)
  return b
}

/** 연결 문자열의 프로젝트 ref 확인(값 자체는 출력하지 않는다) */
export function targetOf(url, { isolated = false } = {}) {
  let u
  try { u = new URL(url) } catch { return { ok: false, why: 'DEPLOY_BLOCKED[target] 연결 문자열을 해석할 수 없다' } }
  // pg-connection-string lets query parameters override hostname, port and TLS after URL parsing.
  if (!['postgres:', 'postgresql:'].includes(u.protocol) || u.search || u.hash || u.pathname !== '/postgres' && !isolated) return { ok: false, why: 'DEPLOY_BLOCKED[target] PostgreSQL URL only; query/fragment overrides and non-postgres database are forbidden' }
  if (isolated) return ['localhost', '127.0.0.1'].includes(u.hostname) ? { ok: true, target: 'isolated', host: u.hostname } : { ok: false, why: 'DEPLOY_BLOCKED[target] --isolated 는 localhost 만' }
  const direct = u.hostname === `db.${PROJECT_REF}.supabase.co`
  const pooler = u.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(u.username) === `postgres.${PROJECT_REF}`
  if (!direct && !pooler) return { ok: false, why: `DEPLOY_BLOCKED[target] 연결 대상이 ${PROJECT_REF} 가 아니다` }
  if (pooler && u.port === '6543') return { ok: false, why: 'DEPLOY_BLOCKED[atomicity] transaction pooler(6543)는 쓰지 않는다 — 직결(5432) 또는 session pooler' }
  if (u.port !== '5432') return { ok: false, why: 'DEPLOY_BLOCKED[target] production connection requires explicit port 5432 (no PGPORT fallback)' }
  return { ok: true, target: PROJECT_REF, host: u.hostname }
}

export async function readPreflight(client) {
  await client.query('begin transaction read only')
  try { return (await client.query(PREFLIGHT_SQL)).rows[0].preflight } finally { await client.query('rollback') }
}

export async function runVerify(client, stage, sha) {
  await client.query('begin transaction read only')
  const rows = []
  try {
    for (const q of verifySql(stage)) {
      try {
        const r = await client.query({ text: q, values: q.includes('$1') ? [sha] : [], rowMode: 'array' })
        const [chk, ok, detail] = r.rows[0]
        rows.push({ check: chk, ok: ok === true, detail })
      } catch (e) {
        rows.push({ check: q.match(/'([a-z0-9_]+)'/)?.[1] ?? '?', ok: false, detail: `error ${e.code ?? ''} ${e.message}` })
        await client.query('rollback'); await client.query('begin transaction read only')
      }
    }
  } finally { await client.query('rollback') }
  return { ok: rows.every((r) => r.ok), rows }
}

/**
 * 한 단계 적용. 한 연결 · 한 트랜잭션: migration 본문(단순 질의 1회) + 이력 1행 → COMMIT.
 * opts.injectFailure: 격리 시험 전용 — 'before-commit' 이면 이력까지 쓴 뒤 일부러 실패시켜 롤백을 시험한다.
 */
export async function applyStage(client, stage, { text, sha, approvedBy, injectFailure, acceptRemoteAfter = [] } = {}) {
  const st = STAGES[stage]
  if (sha256(Buffer.from(text)) !== sha) throw new Error('DEPLOY_BLOCKED[sha] 적용할 본문 sha256 이 확인값과 다르다')
  const notices = []
  const onNotice = (n) => notices.push(n.message)
  client.on('notice', onNotice)
  const t0 = new Date().toISOString()
  let committing = false
  try {
    await client.query('begin')
    try {
      await client.query("set local lock_timeout = '15s'; set local statement_timeout = '120s'")
      await client.query('lock table supabase_migrations.schema_migrations in share row exclusive mode')
      const pre = (await client.query(PREFLIGHT_SQL)).rows[0].preflight
      const blocks = evaluatePreflight(stage, pre, { acceptRemoteAfter })
      if (stage === 'db2' && pre.history.db1?.sha256 !== buildAll().db1.sha256) blocks.push('DEPLOY_BLOCKED[db1-first] locked DB-1 history SHA does not match')
      if (blocks.length) throw new Error(blocks.join('\n'))
      if (stage === 'db2') {
        // A local JSON with verify.ok=true is not evidence by itself. Re-run DB-1 checks on this connection.
        // Empty ledgers are an initial deployment check, not an invariant after legitimate DB-1 use.
        for (const q of verifySql('db1').filter((sql) => !sql.includes("'tables_empty'"))) {
          const r = await client.query({ text: q, values: q.includes('$1') ? [buildAll().db1.sha256] : [], rowMode: 'array' })
          if (r.rows[0]?.[1] !== true) throw new Error(`DEPLOY_BLOCKED[db1-first] live DB-1 verification failed: ${r.rows[0]?.[0]}`)
        }
      }
      await client.query(text)
      await client.query(`insert into supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key)
        values ($1, $2, $3, $4, $5)`, [st.version, st.name, [text], `factory-i1-deploy:${approvedBy}`, sha])
      if (injectFailure === 'before-commit') throw new Error('VF_INJECTED_FAILURE before-commit')
      committing = true
      const committed = await client.query('commit')
      if (committed.command !== 'COMMIT') throw Object.assign(new Error('server did not confirm COMMIT'), { code: '40003' })
    } catch (e) {
      // A network error after COMMIT may mean it committed. ROLLBACK cannot undo that fact.
      const serverRejection = /^[0-9A-Z]{5}$/.test(e.code ?? '') && !String(e.code).startsWith('08') && e.code !== '40003'
      let unknown = committing && !serverRejection
      await client.query('rollback').catch(() => { unknown = true })
      return { ok: false, outcome: unknown ? 'unknown' : 'rolled_back', started_at: t0, ended_at: new Date().toISOString(), error: { code: e.code ?? null, message: e.message }, notices }
    }
    return { ok: true, outcome: 'committed', started_at: t0, ended_at: new Date().toISOString(), notices }
  } finally { client.off('notice', onNotice) }
}

function args() {
  const a = process.argv.slice(2)
  const get = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined }
  return { cmd: a[0], stage: get('--stage'), deps: get('--deps'), urlEnv: get('--db-url-env') ?? 'VF_DEPLOY_DB_URL', confirmSha: get('--confirm-sha'),
    approvedBy: get('--approved-by'), db1Log: get('--db1-verify-log'), remoteHistory: get('--remote-history'), out: get('--out'),
    acceptRemoteAfter: (get('--accept-remote-after') ?? '').split(',').filter(Boolean), isolated: a.includes('--isolated') }
}

function writeLog(obj, existing) {
  const dir = path.join(ROOT, LOG_DIR)
  fs.mkdirSync(dir, { recursive: true })
  const f = existing ? path.join(ROOT, existing) : path.join(dir, `${obj.stage}-${obj.command}-${obj.target}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(f, redactText(JSON.stringify(obj, null, 2)) + '\n')
  return path.relative(ROOT, f).replaceAll('\\', '/')
}

async function connect(o) {
  if (!o.deps) throw new Error('--deps <pg 를 설치한 폴더> 가 필요하다(npm i pg@8.13.1)')
  const url = process.env[o.urlEnv]
  activeSecretUrl = url
  if (!url) throw new Error(`환경 변수 ${o.urlEnv} 가 없다`)
  const t = targetOf(url, { isolated: o.isolated })
  if (!t.ok) return { blocked: t.why }
  const pg = createRequire(path.join(o.deps, 'package.json'))('pg')
  const client = new pg.Client({ connectionString: url, application_name: 'vf-factory-i1-deploy', ssl: o.isolated ? false : { rejectUnauthorized: true } })
  await client.connect()
  return { client, target: t }
}

async function main() {
  const o = args()
  if (o.cmd !== 'check' && !STAGES[o.stage]) { console.error('--stage db1|db2'); process.exit(1) }
  const off = offlineCheck()
  if (o.cmd === 'check') {
    console.log(off.blocks.length ? off.blocks.join('\n') : `OK db1=${off.manifest.stages.db1.sha256} db2=${off.manifest.stages.db2.sha256}`)
    process.exit(off.blocks.length ? 2 : 0)
  }
  const st = STAGES[o.stage]
  const stageSha = off.manifest?.stages[o.stage].sha256
  if (o.cmd === 'dry-run') {
    if (!o.remoteHistory) { console.error('--remote-history <원격 이력 버전 목록 파일>'); process.exit(1) }
    const remote = fs.readFileSync(o.remoteHistory, 'utf8').split(/\s+/).filter((v) => /^\d{14}$/.test(v))
    const r = { ...dryRun(o.stage, remote), offline_blocks: off.blocks, stage_sha256: stageSha }
    const out = JSON.stringify(r, null, 2) + '\n'
    if (o.out) fs.writeFileSync(o.out, out)
    console.log(out)
    process.exit(r.blocks.length || off.blocks.length ? 2 : 0)
  }
  if (off.blocks.length) { console.error(off.blocks.join('\n')); process.exit(2) }
  if (o.cmd === 'apply') {
    const authorization = writeAuthorizationBlocks(o)
    if (!o.approvedBy) authorization.push('DEPLOY_BLOCKED[permission] --approved-by audit metadata required')
    if (o.confirmSha !== stageSha) authorization.push('DEPLOY_BLOCKED[sha] --confirm-sha does not match package')
    if (authorization.length) { console.error(authorization.join('\n')); process.exit(2) }
    const terminal = createInterface({ input: process.stdin, output: process.stdout })
    try {
      const expected = `APPLY ${o.stage} ${stageSha}`
      const answer = await terminal.question(`Policy-authorized DB executor only. --approved-by is not approval. Confirm reviewed full SHA by typing ${expected}: `)
      if (answer !== expected) { console.error('DEPLOY_BLOCKED[permission] confirmation mismatch'); process.exit(2) }
    } finally { terminal.close() }
  }
  const c = await connect(o)
  if (c.blocked) { console.error(c.blocked); process.exit(2) }
  const { client, target } = c
  const log = { package: 'factory-i1-deploy', stage: o.stage, command: o.cmd, target: target.target, stage_sha256: stageSha,
    git_head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', windowsHide: true }).trim(),
    manifest_sha256: sha256(fs.readFileSync(path.join(ROOT, MANIFEST_PATH))),
    runner_sha256: sha256(fs.readFileSync(path.join(ROOT, 'scripts/db/factory-i1/deploy.mjs'))) }
  try {
    const pre = await readPreflight(client)
    const blocks = evaluatePreflight(o.stage, pre, { acceptRemoteAfter: o.acceptRemoteAfter })
    if (o.cmd === 'preflight') {
      // 적용 전에는 이 단계가 「아직 없음」이어야 한다 — verify 는 반대로 「있음」이어야 하므로 판정을 나눈다
      Object.assign(log, { preflight: pre, blocks })
      console.log(JSON.stringify({ blocks, log: writeLog(log) }, null, 2))
      process.exit(blocks.length ? 2 : 0)
    }
    if (o.cmd === 'verify') {
      const v = await runVerify(client, o.stage, stageSha)
      Object.assign(log, { verify: v, preflight: pre })
      console.log(JSON.stringify({ ok: v.ok, rows: v.rows, log: writeLog(log) }, null, 2))
      process.exit(v.ok ? 0 : 4)
    }
    if (o.cmd !== 'apply') { console.error(`알 수 없는 명령 ${o.cmd}`); process.exit(1) }
    if (!o.approvedBy) blocks.push('DEPLOY_BLOCKED[permission] --approved-by(사용자 승인 기록)가 없다')
    if (o.confirmSha !== stageSha) blocks.push(`DEPLOY_BLOCKED[sha] --confirm-sha 가 패키지 ${o.stage} sha256 과 다르다`)
    if (o.stage === 'db2') {
      const l = o.db1Log && fs.existsSync(o.db1Log) ? JSON.parse(fs.readFileSync(o.db1Log, 'utf8')) : null
      const ok = l && l.stage === 'db1' && l.command === 'verify' && l.target === target.target && l.verify?.ok === true && l.stage_sha256 === off.manifest.stages.db1.sha256
      if (!ok) blocks.push('DEPLOY_BLOCKED[db1-first] DB-1 실DB 검증 로그(--db1-verify-log, 같은 대상 · verify ok · DB-1 sha 일치)가 없다')
      if (pre.history.db1?.sha256 !== off.manifest.stages.db1.sha256) blocks.push('DEPLOY_BLOCKED[db1-first] 원격 DB-1 이력 본문 sha256 이 패키지와 다르다')
    }
    if (blocks.length) {
      Object.assign(log, { preflight: pre, blocks })
      console.error(blocks.join('\n')); console.error(`log ${writeLog(log)}`)
      process.exit(2)
    }
    const text = fs.readFileSync(path.join(ROOT, st.path), 'utf8')
    Object.assign(log, { approved_by: o.approvedBy, preflight: pre, state: 'applying' })
    const logPath = writeLog(log) // Durable intent before any DDL; crash recovery starts from this file.
    const r = await applyStage(client, o.stage, { text, sha: stageSha, approvedBy: o.approvedBy, acceptRemoteAfter: o.acceptRemoteAfter })
    Object.assign(log, { approved_by: o.approvedBy, preflight: pre, apply: r })
    log.state = r.outcome
    writeLog(log, logPath)
    if (!r.ok) {
      console.error(redactText(`${r.outcome === 'unknown' ? 'INCIDENT: COMMIT outcome unknown; do not retry or restore before read-only history/catalog reconciliation' : '적용 실패 — 롤백됨'}: ${r.error.message}`))
      console.error(`log ${logPath}`); process.exit(r.outcome === 'unknown' ? 4 : 3)
    }
    let v
    try { v = await runVerify(client, o.stage, stageSha) }
    catch (e) { v = { ok: false, rows: [], error: { code: e.code ?? null, message: e.message } } }
    log.verify = v
    log.state = v.ok ? 'verified' : 'committed_verify_failed'
    console.log(redactText(JSON.stringify({ applied: true, verify: v, log: writeLog(log, logPath) }, null, 2)))
    process.exit(v.ok ? 0 : 4)
  } finally { await client.end().catch(() => {}) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) await main().catch((e) => {
  console.error(redactText(`DEPLOY_ERROR ${e.code ?? ''} ${e.message}`)); process.exitCode = 4
})
