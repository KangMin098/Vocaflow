// scripts/csat/design-spec.mjs
//
// **수능 영어 출제 설계기준 — 실행 가능한 명세 + 검증기.**
//
// ── 이 파일이 존재하는 이유 ──────────────────────────────────────────
// 가설 12개가 "출제자가 지문 안에서 무엇을 고르는가" 를 물었고 전부 실패했다.
// 마지막에 만들어 보니 이유가 분명했다 — 선정을 거치지 않은 학술 문단 12편 전부에서
// 유효한 삽입 문항이 나왔다(12/12). **고를 것이 별로 없다.**
//
// 그래서 설계기준은 '무엇을 고르는가' 가 아니라 **'무엇을 반드시 지키는가'** 로 쓴다.
// 지키는 것들은 13~14개년 예외가 0 이다. 그게 이 파일의 규칙들이다.
//
// ── 쓰임 ────────────────────────────────────────────────────────────
//   1) 검증  — 기출 630문항이 전부 통과해야 한다. 통과하면 "14년에 모두 적용" 이 증명된다.
//   2) 생성  — 새 문항을 만들 때 이 규칙을 어기면 기출 분포에서 벗어난다.
//
// ⚠️ 규칙은 두 등급이다.
//    HARD  13/13 회차 예외 0. 어기면 기출이 아니다.
//    SOFT  방향은 뚜렷하나 표본이 작아 유의성 미달(§0). 생성 시 참고만 한다.
//
// 실행: pnpm dlx tsx scripts/csat/design-spec.mjs

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const R = (f) => JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'))

// ── 명세 ────────────────────────────────────────────────────────────

/** 선택지 ①~⑤ 가 지문·담화의 서술 순서에 대응하는 유형. 여기서 ① 은 정답이 되지 않는다. */
export const SEQUENTIAL_TYPES = [
  'R-GRAMMAR', 'R-VOCAB', 'R-IRRELEVANT', 'X-VOCAB', 'X-REFER', 'R-REFER', 'R-INSERT',
  'R-FACT', 'X-FACT', 'R-NOTICE', 'R-CHART', 'L-NOTMENTION', 'L-SET-NOT', 'L-ANNOUNCE',
]

/** 유형 → 평가원 능력군. 함축(21)은 2019 신설이라 따로 둔다. */
export const ABILITY_OF = {
  'R-PURPOSE': '대의파악', 'R-MOOD': '대의파악', 'R-CLAIM': '대의파악',
  'R-GIST': '대의파악', 'R-TOPIC': '대의파악', 'R-TITLE': '대의파악',
  'R-IMPLY': '함축',
  'R-CHART': '세부사항', 'R-FACT': '세부사항', 'R-NOTICE': '세부사항',
  'R-GRAMMAR': '어휘어법', 'R-VOCAB': '어휘어법', 'R-REFER': '어휘어법',
  'R-BLANK': '빈칸', 'R-BLANK2': '빈칸',
  'R-IRRELEVANT': '간접쓰기', 'R-ORDER': '간접쓰기', 'R-INSERT': '간접쓰기', 'R-SUMMARY': '간접쓰기',
}

/** 2019 개편 이후 번호 → 능력군 (18~40). 실측에서 뽑았고 12회차 예외 0. */
export const ABILITY_BY_NO = {
  18: '대의파악', 19: '대의파악', 20: '대의파악', 21: '함축', 22: '대의파악', 23: '대의파악', 24: '대의파악',
  25: '세부사항', 26: '세부사항', 27: '세부사항', 28: '세부사항',
  29: '어휘어법', 30: '어휘어법',
  31: '빈칸', 32: '빈칸', 33: '빈칸', 34: '빈칸',
  35: '간접쓰기', 36: '간접쓰기', 37: '간접쓰기', 38: '간접쓰기', 39: '간접쓰기', 40: '간접쓰기',
}

