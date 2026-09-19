// scripts/csat/generate-exam-frame.mjs
//
// **축 ① — 설계기준만으로 시험지 얼개를 만들면 어디까지 정해지는가.**
//
// ⚠️ **"만든 세트가 design-spec 을 통과하는가" 는 그대로 물으면 항진명제다.**
// 생성기가 규칙을 그대로 구현하면 당연히 통과한다. 그건 아무것도 증명하지 않는다.
//
// 그래서 물음을 바꾼다: **규칙을 전부 지키고도 남는 자유가 몇 개인가.**
//   자유가 0 이면 → 얼개가 **유일하게** 결정된다. 설계도만으로 기출과 같은 틀이 나온다.
//   자유가 크면  → 규칙은 틀의 일부만 정하고 나머지는 여전히 사람의 몫이다.
//
// **자유도를 비트로 센다.** 선택지가 k 개면 log2(k) 비트다.
// 그리고 그 자유를 실제 기출이 어떻게 썼는지 옆에 붙인다 —
// 자유가 있는데 기출이 늘 같은 값을 골랐다면 **규칙이 하나 더 있는 것**이고, 그건 발견이다.
//
// 실행: pnpm dlx tsx scripts/csat/generate-exam-frame.mjs

import fs from 'node:fs'
import path from 'node:path'
import { allRows, answerOf } from './lib-passage.mjs'
import { TYPE_BY_NO, ABILITY_OF, SEQUENTIAL_TYPES } from './design-spec.mjs'

const DIR = path.resolve('scripts/csat/data')
const R = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
const bp = Object.fromEntries(R('blueprint.json').blueprint.map((x) => [x.type, x]))

const yearOf = (e) => (String(e).startsWith('M') ? 2000 + Number(String(e).slice(1, 3)) : Number(e))
const rows = allRows().filter((r) => yearOf(r.exam) >= 2019)
const exams = [...new Set(rows.map((r) => r.exam))].sort()

console.log('축 ① — 설계기준만으로 얼개를 만들면 어디까지 정해지는가')
console.log('='.repeat(78))
console.log(`  2019 개편 이후 ${exams.length}회차. 읽기 18~45 (28자리) 를 본다.`)
console.log('')

const READ = Array.from({ length: 28 }, (_, i) => i + 18)
const free = []

// ── D2 유형 ────────────────────────────────────────────────────────────────
free.push({ id: 'D2', name: '유형 배정', options: 1, bits: 0,
  note: 'E11 이 28자리를 전부 못박는다. 고를 것이 없다.' })

