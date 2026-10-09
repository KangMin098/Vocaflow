// scripts/csat/lure-drain-check.mjs
//
// 청크 하나의 출력을 DB 없이 미리 점검한다(에이전트 자가 점검용) — 구절이 지문에 그대로 있는가 · 길이 20–80자.
// 최종 판정은 lure-drain-import(정규화 일치)가 한다. 이 점검은 공백만 접어 견주므로 그보다 엄격하다.
//   node scripts/csat/lure-drain-check.mjs 01

import fs from 'node:fs'
import path from 'node:path'

const id = String(process.argv[2] ?? '').padStart(2, '0')
const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'lure-drain')
const input = JSON.parse(fs.readFileSync(path.join(dir, `chunk-${id}.json`), 'utf8'))
const output = JSON.parse(fs.readFileSync(path.join(dir, `chunk-${id}.out.json`), 'utf8'))
const fold = (s) => String(s).replace(/\s+/g, ' ').trim()

const byItem = new Map(input.items.map((it) => [it.item_id, it]))
let ok = 0
let nulls = 0
const bad = []
let expected = 0
for (const it of input.items) expected += it.distractors.length
let seen = 0
for (const row of output.items ?? []) {
  const src = byItem.get(row.item_id)
  if (!src) { bad.push(`${row.item_id}: 입력에 없는 문항`); continue }
  for (const d of row.distractors ?? []) {
    seen += 1
    if (d.lure_quote == null) { nulls += 1; continue }
    const q = fold(d.lure_quote)
    if (q.length < 20 || q.length > 80) bad.push(`${row.item_id} #${d.n}: 길이 ${q.length}`)
    else if (!fold(src.passage).includes(q)) bad.push(`${row.item_id} #${d.n}: 지문에 그대로 없음 — ${q.slice(0, 50)}`)
    else ok += 1
  }
}
if (seen !== expected) bad.push(`오답 수 불일치: 입력 ${expected} · 출력 ${seen}`)
console.log(`chunk-${id}: 통과 ${ok} · 자리 없음(null) ${nulls} · 문제 ${bad.length}`)
for (const b of bad) console.log('  ', b)
process.exit(bad.length ? 1 : 0)
