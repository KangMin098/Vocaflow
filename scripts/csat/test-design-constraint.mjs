// scripts/csat/test-design-constraint.mjs
//
// **설계 제약이 실제로 선택을 좁히는가 — 설계도가 진짜인지의 시험.**
//
// 문제의식. "출제자의 설계도" 를 문서로 아무리 잘 써도, 그 제약이 지문 앞에서
// 후보를 좁히지 못하면 설계도가 아니라 사후 서술이다.
// 그래서 **거꾸로** 돌린다: 완성된 문항이 아니라 **원래 지문**을 놓고,
// 출제자가 그때 고를 수 있었던 후보가 몇 개였는지 센다.
//
// 대상: 문장 삽입(38·39). 여기 설계 제약은 H6 으로 실측됐다 —
//   뽑아낸 문장은 **후방 지시어**(this/these/such/it/their…)를 담는다 (24/25 = 96%).
//
// 절차
//   1. 기출 삽입 문항에서 **원래 지문을 복원**한다 (주어진 문장을 정답 자리에 되꽂는다)
//   2. 지문의 모든 문장을 후보로 놓는다 (첫 문장 제외 — 뽑을 수 없다)
//   3. 각 후보에 제약을 적용한다: 후방 지시어를 담는가
//   4. **실제 정답 문장이 후보 안에 있는가**, 그리고 **후보가 몇 개로 좁혀지는가**
//
// 판정
//   후보가 전체 문장의 대부분이면 → 제약이 아무것도 안 좁힌다. 설계도가 비어 있다.
//   후보가 소수이고 정답이 그 안에 있으면 → 제약이 실제로 설계를 몬다. 엔진으로 구현 가능하다.
//
// ⚠️ 이건 "정답을 맞히는" 시험이 아니다. 출제자가 **고를 수 있었던 자리의 수**를 재는 것이다.
//    후보가 3개인데 그중 하나가 정답이라면, 설계도는 8분의 1을 3분의 1로 좁힌 것이다.
//
// 실행: pnpm dlx tsx scripts/csat/test-design-constraint.mjs

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

// 후방 지시어 — 앞 문장을 가리켜야만 뜻이 서는 표현. H6 에서 쓴 것과 같은 목록.
const REF = /\b(this|these|that|those|such|its|their|his|her|it|they|them|the\s+(former|latter)|another|other|the\s+same)\b/i

const classified = R('classified.json')
const answers = R('answers.json').answers
const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))
const MARKS = ['①', '②', '③', '④', '⑤']

/** 문장 분할 — 약어(Mr. / e.g.)에 걸리지 않게 뒤에 대문자·인용부호가 와야 경계로 본다. */
function sentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?]["'’”)]?)\s+(?=["'“‘(]?[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
}

