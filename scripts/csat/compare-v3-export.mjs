// scripts/csat/compare-v3-export.mjs
//
// v3 M4 비교 쌍 작성 입력 — 기존 비교 정본(compare-data.json, legacy_unbound 831쌍)에서
// **양쪽 문항이 공개 v3(verified)** 인 쌍만 골라 청크로 만든다. legacy 쌍을 v3 로 승격하지 않는다 — 작성 · 독립 검수를 다시 거친다.
// 청크에는 양쪽 전체 원문 문장 · 선지 · 정답 · 공개 v3 칸과 결속 해시(탐구 contentHash · units_hash)를 넣는다(원문 포함 → gitignore).
// 재실행 안전: 이미 작성 결과(.out.json)가 있는 pair_id 는 건너뛴다. DB 를 읽지 않는다.
//   node scripts/csat/compare-v3-export.mjs [--size 15] [--limit N]
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import { contentHash } from './lib-inquiry-review.mjs'

const ROOT = process.cwd()
const IDIR = join(ROOT, 'scripts/csat/inquiry-drain')
const ODIR = join(ROOT, 'scripts/csat/compare-drain')
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d }
const SIZE = arg('--size', 15)
const LIMIT = arg('--limit', Infinity)

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const listOf = (o) => (Array.isArray(o) ? o : o.items ?? [])

// 원문 입력(v1 · v3 입력 청크) · 작성 결과(해시 계산용) — 같은 id 는 v3 결과 우선
const inputs = new Map()
for (const f of readdirSync(IDIR).filter((f) => /^chunk-(inq|v3)-[\w-]+\.json$/.test(f) && !f.includes('.out.'))) {
  for (const it of listOf(readJson(join(IDIR, f)))) if (!inputs.has(it.id)) inputs.set(it.id, it)
}
const outs = new Map()
for (const f of readdirSync(IDIR).filter((f) => /^chunk-(inq|v3)-[\w-]+\.out\.json$/.test(f)).sort()) {
  for (const it of listOf(readJson(join(IDIR, f)))) {
    const prev = outs.get(it.id)
    if (!prev || (it.v3 && !prev.v3) || f.startsWith('chunk-v3')) outs.set(it.id, it)
  }
}
const pub = readJson(join(ROOT, 'apps/web/src/lib/csat/inquiry-data.json')).items
const legacy = readJson(join(ROOT, 'apps/web/src/lib/csat/compare-data.json')).items

// 이미 작성된 쌍
const done = new Set()
for (const f of readdirSync(ODIR).filter((f) => /^chunk-v3p-\d+\.out\.json$/.test(f))) {
  for (const p of readJson(join(ODIR, f)).pairs ?? []) done.add(p.pair_id)
}

const side = (id) => {
  const inp = inputs.get(id)
  const p = pub[id]
  return {
    id,
    type_id: inp.type_id,
    answer: inp.answer,
    stem: inp.stem,
    sentences: inp.sentences,
    choices: inp.choices,
    units_hash: p.v3.units_hash,
    inquiry_hash: contentHash(outs.get(id)),
    v3: { requirement: p.v3.requirement, choices: p.v3.choices, meanings: p.v3.meanings },
    principle: p.principle,
  }
}

const seen = new Set()
const cands = []
let skipNotPublic = 0
for (const [a, list] of Object.entries(legacy)) {
  for (const e of list) {
    const [l, r] = [a, e.other].sort()
    const pair_id = `${l}~${r}`
    if (seen.has(pair_id)) continue
    seen.add(pair_id)
    const ok = (id) => pub[id]?.review === 'verified' && pub[id]?.v3 && inputs.has(id) && outs.has(id)
    if (!ok(l) || !ok(r)) { skipNotPublic++; continue }
    if (done.has(pair_id)) continue
    const lc = a === l ? e.choice : e.otherChoice
    const rc = a === l ? e.otherChoice : e.choice
    cands.push({ pair_id, legacy: { kind: e.kind, trap: e.trap, note: e.note, left_choice: lc, right_choice: rc }, left: side(l), right: side(r) })
  }
}

const picked = cands.slice(0, LIMIT)
let n = 0
for (let i = 0; i < picked.length; i += SIZE) {
  let k = 1
  while (existsSync(join(ODIR, `chunk-v3p-${String(k).padStart(2, '0')}.json`))) k++
  const name = `v3p-${String(k).padStart(2, '0')}`
  writeFileSync(join(ODIR, `chunk-${name}.json`), JSON.stringify({ chunk: name, pairs: picked.slice(i, i + SIZE) }, null, 1))
  n++
}
console.log(`legacy 쌍 ${seen.size} · 양쪽 공개 v3 아님 ${skipNotPublic} · 이미 작성 ${done.size} · 이번 후보 ${picked.length} → 청크 ${n}개`)
