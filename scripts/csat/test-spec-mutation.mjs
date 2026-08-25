// scripts/csat/test-spec-mutation.mjs
//
// **설계기준의 자기 점검 — 규칙이 항진명제인지 돌연변이로 검사한다.**
//
// 왜. E4 가 항진명제였다. `문항 번호가 17 이하인 것이 17개인가` 는 1~45 번호가 있으면
// 언제나 참이라, 2014 가 실제로는 **듣기 22문항**인데도 통과했다.
// **"위반 0" 이 규칙이 옳아서인지 규칙이 공허해서인지 구분되지 않았다.**
//
// 방법(돌연변이 검사). 규칙마다 **그 규칙을 어기도록 자료를 한 군데 비튼 판**을 만들어 넣는다.
//   · 비튼 판을 검증기가 **잡으면** → 그 규칙은 반증 가능하다. 유효한 검사다.
//   · 비튼 판도 **통과하면** → 그 규칙은 어떤 입력으로도 실패할 수 없다. 항진명제다.
//
// 이건 "규칙이 맞는가" 가 아니라 **"규칙이 무언가를 주장하고 있는가"** 를 묻는 검사다.
// 새 규칙을 넣을 때마다 여기에도 돌연변이를 하나 추가한다.
//
// 실행: pnpm dlx tsx scripts/csat/test-spec-mutation.mjs

import fs from 'node:fs'
import path from 'node:path'
import { SPEC, SEQUENTIAL_TYPES } from './design-spec.mjs'

const OUT_DIR = path.resolve('scripts/csat/data')
const R = (f) => JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'))

const bp = Object.fromEntries(R('blueprint.json').blueprint.map((x) => [x.type, x]))
const classified = R('classified.json')
const answers = R('answers.json').answers
const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))

const allItems = classified.rows
  .filter((r) => key.has(`${r.exam}#${r.no}`))
  .map((r) => {
    const a = key.get(`${r.exam}#${r.no}`)
    const lang = bp[r.type]?.constraints?.choice_lang ?? []
    return { exam: r.exam, no: r.no, type: r.type, answer: a.answer, points: a.points, choiceHasKo: lang.includes('ko') }
  })

const EXAM = '2026'
const baseItems = allItems.filter((i) => i.exam === EXAM)
const clone = () => baseItems.map((i) => ({ ...i }))

/** 규칙 하나를 원본과 돌연변이 양쪽에 걸어 본다 */
function run(ruleId, mutate) {
  const rule = [...SPEC.exam, ...SPEC.item].find((r) => r.id === ruleId)
  const level = SPEC.exam.includes(rule) ? 'exam' : 'item'
  const check = (items) =>
    level === 'exam'
      ? rule.check({ exam: EXAM, items })
      : items.every((it) => rule.check(it))
  const before = check(baseItems)
  const mutated = mutate(clone())
  const after = check(mutated)
  return { id: ruleId, name: rule.name, before, after, ok: before === true && after === false }
}

// 규칙마다 '어기는 입력' 을 하나씩 만든다
const MUT = {
  E1: (it) => it.slice(0, 44),                                            // 문항 하나 제거
  E2: (it) => { it.find((x) => x.points === 2).points = 3; return it },     // 3점을 11개로
  E3: (it) => { it[0].points = 1; return it },                             // 1점 도입
  E4: (it) => { it.find((x) => x.type.startsWith('L-')).type = 'R-FACT'; return it }, // 듣기 하나를 읽기로
  E5: (it) => { for (const x of it) x.answer = 1; return it },             // 정답을 전부 ①로
  E6: (it) => { it.find((x) => x.no === 41).type = 'R-BLANK'; return it },  // 장문 41 유형 교체
  E7: (it) => { const b = it.filter((x) => x.type === 'R-BLANK' && x.points === 3); if (b[0]) b[0].points = 2; return it }, // 빈칸 3점을 1개로
  // 29(어휘어법) 자리에 빈칸 유형을 놓는다 — 번호→능력군 고정을 어긴다
  E8: (it) => { const x = it.find((y) => y.no === 29); if (x) x.type = 'R-BLANK'; return it },
  // 34번 3점을 2점으로 — 유형군 마지막 자리 고정을 어긴다
  E9: (it) => { const x = it.find((y) => y.no === 34); if (x) x.points = 2; return it },
  I1: (it) => { it[0].answer = 6; return it },                            // 정답 6번
  I2: (it) => { it.find((x) => SEQUENTIAL_TYPES.includes(x.type)).answer = 1; return it }, // 순서대응형 ①
  I3: (it) => { it.find((x) => x.choiceHasKo).points = 3; return it },      // 한글 선택지에 3점
}

console.log('설계기준 돌연변이 검사 — 규칙이 무언가를 주장하고 있는가')
console.log('═'.repeat(78))
console.log(`  기준 회차 ${EXAM} · 규칙 ${Object.keys(MUT).length}개`)
console.log('')
console.log('  규칙  원본   돌연변이   판정')
const results = []
for (const [id, mutate] of Object.entries(MUT)) {
  const r = run(id, mutate)
  results.push(r)
  const verdict = !r.before ? '⚠ 원본이 이미 실패 — 규칙이나 자료가 잘못됐다'
    : r.after ? '✗ **항진명제** — 어기는 입력도 통과한다'
      : '✓ 반증 가능'
  console.log(`  ${id.padEnd(5)} ${r.before ? '통과' : '실패'}   ${r.after ? '통과' : '실패'}       ${verdict}`)
}
console.log('')
const bad = results.filter((r) => !r.ok)
console.log('─'.repeat(78))
if (!bad.length) {
  console.log(`  **${results.length}/${results.length} 규칙 전부 반증 가능하다.**`)
  console.log('  각 규칙마다 그것을 어기는 입력이 존재하고, 검증기가 그것을 잡아낸다.')
  console.log('  → "위반 0" 이 공허하지 않다.')
} else {
  console.log(`  문제 있는 규칙 ${bad.length}개:`)
  for (const r of bad) console.log(`    ${r.id} ${r.name}`)
}

fs.writeFileSync(path.join(OUT_DIR, 'spec-mutation.json'), JSON.stringify({ exam: EXAM, results }, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'spec-mutation.json')}`)
