// scripts/csat/export-bait-blind.mjs
//
// **의미 수준 오답 판독용 — 배점을 가린 표본을 뽑는다.**
//
// §6.12 는 **어휘 유사도**로 "미끼는 정답이 아니라 지문을 닮는다" 를 봤다(raw p=0.0054).
// 그러나 어휘 도구는 **같은 뜻 다른 낱말**을 못 잡는다 — 선지의 32%가 지문과 0겹침이다.
// 의미 수준에서도 같은 결론이 나오는지 보려면 사람이 읽어야 한다(CLAUDE.md §🤖).
//
// ⚠️ **배점만 가린다** — 정답은 보여야 '정답과 가까운 오답' 을 판정할 수 있다.
// ⚠️ 배점을 가리는 이유: 3점인 줄 알고 읽으면 "어려워 보인다" 로 판정이 끌려간다.
//    판독이 끝난 뒤에 `score-bait-blind.mjs` 가 배점을 붙여 대조한다.
//
// ⚠️ 표본은 **결정적 규칙**으로 뽑는다(난수 없음) — 재현 가능해야 하고,
//    3점/2점이 섞이되 판독자가 그 비율을 모르게 한다.
//
// 실행: pnpm dlx tsx scripts/csat/export-bait-blind.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, choicesOf, answerOf, allRows } from './lib-passage.mjs'

const DIR = path.resolve('scripts/csat/data')
const TYPES = ['R-BLANK', 'R-TOPIC', 'R-TITLE', 'R-IMPLY', 'R-SUMMARY']

const pool = []
for (const r of allRows().filter((x) => TYPES.includes(x.type))) {
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) continue
  const p = passageOf(b), ch = choicesOf(b), a = answerOf(r.exam, r.no)
  if (p.length < 300 || !ch || !ch.every((c) => c.trim().length > 8) || !a || a.answer < 1 || a.answer > 5) continue
  pool.push({ exam: r.exam, no: r.no, type: r.type, points: a.points, answer: a.answer, passage: p, choices: ch })
}

// 결정적 표집 — 유형별로 고르게, 3점/2점을 섞되 순서는 exam#no 로 정렬해 흔든다
pool.sort((a, b) => `${a.type}${a.exam}${a.no}`.localeCompare(`${b.type}${b.exam}${b.no}`))
const want = 24
const step = Math.max(1, Math.floor(pool.length / want))
const sample = pool.filter((_, i) => i % step === 0).slice(0, want)
// 판독 순서를 배점과 무관하게 — exam 문자열 해시로 정렬
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100000, 7)
sample.sort((a, b) => hash(`${a.exam}#${a.no}`) - hash(`${b.exam}#${b.no}`))

/**
 * ⚠️ **블라인드를 지키는 함수.** 지문·선지에 `[3점]` 이 그대로 남아 있어서
 *    첫 판은 배점이 새어 나갔다(4·5번에서 눈으로 확인). 닫는 괄호가 없는 `[3점` 도 있다.
 *    저작권 문구·쪽번호도 판독에 방해가 되므로 함께 걷어낸다.
 */
const clean = (s) => s
  .replace(/\[\s*3\s*점\s*\]?/g, '')
  .replace(/이 문제지에 관한 저작권은[\s\S]*/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const L = []
L.push('# 오답 미끼 — 의미 수준 판독 (배점 가림)')
L.push('')
L.push('각 문항에서 **오답 넷**을 보고 둘을 판정한다:')
L.push('')
L.push('  A. **정답과 의미가 가까운가** (같은 뜻 다른 낱말 포함) — 예/아니오')
L.push('  B. **지문 내용을 물고 있는가** (지문에 나온 개념·사례를 재사용) — 예/아니오')
L.push('')
L.push('가장 강한 미끼 하나를 고르고, 그것이 A 형인지 B 형인지 적는다.')
L.push('⚠️ 배점은 가려져 있다. 판독 뒤 `score-bait-blind.mjs` 가 붙인다.')
L.push('')
sample.forEach((it, i) => {
  L.push('---')
  L.push('')
  L.push(`## ${i + 1}. ${it.exam}#${it.no}  (${it.type})`)
  L.push('')
  L.push('**지문**')
  L.push('')
  L.push(clean(it.passage))
  L.push('')
  L.push('**선택지** — ★ 가 정답 (배점은 가림)')
  L.push('')
  it.choices.forEach((c, k) => L.push(
    `  ${k + 1}.${k + 1 === it.answer ? ' ★' : '  '} ${clean(c)}`,
  ))
  L.push('')
})

const out = path.join(DIR, 'bait-blind.md')
fs.writeFileSync(out, L.join('\n'))
fs.writeFileSync(path.join(DIR, 'bait-blind-key.json'), JSON.stringify({
  n: sample.length,
  items: sample.map((x, i) => ({ idx: i + 1, exam: x.exam, no: x.no, type: x.type, points: x.points, answer: x.answer })),
}, null, 1))

const p3 = sample.filter((x) => x.points === 3).length
console.log(`표본 ${sample.length}문항 (pool ${pool.length} 에서 결정적 표집)`)
console.log(`  → ${out}   ← 여기를 읽고 판정한다 (배점 가림)`)
console.log(`  → bait-blind-key.json  (배점·정답 — 판독 뒤에 쓴다. 3점 ${p3} · 2점 ${sample.length - p3})`)
