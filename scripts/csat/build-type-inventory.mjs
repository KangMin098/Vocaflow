// scripts/csat/build-type-inventory.mjs
//
// **분모를 고정한다 — "현행 수능 영어의 유형은 몇 개인가".**
//
// 설계도의 달성률을 % 로 적으려면 분모가 먼저 필요하다. 그 분모를 문서가 아니라
// 기출에서 뽑는다. 규칙 하나: **2023~2026 4개년 중 한 번이라도 출제된 유형**.
//   - 4개년 전부 출제 = 35 (상시 유형)
//   - 3번 자리만 L-RELATION ↔ L-MAIN 로 번갈아 나온다 → +2
//   → **37 유형**
// 그 밖의 7 유형(L-TOPIC · L-FAVOR · L-MENTIONED · R-REFER · R-BLANK2 · X-BLANK · X-BLANK2)은
// 2022 이전에 끊겼다. 설계도의 분모에서 뺀다 — 다만 목록에는 남겨 근거를 남긴다.
//
// 실행: node scripts/csat/build-type-inventory.mjs

import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('scripts/csat/data')
const c = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8'))
const RECENT = ['2023', '2024', '2025', '2026']
const meta = Object.fromEntries(c.types.map((t) => [t.id, t]))

const agg = {}
for (const r of c.rows) {
  const a = (agg[r.type] ??= { type: r.type, n: 0, exams: new Set(), recent: new Set(), nos: new Set(), high: 0 })
  a.n += 1
  a.exams.add(r.exam)
  if (RECENT.includes(r.exam)) a.recent.add(r.exam)
  a.nos.add(r.no)
  if (r.high_score) a.high += 1
}

const rows = Object.values(agg).map((a) => ({
  type: a.type,
  name: meta[a.type]?.name ?? '?',
  sec: meta[a.type]?.sec ?? '?',
  n14: a.n,
  exams: a.exams.size,
  recentExams: a.recent.size,
  current: a.recent.size > 0,
  always: a.recent.size === RECENT.length,
  nos: [...a.nos].sort((x, y) => x - y),
  highScore: a.high,
}))
rows.sort((a, b) => (b.current - a.current) || (a.nos[0] - b.nos[0]) || (b.n14 - a.n14))

const current = rows.filter((r) => r.current)
const out = {
  builtFrom: 'scripts/csat/data/classified.json',
  exams: c.scope,
  rule: '2023~2026 4개년 중 1회 이상 출제된 유형 = 현행 유형(분모)',
  denominator: current.length,
  always: rows.filter((r) => r.always).length,
  retired: rows.filter((r) => !r.current).map((r) => r.type),
  perExamSlots: 45,
  rows,
}
fs.writeFileSync(path.join(DIR, 'type-inventory.json'), JSON.stringify(out, null, 1))

console.log(`현행 유형(분모) = ${out.denominator}  (상시 ${out.always} + 교대 ${out.denominator - out.always})`)
console.log(`폐지 유형 ${out.retired.length}: ${out.retired.join(' ')}`)
console.log('\ntype\tname\tsec\tn14\t회차\t최근4\t문항번호\t3점')
for (const r of current) console.log([r.type, r.name, r.sec, r.n14, r.exams, r.recentExams, r.nos.join('/'), r.highScore].join('\t'))
console.log(`\n→ ${path.join(DIR, 'type-inventory.json')}`)
