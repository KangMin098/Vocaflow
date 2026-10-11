// scripts/csat/compare-drain-import.mjs
//
// **같은 원리 비교 쌍 — 검수 통과분만 화면 데이터로**(M4, 2026-10-11). 3단의 마지막.
//
// 입력: compare-drain/chunk-*.json(후보) + chunk-*.out.json(독립 검수). `same_principle: true` 이고 note 가 있는 쌍만 쓴다.
// 출력: `apps/web/src/lib/csat/compare-data.json` — 문항마다 [{ other, choice, otherChoice, trap, note }] (양방향).
// 검수가 없는 후보 · 검수에서 빠진 pair_id · 빈 note 는 건너뛰고 **수를 출력**한다(빈자리를 숨기지 않는다).
// 원문은 싣지 않는다(note 는 검수자가 쓴 우리 문장, 80자 상한).
//
// 재실행 안전: 같은 입력이면 같은 파일(정렬).
//
//   node scripts/csat/compare-drain-import.mjs           (검사만 — 수만 출력)
//   node scripts/csat/compare-drain-import.mjs --write

import fs from 'node:fs'
import path from 'node:path'

const WRITE = process.argv.includes('--write')
const WORK = path.resolve('scripts/csat/compare-drain')
const OUT = path.resolve('apps/web/src/lib/csat/compare-data.json')
const NOTE_MAX = 80

const byItem = new Map()
const add = (id, entry) => {
  if (!byItem.has(id)) byItem.set(id, [])
  byItem.get(id).push(entry)
}
let candidates = 0
let accepted = 0
let rejected = 0
let missing = 0
let badNote = 0
let labelConflict = 0
// 한 줄이 라벨과 다른 함정을 말하는 쌍 — 「주체를 바꿨다」고 쓰면서 라벨이 주체 역전이 아니면 학습자가 헷갈린다(2026-10-11 표본 3/546)
const conflicts = (trap, note) => trap !== '주체 역전' && /주체(?:를|·대상을|가)?\s*(?:지문에 없는 쪽으로\s*)?바(?:뀌|꿨)/.test(note)
for (const f of fs.readdirSync(WORK).filter((f) => /^chunk-.*\.json$/.test(f) && !f.endsWith('.out.json')).sort()) {
  const inp = JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'))
  const outPath = path.join(WORK, f.replace(/\.json$/, '.out.json'))
  const verdicts = fs.existsSync(outPath) ? new Map((JSON.parse(fs.readFileSync(outPath, 'utf8')).verdicts ?? []).map((v) => [v.pair_id, v])) : new Map()
  for (const p of inp.pairs) {
    candidates += 1
    const v = verdicts.get(p.pair_id)
    if (!v) {
      missing += 1
      continue
    }
    if (v.same_principle !== true) {
      rejected += 1
      continue
    }
    const note = typeof v.note === 'string' ? v.note.trim() : ''
    if (note.length < 8 || note.length > NOTE_MAX) {
      badNote += 1
      continue
    }
    if (conflicts(p.trap, note)) {
      labelConflict += 1
      continue
    }
    accepted += 1
    add(p.a.id, { other: p.b.id, choice: p.a.n, otherChoice: p.b.n, trap: p.trap, note })
    add(p.b.id, { other: p.a.id, choice: p.b.n, otherChoice: p.a.n, trap: p.trap, note })
  }
}

const data = Object.fromEntries([...byItem.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([id, xs]) => [id, xs.sort((p, q) => p.other.localeCompare(q.other))]))
console.log(`후보 ${candidates} · 통과 ${accepted} · 탈락 ${rejected} · 검수 없음 ${missing} · note 부적합 ${badNote} · 라벨-설명 충돌 ${labelConflict} → 비교 쌍이 있는 문항 ${byItem.size}`)
if (WRITE) {
  fs.writeFileSync(OUT, JSON.stringify({ built_by: 'scripts/csat/compare-drain-import.mjs', pairs: accepted, items: data }, null, 1) + '\n')
  console.log(`→ ${path.relative(process.cwd(), OUT)}`)
} else console.log('(검사만 — --write 로 쓴다)')
