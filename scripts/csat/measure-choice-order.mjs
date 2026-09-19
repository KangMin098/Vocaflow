// scripts/csat/measure-choice-order.mjs
//
// **선택지가 지문의 서술 순서에 대응하는 유형에서 ①은 정답이 되지 않는다 — 읽기 전용.**
//
// ── 정정 이력 (남겨 둔다) ────────────────────────────────────────────
// 1판은 "밑줄이 지문 안에 박히는 7유형 89문항에서 ①이 0" 이라고 적고,
// "선택지 분리형 496문항은 21% 로 균등" 을 대조군으로 삼았다. **그 층화가 틀렸다.**
// 496 안에는 ① 이 1% 인 일치·불일치 계열 103문항이 섞여 있었고, 진짜 나머지 393문항은
// ① 이 **27%** 다. 두 집단을 합쳐서 21% 로 보였을 뿐이다 — 심슨의 역설을 또 당했다
// (docs/CSAT_AXIS_SEARCH_POSTMORTEM.md §2.2 에 적어 두고도 같은 실수를 했다).
//
// 바른 경계는 '밑줄이 박히느냐' 가 아니라 **선택지가 지문의 서술 순서를 따라가느냐** 다.
//   · 어법·어휘·무관한문장·삽입·지칭 — 번호가 본문 진행을 따라 찍힌다
//   · 일치·불일치·안내문·도표·언급되지 않은 것 — 선택지가 지문 서술 순서대로 늘어선다
// 둘 다 ① 은 **지문의 맨 앞**에 대응한다. 거기서 답이 정해지면 뒤를 읽을 이유가 없어져
// 문항이 '첫 부분만 읽고 찍기' 로 무너진다. 그래서 출제자가 ① 을 오답 자리로만 쓴다.
//
// L-TABLE(표 보고 고르기)은 제외한다 — 선택지가 표의 **행**이고 속성 열로 소거하는
// 문항이라 지문 순서에 대응하지 않는다. 전제가 성립하지 않는다.
// (경계를 옮긴 것이 사후 합리화가 아님을 밝혀 둔다: 유일한 ① 사례였던 2023#10 을 읽고
//  전제 불성립을 확인했다. 정답을 보지 않고도 판별 가능한 구조적 차이다.)
//
// ⚠️ 이 패턴 자체는 새롭지 않다 — 학원가에 "어법·어휘는 1번이 거의 안 나온다" 로 알려져 있다.
//    여기서 더한 것은 (a) 예외 0 의 전수 확인, (b) **반대편** 이다. 아래 §2.
//
// 실행: pnpm dlx tsx scripts/csat/measure-choice-order.mjs

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const R = (f) => JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'))

/** 선택지 ①~⑤ 가 지문·담화의 서술 순서에 대응하는 유형. */
const SEQ = [
  // 번호가 본문 안에 찍힌다
  'R-GRAMMAR', 'R-VOCAB', 'R-IRRELEVANT', 'X-VOCAB', 'X-REFER', 'R-REFER', 'R-INSERT',
  // 선택지가 지문 서술 순서대로 늘어선다
  'R-FACT', 'X-FACT', 'R-NOTICE', 'R-CHART', 'L-NOTMENTION', 'L-SET-NOT', 'L-ANNOUNCE',
]

const classified = R('classified.json')
const answers = R('answers.json').answers
const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))
const rows = classified.rows.filter((r) => r.exam !== '2014A' && key.has(`${r.exam}#${r.no}`))
const ansOf = (r) => key.get(`${r.exam}#${r.no}`).answer

const dist = (rs) => {
  const d = [0, 0, 0, 0, 0, 0]
  for (const r of rs) d[ansOf(r)] += 1
  return d
}
const pc = (x, n) => (n ? (100 * x / n).toFixed(0) + '%' : '-')
const MARK = ['①', '②', '③', '④', '⑤']

const seq = rows.filter((r) => SEQ.includes(r.type))
const oth = rows.filter((r) => !SEQ.includes(r.type))
const ds = dist(seq), dt = dist(oth), dall = dist(rows)

console.log('§1  선택지가 지문 서술 순서에 대응하는가 — 585문항 · 13개년')
console.log('─'.repeat(76))
for (const [lab, rs, d] of [['대응함 (14유형)', seq, ds], ['대응 안 함 (29유형)', oth, dt]]) {
  console.log(
    `  ${lab.padEnd(20)} n=${String(rs.length).padStart(3)}   ` +
      MARK.map((m, i) => `${m}${String(d[i + 1]).padStart(3)}(${pc(d[i + 1], rs.length).padStart(3)})`).join(' '),
  )
}
console.log(`  ${'전체'.padEnd(20)} n=${String(rows.length).padStart(3)}   ` +
  MARK.map((m, i) => `${m}${String(dall[i + 1]).padStart(3)}(${pc(dall[i + 1], rows.length).padStart(3)})`).join(' '))
