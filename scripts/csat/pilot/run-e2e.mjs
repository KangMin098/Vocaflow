// scripts/csat/pilot/run-e2e.mjs
//
// 오답 원인 Pilot G6 준비 ⑥ — 화면 E2E 러너(PILOT_PROTOCOL §18 · §20-6). 개발 Supabase 전용.
//   1) 실행마다 테스트 계정(ec-e2e-<run>-<역할>@example.com)을 만든다 — 실제 학습자 데이터를 쓰지 않는다.
//   2) pilot 단계: 참가자 역할 id 만 CSAT_EC_PILOT_USER_IDS 로 둔 `next start`(production 빌드)를 띄워 60 · 61 spec 을 돌린다.
//   3) gate 단계: 참가자 env 를 비운 서버로 다시 띄워 62 spec(시작 게이트 자리 — 지금은 「설정이 비면 닫힘」)을 돌린다.
//   4) 계정을 모두 지우고(cascade) 잔여 0 을 확인한다 — 계정 · 기록 세션.
//   5) 커밋 가능한 요약을 scripts/csat/pilot/e2e-last-run.json 에 남긴다(실행 시각 · 앱 커밋 · spec · pass/fail · 잔여). 비밀값 · 이메일 · 계정 id 없음.
// 서버는 성공 · 실패와 무관하게 끈다. 빌드는 미리 해 둔다(apps/web/.next).
//
//   node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/csat/pilot/run-e2e.mjs [--port 3100] [--run ec-pilot-run-<YYYYMMDD>-<n>]
//   --run 을 주면 통과했고 작업 트리가 깨끗할 때만 게이트 형식 기록 docs/csat-learner/pilot-runs/<run id>.e2e.json 을 쓴다(README 형식).

import { execFileSync, spawn } from 'node:child_process'
import crypto, { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const WEB = path.join(ROOT, 'apps/web')
const OUT = path.join(ROOT, 'scripts/csat/pilot/e2e-last-run.json')
const DEV_REF = 'jajenrevcbmrpaliomxv'
const PORT = Number(process.argv[process.argv.indexOf('--port') + 1]) || 3100
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !SERVICE || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) { console.error('환경 변수 없음 — --env-file 로 실행'); process.exit(2) }
if (!URL_.includes(DEV_REF)) { console.error(`개발 프로젝트(${DEV_REF})가 아니다 — 중단`); process.exit(2) }
if (!fs.existsSync(path.join(WEB, '.next/BUILD_ID'))) { console.error('production 빌드가 없다 — apps/web 에서 next build 먼저'); process.exit(2) }

// 시나리오 시험(tests/e2e/utils/ec-pilot.ts EXAMS 와 같게) — 잔여 보류 확인용
const EXAMS = ['2024', '2025', '2026', '2016', '2015', '2017', '2022']
const PARTICIPANTS = ['full', 'variants', 'correction', 'bypass', 'taxonomy']
const OTHERS = ['other', 'nonparticipant', 'gate']
// G6 게이트(gate.ts) 이후: 참가자 env 만으로는 열리지 않는다 — pilot 단계는 검증 모드(CSAT_EC_PILOT_MODE=verification · @example.com)로 연다.
// gate 단계 둘: ① 참가자 env 비움 ② 참가자 env 는 있으나 모드 · 봉인 run 이 없음 — 둘 다 같은 404(fail-closed)여야 한다(62 spec 재사용).
const PHASES = [
  { name: 'pilot', specs: ['tests/e2e/60-csat-ec-pilot-flow.spec.ts', 'tests/e2e/61-csat-ec-pilot-guards.spec.ts'], participants: PARTICIPANTS, mode: 'verification', specPhase: 'pilot' },
  { name: 'gate', specs: ['tests/e2e/62-csat-ec-pilot-start-gate.spec.ts'], participants: [], mode: null, specPhase: 'gate' },
  { name: 'gate-env-only', specs: ['tests/e2e/62-csat-ec-pilot-start-gate.spec.ts'], participants: [...PARTICIPANTS, 'gate'], mode: null, specPhase: 'gate' },
]