export const SPEC = {
  exam: [
    { id: 'E1', grade: 'HARD', name: '한 회차는 45문항', check: (ex) => ex.items.length === 45 },
    { id: 'E2', grade: 'HARD', name: '3점이 정확히 10문항', check: (ex) => ex.items.filter((i) => i.points === 3).length === 10 },
    { id: 'E3', grade: 'HARD', name: '나머지는 전부 2점', check: (ex) => ex.items.every((i) => i.points === 2 || i.points === 3) },
    // ⚠️ 1판의 E4 는 `no <= 17 인 문항이 17개인가` 를 봤다. **항진명제다** — 1~45 번호가 있으면 언제나 참이다.
    //    그래서 2014A·2014B 가 실제로는 **듣기 22문항**인데도 통과했다("위반 0" 중 하나가 무의미한 검사였다).
    //    유형 코드로 실제 듣기 수를 센다. 2015학년도에 듣기가 22 → 17 로 줄었으므로 시기를 나눈다.
    { id: 'E4', grade: 'HARD', name: '듣기 문항 수 고정 — 2015학년도부터 17 (2014 는 22)',
      check: (ex) => {
        const n = ex.items.filter((i) => i.type.startsWith('L-')).length
        return ex.exam.startsWith('2014') ? n === 22 : n === 17
      },
      why: '2015학년도에 듣기가 22 → 17 로 줄었다. 그 뒤 12회차 고정.' },
    { id: 'E5', grade: 'HARD', name: '정답 번호가 한쪽으로 쏠리지 않는다 (각 번호 6~12)',
      check: (ex) => { const d = [0, 0, 0, 0, 0, 0]; for (const i of ex.items) d[i.answer] += 1; return d.slice(1).every((x) => x >= 6 && x <= 12) } },
    // 장문 세트는 유형군을 한 번씩 배치한다 — 41·43·44·45 는 13개년 한 번도 안 바뀌었다.
    // 42 만 움직였다: X-BLANK(2014B~2018, 2017 만 X-BLANK2) → **2019 부터 X-VOCAB 로 8회 연속**.
    // 그래서 2019 이후 장문 세트는 '5유형 종합' 이 아니라 어휘가 두 번 들어간 4유형 구성이다.
    // (2016 년에 나온 시중 분석서가 '5유형 종합' 이라 적은 것은 그 시점엔 맞았고 지금은 틀리다)
    { id: 'E6', grade: 'HARD', name: '장문 세트 41·43·44·45 의 유형이 고정 (제목·순서·지칭·일치)',
      check: (ex) => {
        const want = { 41: 'X-TITLE', 43: 'X-ORDER', 44: 'X-REFER', 45: 'X-FACT' }
        return Object.entries(want).every(([no, t]) => {
          const it = ex.items.find((i) => i.no === Number(no))
          return !it || it.type === t
        })
      },
      why: '13개년 예외 0. 42번만 바뀌었고 2019 부터 장문 어휘로 고정됐다.' },
    // ⚠️ 이 규칙은 SOFT 였던 주장을 승격시킨 것이다.
    //    "3점 배분이 빈칸에서 구조·요지로 **이동하는 중**" 이라고 읽었었는데, 회차별로 펼쳐 보니
    //    추세가 아니라 **2019 에 한 번 바뀐 계단**이고 그 뒤 8회차가 한 칸도 안 틀린다.
    //      빈칸  4/5 3/3 4/4 4/4 4/4 │ 2/4 ×8
    //      순서  0/1 0/2 0/2 1/2 1/2 │ 1/2 ×8
    //      삽입  0/1 1/2 1/2 0/2 0/2 │ 1/2 ×8
    //    2019~ 에서 8/8, 2018 이전에는 0/5. 앞뒤 6회 평균으로 재던 방식이 계단을 추세로 보이게 했다.
    { id: 'E7', grade: 'HARD', name: '2019학년도부터 3점 배분 고정 — 빈칸 2 · 순서 1 · 삽입 1',
      check: (ex) => {
        if (Number(ex.exam.slice(0, 4)) < 2019) return true // 개편 전에는 적용하지 않는다
        const n = (t) => ex.items.filter((i) => i.type === t && i.points === 3).length
        return n('R-BLANK') === 2 && n('R-ORDER') === 1 && n('R-INSERT') === 1
      },
      why: '2019~2026 8회차 8/8. 2018 이전 0/5. 개편으로 고정된 배분표다.' },
    // ⭐ 배정은 지문 성질과의 매칭이 아니다 — **번호가 능력군을 미리 정해 놓는다.**
    //    2019 개편 이후 12회차(수능 9 + 모평 3)에서 18~40 번 **23개 번호가 전부** 한 능력군에 고정.
    //    지문을 보고 유형을 고르는 것이 아니라, 자리에 맞는 지문을 넣는 것이다.
    //    (12개 가설이 지문 쪽에서 아무것도 못 찾은 이유가 여기 있다 — §1)
    { id: 'E8', grade: 'HARD', name: '번호마다 능력군이 고정 (2019 개편 이후 18~40)',
      check: (ex) => {
        const y = Number(ex.exam.slice(0, 4))
        if (!(y >= 2019)) return true // 개편 전에는 배치가 다르다
        return ex.items.every((i) => {
          const want = ABILITY_BY_NO[i.no]
          const got = ABILITY_OF[i.type]
          return !want || !got || want === got
        })
      },
      why: '2019~ 12회차 예외 0. 번호→능력군이 고정이므로 유형 배정은 지문 성질 매칭이 아니다.' },
    // ⭐ E7 은 유형별 3점 **개수**만 고정한다. **어느 번호**인지는 안 정한다 —
    //    빈칸은 31~34 중 둘, 순서는 36·37 중 하나, 삽입은 38·39 중 하나.
    //    그런데 **각 유형군의 마지막 자리**가 고정이다:
    //      34번(빈칸 마지막) 13/13 · 37번(순서 마지막) 13/13 · 39번(삽입 마지막) 12/13(2025 예외)
    //    예외가 없는 34·37 만 규칙으로 세운다. 경계는 **2017**이고, 그 해는 이 저장소가 이미 아는
    //    변곡점이다(순서 선택지 템플릿 교체 · R-BLANK2 폐지).
    { id: 'E9', grade: 'HARD', name: '2017학년도부터 34번·37번은 3점 (유형군의 마지막 자리)',
      check: (ex) => {
        if (Number(ex.exam.slice(0, 4)) < 2017) return true
        return [34, 37].every((no) => {
          const it = ex.items.find((i) => i.no === no)
          return !it || it.points === 3
        })
      },
      why: '2017~2026 수능 10 + 모평 3 = 13회차 · 26/26 예외 0. 기저 10/45 에서 이항 p ≈ 1e-17.' },
  ],
  item: [
    { id: 'I1', grade: 'HARD', name: '선택지는 5개, 정답은 1~5', check: (it) => it.answer >= 1 && it.answer <= 5 },
    { id: 'I2', grade: 'HARD', name: '순서 대응형에서 ① 은 정답이 아니다',
      check: (it) => !SEQUENTIAL_TYPES.includes(it.type) || it.answer !== 1,
      why: '① 은 지문 맨 앞이라 거기서 답이 정해지면 뒤를 읽을 이유가 없어진다. 13개년 192문항 예외 0.' },
    { id: 'I3', grade: 'HARD', name: '선택지에 한글이 섞이면 3점이 아니다',
      check: (it) => !it.choiceHasKo || it.points !== 3,
      why: '한글 선택지는 "지문 이해까지만 잰다" 는 선언이다. 13개년 179문항 예외 0.' },
  ],
}

