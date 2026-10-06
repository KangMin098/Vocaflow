// scripts/csat/pilot/prepare-run.mjs
//
// G6 run 준비를 한 번에 — 운영자 입력(익명 대응표 · 시험 2회)이 오면 이것 하나로 봉인까지 끝낸다(배포 env 설정 · start-check 는 배포 뒤).
// 순서(멈추면 그 단계에서 실패 원인을 출력하고 끝난다):
//   1) 작업 트리 깨끗 · HEAD = 고정할 배포 커밋
//   2) 대응표 검사 — git 이 추적하지 않는 경로(.pilot-private/ 또는 저장소 밖)만 · P001… 형식 · 계정 UUID 형식 · 3–8명
//      → 배포 env 에 넣을 줄을 .pilot-private/<run id>.env 에 쓴다(화면에 계정 id 를 출력하지 않는다)
//   3) 모델 입력 식별정보 가드 selftest → <run id>.pii-guard.json
//   4) production 빌드(이 커밋) → Playwright E2E(run-e2e.mjs --run) → <run id>.e2e.json
//   5) seal-run.mjs → <run id>.json · .md (익명 key · 해시만)
//
// 대응표 파일(한 줄에 하나, # 주석 허용):
//   P001=<계정 uuid>
//   P002=<계정 uuid>
//
//   node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/csat/pilot/prepare-run.mjs \
//     --run ec-pilot-run-YYYYMMDD-1 --exams 2019,2020 --mapping .pilot-private/participants.txt [--skip-build]
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../..')
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null }
const has = (k) => process.argv.includes(`--${k}`)
const die = (m) => { console.error(`중단: ${m}`); process.exit(1) }
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim()
const step = (n, m) => console.log(`\n[${n}] ${m}`)
function run(label, cmd, args, cwd = ROOT) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: process.env })
  if (r.status !== 0) die(`${label} 실패(exit ${r.status})`)
}

const runId = arg('run'), exams = (arg('exams') ?? '').split(',').filter(Boolean), mapping = arg('mapping')
if (!/^ec-pilot-run-\d{8}-\d+$/.test(runId ?? '')) die('--run ec-pilot-run-<YYYYMMDD>-<n>')
if (exams.length !== 2 || new Set(exams).size !== 2) die('--exams 서로 다른 시험 2개(쉼표)')
if (!mapping) die('--mapping <대응표 파일>')

// 같은 run id 로 다시 돌려 기존 기록을 조용히 덮어쓰지 않는다 — seal-run 은 봉인 json 만 막으므로, 앞 단계가 쓰는 기록 · env 초안까지 여기서 먼저 막는다
const existing = ['json', 'md', 'e2e.json', 'pii-guard.json'].map((x) => path.join(ROOT, 'docs/csat-learner/pilot-runs', `${runId}.${x}`))
  .concat(path.join(ROOT, '.pilot-private', `${runId}.env`)).filter((p) => fs.existsSync(p))
if (existing.length) die(`이 run id 의 기록이 이미 있다(${existing.map((p) => path.relative(ROOT, p)).join(', ')}) — 새 run id 로(같은 run 을 고치지 않는다 · §16)`)

step(1, '작업 트리 · 커밋')
// e2e-last-run.json 은 E2E 러너가 매번 다시 쓰는 요약 — 깨끗함 검사에서 뺀다
if (git('status', '--porcelain', '--untracked-files=no', '--', '.', ':!scripts/csat/pilot/e2e-last-run.json').length) die('커밋 안 된 변경이 있다 — 봉인 커밋이 실제 코드와 달라진다')
const commit = git('rev-parse', 'HEAD')
// 봉인 조건 중 저장소 설정으로 정해지는 것은 긴 빌드 · E2E 전에 먼저 본다(seal-run 이 같은 검사를 다시 한다)
const cap = fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/csat/ec-pilot/config.ts'), 'utf8').match(/probeCapPerSession:\s*(null|[0-9]+)\s*,/)?.[1]
if (cap !== '3') die(`config.ts probeCapPerSession = ${cap} — 결정 C(3)로 커밋한 뒤 실행`)
console.log(`고정 커밋 ${commit} — production 배포를 이 커밋으로 고정해야 게이트가 열린다`)