const svc = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
const run = randomUUID().slice(0, 8)
const prefix = `ec-e2e-${run}-`
const accounts = {}
const started = Date.now()

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim()

async function makeAccount(role) {
  const email = `${prefix}${role}@example.com`, password = randomUUID()
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { test: 'csat_ec pilot e2e' } })
  if (error) throw new Error(`계정 생성 실패(${role}): ${error.message}`)
  accounts[role] = { email, password, id: data.user.id }
}

function startServer(participantIds, mode) {
  const env = { ...process.env, CSAT_EC_PILOT_USER_IDS: participantIds.join(','), PORT: String(PORT) }
  delete env.CSAT_EC_PILOT_MODE; delete env.CSAT_EC_ACTIVE_RUN   // 실행자 셸에 남은 값이 단계를 오염시키지 않게
  if (mode) env.CSAT_EC_PILOT_MODE = mode
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], { cwd: WEB, env, stdio: ['ignore', 'pipe', 'pipe'] })
  const log = []
  child.stdout.on('data', (d) => log.push(String(d)))
  child.stderr.on('data', (d) => log.push(String(d)))
  return { child, log }
}

async function waitUp() {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/login`); if (r.status < 500) return } catch { /* 아직 안 떴다 */ }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`서버가 ${PORT} 에서 120초 안에 뜨지 않았다`)
}

function stopServer(s) {
  if (!s || s.child.exitCode !== null) return
  if (process.platform === 'win32') { try { execFileSync('taskkill', ['/pid', String(s.child.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { /* 이미 끝남 */ } }
  else s.child.kill('SIGTERM')
}

function runPlaywright(phase, jsonFile) {
  return new Promise((resolve) => {
    const env = { ...process.env, EC_E2E_PHASE: phase.specPhase, EC_E2E_ACCOUNTS: JSON.stringify(accounts), PLAYWRIGHT_BASE_URL: `http://localhost:${PORT}`, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonFile }
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...phase.specs, '--reporter=list,json', '--workers=1', `--output=test-results/ec-pilot-${phase.name}`], { cwd: WEB, env, stdio: ['ignore', 'inherit', 'inherit'] })
    child.on('exit', (code) => resolve(code ?? 1))
  })
}

/** playwright JSON 보고서 → 테스트별 결과(제목 · 상태 · 시간). 비밀값이 끼지 않게 오류 문구는 첫 줄만 · 계정 정보는 지운다 */
function summarize(jsonFile) {
  const rep = JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
  const out = []
  const walk = (suite, file) => {
    for (const s of suite.suites ?? []) walk(s, s.file ?? file)
    for (const spec of suite.specs ?? []) for (const t of spec.tests ?? []) {
      const last = t.results?.at(-1)
      const err = last?.error?.message ? redact(last.error.message.split('\n')[0]).slice(0, 200) : undefined
      out.push({ spec: path.basename(spec.file ?? file ?? ''), title: spec.title, status: last?.status ?? 'skipped', ms: last?.duration ?? 0, ...(err ? { error: err } : {}) })
    }
  }
  for (const s of rep.suites ?? []) walk(s, s.file)
  return out
}

