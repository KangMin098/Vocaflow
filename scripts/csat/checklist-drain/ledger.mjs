// scripts/csat/checklist-drain/ledger.mjs
//
// **v7 체크리스트 경로 — 감사 원장.** 판정 기준 v7 §3-6: 배치마다 5% 를 전문 판정으로 다시 보고,
// **체크리스트가 keep 이라 했는데 전문 판정이 keep 이 아닌 것**을 원천별로 센다. 누적 감사 keep 이 30편 이상이고
// 그 오판률이 3% 를 넘는 원천은 꺼진다 — `export.mjs` 가 원장을 읽고 그 원천을 더는 뽑지 않는다(전문 판정으로 돈다).
//
// 원장: `docs/source-check/checklist-audit.json`(커밋한다 — 어느 원천이 왜 꺼졌는지가 기준 운영의 기록이다).
// 입력: `batch-<N>/audited.json` + 전문 판정자 출력 `batch-<N>/full-*.out.json`.
// 재실행 안전: 같은 배치 번호의 항목을 바꿔 쓴다(두 번 세지 않는다). 감사분 전문 판정이 덜 끝났으면 쓰지 않는다.
//
// 실행: node scripts/csat/checklist-drain/ledger.mjs --batch 1 --date 2026-09-26 [--write]

import fs from 'node:fs'
import path from 'node:path'

import { CHECKLIST_AUDIT, CRITERIA_VERSION } from '../gate-rules.mjs'
import { tallyAudit, sourceStatus } from './lib.mjs'

const arg = (k) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : undefined
}
const BATCH = Number(arg('batch'))
if (!Number.isInteger(BATCH) || BATCH < 1) throw new Error('--batch <n>')
// 날짜는 받는다 — 시계를 직접 읽지 않는다(AGENTS.md).
const DATE = arg('date')
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE ?? '')) throw new Error('--date YYYY-MM-DD')
const WRITE = process.argv.includes('--write')
const DIR = path.resolve(`scripts/csat/checklist-drain/batch-${BATCH}`)
const LEDGER = path.resolve('docs/source-check/checklist-audit.json')

const audited = JSON.parse(fs.readFileSync(path.join(DIR, 'audited.json'), 'utf8'))
const fullById = new Map()
for (const f of fs.readdirSync(DIR).filter((x) => /^full-\d+\.out\.json$/.test(x))) {
  for (const r of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) fullById.set(r.id, r.retention)
}
const { bySource, pending, wrong } = tallyAudit(audited, fullById)
if (pending.length) {
  console.error(`감사분 전문 판정이 아직 없다 ${pending.length}편 — full-*.out.json 을 먼저 채운다`)
  process.exit(1)
}

const ledger = fs.existsSync(LEDGER)
  ? JSON.parse(fs.readFileSync(LEDGER, 'utf8'))
  : { rule: { ...CHECKLIST_AUDIT }, disabled: [], batches: [] }
const entry = { batch: BATCH, date: DATE, criteria_version: CRITERIA_VERSION, bySource, wrong }
ledger.batches = [...ledger.batches.filter((b) => b.batch !== BATCH), entry].sort((a, b) => a.batch - b.batch)

const status = sourceStatus(ledger.batches)
for (const [src, s] of Object.entries(status).sort()) {
  console.log(`  ${src.padEnd(18)} 감사 ${s.audited} · 그중 체크리스트 keep ${s.auditedKeep} · 오판 ${s.wrongKeep} (${(s.rate * 100).toFixed(1)}%)${s.off ? ' → 끔(전문 판정으로)' : s.auditedKeep < CHECKLIST_AUDIT.minAudited ? ` · ${CHECKLIST_AUDIT.minAudited}편 전까지 판단 보류` : ''}`)
}
for (const w of wrong) console.log(`  오판 ${w.id.slice(0, 8)} ${w.source} — 체크리스트 keep(${w.rule}) · 전문 ${w.truth}`)
if (!WRITE) { console.log('  (예행 — --write 로 원장에 쓴다)'); process.exit(0) }
fs.writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 1)}\n`)
console.log(`  원장 → ${path.relative(process.cwd(), LEDGER)}`)
