// scripts/csat/export-seams.mjs
//
// **H9 판단용 — 문장을 빼냈을 때 남는 '이음매' 만 뽑는다. 읽기 전용.**
//
// H9: 삽입의 선택자는 뽑아낸 문장의 성질이 아니라 **빼낸 뒤 남은 두 문장이 그럴듯하게
//     붙느냐** 다. 붙으면 구멍이 안 보여 문항이 성립하고, 안 붙으면 구멍이 드러나 버린다.
//
// H6(뽑아낸 문장에 후방 지시어가 있다)과 **정반대 방향**이다 —
// 지시어를 담은 문장을 빼면 오히려 남은 자리에 대명사가 붕 떠서 구멍이 보인다.
//
// ⚠️ **base rate 를 먼저 센다.** 이게 지난 8개 가설이 전부 무너진 이유다.
//    후보 중 몇 개가 '매끄러움' 인지를 먼저 재고, 정답이 그 안에 드는지는 그 다음이다.
//    후보의 대부분이 매끄러우면 H9 도 선택자가 아니다.
//
// 판단은 의미 수준이라 정규식으로 못 한다 → Claude Code 가 직접 읽는다
// (CLAUDE.md §🤖). 이 스크립트는 판단할 이음매 목록만 만든다.
//
// 실행: pnpm dlx tsx scripts/csat/export-seams.mjs

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const COL_DIR = path.join(OUT_DIR, 'columns')
const R = (f) => JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'))

const cache = new Map()
function examLines(exam) {
  if (!cache.has(exam)) {
    const p = path.join(COL_DIR, `${exam}.txt`)
    cache.set(exam, fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r/g, '').split('\n') : null)
  }
  return cache.get(exam)
}
function itemLines(exam, no) {
  const lines = examLines(exam)
  if (!lines) return null
  const i = lines.findIndex((l) => new RegExp(`^\\s*${no}\\s*\\.`).test(l))
  if (i < 0) return null
  let j = lines.findIndex((l, k) => k > i && new RegExp(`^\\s*${no + 1}\\s*\\.`).test(l))
  if (j < 0 || j - i > 220) j = Math.min(i + 160, lines.length)
  return lines.slice(i, j)
}
const clean = (s) => s.replace(/[^\x00-\x7F]+/g, ' ').replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim()
const sentences = (t) =>
  t.split(/(?<=[.!?]["'’”)]?)\s+(?=["'“‘(]?[A-Z])/).map((s) => s.trim()).filter((s) => s.length > 12)

const classified = R('classified.json')
const answers = R('answers.json').answers
const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))

const items = []
for (const q of classified.rows.filter((r) => r.exam !== '2014A' && r.type === 'R-INSERT')) {
  const L = itemLines(q.exam, q.no)
  if (!L) continue
  const blocks = []
  let cur = []
  for (const raw of L.slice(1)) {
    if (!raw.trim()) { if (cur.length) { blocks.push(cur); cur = [] } } else cur.push(raw)
  }
  if (cur.length) blocks.push(cur)
  const enBlocks = blocks.filter((b) => /[A-Za-z]{3,}/.test(b.join(' ')))
  if (enBlocks.length < 2) continue
  const given = clean(enBlocks[0].join(' '))
  const passageRaw = enBlocks.slice(1).join(' ').replace(/\s+/g, ' ')
  if (given.split(/\s+/).length < 6 || !/\(\s*①\s*\)/.test(passageRaw)) continue
  const at1 = passageRaw.search(/\(\s*①\s*\)/)
  const lead = clean(passageRaw.slice(0, at1))
  let rest = passageRaw.slice(at1)
  const ci = rest.search(/①\s*$|①\s+②/)
  if (ci > 0) rest = rest.slice(0, ci)
  rest = rest.replace(/\*.*$/, '')
  const marked = rest.split(/\(\s*[①②③④⑤]\s*\)/)
  if (marked.length !== 6) continue
  const ans = key.get(`${q.exam}#${q.no}`)?.answer
  if (!ans) continue
  const restored = [lead, ...marked.slice(1)]
    .map((p, i) => (i === ans ? given + ' ' + clean(p) : clean(p)))
    .join(' ').replace(/\s+/g, ' ').trim()
  const sents = sentences(restored)
  if (sents.length < 5) continue
  const head = given.split(/\s+/).slice(0, 6).join(' ').toLowerCase()
  const ansIdx = sents.findIndex((s) => s.toLowerCase().startsWith(head.slice(0, Math.min(36, head.length))))
  if (ansIdx <= 0) continue
  items.push({ id: `${q.exam}#${q.no}`, points: key.get(`${q.exam}#${q.no}`).points, ansIdx, sents })
}

// 이음매 — 문장 i 를 빼면 S[i-1] 의 꼬리와 S[i+1] 의 머리가 맞닿는다.
// 마지막 문장은 빼도 삽입 문항이 안 되므로 후보에서 뺀다.
const tail = (s, n = 13) => { const w = s.split(/\s+/); return (w.length > n ? '… ' : '') + w.slice(-n).join(' ') }
const head = (s, n = 13) => { const w = s.split(/\s+/); return w.slice(0, n).join(' ') + (w.length > n ? ' …' : '') }

const out = []
for (const it of items) {
  const seams = []
  for (let i = 1; i < it.sents.length - 1; i += 1) {
    seams.push({ i, isAnswer: i === it.ansIdx, before: tail(it.sents[i - 1]), after: head(it.sents[i + 1]), removed: it.sents[i] })
  }
  out.push({ ...it, seams, pool: seams.length })
}

for (const it of out) {
  console.log('═'.repeat(80))
  console.log(`${it.id} (${it.points}점) · 문장 ${it.sents.length} · 후보 ${it.pool} · 정답 S${it.ansIdx}`)
  for (const s of it.seams) {
    console.log(`  ${s.isAnswer ? '▶' : ' '} S${String(s.i).padStart(2)} 제거 →  ${s.before}`)
    console.log(`             ⊕  ${s.after}`)
  }
}
fs.writeFileSync(path.join(OUT_DIR, 'insert-seams.json'), JSON.stringify(out, null, 1))
console.log(`\n${out.length}문항 · 이음매 ${out.reduce((s, x) => s + x.pool, 0)}개 → ${path.join(OUT_DIR, 'insert-seams.json')}`)