// ── 검증 ────────────────────────────────────────────────────────────
const classified = R('classified.json')
const answers = R('answers.json').answers
const bp = Object.fromEntries(R('blueprint.json').blueprint.map((x) => [x.type, x]))
const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))

const items = classified.rows
  .filter((r) => key.has(`${r.exam}#${r.no}`))
  .map((r) => {
    const a = key.get(`${r.exam}#${r.no}`)
    const lang = bp[r.type]?.constraints?.choice_lang ?? []
    return { exam: r.exam, no: r.no, type: r.type, answer: a.answer, points: a.points, choiceHasKo: lang.includes('ko') }
  })

const exams = [...new Set(items.map((i) => i.exam))].sort()
const violations = []

for (const exam of exams) {
  const ex = { exam, items: items.filter((i) => i.exam === exam) }
  for (const rule of SPEC.exam) {
    if (!rule.check(ex)) violations.push({ level: '회차', exam, rule: rule.id, name: rule.name, grade: rule.grade })
  }
}
for (const it of items) {
  for (const rule of SPEC.item) {
    if (!rule.check(it)) violations.push({ level: '문항', exam: it.exam, no: it.no, type: it.type, rule: rule.id, name: rule.name, grade: rule.grade })
  }
}

const hardCount = SPEC.exam.filter((r) => r.grade === 'HARD').length + SPEC.item.filter((r) => r.grade === 'HARD').length
const checks = exams.length * SPEC.exam.length + items.length * SPEC.item.length

console.log('수능 영어 출제 설계기준 — 기출 전수 검증')
console.log('═'.repeat(76))
console.log(`  회차 ${exams.length} · 문항 ${items.length} · 규칙 ${hardCount} · 검사 ${checks}건`)
console.log('')
console.log('  규칙')
for (const r of [...SPEC.exam, ...SPEC.item]) {
  console.log(`    [${r.grade}] ${r.id}  ${r.name}`)
  if (r.why) console.log(`             ${r.why}`)
}
console.log('')
console.log('  결과')
console.log('─'.repeat(76))
if (!violations.length) {
  console.log(`  **위반 0건 — ${exams.length}회차 ${items.length}문항 전부가 이 기준을 만족한다.**`)
  console.log('  → 이 명세는 기출 전 회차에 예외 없이 적용된다.')
} else {
  console.log(`  위반 ${violations.length}건`)
  for (const v of violations.slice(0, 20)) {
    console.log(`    ${v.level} ${v.exam}${v.no ? '#' + v.no : ''} ${v.rule} — ${v.name}`)
  }
}

// 회차별 통과 표
console.log('')
console.log('  회차별')
for (const exam of exams) {
  const bad = violations.filter((v) => v.exam === exam).length
  const n = items.filter((i) => i.exam === exam).length
  console.log(`    ${exam.padEnd(7)} ${String(n).padStart(2)}문항  ${bad === 0 ? '통과' : `위반 ${bad}`}`)
}

fs.writeFileSync(path.join(OUT_DIR, 'design-spec-verify.json'), JSON.stringify(
  { exams: exams.length, items: items.length, checks, violations }, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'design-spec-verify.json')}`)