// ── D3 배점 — 3점을 어디에 놓는가 ────────────────────────────────────────────
// 실측: 읽기에서 3점이 몇 개이고, 그중 규칙이 정하는 것이 몇 개인가
const three = {}
for (const e of exams) {
  three[e] = READ.filter((no) => answerOf(e, no)?.points === 3)
}
const threeCount = [...new Set(Object.values(three).map((v) => v.length))]
const fixedByRule = new Set([34, 37]) // E9
console.log('  D3 배점 — 읽기에서 3점이 붙는 자리')
console.log('  ' + '-'.repeat(74))
for (const e of exams) console.log(`    ${e.padEnd(6)} ${three[e].join(' ')}`)
const perSlot = {}
for (const e of exams) for (const no of three[e]) perSlot[no] = (perSlot[no] ?? 0) + 1
const always = Object.entries(perSlot).filter(([, v]) => v === exams.length).map(([n]) => Number(n)).sort((a, b) => a - b)
const sometimes = Object.entries(perSlot).filter(([, v]) => v < exams.length).map(([n, v]) => ({ no: Number(n), n: v })).sort((a, b) => a.no - b.no)
console.log('')
console.log(`    읽기 3점 개수 ${threeCount.join('/')} · **항상 3점인 자리** ${always.join(' ')} (${always.length}개)`)
console.log(`    갈리는 자리: ${sometimes.map((x) => `${x.no}(${x.n}/${exams.length})`).join(' · ')}`)
// ⚠️ **처음 셀 때 여기를 틀렸다.** E7 이 3점을 다 덮는 줄 알고 "빈칸 둘째 + 삽입" 2가지만 셌다.
// 실제로는 읽기 3점이 회차당 **7개**인데 E7 은 그중 **4개(빈칸2·순서1·삽입1)만** 말한다.
// 나머지 3개는 E7 이 다루지 않는 유형(함축·주제·제목·어법·어휘·장문)에서 나오고 **규칙이 없다.**
const E7_TYPES = new Set(['R-BLANK', 'R-ORDER', 'R-INSERT'])
const covered = READ.filter((no) => E7_TYPES.has(TYPE_BY_NO[no]))
const uncovered = READ.filter((no) => !E7_TYPES.has(TYPE_BY_NO[no]))
const perExamUncovered = exams.map((e) => three[e].filter((no) => !E7_TYPES.has(TYPE_BY_NO[no])).length)
const uncoveredSlots = [...new Set(exams.flatMap((e) => three[e].filter((no) => !E7_TYPES.has(TYPE_BY_NO[no]))))].sort((a, b) => a - b)
console.log('')
console.log(`    ⚠️ **E7 은 읽기 3점 7개 중 4개만 말한다**(빈칸2·순서1·삽입1).`)
console.log(`       나머지 **${[...new Set(perExamUncovered)].join('/')}개**는 E7 밖 유형에서 나오고 **규칙이 없다.**`)
console.log(`       실제로 쓰인 자리: ${uncoveredSlots.join(' ')} (${uncoveredSlots.length}자리 중 ${perExamUncovered[0]}개를 고른다)`)

// 자유도: E7 이 덮는 쪽(빈칸 둘째 3가지 · 삽입 2가지) × 안 덮는 쪽(k자리에서 m개 고르기)
const blankFree = 3   // 31·32·33 중 하나 (34 는 E9)
const insFree = 2     // 38·39 중 하나
const m = perExamUncovered[0]
const k = uncoveredSlots.length
const C = (n, r) => { let v = 1; for (let i = 0; i < r; i += 1) v = (v * (n - i)) / (i + 1); return v }
const d3opt = blankFree * insFree * C(k, m)
console.log(`       조합 = 빈칸 ${blankFree} × 삽입 ${insFree} × C(${k},${m})=${Math.round(C(k, m))} = **${Math.round(d3opt)}가지**`)
free.push({ id: 'D3', name: '배점(3점 자리)', options: d3opt, bits: Math.log2(d3opt),
  note: `E9 가 34·37 을 못박지만 **E7 밖의 3점 ${m}개는 규칙이 없다** — ${k}자리에서 고른다.` })

// ── D4 정답 자리 ────────────────────────────────────────────────────────────
// I2(순서대응형 ① 회피)와 E5(회차 전체 번호별 6~12)만 제약이다.
const seq = READ.filter((no) => SEQUENTIAL_TYPES.includes(TYPE_BY_NO[no]))
const nonSeq = READ.filter((no) => !SEQUENTIAL_TYPES.includes(TYPE_BY_NO[no]))
const d4bits = seq.length * Math.log2(4) + nonSeq.length * Math.log2(5)
console.log('')
console.log('  D4 정답 자리 — 어느 번호를 정답으로 하는가')
console.log('  ' + '-'.repeat(74))
console.log(`    순서대응형 ${seq.length}자리는 ①을 못 쓴다(I2) → 자리당 4가지`)
console.log(`    나머지 ${nonSeq.length}자리 → 자리당 5가지`)
console.log(`    E5 는 **회차 전체**(45문항) 분포만 묶으므로 개별 자리는 거의 자유다`)
console.log(`    → 읽기 28자리만으로 약 **${d4bits.toFixed(0)} 비트** (${(2 ** d4bits).toExponential(1)} 가지)`)
free.push({ id: 'D4', name: '정답 자리', options: 2 ** d4bits, bits: d4bits,
  note: `I2 가 ${seq.length}자리에서 ①을 지우고, E5 는 회차 총합만 묶는다.` })

