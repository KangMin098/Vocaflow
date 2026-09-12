// scripts/csat/test-h9-seam.mjs
//
// **H9 — 삽입의 선택자는 '빼내도 이음매가 매끄러운 자리' 인가. 읽기 전용.**
//
// H6(뽑아낸 문장에 후방 지시어가 있다)은 base rate 71% 앞에서 무효가 됐다.
// H9 는 시선을 옮긴다: 뽑아낸 문장이 아니라 **빼낸 뒤 남는 이음매**를 본다.
//
// 조작적 정의 — 눈대중을 쓰면 또 사후 서술이 된다. 이렇게 고정한다:
//   **구멍이 보인다** = 이음매 뒷 문장이 지시어·정관사로 무언가를 가리키는데
//                     그 선행사가 **앞 문장에 없다**.
//   **매끄럽다**     = 뒷 문장의 지시 표현이 전부 앞 문장에서 받아진다(또는 지시 표현이 없다).
//
// 출제자 입장의 논리: 구멍이 드러나면 지문을 읽지 않아도 자리가 보인다 → 문항이 무너진다.
// 그래서 **구멍이 안 보이는 자리**를 고른다. H6 과 정확히 반대 방향의 예측이다.
//
// ⚠️ base rate 를 **먼저** 낸다. 후보 대부분이 매끄러우면 H9 도 선택자가 아니다.
// ⚠️ 기계 판정은 어휘 수준이다. 경계 사례는 따로 뽑아 사람이 읽는다.
//
// 실행: pnpm dlx tsx scripts/csat/test-h9-seam.mjs

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const R = (f) => JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'))
const items = R('insert-seams.json')

