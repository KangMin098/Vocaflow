// scripts/csat/test-p621-implication.mjs
//
// **P6.21 — "함축(21)은 비유를 직설로 번역한 것이 정답" 을 전수로 건다.**
//
// 명제를 반증 가능한 둘로 가른다.
//
//   A. 밑줄 어구가 **비유**인가 (직접 읽어 판정 — 의미 수준)
//   B. **정답이 비유의 낱말을 버리는가** — 그리고 **오답은 되받는가**
//
// B 가 이 명제의 값어치다. A 만으로는 아무것도 좁히지 못한다(비유인 건 발문이 이미 알려 준다).
// B 는 기저가 필요하다 — 다섯 선택지 **전부**가 비유 낱말을 안 쓴다면 정답의 성질이 아니다.
// 그래서 정답과 오답 넷을 **같은 자로** 잰다.
//
// 실행: pnpm dlx tsx scripts/csat/test-p621-implication.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, choicesOf, answerOf } from './lib-passage.mjs'
import { fisher, report } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')

// 밑줄 어구 — 발문에서 뽑으면 한글이 섞여 깨지므로 직접 적는다(8문항뿐).
// figurative: 비유인가 (Claude Code 판정, CLAUDE.md §🤖)
const ITEMS = [
  { exam: '2019', phrase: 'refining ignorance', figurative: true, why: '역설적 결합 — 무지를 다듬는다' },
  { exam: '2020', phrase: 'playing intellectual air guitar', figurative: true, why: '은유 — air guitar' },
  { exam: '2021', phrase: "the role of the lion's historians", figurative: true, why: '우화 인유 — 사자의 역사가' },
  { exam: '2022', phrase: 'whether to make ready for the morning commute or not', figurative: false, why: '문자 그대로의 사례 서술 — 비유가 아니다' },
  { exam: '2023', phrase: 'make oneself public to oneself', figurative: true, why: '역설 — 자신에게 자신을 공개한다' },
  { exam: '2024', phrase: 'a nonstick frying pan', figurative: true, why: '은유 — 눌어붙지 않는 프라이팬' },
  { exam: '2025', phrase: 'hunting the shadow, not the substance', figurative: true, why: '관용적 은유 — 그림자를 좇다' },
  { exam: '2026', phrase: 'made a lot of work less sticky', figurative: true, why: '은유 — 일이 덜 끈적해졌다' },
]

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'not', 'is', 'be', 'it',
  'that', 'this', 'with', 'as', 'by', 'at', 'from', 'its', 'their', 'one', 'oneself', 'less', 'more', 'make',
  'made', 'whether', 'lot', 'role', 'ready'])
const words = (s) => [...new Set((s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)))]
/** 어간 대충 맞추기 — refining/refine, historians/historian */
const stem = (w) => w.replace(/(ing|ers|er|ies|es|s|ed|al|ic)$/, '')
const overlap = (a, b) => {
  const B = new Set(b.map(stem))
  return a.map(stem).filter((w) => B.has(w))
}

const rows = []
for (const it of ITEMS) {
  const b = itemBlocks(it.exam, 21)[0]
  const ch = b ? choicesOf(b) : null
  const ans = answerOf(it.exam, 21)
  if (!ch || !ans) { rows.push({ ...it, ok: false }); continue }
  const pw = words(it.phrase)
  const per = ch.map((c, i) => {
    const ov = overlap(words(c), pw)
    return { i: i + 1, isAns: i + 1 === ans.answer, n: ov.length, shared: ov, text: c.replace(/\s+/g, ' ').slice(0, 58) }
  })
  rows.push({ ...it, ok: true, answer: ans.answer, per })
}

const good = rows.filter((r) => r.ok)
console.log('P6.21 — 함축: 정답은 비유의 낱말을 버리는가, 오답은 되받는가')
console.log('='.repeat(78))
console.log()

let ansReuse = 0, ansTot = 0, disReuse = 0, disTot = 0
for (const r of good) {
  console.log(`  ${r.exam}  "${r.phrase}"   ${r.figurative ? '비유' : '⚠ 비유 아님'} — ${r.why}`)
  for (const c of r.per) {
    const mark = c.isAns ? '정답' : '오답'
    if (c.isAns) { ansTot += 1; if (c.n) ansReuse += 1 } else { disTot += 1; if (c.n) disReuse += 1 }
    console.log(`      ${mark} ${c.i}  겹침 ${c.n}${c.n ? ' [' + c.shared.join(',') + ']' : ''}   ${c.text}`)
  }
  console.log()
}

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)
const fig = good.filter((r) => r.figurative).length
console.log('  ' + '-'.repeat(74))
console.log(`  A. 밑줄 어구가 비유: ${fig}/${good.length} = ${pct(fig, good.length)}%  (예외: 2022 — 문자 그대로의 사례)`)
console.log(`  B. 비유 낱말을 되받은 비율`)
console.log(`       정답 ${ansReuse}/${ansTot} = ${pct(ansReuse, ansTot)}%`)
console.log(`       오답 ${disReuse}/${disTot} = ${pct(disReuse, disTot)}%`)
const p = fisher(ansReuse, ansTot - ansReuse, disReuse, disTot - disReuse)
console.log(`     Fisher p = ${p.toFixed(4)}`)
console.log()

report({
  name: 'P6.21 — 정답은 비유의 낱말을 버리고 오답은 되받는다  [검사]',
  hit: ansTot - ansReuse, n: ansTot, baseRate: (disTot - disReuse) / disTot, shape: 'two-proportions',
  table: [ansTot - ansReuse, ansReuse, disTot - disReuse, disReuse],
  falsifier: '오답도 정답만큼 비유 낱말을 버리면 깨진다 — 정답의 성질이 아니라 선지 일반의 성질이다',
  subgroups: [
    { label: '2019~2022', hit: good.slice(0, 4).filter((r) => !r.per.find((c) => c.isAns).n).length, n: 4 },
    { label: '2023~2026', hit: good.slice(4).filter((r) => !r.per.find((c) => c.isAns).n).length, n: good.length - 4 },
  ],
  perExam: good.map((r) => ({ exam: r.exam, hit: r.per.find((c) => c.isAns).n ? 0 : 1, n: 1 })),
})

fs.writeFileSync(path.join(DIR, 'p621-implication.json'), JSON.stringify({ fig, ansReuse, ansTot, disReuse, disTot, p, rows }, null, 1))
console.log(`→ ${path.join(DIR, 'p621-implication.json')}`)