// ── D7 선지 언어 · D8 형식 ──────────────────────────────────────────────────
let langFree = 0
for (const no of READ) {
  const lang = bp[TYPE_BY_NO[no]]?.constraints?.choice_lang ?? []
  if (lang.length > 1) langFree += 1
}
free.push({ id: 'D7', name: '선지 언어', options: 2 ** langFree, bits: langFree,
  note: `유형이 정한다. 갈리는 자리 ${langFree}개.` })
free.push({ id: 'D8', name: '표시 형식', options: 1, bits: 0, note: 'E6·E10 + 유형별 마커 위치가 정한다.' })

// ── 요약 ────────────────────────────────────────────────────────────────────
console.log('')
console.log('  ⭐ 얼개의 자유도 — 규칙을 전부 지키고도 남는 것')
console.log('  ' + '-'.repeat(74))
console.log('    결정          선택지        비트    무엇이 정하는가')
for (const f of free) {
  const opt = f.options > 1e6 ? f.options.toExponential(1) : String(Math.round(f.options))
  console.log(`    ${f.id} ${f.name.padEnd(10)} ${opt.padStart(9)}  ${f.bits.toFixed(1).padStart(6)}   ${f.note}`)
}
const total = free.reduce((s, f) => s + f.bits, 0)
const structural = free.filter((f) => f.id !== 'D4').reduce((s, f) => s + f.bits, 0)
console.log('')
console.log(`    합계 **${total.toFixed(1)} 비트** · 그중 **정답 자리(D4)가 ${(free.find((f) => f.id === 'D4').bits).toFixed(1)} 비트**`)
console.log(`    정답 자리를 빼면 **${structural.toFixed(1)} 비트** — 선택지 ${Math.round(2 ** structural)}가지뿐이다`)

console.log('')
console.log('  판정')
console.log('  ' + '-'.repeat(74))
console.log(`    · **유형·형식은 자유도 0 이다.** 28자리 전부 규칙이 정한다.`)
console.log(`    · **배점은 생각보다 안 정해진다** — E9 가 34·37 을 못박아도 **E7 밖의 3점 3개는 규칙이 없다**.`)
console.log(`    · **정답 자리만 크게 열려 있다**(${d4bits.toFixed(0)} 비트). 그런데 이건 "설계" 라기보다`)
console.log(`      **답안 배치**다 — E5 가 회차 총합을 묶으므로 기출도 여기서 자유롭게 고른다.`)
console.log('')
console.log('    ⭐ **①의 답 — 나누어 적는다.**')
console.log('      · **유형·형식**은 설계기준만으로 **유일하게** 결정된다 (자유도 0).')
console.log(`      · **배점**은 ${Math.round(d3opt)}가지가 남는다 — E7 이 읽기 3점 7개 중 4개만 말하기 때문이다.`)
console.log('        **이건 설계도의 빈칸이다.** 함축·주제·제목·어법·어휘·장문에 3점이 어떻게 붙는지는 규칙이 없다.')
console.log('      · **정답 자리**는 사실상 전부 자유다. 다만 이건 설계라기보다 답안 배치다.')
console.log('')
console.log('    ⚠️ **처음에 D3 를 2가지로 셌다가 고쳤다.** E7 이 3점을 다 덮는 줄 알았는데')
console.log('       읽기 3점 7개 중 4개만 덮는다. 규칙표를 읽고 세지 않고 **자료를 세어서** 잡았다.')

fs.writeFileSync(path.join(DIR, 'exam-frame-freedom.json'), JSON.stringify({
  exams: exams.length, readSlots: READ.length,
  threePointSlots: { always, sometimes }, free, totalBits: total, structuralBits: structural,
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'exam-frame-freedom.json')}`)
