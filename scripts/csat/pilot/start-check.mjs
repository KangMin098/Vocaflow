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
//   node --tls-max-v1.2 --env-file=<배포 env 를 담은 파일> scripts/csat/pilot/start-check.mjs --run <run id> --app-commit <배포 커밋 sha>
//   (CSAT_EC_PILOT_USER_IDS 는 env 로 읽어 개수만 본다 — 계정 id 는 출력하지 않는다)

import fs from 'node:fs'
import path from 'node:path'

import { canonicalJson, evaluateRunGate } from '../../../apps/web/src/lib/csat/ec-pilot/run-gate.ts'
import { RUNS, ROOT, fileSha256, readLive, rulesHash } from './live.mjs'

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => (x.startsWith('--') ? [...acc, [x.slice(2), arr[i + 1]]] : acc), []))
if (!/^ec-pilot-run-[0-9]{8}-[0-9]+$/.test(a.run ?? '')) { console.error('--run <ec-pilot-run-YYYYMMDD-n> 필요'); process.exit(2) }
const appCommit = (a['app-commit'] ?? process.env.CSAT_EC_APP_COMMIT ?? '').trim().toLowerCase() || null

/** 기록 파일 대조(앱이 못 보는 항목) — 실패 코드 목록 */
export function recordFailures(meta, files) {
  const f = []
  const v = meta.verification ?? {}
  const pii = files.pii, e2e = files.e2e
  if (!pii) f.push('record:piiGuard.missing')
  else {
    if (pii.sha256 !== v.piiGuard?.recordSha256) f.push('record:piiGuard.sha256')
    if (pii.json.rulesHash !== files.liveRulesHash || v.piiGuard?.rulesHash !== files.liveRulesHash) f.push('record:piiGuard.rulesHash')
    if (pii.json.failed !== 0 || pii.json.passed !== v.piiGuard?.passed || pii.json.commit !== v.piiGuard?.commit || pii.json.runId !== meta.runId) f.push('record:piiGuard.fields')
  }
  if (!e2e) f.push('record:e2e.missing')
  else {
    if (e2e.sha256 !== v.e2e?.recordSha256) f.push('record:e2e.sha256')
    const j = e2e.json
    if (j.format !== 'ec-pilot-e2e-1' || j.runId !== meta.runId || j.commit !== v.e2e?.commit || j.passed !== v.e2e?.passed || j.failed !== 0 || j.skipped !== 0 || j.at !== v.e2e?.at) f.push('record:e2e.fields')
  }
  if (files.activeRun !== 'match') f.push(`app:active-run.${files.activeRun}`)
  return f
}

function readRecord(name) {
  const p = path.join(RUNS, name)
  return fs.existsSync(p) ? { sha256: fileSha256(p), json: JSON.parse(fs.readFileSync(p, 'utf8')) } : null
}

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
const live = await readLive(examIds, { appCommit })
const gate = evaluateRunGate(meta, live)
const extra = meta ? recordFailures(meta, {
  pii: readRecord(`${a.run}.pii-guard.json`), e2e: readRecord(`${a.run}.e2e.json`), liveRulesHash: rulesHash(), activeRun: await activeRunState(meta),
}) : []
const failures = [...gate.failures, ...extra]

const CHECKS = [
  ['run 메타 형식 · 봉인', (x) => /^(meta|shape|seal):/.test(x)],
  ['메타 식별정보 가드', (x) => x.startsWith('pii:')],
  ['참가자(익명 key · env 개수)', (x) => x.startsWith('participants:') || x === 'live:participants.count'],
  ['시험 2회차 · item set · 정답표 · 코퍼스 해시', (x) => x.startsWith('exams:') || x.startsWith('live:exam.')],
  ['taxonomy v0.1 definitions_hash', (x) => x.startsWith('taxonomy:') || x.startsWith('live:taxonomy')],
  ['감지기 판 bd-0.1.0', (x) => x.startsWith('detector:') || x === 'live:detector'],
  ['probe 상한 3 · config 해시', (x) => x.startsWith('probe:') || x.startsWith('live:probe')],
  ['앱 커밋 · 활성 메타', (x) => x.startsWith('app:') || x === 'live:app.commit'],
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