const rows = []
let skipped = 0
for (const q of classified.rows.filter((r) => r.exam !== '2014A' && r.type === 'R-INSERT')) {
  const L = itemLines(q.exam, q.no)
  if (!L) { skipped += 1; continue }
  const body = L.join(' ').replace(/\s+/g, ' ')
  const at1 = body.search(/\(\s*①\s*\)/)
  if (at1 < 0) { skipped += 1; continue }

  // 주어진 문장 = 문항 번호 뒤 ~ 첫 ( ① ) 앞. 발문(한글)은 걷어낸다.
  let given = body.slice(0, at1).replace(/^\s*\d+\s*\.\s*/, '')
  given = given.replace(/[^\x00-\x7F]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (given.split(/\s+/).length < 6) { skipped += 1; continue }

  // 본문 = 첫 ( ① ) 부터 선택지 전까지. 표지를 자리 표시로 남긴다.
  let rest = body.slice(at1)
  const cut = rest.search(/[①②③④⑤]\s*(?![)\s]*\))/)
  const choiceAt = rest.search(/①\s*$|①\s+②/)
  if (choiceAt > 0) rest = rest.slice(0, choiceAt)
  rest = rest.replace(/\*.*$/, '') // 각주 제거

  // 표지 자리를 기준으로 조각내기
  const parts = rest.split(/\(\s*[①②③④⑤]\s*\)/)
  if (parts.length !== 6) { skipped += 1; continue }
  const clean = (s) => s.replace(/[^\x00-\x7F]+/g, ' ').replace(/\s+/g, ' ').trim()
  const ans = key.get(`${q.exam}#${q.no}`)?.answer
  if (!ans) { skipped += 1; continue }

  // 원래 지문 복원 — 주어진 문장을 정답 표지 자리에 되꽂는다
  const restored = parts
    .map((p, i) => (i === ans ? given + ' ' + clean(p) : clean(p)))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  const sents = sentences(restored)
  if (sents.length < 4) { skipped += 1; continue }

  // 정답 문장 찾기 — 주어진 문장의 앞 8단어로 대조
  const head = given.split(/\s+/).slice(0, 8).join(' ').toLowerCase()
  const ansIdx = sents.findIndex((s) => s.toLowerCase().startsWith(head.slice(0, Math.min(40, head.length))))
  if (ansIdx <= 0) { skipped += 1; continue }

  // 후보 = 첫 문장을 뺀 모든 문장 중 후방 지시어를 담은 것
  const pool = sents.map((s, i) => ({ i, s })).filter((x) => x.i > 0)
  const cand = pool.filter((x) => REF.test(x.s))
  rows.push({
    exam: q.exam, no: q.no,
    sents: sents.length,
    pool: pool.length,
    cand: cand.length,
    hit: cand.some((x) => x.i === ansIdx),
    ansIdx,
  })
}

const n = rows.length
const hit = rows.filter((r) => r.hit).length
const avg = (f) => rows.reduce((s, r) => s + f(r), 0) / n

console.log('설계 제약이 후보를 좁히는가 — 문장 삽입(38·39)')
console.log('─'.repeat(74))
console.log(`  복원 성공 ${n}/${classified.rows.filter((r) => r.exam !== '2014A' && r.type === 'R-INSERT').length} · 실패 ${skipped}`)
console.log('')
console.log(`  지문 평균 문장 수        ${avg((r) => r.sents).toFixed(1)}`)
console.log(`  뽑을 수 있는 자리(첫 문장 제외)  ${avg((r) => r.pool).toFixed(1)}`)
console.log(`  제약 통과 후보           ${avg((r) => r.cand).toFixed(1)}`)
console.log(`  → 제약이 후보를 ${(100 * (1 - avg((r) => r.cand) / avg((r) => r.pool))).toFixed(0)}% 줄인다`)
console.log('')
console.log(`  실제 정답 문장이 후보 안에 있는가  ${hit}/${n} = ${(100 * hit / n).toFixed(1)}%`)
console.log('')
const before = 1 / avg((r) => r.pool), after = 1 / avg((r) => r.cand)
console.log('  판정')
console.log(`    제약 없이 찍으면 ${(100 * before).toFixed(1)}% · 제약을 걸면 ${(100 * after).toFixed(1)}%`)
if (avg((r) => r.cand) / avg((r) => r.pool) > 0.8) {
  console.log('    → 제약이 거의 아무것도 안 좁힌다. 설계도가 비어 있다 — 사후 서술이었다.')
} else if (hit / n >= 0.9) {
  console.log('    → 제약이 실제로 설계를 몬다. 정답을 거의 놓치지 않으면서 후보를 줄인다.')
  console.log('      **엔진으로 구현 가능하다** — 지문을 넣으면 출제 가능한 자리 목록이 나온다.')
} else {
  console.log('    → 후보는 좁아지는데 정답을 자주 놓친다. 제약이 부정확하다.')
}

console.log('')
console.log('  회차별 (후보/뽑을 수 있는 자리)')
for (const r of rows) {
  console.log(`    ${r.exam}#${r.no}  ${String(r.cand).padStart(2)}/${String(r.pool).padStart(2)}  ${r.hit ? '정답 포함' : '⚠ 정답 놓침'}`)
}

fs.writeFileSync(path.join(OUT_DIR, 'design-constraint.json'), JSON.stringify({ n, hit, rows }, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'design-constraint.json')}`)
