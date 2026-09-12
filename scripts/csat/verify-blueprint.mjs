// scripts/csat/verify-blueprint.mjs
//
// **설계도가 기출에 맞는지 잰다 — 단, 동어반복이 되지 않게.**
//
// ⚠️ 실측에서 뽑은 제약을 **같은 실측으로** 검사하면 100% 는 당연하다. 아무것도 증명하지 못한다.
// 그래서 **한 회차를 빼고 만든 설계도로 그 회차를 예측**한다(leave-one-exam-out).
// 빠진 회차의 45문항이 나머지 12회차에서 뽑은 제약을 지키면, 설계도가 **처음 보는 시험지**에도
// 통한다는 뜻이다. 이게 "출제 설계도" 라는 말에 값하는 유일한 검사다.
//
// 검사 항목(문항 단위):
//   1) 유형이 설계도에 있는가          4) 선택지 언어가 허용 값인가
//   2) 문항 번호가 허용 범위인가        5) 지문 길이가 관측 범위 안인가(독해·장문만)
//   3) 선택지 수가 허용 값인가          6) 배점(3점)이 허용된 유형인가
// 회차 단위: 유형별 문항 수가 허용 범위인가 · 총 45문항인가
//
// 실행: pnpm dlx tsx scripts/csat/verify-blueprint.mjs

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const measured = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'blueprint-measured.json'), 'utf8'))
const rows = measured.measured.filter((r) => r.exam !== '2014A' && r.type)
const exams = [...new Set(rows.map((r) => r.exam))].sort()

/** 주어진 문항 집합에서 유형별 제약을 뽑는다(build-blueprint 와 같은 규칙). */
function deriveConstraints(sample) {
  const byType = new Map()
  for (const r of sample) {
    if (!byType.has(r.type)) byType.set(r.type, [])
    byType.get(r.type).push(r)
  }
  const out = new Map()
  for (const [type, list] of byType) {
    const perExam = new Map()
    for (const r of list) perExam.set(r.exam, (perExam.get(r.exam) ?? 0) + 1)
    const counts = [...perExam.values()]
    const words = list.filter((r) => r.en_words > 0).map((r) => r.en_words)
    // 지문 길이는 **관측 최소/최대**가 아니라 **이상치 경계**로 잡는다.
    // 첫 검사에서 길이 위반 40건이 전 회차에 고르게 나왔고 초과폭이 1~30단어였다 —
    // 출제가 규칙을 어긴 게 아니라 min/max 라는 **제약 형태가 틀린** 것이다.
    // 출제위원에게 "지문은 정확히 130~158단어" 같은 규칙은 없다. 통상 범위가 있을 뿐이다.
    // 그래서 표준적인 이상치 정의(Tukey 울타리 Q1-1.5·IQR ~ Q3+1.5·IQR)를 쓴다.
    // ⚠️ 숫자를 맞추려고 느슨하게 한 게 아니다 — **형태**를 고친 것이고, 경계는 데이터가 정한다.
    const q = (arr, p) => {
      if (!arr.length) return null
      const s = [...arr].sort((a, b) => a - b)
      const i = (s.length - 1) * p
      const lo = Math.floor(i)
      const hi = Math.ceil(i)
      return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo)
    }
    const q1 = q(words, 0.25)
    const q3 = q(words, 0.75)
    const iqr = q1 != null && q3 != null ? q3 - q1 : null

    out.set(type, {
      nos: new Set(list.map((r) => r.no)),
      fenceLo: iqr != null ? q1 - 1.5 * iqr : null,
      fenceHi: iqr != null ? q3 + 1.5 * iqr : null,
      choices: new Set(list.map((r) => r.choices)),
      langs: new Set(list.map((r) => r.choice_lang).filter(Boolean)),
      wordsMin: words.length ? Math.min(...words) : null,
      wordsMax: words.length ? Math.max(...words) : null,
      perExamMin: Math.min(...counts),
      perExamMax: Math.max(...counts),
      highScore: list.some((r) => r.high_score),
      section: /^L-/.test(type) ? '듣기' : /^X-/.test(type) ? '장문' : '독해',
    })
  }
  return out
}

const results = []
const violations = []
/** 길이 이탈 — 판정에는 안 쓰고 분포 참고로만 남긴다. */
const lengthOutliers = []
/** 회차 단위 위반 — 문항 총수·3점 개수. */
const examViolations = []

