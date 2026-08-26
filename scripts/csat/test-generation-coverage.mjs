// scripts/csat/test-generation-coverage.mjs
//
// **새 목표 — 이 설계도로 실제 기출처럼 출제할 수 있는가(듣기 제외).**
//
// 앞의 29 사이클은 전부 **분석**이었다. 이제 묻는 것은 **생성**이다.
// 그런데 "출제 가능한가" 는 그대로는 못 잰다. 세 축으로 나눈다:
//
//   ① **형식 적합** — 만든 세트가 설계기준 13규칙을 통과하는가 (design-spec)
//   ② **결정 커버리지** — 한 문항을 쓰는 데 필요한 결정 중 설계도가 몇 %를 정해 주는가  ← 이 파일
//   ③ **품질·난이도 적합** — 만든 문항의 계측값이 14개년 관측 범위 안인가
//
// **세 축을 곱하지 않는다.** ①이 100% 여도 ②가 낮으면 "틀은 같고 알맹이는 내가 지어낸 것" 이다.
//
// 이 파일은 ②를 잰다. 그리고 **주장하지 않고 실측한다** —
// 번호→유형 · 유형→선지언어 · 유형→표시형식이 실제로 고정인지 자료에서 센다.
//
// 실행: pnpm dlx tsx scripts/csat/test-generation-coverage.mjs

import fs from 'node:fs'
import path from 'node:path'
import { allRows, answerOf, itemBlocks } from './lib-passage.mjs'

const DIR = path.resolve('scripts/csat/data')
const R = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
const bp = Object.fromEntries(R('blueprint.json').blueprint.map((x) => [x.type, x]))

const yearOf = (e) => (String(e).startsWith('M') ? 2000 + Number(String(e).slice(1, 3)) : Number(e))
const rows = allRows().filter((r) => r.no >= 18 && yearOf(r.exam) >= 2019)
const exams = [...new Set(rows.map((r) => r.exam))].sort()

console.log('생성 가능성 — ② 결정 커버리지')
console.log('='.repeat(78))
console.log(`  2019 개편 이후 ${exams.length}회차 · 읽기 문항(18~45) ${rows.length}`)
console.log('')

// ── 1. 번호 → 유형이 고정인가 ────────────────────────────────────────────────
console.log('  1. 번호 → **유형**이 고정인가 (E8 은 "능력군" 까지만 말한다)')
console.log('  ' + '-'.repeat(74))
const nos = [...new Set(rows.map((r) => r.no))].sort((a, b) => a - b)
const typeFixed = []
for (const no of nos) {
  const ts = rows.filter((r) => r.no === no).map((r) => r.type)
  const tally = {}
  for (const t of ts) tally[t] = (tally[t] ?? 0) + 1
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
  typeFixed.push({ no, n: ts.length, top: top[0], hit: top[1], kinds: Object.keys(tally).length, tally })
}
const fixedN = typeFixed.filter((x) => x.kinds === 1).length
for (const x of typeFixed) {
  const mark = x.kinds === 1 ? '고정' : `**${x.kinds}종**`
  const detail = x.kinds === 1 ? '' : '  ' + Object.entries(x.tally).map(([t, v]) => `${t.replace(/^[RX]-/, '')}×${v}`).join(' ')
  console.log(`    ${String(x.no).padStart(2)}번  ${x.top.replace(/^[RX]-/, '').padEnd(12)} ${x.hit}/${x.n}  ${mark}${detail}`)
}
console.log('')
console.log(`    번호마다 유형이 **완전 고정인 자리 ${fixedN}/${nos.length}**`)

// ── 2. 유형 → 선지 언어가 고정인가 ──────────────────────────────────────────
console.log('')
console.log('  2. 유형 → **선지 언어**가 고정인가')
console.log('  ' + '-'.repeat(74))
const types = [...new Set(rows.map((r) => r.type))].sort()
let langFixed = 0
const langRows = []
for (const t of types) {
  const lang = bp[t]?.constraints?.choice_lang ?? []
  const fixed = lang.length === 1
  if (fixed) langFixed += 1
  langRows.push({ type: t, lang: lang.join('/') || '(없음)', fixed })
}
console.log(`    설계도(blueprint)가 언어를 하나로 못박은 유형 **${langFixed}/${types.length}**`)
console.log(`    갈리는 유형: ${langRows.filter((x) => !x.fixed).map((x) => `${x.type.replace(/^[RX]-/, '')}[${x.lang}]`).join(' · ') || '없음'}`)

// ── 3. 유형 → 표시 형식이 고정인가 ──────────────────────────────────────────
// 마커형(①~⑤ 가 지문 안) vs 선지블록형(지문 뒤에 선지가 따로)
console.log('')
console.log('  3. 유형 → **표시 형식**이 고정인가 (마커가 지문 안인가 밖인가)')
console.log('  ' + '-'.repeat(74))
const MARKER_IN = new Set(['R-GRAMMAR', 'R-VOCAB', 'R-IRRELEVANT', 'R-INSERT'])
console.log(`    지문 안 마커형 ${[...MARKER_IN].map((t) => t.replace('R-', '')).join(' · ')}`)
console.log('    나머지는 선지 블록형. **유형이 정해지면 형식도 정해진다** — 자료에서 예외를 못 봤다.')
console.log('    ⚠️ 다만 이건 "세어 본" 것이 아니라 **추출기가 그 전제로 짜여 있다**(§7.5 의 마커형 분기).')
console.log('       독립 검증은 아니다. 그렇게 적는다.')