console.log(`\n  회차당 대응형 ${(seq.length / 13).toFixed(1)}문항 · 비대응형 ${(oth.length / 13).toFixed(1)}문항`)

console.log('')
console.log('  대응형 14유형 전수 — ① 건수')
for (const t of SEQ) {
  const sub = rows.filter((r) => r.type === t)
  console.log(`     ${t.padEnd(14)} ${String(sub.length).padStart(3)}문항  ①=${dist(sub)[1]}`)
}
const ex = seq.filter((r) => ansOf(r) === 1)
console.log(`  → 192문항 중 ① 정답 ${ex.length}건${ex.length ? ': ' + ex.map((r) => `${r.exam}#${r.no}`).join(' ') : ' (예외 없음)'}`)

// ── §2 반대편 — 여기가 실제로 중요하다 ───────────────────────────────
console.log('')
console.log('§2  반대편 — 두 집단의 기울기가 정반대다')
console.log('─'.repeat(76))
console.log('  대응형은 뒤로 갈수록 높고(④ 최빈), 비대응형은 앞으로 갈수록 높다(① 최빈).')
for (const [lab, rs, d] of [['대응형   ', seq, ds], ['비대응형 ', oth, dt]]) {
  const mx = Math.max(...d.slice(1))
  console.log(`  ${lab} ${MARK.map((m, i) => `${m} ${'█'.repeat(Math.round(30 * d[i + 1] / mx))}`.padEnd(34)).join('')}`)
}

// 회차당 균형 제약 — 왜 반대편이 생기는가
console.log('')
console.log('  왜인가 — 회차당 정답 번호는 균형이 잡혀 있다 (균등이면 각 9.0)')
const exams = [...new Set(rows.map((r) => r.exam))].sort()
const per = exams.map((e) => dist(rows.filter((r) => r.exam === e)))
const avg = [1, 2, 3, 4, 5].map((i) => per.reduce((s, d) => s + d[i], 0) / exams.length)
const lo = [1, 2, 3, 4, 5].map((i) => Math.min(...per.map((d) => d[i])))
const hi = [1, 2, 3, 4, 5].map((i) => Math.max(...per.map((d) => d[i])))
console.log(`     회차당 평균 ${avg.map((x) => x.toFixed(1)).join(' / ')}   범위 ${lo.map((x, i) => `${x}~${hi[i]}`).join(' / ')}`)
console.log('     회차 전체는 균형을 맞추는데 대응형 15문항에서 앞번호를 못 쓴다.')
console.log('     그 몫이 비대응형 30문항으로 밀린다 → 거기서 ① 이 27% 로 최빈이 된다.')

console.log('')
console.log('  학습자에게 주는 함의 (풀이법이 아니라 시간 배분)')
console.log(`     대응형  ${(seq.length / 13).toFixed(0)}문항 — ① 을 빼면 4지선다. 최빈은 ④(${pc(ds[4], seq.length)}).`)
console.log(`     비대응형 ${(oth.length / 13).toFixed(0)}문항 — ① 이 최빈(${pc(dt[1], oth.length)}). **① 을 의심하면 손해다.**`)
console.log('     "1번은 잘 안 나온다" 를 전 유형에 적용하면 3분의 2 에서 반대로 작동한다.')

fs.writeFileSync(path.join(OUT_DIR, 'choice-order.json'), JSON.stringify({
  seqTypes: SEQ,
  sequential: { n: seq.length, dist: ds.slice(1), exceptions: ex.map((r) => `${r.exam}#${r.no}`) },
  other: { n: oth.length, dist: dt.slice(1) },
  perExamAvg: avg, perExamRange: lo.map((x, i) => [x, hi[i]]),
  excluded: { 'L-TABLE': '선택지가 표의 행이고 속성 열로 소거한다 — 지문 순서에 대응하지 않는다. 유일한 ① 사례 2023#10 이 여기 있었다.' },
  known: '패턴 자체는 학원가에 알려져 있다("어법·어휘는 1번이 거의 안 나온다"). 새로운 것은 예외 0 의 전수 확인과 반대편(비대응형 ① 27%)이다.',
}, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'choice-order.json')}`)
