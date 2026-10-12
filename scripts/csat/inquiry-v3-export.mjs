// scripts/csat/inquiry-v3-export.mjs
//
// **탐구 데이터 v3 청크 — 지정한 문항만.** (v3 M2 대표 수직 구현 → M3 확장)
//
// 입력은 새로 DB 를 읽지 않고 v1 공정의 청크 입력(chunk-inq-NN.json · 원문 포함 · 로컬 전용)과 v1 출력(.out.json)을 쓴다 —
// 같은 분석 버전 · 같은 문장 분할이어야 v1 과 v3 가 같은 근거 번호를 가리킨다.
// `units_hash` = 문장 분할 결과(번호 · 텍스트)의 해시. 화면은 지문 지도 문장과 이 해시가 맞을 때만 근거 연결을 켠다(원문 분할이 바뀌면 stale).
// 청크에는 원문이 들어간다 — gitignore(`scripts/csat/inquiry-drain/chunk-*.json`). 커밋하는 것은 검수를 지난 .out.json 뿐이다.
// 재실행 안전: 이미 같은 이름의 청크가 있으면 덮지 않고 멈춘다.
//
//   node scripts/csat/inquiry-v3-export.mjs --name v3-01 --ids 2026#34,2026#36

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const WORK = path.resolve('scripts/csat/inquiry-drain')
const arg = (k) => {
  const i = process.argv.indexOf(k)
  return i >= 0 ? process.argv[i + 1] : null
}
const name = arg('--name')
const ids = (arg('--ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
if (!name || !/^v3-\d+$/.test(name) || !ids.length) {
  console.error('사용: node scripts/csat/inquiry-v3-export.mjs --name v3-NN --ids <id,id,…>')
  process.exit(2)
}
const target = path.join(WORK, `chunk-${name}.json`)
if (fs.existsSync(target)) {
  console.error(`이미 있다: ${target} — 덮지 않는다(새 이름을 쓴다)`)
  process.exit(1)
}

/** 문장 분할의 결속 해시 — 번호와 정규화한 텍스트. 키 순서와 무관하다 */
export function unitsHash(sentences) {
  const body = sentences.map((s) => `${s.n}\u0001${String(s.text).replace(/\s+/g, ' ').trim()}`).join('\u0002')
  return createHash('sha256').update(body).digest('hex').slice(0, 16)
}

const inputs = new Map()
const v1 = new Map()
for (const f of fs.readdirSync(WORK)) {
  if (/^chunk-inq-\d+\.json$/.test(f)) for (const it of JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')).items) inputs.set(it.id, it)
  if (/^chunk-inq-\d+\.out\.json$/.test(f)) for (const r of JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')).items ?? []) v1.set(r.id, r)
}
const missing = ids.filter((id) => !inputs.has(id))
if (missing.length) {
  console.error(`v1 청크 입력에 없는 문항: ${missing.join(', ')} — 먼저 inquiry-drain-export 로 뽑는다`)
  process.exit(1)
}
const items = ids.map((id) => {
  const it = inputs.get(id)
  return { ...it, units_hash: unitsHash(it.sentences), v1: v1.get(id) ?? null }
})
fs.writeFileSync(target, JSON.stringify({ chunk: name, items }, null, 1) + '\n')
console.log(`${name}: ${items.length}문항 → ${target} (v1 출력 있음 ${items.filter((x) => x.v1).length})`)