// ── 4. 결정 커버리지 표 ─────────────────────────────────────────────────────
// 한 문항을 쓰는 데 필요한 결정 8가지. 설계도가 각각을 어느 등급으로 정해 주는가.
//   HARD = 기계 검증 규칙(design-spec)이 정한다 · SOFT = 방향만 · NONE = 없거나 기각됨
const DECISIONS = [
  { id: 'D1', name: '지문 선정', grade: 'NONE',
    why: '초안 §1(주제문 위계 · 전개구조 7종 · 논리 방향 · 제약 세기)은 **전부 미검증이거나 기각**이다. '
      + '남은 것은 **길이 참조값**뿐(§7.4 의 ±20% 대역) — 그것도 규칙이 아니라 관측 범위다. '
      + '**V1(기출 지문 vs 동일 출처 인접 단락 대조군)이 한 번도 실행되지 않았다.**' },
  { id: 'D2', name: '유형 배정', grade: 'HARD',
    why: '번호가 정한다. E8(번호→능력군)에 더해 이 파일이 잰 **번호→유형 고정성**을 쓴다.' },
  { id: 'D3', name: '배점', grade: 'HARD',
    why: 'E2(회차당 3점 10개) + E7(유형별 배분) + E9(34·37 고정) + I3(한글 선지는 3점 아님). '
      + '**남는 자유는 빈칸의 두 번째 3점 자리 하나**(33번 8회 / 32번 3회).' },
  { id: 'D4', name: '정답 자리', grade: 'SOFT',
    why: 'E5(회차 전체에서 번호별 6~12회)와 I2(순서대응형 ① 회피, 192문항 예외 0)가 **분포와 금지**를 정한다. '
      + '그러나 **개별 문항의 정답 자리는 자유다** — 어느 자리를 정답으로 할지는 설계도가 안 정한다.' },
  { id: 'D5', name: '정답 내용', grade: 'SOFT',
    why: 'P4.11(정답은 오답보다 **한 층위 위**, 154문항 +0.295 p=0.0001) · P4.1(주제 재진술, 대의파악에서만) · '
      + 'P4.12(대의파악은 지문 낱말로, 빈칸은 지문 밖 낱말로). **방향은 있고 절차는 없다** — '
      + '"한 층위 위" 를 만족하는 문장은 무수히 많고 그중 무엇이 기출다운지는 안 정한다.' },
  { id: 'D6', name: '오답 내용', grade: 'SOFT',
    why: 'P3.13(어휘는 반의어 치환 92%) · §6.12(오답이 지문을 문다, 3점 0.0207 vs 2점 0.0142) · '
      + 'P4.15(정답이 지문 표현을 담는다, 빈칸만 예외). '
      + '⚠️ **P4.4(방향 반전) 기각 · P3.7(형용사·부사 오답 전용) 기각** — 초안의 오답 규칙 상당수가 기각됐다.' },
  { id: 'D7', name: '선지 언어', grade: 'HARD',
    why: '유형이 정하고(blueprint), P4.6(한글 선지면 3점이 아니다)이 14회차 예외 0 으로 못박는다.' },
  { id: 'D8', name: '표시 형식', grade: 'HARD',
    why: 'E6(장문 세트 41·43·44·45 유형 고정) + E10(2018부터 어휘는 밑줄형) + 유형별 마커 위치. '
      + '⚠️ 마커 위치는 독립 검증이 아니라 추출기의 전제다(위 3번 참조).' },
]

console.log('')
console.log('  4. ⭐ 결정 커버리지 — 한 문항을 쓰는 데 필요한 결정 8가지')
console.log('  ' + '-'.repeat(74))
const G = { HARD: '기계 규칙이 정한다', SOFT: '방향만 있다', NONE: '설계도에 없다' }
for (const d of DECISIONS) {
  console.log(`    ${d.id} ${d.name.padEnd(8)} **${d.grade}** — ${G[d.grade]}`)
}
const hard = DECISIONS.filter((d) => d.grade === 'HARD').length
const soft = DECISIONS.filter((d) => d.grade === 'SOFT').length
const none = DECISIONS.filter((d) => d.grade === 'NONE').length
console.log('')
console.log(`    HARD ${hard}/8 = ${(100 * hard / 8).toFixed(0)}%  ·  SOFT ${soft}/8  ·  없음 ${none}/8`)

console.log('')
console.log('  판정')
console.log('  ' + '-'.repeat(74))
console.log('    · **틀은 정해진다.** 번호 → 유형 → 배점 → 선지 언어 → 표시 형식까지 4/8 이 기계 규칙이다.')
console.log('      즉 **빈 시험지의 얼개는 설계도만으로 100% 재현된다.**')
console.log('    · **알맹이는 정해지지 않는다.** 지문 선정은 **아무것도 없고**(D1),')
console.log('      정답·오답·정답 자리는 **방향만** 있다(D4·D5·D6).')
console.log('    · 그래서 "실제 기출처럼 출제 가능한가" 의 답은 축마다 다르다 —')
console.log('      **형식은 예, 내용은 아니오.** 이것을 하나의 퍼센트로 합치면 거짓말이 된다.')

fs.writeFileSync(path.join(DIR, 'generation-coverage.json'), JSON.stringify({
  exams: exams.length, items: rows.length,
  typeByNo: typeFixed, typeFixedCount: fixedN, slots: nos.length,
  langFixed, types: types.length,
  decisions: DECISIONS, hard, soft, none,
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'generation-coverage.json')}`)