step(2, '대응표')
const abs = path.resolve(ROOT, mapping)
if (!fs.existsSync(abs)) die('대응표 파일이 없다')
const rel = path.relative(ROOT, abs)
if (!rel.startsWith('..')) {
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', rel], { cwd: ROOT }).status === 0
  const ignored = spawnSync('git', ['check-ignore', '-q', rel], { cwd: ROOT }).status === 0
  if (tracked || !ignored) die('대응표는 git 이 무시하는 경로(.pilot-private/) 또는 저장소 밖에만 둔다')
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const pairs = fs.readFileSync(abs, 'utf8').split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean).map((l) => l.split('=').map((x) => x.trim()))
const bad = pairs.filter(([k, v]) => !/^P\d{3}$/.test(k ?? '') || !UUID.test(v ?? ''))
if (bad.length) die(`형식이 틀린 줄 ${bad.length}개(P001=<uuid>) — 키만: ${bad.map(([k]) => k).join(', ')}`)
const keys = pairs.map(([k]) => k), ids = pairs.map(([, v]) => v.toLowerCase())
if (new Set(keys).size !== keys.length || new Set(ids).size !== ids.length) die('익명 key 또는 계정이 겹친다')
if (keys.length < 3 || keys.length > 8) die(`참가자 ${keys.length}명 — 프로토콜 결정 A 는 3–8명`)
const envOut = path.join(ROOT, '.pilot-private', `${runId}.env`)
fs.mkdirSync(path.dirname(envOut), { recursive: true })
// 모든 참가자가 같은 두 시험(결정 B ①). 다른 배정이 필요하면 seal-run.mjs 를 직접 부른다
const assignment = keys.map((k) => `${k}=${exams.join('+')}`).join(',')
fs.writeFileSync(envOut, `# ${runId} — 배포 env 에 넣는다(저장소 밖 · 커밋 금지)\nCSAT_EC_PILOT_USER_IDS=${ids.join(',')}\nCSAT_EC_APP_COMMIT=${commit}\n# CSAT_EC_ACTIVE_RUN 은 5단계(seal-run)가 출력하는 한 줄\n# CSAT_EC_PILOT_MODE 는 지운다(검증 모드 금지)\n`)
console.log(`참가자 ${keys.length}명(${keys.join(' ')}) · 배정 ${exams.join('+')} · 배포 env 초안 ${path.relative(ROOT, envOut)}`)

const pgDir = process.env.CSAT_PG_MODULE_DIR ?? path.join(ROOT, 'scripts/csat/error-evidence/isolated-pg/node_modules')
process.env.CSAT_PG_MODULE_DIR = pgDir

step(3, '모델 입력 식별정보 가드 selftest')
run('식별정보 가드 selftest', process.execPath, ['scripts/csat/error-evidence/model-input/model-packets.mjs', 'selftest', '--run', runId])

step(4, 'production 빌드 · E2E')
if (!has('skip-build')) run('production 빌드', process.execPath, ['node_modules/next/dist/bin/next', 'build'], path.join(ROOT, 'apps/web'))
run('E2E(run-e2e.mjs)', process.execPath, ['--tls-max-v1.2', 'scripts/csat/pilot/run-e2e.mjs', '--run', runId])

step(5, 'run 봉인')
run('run 봉인(seal-run.mjs)', process.execPath, ['--tls-max-v1.2', 'scripts/csat/pilot/seal-run.mjs', '--run', runId, '--exams', exams.join(','), '--participants', assignment, '--app-commit', commit])

console.log(`\n준비 끝 — 다음:
  a) 봉인 파일 docs/csat-learner/pilot-runs/${runId}.json · .md · .e2e.json · .pii-guard.json 을 커밋하지 말고 그대로 둔 채(커밋하면 HEAD 가 바뀐다) 검토
     → 검토 뒤 기록용 커밋은 run 이 끝난 뒤 또는 docs 전용 브랜치에(배포 freeze)
  b) 배포 env: ${path.relative(ROOT, envOut)} 의 값 + seal-run 이 출력한 CSAT_EC_ACTIVE_RUN · CSAT_EC_PILOT_MODE 제거 · 커밋 ${commit.slice(0, 12)} 로 배포
  c) node --tls-max-v1.2 --env-file=<배포 env> scripts/csat/pilot/start-check.mjs --run ${runId} --build-commit <플랫폼 배포 커밋>
  d) start-check 전 항목 PASS → G6 시작 승인 요청`)
