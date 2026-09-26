// scripts/csat/checklist-drain/assemble.mjs
//
// **v7 체크리스트 경로 — 판정자 답을 두 갈래로 나눈다.** 판정 기준 v7 §3-6. 파일만 쓴다(DB 0).
//
// 입력: `batch-<N>/chunk-NN.json` + 판정자(checklist-judge)가 쓴 `chunk-NN.out.json` · `audit.json`.
// 출력(같은 폴더):
//   import-NN.json — 규칙 keep · 감사 밖 → 보관 판정 기록(≤100편). `gate-mixed-import.mjs --input` 이 그대로 받는다.
//   full-NN.json   — 규칙이 keep 이 아니거나 감사 대상 → **전문 판정** 청크(csat-source-judge · 체크리스트 답은 싣지 않는다).
//                    판정자가 `full-NN.out.json` 을 쓰면 그것도 `gate-mixed-import --input` 으로 적재한다.
//   audited.json   — 감사 대상의 체크리스트 결론. `ledger.mjs` 가 전문 판정과 대 본다.
// 재실행 안전: 같은 입력이면 같은 파일이다. 이미 있는 출력과 내용이 다르면 멈춘다(판정자가 답을 고쳤다면 사람이 보고 지운다).
//
// 실행: node scripts/csat/checklist-drain/assemble.mjs --batch 1

import fs from 'node:fs'
import path from 'node:path'

import { route } from './lib.mjs'

const i = process.argv.indexOf('--batch')
const BATCH = Number(process.argv[i + 1])
if (i < 0 || !Number.isInteger(BATCH) || BATCH < 1) throw new Error('--batch <n>')
const DIR = path.resolve(`scripts/csat/checklist-drain/batch-${BATCH}`)
const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))

const chunkFiles = fs.readdirSync(DIR).filter((f) => /^chunk-\d+\.json$/.test(f)).sort()
const missing = chunkFiles.filter((f) => !fs.existsSync(path.join(DIR, f.replace('.json', '.out.json'))))
if (missing.length) {
  console.error(`판정자 출력이 없는 청크 ${missing.length}개: ${missing.join(' ')}`)
  process.exit(1)
}
const items = chunkFiles.flatMap(read)
const outs = chunkFiles.flatMap((f) => read(f.replace('.json', '.out.json')))
const { audit } = read('audit.json')

const { records, full, audited, problems } = route(items, outs, audit)
if (problems.length) {
  console.error(`고칠 것 ${problems.length}건 — 어느 갈래에도 넣지 않았다:\n${problems.join('\n')}`)
  process.exit(1)
}

const files = []
const put = (name, value) => {
  const file = path.join(DIR, name)
  const text = `${JSON.stringify(value, null, 1)}\n`
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') !== text) throw new Error(`${name} 가 이미 있고 내용이 다르다 — 확인하고 지운 뒤 다시 돌린다`)
  } else fs.writeFileSync(file, text)
  files.push(name)
}
for (let k = 0; k * 100 < records.length; k++) put(`import-${String(k + 1).padStart(2, '0')}.json`, records.slice(k * 100, (k + 1) * 100))
for (let k = 0; k * 25 < full.length; k++) put(`full-${String(k + 1).padStart(2, '0')}.json`, full.slice(k * 25, (k + 1) * 25))
put('audited.json', audited)

console.log(JSON.stringify({
  batch: BATCH, total: items.length, recordsKeep: records.length, toFullJudgment: full.length,
  audited: audited.length, auditedChecklistKeep: audited.filter((a) => a.checklist === 'keep').length,
  autoKeepRate: +(records.length / Math.max(1, items.length - audited.length)).toFixed(3), files,
}, null, 1))
