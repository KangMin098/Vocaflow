// scripts/csat/pilot/seal-run.mjs
//
// G6 run 메타 봉인(PILOT_PROTOCOL §16) — live DB(읽기 전용) · 저장소 · 검증 기록에서 run 메타를 만들어
//   docs/csat-learner/pilot-runs/<run id>.json (기계용 · 앱 게이트 정본) + <run id>.md (사람이 읽는 요약)를 쓴다.
// 담는 것: 익명 key · assignment · 해시 · 판 · 커밋 · 검증 기록 요약. 계정 id · 이름 · 이메일은 넣지 않는다(가드가 막는다).
// --activate 면 apps/web/src/lib/csat/ec-pilot/active-run.ts 에 같은 값을 쓴다(앱 게이트가 읽는 값 — 커밋 · 배포해야 열린다).
//
//   node --tls-max-v1.2 --env-file=<배포 env 파일> scripts/csat/pilot/seal-run.mjs --run ec-pilot-run-20261020-1 \
//     --exams 2019,2020 --participants "P001=2019+2020,P002=2019+2020,P003=2020" --app-commit <배포 커밋 sha> [--activate]
//   전제: <run id>.pii-guard.json(model-packets.mjs selftest) · <run id>.e2e.json(E2E 통과 기록) 이 같은 커밋으로 있어야 한다.

import fs from 'node:fs'
import path from 'node:path'

