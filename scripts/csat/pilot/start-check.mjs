// scripts/csat/pilot/start-check.mjs
//
// G6 시작 점검(읽기 전용) — 봉인된 run 메타를 live DB · 저장소 · env 와 다시 대조해 **어떤 항목이 실패했는지** 보여 준다.
// 앱 게이트(apps/web/src/lib/csat/ec-pilot/gate.ts)와 같은 규칙(run-gate.ts evaluateRunGate) + 앱이 못 보는 항목:
//   · 감지기 판 = live 함수 본문(csat_ec_detect_boundaries 의 c_version)
//   · DB 마이그레이션 상태(schema_migrations 최신 · 개수)
//   · PII 가드 기록 파일 sha256 · 규칙 해시 = 지금 deidentify.mjs 규칙
//   · E2E 통과 기록 파일 sha256 · 필드 = 메타
//   · 앱 활성 메타(active-run.ts)와 docs 정본 일치
// 매일 감시(PILOT_PROTOCOL §12)에서도 그대로 돌린다 — 실패하면 무결성 중단 기준.
//
//   node --tls-max-v1.2 --env-file=<배포 env 를 담은 파일> scripts/csat/pilot/start-check.mjs --run <run id> --build-commit <플랫폼에 표시된 배포 커밋> [--e2e-report-sha256 <리포트 sha256>]
//   배포 env 의 CSAT_EC_APP_COMMIT(검증 커밋) · CSAT_EC_ACTIVATION_COMMIT · CSAT_EC_PILOT_MODE · CSAT_EC_PILOT_USER_IDS(개수만 — 출력하지 않는다)를 읽는다.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { canonicalJson, evaluateRunGate } from '../../../apps/web/src/lib/csat/ec-pilot/run-gate.ts'
import { RUNS, ROOT, activationDiffFailures, readLive, readRecord, recordFailures } from './live.mjs'

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => (x.startsWith('--') ? [...acc, [x.slice(2), arr[i + 1]]] : acc), []))
if (!/^ec-pilot-run-[0-9]{8}-[0-9]+$/.test(a.run ?? '')) { console.error('--run <ec-pilot-run-YYYYMMDD-n> 필요'); process.exit(2) }
// 커밋 셋은 섞지 않는다: 검증 커밋 · 활성화 커밋은 배포 env 값 그대로, 실제 배포 빌드 커밋은 플랫폼에서 확인한 값(--build-commit)
const envOf = (k) => (process.env[k] ?? '').trim().toLowerCase() || null
const appCommit = envOf('CSAT_EC_APP_COMMIT')
const activationCommit = envOf('CSAT_EC_ACTIVATION_COMMIT')
const buildCommit = (a['build-commit'] ?? '').trim().toLowerCase() || null
const git = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

/** active-run.ts 의 ACTIVE_RUN 이 메타와 같은지(소스를 import 해 비교) */
async function activeRunState(meta) {
  const mod = await import('../../../apps/web/src/lib/csat/ec-pilot/active-run.ts')
  if (mod.ACTIVE_RUN === null) return 'null'
  return canonicalJson(mod.ACTIVE_RUN) === canonicalJson(meta) ? 'match' : 'differs'
}

const metaPath = path.join(RUNS, `${a.run}.json`)
const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : null
if (!meta) { console.log(`G6 시작 점검 — ${a.run}
FAIL  run 메타 없음 — ${path.relative(ROOT, metaPath)}
닫힘`); process.exit(1) }
const examIds = Array.isArray(meta?.exams) ? meta.exams.map((e) => e?.examId).filter((x) => typeof x === 'string') : []
const live = { ...(await readLive(examIds, { appCommit })), buildCommit, activationCommit }
const gate = evaluateRunGate(meta, live)
const activeRun = await activeRunState(meta)
const mode = process.env.CSAT_EC_PILOT_MODE ?? ''
const extra = [
  ...recordFailures(a.run, { pii: readRecord(`${a.run}.pii-guard.json`), e2e: readRecord(`${a.run}.e2e.json`) }, meta, { e2eReportSha256: a['e2e-report-sha256'] ?? null }),
  ...(activeRun === 'match' ? [] : [`app:active-run.${activeRun}`]),
  // 앱과 같은 모드 판정 — 활성 run 에서 verification 등 다른 값이면 앱은 닫혀 있다
  ...(mode === '' || mode === 'run' ? [] : [`app:mode.${mode}`]),
  ...(appCommit ? activationDiffFailures(appCommit, activationCommit, a.run, git) : []),
]
const failures = [...gate.failures, ...extra]

const CHECKS = [
  ['run 메타 형식 · 봉인', (x) => /^(meta|shape|seal):/.test(x)],
  ['메타 식별정보 가드', (x) => x.startsWith('pii:')],
  ['참가자(익명 key · env 개수)', (x) => x.startsWith('participants:') || x === 'live:participants.count'],
  ['시험 2회차 · item set · 정답표 · 코퍼스 해시', (x) => x.startsWith('exams:') || x.startsWith('live:exam.')],
  ['taxonomy v0.1 definitions_hash', (x) => x.startsWith('taxonomy:') || x.startsWith('live:taxonomy')],
  ['감지기 판 bd-0.1.0', (x) => x.startsWith('detector:') || x === 'live:detector'],
  ['probe 상한 3 · config 해시', (x) => x.startsWith('probe:') || x.startsWith('live:probe')],
  ['앱 커밋 · 배포 빌드 · 활성화 차이 · 활성 메타 · 모드', (x) => x.startsWith('app:') || x.startsWith('live:app.') || x.startsWith('activation:')],
  ['DB 마이그레이션 상태', (x) => x === 'live:db.migrations'],
  ['PII 가드 통과 기록', (x) => x.includes('piiGuard')],
  ['E2E 통과 기록', (x) => x.includes('e2e')],
]
console.log(`G6 시작 점검 — ${a.run}`)
for (const [name, match] of CHECKS) {
  const hit = failures.filter(match)
  console.log(`${hit.length ? 'FAIL' : 'PASS'}  ${name}${hit.length ? ` — ${hit.join(', ')}` : ''}`)
}
const known = failures.filter((x) => !CHECKS.some(([, m]) => m(x)))
for (const k of known) console.log(`FAIL  기타 — ${k}`)
console.log(failures.length ? `닫힘 — 실패 ${failures.length}건` : '열림 조건 충족 — 모든 항목 통과')
process.exit(failures.length ? 1 : 0)

export { ROOT }