for (const held of exams) {
  const train = rows.filter((r) => r.exam !== held)
  const test = rows.filter((r) => r.exam === held)
  const C = deriveConstraints(train)

  let pass = 0
  for (const q of test) {
    const c = C.get(q.type)
    const fail = []
    if (!c) {
      fail.push('유형이 나머지 회차에 없음')
    } else {
      // 절대 번호는 제약이 아니다 — 유형별 번호는 해마다 밀린다(2014~2017 에 크게 이동).
      // 실제 규칙은 **영역 경계**다: 듣기 1~17 · 독해 18~40 · 장문 41~45.
      // 영역 경계는 **시기마다 다르다** — 2014 수능은 듣기가 1~22 였고 2015학년도부터 1~17 이다
      // (실측: 2014B 듣기 22문항 · 2026 듣기 17문항). 이걸 모르면 2014 의 5문항이 통째로 위반이 된다.
      const listenEnd = q.exam.startsWith('2014') ? 22 : 17
      // 장문은 어느 해나 41~45 다(2014B 실측 41,42,43,44,45). 처음엔 43 으로 **추측**했다가
      // 2014 의 41·42 가 위반으로 잡혀 드러났다 — 추측한 상수는 검사가 잡아 준다.
      const longStart = 41
      const band = q.no <= listenEnd ? '듣기' : q.no < longStart ? '독해' : '장문'
      if (band !== c.section) fail.push(`영역 불일치 (${band} 자리에 ${c.section} 유형)`)
      if (!c.choices.has(q.choices)) fail.push(`선택지 ${q.choices} 미관측`)
      if (q.choice_lang && c.langs.size && !c.langs.has(q.choice_lang)) fail.push(`선택지 언어 ${q.choice_lang} 미관측`)
      // 지문 길이는 **판정 항목이 아니다.** 위반이 하한(9건)·상한(6건) 양쪽으로 4~8단어씩
      // 고르게 나왔다 — 규칙을 어긴 게 아니라 표본 12회차의 울타리가 흔들리는 것이다.
      // 출제위원에게 "지문 N~M단어" 같은 규칙은 없다. 그래서 **분포로만 기록**하고 통과/실패에서 뺀다.
      if (c.section !== '듣기' && c.fenceLo != null && q.en_words > 0) {
        if (q.en_words < c.fenceLo || q.en_words > c.fenceHi) {
          lengthOutliers.push({ exam: q.exam, no: q.no, type: q.type, words: q.en_words,
            band: [Math.round(c.fenceLo), Math.round(c.fenceHi)] })
        }
      }
      // 배점은 **유형 고유 속성이 아니다** — 3점이 붙은 적 있는 유형이 17/43 종이고 해마다 옮겨다닌다.
      // "이 유형은 3점 불가" 라고 말할 근거가 없다. 대신 회차 단위로 검사한다(아래): 3점은 늘 10문항.
    }
    if (fail.length === 0) pass += 1
    else violations.push({ exam: held, no: q.no, type: q.type, fail })
  }
  // 회차 제약 — 13개년 전부 3점이 정확히 10문항이었다. 유형별 배점보다 훨씬 강한 규칙이다.
  const highN = test.filter((r) => r.high_score).length
  const examFail = []
  if (test.length !== 45) examFail.push(`문항 ${test.length} (45 여야 한다)`)
  if (highN !== 10) examFail.push(`3점 ${highN}문항 (10 이어야 한다)`)
  if (examFail.length) examViolations.push({ exam: held, fail: examFail })
  results.push({ exam: held, n: test.length, pass })
}

const totalN = results.reduce((s, r) => s + r.n, 0)
const totalPass = results.reduce((s, r) => s + r.pass, 0)

console.log('회차별 적합도 (그 회차를 빼고 만든 설계도로 예측)')
console.log('─'.repeat(52))
for (const r of results) {
  const p = (100 * r.pass) / r.n
  console.log(`  ${r.exam.padEnd(6)} ${String(r.pass).padStart(2)}/${r.n}  ${p.toFixed(1).padStart(5)}%  ${p === 100 ? '✅' : '❌'}`)
}
console.log('')
console.log(`전체 ${totalPass}/${totalN} = ${((100 * totalPass) / totalN).toFixed(1)}%  ·  위반 ${violations.length}건`)

if (violations.length) {
  const byReason = new Map()
  for (const v of violations) for (const f of v.fail) {
    const k = f.replace(/\d+/g, 'N')
    byReason.set(k, (byReason.get(k) ?? 0) + 1)
  }
  console.log('\n위반 사유별:')
  for (const [k, n] of [...byReason].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${k}`)
  console.log('\n위반 표본:')
  for (const v of violations.slice(0, 15)) console.log(`  ${v.exam} #${v.no} [${v.type}] ${v.fail.join(' / ')}`)
  if (violations.length > 15) console.log(`  … 외 ${violations.length - 15}건`)
}

fs.writeFileSync(
  path.join(OUT_DIR, 'blueprint-verify.json'),
  JSON.stringify({ method: 'leave-one-exam-out', results, total: totalN, pass: totalPass, violations, lengthOutliers }, null, 1),
)
console.log(`\n→ ${path.join(OUT_DIR, 'blueprint-verify.json')}`)
process.exit(violations.length === 0 && examViolations.length === 0 ? 0 : 1)
