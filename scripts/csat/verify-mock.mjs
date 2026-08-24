// scripts/csat/verify-mock.mjs
//
// **HARD 10 을 모의평가에 건다 — 사후 서술이 아니라 예측이다.**
//
// 규칙 열 개는 전부 **수능 14회차에서** 도출했다. 모의평가는 규칙 도출에
// 한 번도 쓰이지 않았으므로, 여기서 나오는 결과는 설명이 아니라 **예측의 적중/실패**다.
//
//   통과하면 → 이 규칙들은 수능 한 시험의 관행이 아니라 **평가원 설계의 일반 규칙**이다
//   깨지면   → 그 규칙은 수능 본시험 전용이고, 그것도 발견이다
//              (모평은 본시험과 목적이 다르다 — 난이도 탐색이지 선발이 아니다)
//
// 실행: pnpm dlx tsx scripts/csat/verify-mock.mjs

import fs from 'node:fs'
import path from 'node:path'
import { SPEC } from './design-spec.mjs'

const DIR = path.resolve('scripts/csat/data')
const R = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))

// E4·E7 이 `exam.slice(0,4)` 로 학년도를 읽으므로 그 형태로 이름을 붙인다
const LABEL = { M2606: '2026-06', M2609: '2026-09', M2706: '2027-06', M2509: '2025-09' }

const bp = Object.fromEntries(R('blueprint.json').blueprint.map((x) => [x.type, x]))
const qs = R('mock-questions.json').rows
const key = new Map(R('mock-answers.json').answers.map((a) => [`${a.exam}#${a.no}`, a]))

const items = qs
  .filter((r) => r.type && key.has(`${r.exam}#${r.no}`))
  .map((r) => {
    const a = key.get(`${r.exam}#${r.no}`)
    const lang = bp[r.type]?.constraints?.choice_lang ?? []
    return { exam: LABEL[r.exam] ?? r.exam, src: r.exam, no: r.no, type: r.type, answer: a.answer, points: a.points, choiceHasKo: lang.includes('ko') }
  })

const exams = [...new Set(items.map((i) => i.exam))].sort()
const violations = []
for (const exam of exams) {
  const ex = { exam, items: items.filter((i) => i.exam === exam) }
  for (const rule of SPEC.exam) {
    if (!rule.check(ex)) violations.push({ level: '회차', exam, rule: rule.id, name: rule.name })
  }
}
for (const it of items) {
  for (const rule of SPEC.item) {
    if (!rule.check(it)) violations.push({ level: '문항', exam: it.exam, no: it.no, type: it.type, rule: rule.id, name: rule.name })
  }
}

const checks = exams.length * SPEC.exam.length + items.length * SPEC.item.length
console.log('HARD 10 을 모의평가에 건다 — 순수 홀드아웃')
console.log('═'.repeat(76))
console.log(`  회차 ${exams.length} · 문항 ${items.length} · 검사 ${checks}건`)
console.log(`  ⚠️ 이 회차들은 규칙 도출에 **한 번도 쓰이지 않았다.** 결과는 예측의 적중/실패다.`)
console.log()

console.log('  회차별')
for (const exam of exams) {
  const ex = items.filter((i) => i.exam === exam)
  const v = violations.filter((x) => x.exam === exam)
  const listen = ex.filter((i) => i.type.startsWith('L-')).length
  const p3 = ex.filter((i) => i.points === 3).length
  const dist = [0, 0, 0, 0, 0, 0]; for (const i of ex) dist[i.answer] += 1
  console.log(
    `    ${exam}  문항 ${String(ex.length).padStart(2)} · 듣기 ${String(listen).padStart(2)} · 3점 ${String(p3).padStart(2)} · ` +
    `정답분포 ${dist.slice(1).join('/')}  ${v.length ? '✗ ' + v.map((x) => x.rule).join(',') : '통과'}`,
  )
}
console.log()

console.log('  규칙별')
const byRule = {}
for (const r of [...SPEC.exam, ...SPEC.item]) byRule[r.id] = { name: r.name, n: 0 }
for (const v of violations) byRule[v.rule].n += 1
for (const [id, v] of Object.entries(byRule)) {
  console.log(`    ${v.n === 0 ? '✓' : '✗'} ${id.padEnd(3)} ${v.name}${v.n ? `  — 위반 ${v.n}건` : ''}`)
}
console.log()

if (violations.length === 0) {
  console.log('  **위반 0건 — 규칙 도출에 안 쓴 회차에서도 예외가 없다.**')
  console.log('  → HARD 10 은 수능 본시험 전용 관행이 아니라 평가원 설계의 일반 규칙이다.')
} else {
  console.log(`  **위반 ${violations.length}건**`)
  for (const v of violations) {
    console.log(`    ${v.exam}${v.no ? '#' + v.no : ''} ${v.rule} — ${v.name}${v.type ? ` (${v.type})` : ''}`)
  }
  console.log()
  console.log('  → 깨진 규칙은 본시험 전용일 수 있다. 모평은 목적이 다르다(난이도 탐색 vs 선발).')
}

fs.writeFileSync(path.join(DIR, 'mock-verify.json'), JSON.stringify({ exams, items: items.length, checks, violations }, null, 1))
console.log(`\n→ ${path.join(DIR, 'mock-verify.json')}`)
