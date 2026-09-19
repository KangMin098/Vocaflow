// scripts/csat/test-pdf-anchors.mjs
//
// **오버레이 앵커가 문항마다 ①~⑤ 다섯 개를 제자리에 붙이는지.** 실패하면 exit 1.
//
// 왜 회귀가 필요한가 — 이 파이프라인의 판정은 **단 경계 한 숫자**에 달려 있고, 그 숫자를
// 잘못 잡으면 화면이 멀쩡하게 뜬다. 박스가 옆 단 선지 위에 그려질 뿐이다.
// 2026-09-13 에 실제로 두 번 틀렸다:
//   ① 경계를 x=400 으로 **못박았다** → 2026 은 28/28 인데 2019 에서 25번 기호 셋이 옆 단으로
//   ② 재서 정하되 **두 여백의 중간**으로 잡았다((88+437)/2 = 262) → 전 회차 66.3% 로 떨어졌다.
//      왼 단 본문은 오른 단 여백 가까이까지 뻗는다(실측: 왼 단 기호 x=363 · 오른 단 시작 448).
// 둘 다 「고아 0」이라 조용했다 — 기호는 주인을 찾았고, 다만 틀린 주인이었다.
//
// ⚠️ **PDF 는 저장소에 없다**(평가원 저작물). 원본 폴더가 없으면 **skip** 한다 — CI 에서
//    거짓 실패를 내지 않으려면 그래야 하고, 대신 skip 을 **소리 내어** 말한다.
//    "돌지 않으면 없는 것" 이므로 조용한 skip 은 안전이 아니라 사각지대다.
//
// 실행: node scripts/csat/test-pdf-anchors.mjs

import fs from 'node:fs'
import path from 'node:path'
import { extractAnchors, grade } from './pdf-anchors.mjs'

// 원본 위치는 옮겨진 적이 있다 — 한 자리에 못 박으면 폴더가 움직인 날 조용히 죽는다
// (`ingest-listening.mjs`·`pdf-columns2.mjs` 와 같은 방식).
const DIRS = [
  'C:/Users/Administrator/Documents/영어/수능영어기출/수능기출',
  'C:/Users/Administrator/Documents/영어/모의평가',
]

const fails = []
const warns = []
let checked = 0

const dirs = DIRS.filter((d) => fs.existsSync(d))
if (!dirs.length) {
  console.log('── 앵커 품질 ──')
  console.log('  ⏭ SKIP — 평가원 문제지 원본 폴더가 없다 (저장소에 두지 않는다)')
  console.log(`     찾아본 곳: ${DIRS.join(' · ')}`)
  process.exit(0)
}

for (const dir of dirs) {
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf') && !f.includes('정답표'))
  for (const f of files.sort()) {
    let g
    try {
      g = grade(await extractAnchors(path.join(dir, f)))
    } catch (e) {
      fails.push(`${f} — 추출 자체가 실패했다: ${e.message}`)
      continue
    }

    // **듣기 대본이 `_문제지.pdf` 로 이름 붙은 파일이 있다**(실측: 201906·201909).
    // 추출기가 그것을 17/45 로 가려 낸다 — 이름이 아니라 내용으로 판정하는 것이 옳다.
    // 그 두 회차는 DB 에도 없다. 검사 대상이 아니라고 **말하고** 넘긴다.
    if (g.numbersFound <= 20) {
      warns.push(`${f} — 문항 번호 ${g.numbersFound}/45 · 듣기 대본으로 보인다(문제지가 아니다)`)
      continue
    }

    checked += 1
    if (g.numbersFound !== 45) fails.push(`${f} — 문항 번호 ${g.numbersFound}/45`)
    if (g.orphans) fails.push(`${f} — 주인 못 찾은 기호 ${g.orphans}개 (단 판정이 틀렸다)`)
    if (g.fiveMarks !== g.reading) {
      fails.push(`${f} — 사정권 기호 5개 ${g.fiveMarks}/${g.reading} · 어긋난 문항 ${g.bad.join(' ')}`)
    }
    // 형이 둘 든 PDF 는 절반만 쓴다. 절반이 8쪽이 아니면 형 경계 판정이 틀렸다.
    if (g.formPages !== 8) fails.push(`${f} — 첫 형이 ${g.formPages}쪽 (8쪽이어야 한다)`)
  }
}

console.log('── 앵커 품질 ──')
for (const w of warns) console.log(`  ⚠ ${w}`)
for (const f of fails) console.log(`  ✗ ${f}`)
if (!fails.length) console.log(`  ✓ 문제지 ${checked}개 · 사정권 문항마다 ①~⑤ 다섯 개 · 고아 0`)
console.log(`\n  검사 통과 ${fails.length === 0 ? 'PASS' : 'FAIL'} · 문제지 ${checked} · 제외 ${warns.length}`)
process.exit(fails.length ? 1 : 0)
