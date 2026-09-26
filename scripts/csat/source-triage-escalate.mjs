// scripts/csat/source-triage-escalate.mjs
//
// **창 판정(B) → 전문 판정(C) 청크 — 읽기 전용(DB 를 건드리지 않는다).**
//
// 창 판정 결과(`<lite>/chunk-X.out.json`)에서 전문으로 다시 읽을 것(`needsFullRead` — 보관이 아닌 것 · `escalate`)만 골라
// 같은 이름의 전문 청크(`<full>/chunk-X.json`, `content` 전문)에서 그 항목을 꺼내 `<out>/chunk-X.json` 으로 쓴다.
// 기준: docs/source-check/criteria.md §13. 폐기는 되돌릴 수 없어 창만으로 정하지 않는다.
//
// 재실행 안전: 이미 있는 출력 파일은 건너뛴다. 전문 청크에 없는 id 는 세어서 출력한다(조용히 빠지면 판정 구멍이 남는다).
//
// 실행: node scripts/csat/source-triage-escalate.mjs --lite <창 판정 디렉터리> --full <전문 청크 디렉터리> --out <출력 디렉터리>

import fs from 'node:fs'
import path from 'node:path'

import { needsFullRead } from './retain-record.mjs'

const arg = (k) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : undefined
}
const LITE = arg('lite')
const FULL = arg('full')
const OUT = arg('out')
if (!LITE || !FULL || !OUT) throw new Error('--lite <dir> --full <dir> --out <dir>')
fs.mkdirSync(OUT, { recursive: true })

const summary = { files: 0, judged: 0, escalated: 0, missing: 0, existing: 0 }
for (const f of fs.readdirSync(LITE).filter((f) => /^chunk-[^.]+\.out\.json$/.test(f))) {
  const name = f.replace('.out.json', '.json')
  const reviews = JSON.parse(fs.readFileSync(path.join(LITE, f), 'utf8'))
  summary.judged += reviews.length
  const ids = new Set(reviews.filter(needsFullRead).map((r) => r.id))
  if (!ids.size) continue
  const dest = path.join(OUT, name)
  if (fs.existsSync(dest)) { summary.existing++; continue }
  const fullFile = path.join(FULL, name)
  const full = fs.existsSync(fullFile) ? JSON.parse(fs.readFileSync(fullFile, 'utf8')) : []
  const picked = full.filter((x) => ids.has(x.id)).map((x) => ({ ...x, basis: 'full' }))
  summary.missing += ids.size - picked.length
  if (!picked.length) continue
  fs.writeFileSync(dest, `${JSON.stringify(picked, null, 1)}\n`, { flag: 'wx' })
  summary.files++
  summary.escalated += picked.length
}
console.log(JSON.stringify({ ...summary, rate: summary.judged ? +(summary.escalated / summary.judged).toFixed(3) : null }))
if (summary.missing) process.exitCode = 1
