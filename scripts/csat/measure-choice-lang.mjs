// scripts/csat/measure-choice-lang.mjs
//
// **선택지 언어가 난도 부여와 어떻게 맞물리는가 — 읽기 전용.**
//
// 왜 이 가설인가. 개념 계측에서 눈에 걸린 것이 있다:
//   글의 요지 R-GIST  3점률  0.0%  (선택지 한글)
//   글의 주제 R-TOPIC 3점률 28.6%  (선택지 영어)
// 둘 다 같은 개념(C2)이고 같은 길이의 지문에서 사실상 같은 것을 묻는데 3점률이 갈린다.
// 다른 것은 **선택지가 무슨 언어인가** 하나다.
//
// ⚠️ 앞선 탐색에서 집계가 심슨의 역설로 뒤집힌 적이 있다(3점의 76%가 빈칸이었다).
//    그래서 언어 조합을 **하나도 빠짐없이** 세고, 합계가 13회차×10=130 과 맞는지 확인한다.
//    (첫 판은 en/ko/sym/mix 넷만 세어 3점 116개만 잡았다 — 'neutral' 59문항이 통째로 빠져 있었다.
//     범주를 손으로 나열하면 이렇게 샌다. 데이터에 있는 값을 전수로 돌 것.)
// ⚠️ blueprint.json 의 `blueprint` 는 **배열**이다. type 으로 색인해야 한다.
//
// 실행: pnpm dlx tsx scripts/csat/measure-choice-lang.mjs

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const R = (f) => JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'))

const bp = Object.fromEntries(R('blueprint.json').blueprint.map((x) => [x.type, x]))
const classified = R('classified.json')
const answers = R('answers.json').answers
const concepts = R('curriculum-concepts.json').concepts
const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))
const typeToConcept = new Map()
for (const c of concepts) for (const t of c.types) typeToConcept.set(t, c.id)

/** 선택지 언어 조합을 원본 그대로. 없으면 '(그림)' — 선택지가 이미지인 유형이 있다. */
const langOf = (type) => {
  const L = bp[type]?.constraints?.choice_lang
  return !L || !L.length ? '(그림)' : L.join('+')
}

const rows = classified.rows
  .filter((r) => r.exam !== '2014A' && key.has(`${r.exam}#${r.no}`))
  .map((r) => ({
    type: r.type,
    section: bp[r.type]?.section === '듣기' ? '듣기' : '읽기',
    concept: typeToConcept.get(r.type) ?? '??',
    lang: langOf(r.type),
    hasKo: langOf(r.type).split('+').includes('ko'),
    three: key.get(`${r.exam}#${r.no}`).points === 3,
  }))

const pc = (rs) => (rs.length ? (100 * rs.filter((r) => r.three).length / rs.length).toFixed(1) + '%' : '  -  ')
const n3 = (rs) => rs.filter((r) => r.three).length

// ── 언어 조합 전수 ───────────────────────────────────────────────────
console.log('선택지 언어 조합 전수 — 3점이 어디에 붙는가')
console.log('─'.repeat(76))
const combos = new Map()
for (const r of rows) {
  const c = combos.get(r.lang) ?? { n: 0, three: 0, types: new Set() }
  c.n += 1; if (r.three) c.three += 1; c.types.add(r.type)
  combos.set(r.lang, c)
}
let tot = 0, t3 = 0
const table = []
for (const [k, c] of [...combos].sort((a, b) => b[1].three - a[1].three)) {
  tot += c.n; t3 += c.three
  table.push({ lang: k, n: c.n, three: c.three, types: [...c.types] })
  console.log(
    `  ${k.padEnd(12)} ${String(c.n).padStart(4)}문항  3점 ${String(c.three).padStart(3)}` +
      `  ${((100 * c.three / c.n).toFixed(1) + '%').padStart(7)}  ${c.types.size}종`,
  )
}
console.log('─'.repeat(76))
const ok = tot === rows.length && t3 === 130
console.log(`  합계 ${tot}문항 · 3점 ${t3}  ${ok ? '✓ 13회차×10=130 과 일치 — 새는 범주 없음' : '⚠ 합계가 안 맞는다'}`)