const STOP = new Set(`a an the of to in on at by for with from into over under and or but if then than that this these those
it its their our your his her they we you he she as is are was were be been being do does did have has had
can could will would shall should may might must not no nor so such very more most much many few less least
what which who whom whose when where why how all any both each other others same own too only just also there here`.split(/\s+/))
const content = (s) => (s.toLowerCase().match(/[a-z][a-z'-]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w))

// 뒷 문장 머리에서 '앞을 가리키는 장치' 를 뽑는다
const PRONOUN = /^(this|these|those|such|they|them|their|it|its|he|him|his|she|her|both|each|one|others|another)\b/i
const DEF_NP = /^the\s+([a-z]+(?:\s+[a-z]+)?)/i
const CONNECTIVE = /^(however|but|so|thus|therefore|then|also|moreover|furthermore|instead|nevertheless|yet|still|meanwhile|otherwise|hence|consequently|even|similarly|likewise|in\s+(fact|contrast|addition|turn)|for\s+(example|instance)|as\s+a\s+result|by\s+contrast|on\s+the\s+other\s+hand)\b/i

/** 이음매 뒷 문장이 앞 문장만으로 해석되는가 */
function seamOk(before, after) {
  const head = after.replace(/^[^A-Za-z]*/, '')
  const beforeWords = new Set(content(before))
  const reasons = []

  // (a) 문두 대명사·지시사 — 앞 문장에 복수/단수 선행 명사가 있어야 한다
  const pm = head.match(PRONOUN)
  if (pm) {
    // 앞 문장에 내용어 명사가 하나라도 있으면 받아질 여지가 있다고 본다(관대한 쪽)
    if (beforeWords.size === 0) reasons.push(`문두 "${pm[1]}" 의 선행사 없음`)
  }

  // (b) 문두 정관사 명사구 — 그 명사가 앞 문장에 나와야 한다
  const dm = head.match(DEF_NP)
  if (dm) {
    const nouns = content(dm[1])
    if (nouns.length && !nouns.some((w) => beforeWords.has(w))) reasons.push(`"the ${dm[1]}" 가 앞 문장에 없음`)
  }

  // (c) 뒷 문장 앞부분(첫 10단어)의 지시사+명사 — 그 명사가 앞 문장에 있어야 한다
  const early = head.split(/\s+/).slice(0, 10).join(' ')
  for (const m of early.matchAll(/\b(this|these|those|such)\s+([a-z]+)/gi)) {
    const w = content(m[2])[0]
    if (w && !beforeWords.has(w)) reasons.push(`"${m[1]} ${m[2]}" 가 앞 문장에 없음`)
  }

  // (d) 어휘 연결이 아예 없음 — 접속어도 없고 공유 내용어도 없으면 이음매가 끊긴다
  const shared = content(after).filter((w) => beforeWords.has(w)).length
  if (!shared && !CONNECTIVE.test(head) && !pm) reasons.push('공유 어휘·접속어 없음')

  return { ok: reasons.length === 0, reasons }
}

const rows = []
for (const it of items) {
  for (const s of it.seams) {
    const v = seamOk(s.before, s.after)
    rows.push({ id: it.id, i: s.i, isAnswer: s.isAnswer, ok: v.ok, reasons: v.reasons, before: s.before, after: s.after })
  }
}

const pool = rows.length
const smooth = rows.filter((r) => r.ok).length
const ansRows = rows.filter((r) => r.isAnswer)
const ansSmooth = ansRows.filter((r) => r.ok).length
const nonAns = rows.filter((r) => !r.isAnswer)
const nonAnsSmooth = nonAns.filter((r) => r.ok).length

const pc = (a, b) => `${a}/${b} = ${(100 * a / b).toFixed(1)}%`
console.log('H9  삽입의 선택자는 "빼내도 이음매가 매끄러운 자리" 인가')
console.log('─'.repeat(76))
console.log(`  문항 ${items.length} · 이음매 ${pool}개 (문항당 ${(pool / items.length).toFixed(1)})`)
console.log('')
console.log(`  ① base rate — 정답이 아닌 이음매가 매끄러운 비율   ${pc(nonAnsSmooth, nonAns.length)}`)
console.log(`  ② 정답 이음매가 매끄러운 비율                     ${pc(ansSmooth, ansRows.length)}`)
const lift = 100 * (ansSmooth / ansRows.length - nonAnsSmooth / nonAns.length)
console.log(`  lift = ${lift >= 0 ? '+' : ''}${lift.toFixed(1)}%p`)
console.log('')
console.log(`  후보 좁히기 — 매끄러운 이음매만 남기면 문항당 ${(smooth / items.length).toFixed(1)}개`)
console.log(`               (제약 없으면 ${(pool / items.length).toFixed(1)}개)`)
const before = items.length / pool, after = smooth ? ansSmooth / smooth : 0
console.log(`  찍기 확률 ${(100 * before).toFixed(1)}% → ${(100 * after).toFixed(1)}%`)
console.log('')
if (Math.abs(lift) < 10) console.log('  판정: **H9 도 선택자가 아니다.** 정답 이음매가 나머지와 구분되지 않는다.')
else if (lift > 0) console.log('  판정: 방향이 맞다 — 정답 자리가 실제로 더 매끄럽다. 유의성 검정으로 넘긴다.')
else console.log('  판정: **방향이 반대다** — 정답 자리가 오히려 구멍이 더 잘 보인다. H9 기각.')

console.log('')
console.log('  정답 이음매 중 기계가 "구멍 보임" 으로 판정한 것 (사람이 읽어야 할 것)')
for (const r of ansRows.filter((x) => !x.ok).slice(0, 8)) {
  console.log(`    ${r.id} S${r.i} — ${r.reasons.join(' · ')}`)
  console.log(`      ${r.before}`)
  console.log(`      ⊕ ${r.after}`)
}

fs.writeFileSync(path.join(OUT_DIR, 'h9-seam.json'), JSON.stringify(
  { items: items.length, pool, smooth, ans: { n: ansRows.length, smooth: ansSmooth }, nonAns: { n: nonAns.length, smooth: nonAnsSmooth }, lift, rows }, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'h9-seam.json')}`)