import { PILOT_PROBE_CAP, RUN_META_FORMAT, metaSeal, validateRunMeta, evaluateRunGate } from '../../../apps/web/src/lib/csat/ec-pilot/run-gate.ts'
import { ROOT, RUNS, fileSha256, readLive, rulesHash } from './live.mjs'

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => (x.startsWith('--') ? [...acc, [x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']] : acc), []))
const die = (m) => { console.error(m); process.exit(2) }
if (!/^ec-pilot-run-[0-9]{8}-[0-9]+$/.test(a.run ?? '')) die('--run <ec-pilot-run-YYYYMMDD-n> 필요')
if (fs.existsSync(path.join(RUNS, `${a.run}.json`))) die('이미 봉인된 run 이다 — 바꾸려면 새 run id 로(같은 run 을 고치지 않는다 · §16)')
const exams = (a.exams ?? '').split(',').map((x) => x.trim()).filter(Boolean)
const participants = (a.participants ?? '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
  const [key, ex] = x.split('=')
  return { key, exams: (ex ?? '').split('+').filter(Boolean) }
})
const appCommit = (a['app-commit'] ?? '').trim().toLowerCase()
if (!/^[0-9a-f]{40}$/.test(appCommit)) die('--app-commit <배포 커밋 40자 sha> 필요')

const rec = (name) => {
  const p = path.join(RUNS, name)
  if (!fs.existsSync(p)) die(`검증 기록이 없다: ${path.relative(ROOT, p)}`)
  return { sha256: fileSha256(p), json: JSON.parse(fs.readFileSync(p, 'utf8')) }
}
const pii = rec(`${a.run}.pii-guard.json`)
const e2e = rec(`${a.run}.e2e.json`)
if (pii.json.rulesHash !== rulesHash()) die('PII 가드 기록의 규칙 해시가 지금 규칙과 다르다 — selftest 를 다시 돌린다')

const live = await readLive(exams, { appCommit })
if (live.probeCap !== PILOT_PROBE_CAP) die(`config.ts probeCapPerSession 이 ${PILOT_PROBE_CAP} 이 아니다(결정 C) — 먼저 커밋한다`)
const missing = exams.filter((e) => !live.exams[e])
if (missing.length) die(`live 시험을 읽지 못했다: ${missing.join(',')}`)

const body = {
  format: RUN_META_FORMAT,
  runId: a.run,
  status: 'sealed',
  taxonomy: { version: live.configTaxonomyVersion, definitionsHash: live.dbTaxonomy?.definitionsHash ?? '' },
  detectorVersion: live.detectorVersion ?? '',
  probe: { capPerSession: live.probeCap, configHash: live.probeConfigHash },
  appCommit,
  db: live.db,
  exams: exams.map((e) => live.exams[e]),
  participants,
  verification: {
    piiGuard: { commit: pii.json.commit, rulesHash: pii.json.rulesHash, passed: pii.json.passed, failed: pii.json.failed, at: pii.json.at, recordSha256: pii.sha256 },
    e2e: { commit: e2e.json.commit, passed: e2e.json.passed, failed: e2e.json.failed, skipped: e2e.json.skipped, at: e2e.json.at, recordSha256: e2e.sha256 },
  },
  sealedAt: new Date().toISOString().replace(/\.[0-9]+Z$/, 'Z'),
}
const meta = { ...body, seal: metaSeal(body) }
const bad = validateRunMeta(meta)
if (bad.length) die(`메타 가드 실패 — 봉인하지 않는다: ${bad.join(', ')}`)
const gate = evaluateRunGate(meta, live)
if (!gate.open) die(`live 대조 실패 — 봉인하지 않는다: ${gate.failures.join(', ')}`)

fs.mkdirSync(RUNS, { recursive: true })
const json = JSON.stringify(meta, null, 2) + '\n'
fs.writeFileSync(path.join(RUNS, `${a.run}.json`), json)
const md = [
  `# ${a.run} — 오답 원인 Pilot run 메타(v0.1 operational pilot evidence)`,
  '',
  `> 기계용 정본은 같은 이름의 \`.json\`(봉인 해시 \`${meta.seal}\`). 이 문서는 사람이 읽는 요약이다. 계정 id · 이름 · 이메일 · 자유서술 원문은 담지 않는다(PILOT_PROTOCOL §16 · §19).`,
  '',
  '| 항목 | 값 |',
  '|---|---|',
  `| 봉인 시각 | ${meta.sealedAt} |`,
  `| taxonomy | ${meta.taxonomy.version} · \`${meta.taxonomy.definitionsHash}\` |`,
  `| 감지기 | ${meta.detectorVersion} |`,
  `| probe | 세션당 ${meta.probe.capPerSession} · config \`${meta.probe.configHash}\` |`,
  `| 앱 커밋 | \`${meta.appCommit}\` |`,
  `| DB 마이그레이션 | ${meta.db.latestMigration} · ${meta.db.migrationCount}개 |`,
  `| PII 가드 | ${meta.verification.piiGuard.passed} 통과 · 규칙 \`${meta.verification.piiGuard.rulesHash.slice(0, 16)}…\` · ${meta.verification.piiGuard.at} |`,
  `| E2E | ${meta.verification.e2e.passed} 통과 · 실패 0 · 건너뜀 0 · ${meta.verification.e2e.at} |`,
  '',
  '## 시험',
  '',
  '| exam id | item set | 정답표 | 코퍼스 |',
  '|---|---|---|---|',
  ...meta.exams.map((e) => `| ${e.examId} | \`${e.itemSetHash.slice(0, 16)}…\` | \`${e.answerKeyHash.slice(0, 16)}…\` | \`${e.corpusHash.slice(0, 16)}…\` |`),
  '',
  '## 참가자(익명 key · assignment)',
  '',
  '| key | 시험(순번 E1, E2 …) |',
  '|---|---|',
  ...meta.participants.map((p) => `| ${p.key} | ${p.exams.map((x, i) => `E${i + 1}=${x}`).join(' · ')} |`),
  '',
  '점검: `node --tls-max-v1.2 --env-file=<배포 env> scripts/csat/pilot/start-check.mjs --run ' + a.run + ' --app-commit <배포 커밋>` — 모든 항목 PASS 여야 앱 게이트가 열린다.',
  '',
].join('\n')
fs.writeFileSync(path.join(RUNS, `${a.run}.md`), md)
if (a.activate === 'true') {
  const ts = [
    '// apps/web/src/lib/csat/ec-pilot/active-run.ts',
    '//',
    `// 지금 활성인 Pilot run 메타 — 정본 docs/csat-learner/pilot-runs/${a.run}.json 과 글자 그대로 같아야 한다(run-gate.test.ts 가 지킨다).`,
    '// scripts/csat/pilot/seal-run.mjs --activate 가 썼다. 끄려면 null 로 되돌린다(게이트 fail-closed).',
    '',
    "import type { RunMeta } from './run-gate'",
    '',
    `export const ACTIVE_RUN: RunMeta | null = ${JSON.stringify(meta, null, 2)}`,
    '',
  ].join('\n')
  fs.writeFileSync(path.join(ROOT, 'apps/web/src/lib/csat/ec-pilot/active-run.ts'), ts)
}
console.log(`봉인 — ${path.relative(ROOT, path.join(RUNS, a.run + '.json'))} (seal ${meta.seal.slice(0, 12)})${a.activate === 'true' ? ' · active-run.ts 갱신' : ''}`)