function redact(s) {
  let x = s.replace(/\u001b\[[0-9;]*m/g, '')
  for (const a of Object.values(accounts)) x = x.split(a.email).join('<email>').split(a.password).join('<pw>').split(a.id).join('<id>')
  return x.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
}

const phases = []
let fatal = null
const residual = { accounts: null, sessions: null, keptActive: [], embargoedExams: null }
try {
  for (const r of [...PARTICIPANTS, ...OTHERS]) await makeAccount(r)
  for (const phase of PHASES) {
    const ids = phase.participants.map((r) => accounts[r].id)
    const server = startServer(ids, phase.mode)
    const jsonFile = path.join(WEB, 'test-results', `ec-pilot-e2e-${phase.name}.json`)
    fs.mkdirSync(path.dirname(jsonFile), { recursive: true })
    const t0 = Date.now()
    try {
      await waitUp()
      const code = await runPlaywright(phase, jsonFile)
      const tests = fs.existsSync(jsonFile) ? summarize(jsonFile) : []
      phases.push({ phase: phase.name, participantEnv: phase.participants.length ? 'test-accounts' : 'empty', mode: phase.mode ?? 'none', specs: phase.specs.map((s) => path.basename(s)), exitCode: code, ms: Date.now() - t0, tests })
    } finally {
      stopServer(server)
      // 서버 로그는 원인 가르기용 로컬 파일(test-results 는 커밋하지 않는다)
      fs.writeFileSync(path.join(WEB, 'test-results', `ec-pilot-${phase.name}-server.log`), redact(server.log.join('')))
    }
  }
} catch (e) {
  fatal = redact(e instanceof Error ? e.message : String(e))
  console.error('실행 실패:', fatal)
} finally {
  // 활성 수집(held · collecting)이 남은 계정은 지우지 않는다 — 지우면 묘비가 남아 그 시험이 모든 사용자에게 보류된다(1차 실행 실측).
  // 남긴 계정은 kept 로 보고하고, 관리자 종료(csat_ec_capture_close) 뒤 지운다
  const kept = []
  for (const [role, a] of Object.entries(accounts)) {
    const { data: ss, error: se } = await svc.from('csat_dx_session').select('id').eq('user_id', a.id)
    let active = !!se   // 조회 실패면 활성으로 본다(지우지 않는다)
    for (const s of ss ?? []) {
      const { data: rs, error: re } = await svc.rpc('csat_ec_reveal_state', { p_session: s.id })
      if (re || rs?.exam_embargoed !== false) active = true
    }
    if (active) { kept.push(role); continue }
    const d = await svc.auth.admin.deleteUser(a.id)
    if (d.error && !/not.?found/i.test(d.error.message)) console.error('계정 삭제 실패', redact(d.error.message))
  }
  // 잔여 — 이번 실행 접두의 계정 · 그 계정들의 기록 세션(capture · 증거는 세션 cascade)
  let left = 0
  for (let page = 1; page < 50; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) { left = null; break }
    left += data.users.filter((u) => (u.email ?? '').startsWith(prefix)).length
    if (data.users.length < 1000) break
  }
  residual.accounts = left
  const ids = Object.values(accounts).map((a) => a.id)
  if (ids.length) {
    const { count, error } = await svc.from('csat_dx_session').select('id', { count: 'exact', head: true }).in('user_id', ids)
    residual.sessions = error || count === null ? null : count
  } else residual.sessions = 0
  residual.keptActive = kept
  // 이번 실행이 쓴 시험이 지금 보류인가(활성 capture · 열린 묘비) — 0 이어야 한다
  const { data: emb, error: ee } = await svc.rpc('csat_ec_embargoed_exams', { p_exams: EXAMS })
  residual.embargoedExams = ee ? null : emb
}

const all = phases.flatMap((p) => p.tests)
const summary = {
  ranAt: new Date(started).toISOString(),
  durationMs: Date.now() - started,
  appCommit: git('rev-parse', 'HEAD'),
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  build: 'next build + next start (production)',
  viewport: '1440x900 (PC 데스크톱)',
  phases,
  totals: { pass: all.filter((t) => t.status === 'passed').length, fail: all.filter((t) => t.status !== 'passed' && t.status !== 'skipped').length, skipped: all.filter((t) => t.status === 'skipped').length },
  residual,
  ...(fatal ? { fatal } : {}),
}
fs.writeFileSync(OUT, `${JSON.stringify(summary, null, 2)}\n`)
console.log(`\nE2E pass ${summary.totals.pass} · fail ${summary.totals.fail} · skipped ${summary.totals.skipped} · 잔여 계정 ${residual.accounts} · 잔여 세션 ${residual.sessions} · 보류 시험 ${JSON.stringify(residual.embargoedExams)} · 남긴 계정 ${residual.keptActive.length}`)
process.exitCode = fatal || summary.totals.fail || summary.totals.skipped || phases.length !== PHASES.length || phases.some((p) => p.exitCode !== 0) || summary.totals.pass === 0 || residual.accounts !== 0 || residual.sessions !== 0 || residual.embargoedExams?.length !== 0 ? 1 : 0
