// scripts/csat/measure-concepts.mjs
//
// **개념 6개(2015 개정 읽기 성취기준)를 13개년으로 계측한다 — 읽기 전용.**
//
// C3(내용의 논리적 관계)는 이미 설계도가 있다(docs/CSAT_CONCEPT_C3_LOGIC.md).
// 나머지 5개 설계도를 쓰기 전에 **같은 잣대로 한 번에 재서** 무게 순서를 확정한다.
//
// 재는 것
//   · 회차당 문항 수 · 3점 부여율 · **앞 6회 → 뒤 6회 이동** (난도 배분이 어디로 갔나)
//   · 개념 안 유형별 3점률 (개념 평균이 유형 편차를 가리는지)
//   · 정답 번호 분포 (밑줄 내장형의 ①-회피가 개념 단위로도 보이는지)
//
// ⚠️ 3점은 실제 정답률이 아니라 **출제자가 부여한 것**이다.
//    "출제자가 무엇을 어렵다고 보는가" 의 기록이지 학습자가 어디서 틀리는지가 아니다.
//
// 실행: pnpm dlx tsx scripts/csat/measure-concepts.mjs

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const R = (f) => JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'))

const classified = R('classified.json')
const answers = R('answers.json').answers
const concepts = R('curriculum-concepts.json').concepts
const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))

const EARLY = new Set(['2014B', '2015', '2016', '2017', '2018', '2019'])
const INLINE = new Set(['R-GRAMMAR', 'R-VOCAB', 'R-IRRELEVANT', 'X-VOCAB', 'X-REFER', 'R-REFER', 'R-INSERT'])

const typeToConcept = new Map()
for (const c of concepts) for (const t of c.types) typeToConcept.set(t, c.id)

const rows = classified.rows
  .filter((r) => r.exam !== '2014A' && key.has(`${r.exam}#${r.no}`))
  .map((r) => ({
    ...r,
    concept: typeToConcept.get(r.type) ?? '??',
    points: key.get(`${r.exam}#${r.no}`).points,
    answer: key.get(`${r.exam}#${r.no}`).answer,
    early: EARLY.has(r.exam),
  }))

const unmapped = rows.filter((r) => r.concept === '??')
const exams = new Set(rows.map((r) => r.exam)).size

const pct = (n, d) => (d ? (100 * n / d).toFixed(1) + '%' : '  -  ')
const rate = (rs) => (rs.length ? rs.filter((r) => r.points === 3).length / rs.length : 0)

console.log(`대상 ${rows.length}문항 · ${exams}회차 · 개념 미배정 ${unmapped.length}`)
if (unmapped.length) {
  const t = [...new Set(unmapped.map((u) => u.type))]
  console.log(`  미배정 유형: ${t.join(' · ')}`)
}
console.log('')
console.log('개념별 무게 — 3점 부여율과 그 이동')
console.log('─'.repeat(78))
console.log('  개념                          회차당   3점률    앞6회 → 뒤6회      이동')

const summary = []
for (const c of [...concepts].sort((a, b) => rate(rows.filter((r) => r.concept === b.id)) - rate(rows.filter((r) => r.concept === a.id)))) {
  const rs = rows.filter((r) => r.concept === c.id)
  const e = rs.filter((r) => r.early), l = rs.filter((r) => !r.early)
  const re = rate(e), rl = rate(l), d = rl - re
  const arrow = Math.abs(d) < 0.05 ? '─' : d > 0 ? '↑' : '↓'
  console.log(
    `  ${c.id} ${c.name.padEnd(24)} ${(rs.length / exams).toFixed(1).padStart(5)}` +
      ` ${pct(rs.filter((r) => r.points === 3).length, rs.length).padStart(7)}` +
      `  ${pct(e.filter((r) => r.points === 3).length, e.length).padStart(6)} → ${pct(l.filter((r) => r.points === 3).length, l.length).padStart(6)}` +
      `  ${arrow} ${(100 * d).toFixed(1).padStart(6)}%p`,
  )
  summary.push({ id: c.id, name: c.name, n: rs.length, perExam: rs.length / exams, rate: rate(rs), early: re, late: rl, delta: d })
}

console.log('')
console.log('개념 안 유형별 — 개념 평균이 편차를 가리는가')
console.log('─'.repeat(78))
const perType = []
for (const c of concepts) {
  const rs = rows.filter((r) => r.concept === c.id)
  const ts = [...new Set(rs.map((r) => r.type))]
    .map((t) => {
      const sub = rs.filter((r) => r.type === t)
      const e = sub.filter((r) => r.early), l = sub.filter((r) => !r.early)
      return { type: t, n: sub.length, rate: rate(sub), early: rate(e), late: rate(l), ne: e.length, nl: l.length }
    })
    .sort((a, b) => b.rate - a.rate)
  perType.push({ concept: c.id, types: ts })
  const span = ts.length ? 100 * (ts[0].rate - ts[ts.length - 1].rate) : 0
  console.log(`  ${c.id} ${c.name}  — 유형 ${ts.length}종 · 3점률 폭 ${span.toFixed(0)}%p`)
  for (const t of ts.filter((x) => x.n >= 4)) {
    const mv = t.ne >= 3 && t.nl >= 3 ? `  ${pct(0, 0).trim() && ''}${(100 * t.early).toFixed(0)}%→${(100 * t.late).toFixed(0)}%` : ''
    console.log(`      ${t.type.padEnd(14)} ${String(t.n).padStart(3)}문항  ${pct(Math.round(t.rate * t.n), t.n).padStart(7)}${mv}`)
  }
}

console.log('')
console.log('정답 번호 — 개념별 (밑줄 내장형은 ①이 비어야 한다)')
console.log('─'.repeat(78))
const choiceDist = []
for (const c of concepts) {
  const rs = rows.filter((r) => r.concept === c.id)
  const inl = rs.filter((r) => INLINE.has(r.type)), sep = rs.filter((r) => !INLINE.has(r.type))
  const d = (sub) => {
    const t = [0, 0, 0, 0, 0, 0]
    for (const r of sub) t[r.answer] += 1
    return t
  }
  const di = d(inl), ds = d(sep)
  choiceDist.push({ concept: c.id, inline: di, separate: ds })
  if (inl.length) console.log(`  ${c.id} 밑줄내장 ${String(inl.length).padStart(3)}문항  ①${String(di[1]).padStart(3)} ②${String(di[2]).padStart(3)} ③${String(di[3]).padStart(3)} ④${String(di[4]).padStart(3)} ⑤${String(di[5]).padStart(3)}`)
  if (sep.length) console.log(`  ${c.id} 선택지분리 ${String(sep.length).padStart(2)}문항  ①${String(ds[1]).padStart(3)} ②${String(ds[2]).padStart(3)} ③${String(ds[3]).padStart(3)} ④${String(ds[4]).padStart(3)} ⑤${String(ds[5]).padStart(3)}`)
}

fs.writeFileSync(path.join(OUT_DIR, 'concept-weights.json'), JSON.stringify({ exams, total: rows.length, summary, perType, choiceDist }, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'concept-weights.json')}`)