// ── 핵심 관찰 ────────────────────────────────────────────────────────
const withKo = rows.filter((r) => r.hasKo)
const noKo = rows.filter((r) => !r.hasKo)
console.log('')
console.log('선택지에 한글이 섞이는가')
console.log('─'.repeat(76))
console.log(`  한글 있음  ${String(withKo.length).padStart(3)}문항 (${(100 * withKo.length / rows.length).toFixed(0)}%)  3점 ${String(n3(withKo)).padStart(3)}  ${pc(withKo).padStart(7)}`)
console.log(`  한글 없음  ${String(noKo.length).padStart(3)}문항 (${(100 * noKo.length / rows.length).toFixed(0)}%)  3점 ${String(n3(noKo)).padStart(3)}  ${pc(noKo).padStart(7)}`)

// ── 층화 — 개념마다, 영역마다 예외가 있는가 ──────────────────────────
console.log('')
console.log('층화 — 어느 층에서도 한글 선택지에 3점이 붙지 않는가')
console.log('─'.repeat(76))
const strata = []
for (const sec of ['읽기', '듣기']) {
  for (const c of concepts) {
    const s = rows.filter((r) => r.section === sec && r.concept === c.id && r.hasKo)
    if (!s.length) continue
    strata.push({ section: sec, concept: c.id, n: s.length, three: n3(s) })
    console.log(`  ${sec}  ${c.id} ${c.name.slice(0, 18).padEnd(20)} 한글선택지 ${String(s.length).padStart(3)}문항 · 3점 ${n3(s)}`)
  }
}
const exceptions = strata.filter((s) => s.three > 0)
console.log(`  → 예외 ${exceptions.length}건`)

// ── 같은 개념 안 직접 대조 ───────────────────────────────────────────
console.log('')
console.log('가장 깨끗한 대조 — 같은 개념(C2), 같은 길이 지문, 사실상 같은 질문')
console.log('─'.repeat(76))
for (const t of ['R-TOPIC', 'R-TITLE', 'R-GIST', 'R-SUMMARY']) {
  const sub = rows.filter((r) => r.type === t)
  if (!sub.length) continue
  const nm = { 'R-TOPIC': '글의 주제', 'R-TITLE': '글의 제목', 'R-GIST': '글의 요지', 'R-SUMMARY': '요약문' }[t]
  console.log(`  ${nm.padEnd(8)} ${t.padEnd(11)} 선택지 ${langOf(t).padEnd(11)} 3점 ${String(n3(sub)).padStart(2)}/${sub.length}  ${pc(sub).padStart(7)}`)
}

console.log('')
console.log('판정')
console.log('─'.repeat(76))
console.log(`  관찰: 선택지에 한글이 들어간 ${withKo.length}문항에 13개년 3점이 **${n3(withKo)}건**. 예외 없다.`)
console.log('  ⚠️ 인과는 못 가른다 — 선택지 언어와 유형이 완전히 교락돼 있다.')
console.log('     한글 선택지 유형(목적·주장·심경·요지·사실확인·안내문)은 원래 쉬운 유형들이고,')
console.log('     같은 유형에서 언어가 바뀐 회차가 없어 대조군을 만들 수 없다.')
console.log('  그래도 쓸모는 있다 — 이건 **출제자가 그 문항에서 무엇을 잴지 선언하는 장치**다.')
console.log('     한글 선택지 = "지문 이해까지만 잰다" · 영어 선택지 = "재진술 대조까지 잰다".')

fs.writeFileSync(path.join(OUT_DIR, 'choice-lang.json'), JSON.stringify(
  { total: rows.length, three: t3, combos: table, withKo: { n: withKo.length, three: n3(withKo) }, noKo: { n: noKo.length, three: n3(noKo) }, strata, exceptions },
  null, 1,
))
console.log(`\n→ ${path.join(OUT_DIR, 'choice-lang.json')}`)
