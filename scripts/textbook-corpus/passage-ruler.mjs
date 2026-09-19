// scripts/textbook-corpus/passage-ruler.mjs
//
// **지문 단위 난이도 자** — 문서 평균이 아니라 지문 하나하나를 잰다.
//
// ── 왜 다시 재는가 ───────────────────────────────────────────────────
// 지금 쓰는 학년 사다리(초3~4 3.33 · 중1 7.60 · 중3 10.67)는 **문서 단위 평균**이다.
// 한 문서 안에는 지문 말고도 문항·해설·어휘 목록·차례가 섞여 있고, 그 전부의 평균이
// "그 학년 지문의 난이도" 로 쓰이고 있었다. 특히:
//
//   · 어휘 목록은 문장이 아니라 낱말 나열이라 문장 길이를 **끌어내린다**
//   · 구문 해설은 조각(fragment)이라 마침표가 적어 문장 길이를 **끌어올린다**
//   · 문항 지시문("다음 글의 요지로 가장 적절한 것은")은 지문이 아니다
//
// 두 오염이 서로 상쇄되는지 강화되는지는 **재 보기 전에는 모른다.**
//
// ── 지문을 어떻게 찾는가 — 출판사가 스스로 밝힌다 ────────────────────
// 실측: 초·중 독해 교재 **127쪽**에 `129 words` 처럼 **그 지문의 어수가 인쇄돼 있다**
// (NE능률 1316 Reading 42쪽 · 리딩튜터 주니어 42쪽 · 스타터/딥독 미리보기 등).
// 이 표식은 두 가지를 동시에 준다:
//
//   ① 지문이 **여기서 시작한다** (표식 바로 뒤)
//   ② 지문이 **N 낱말이다**      (어디서 끝나는지)
//
// 짐작으로 자르지 않아도 된다는 뜻이다. 그리고 뽑아낸 길이가 선언값과 크게 다르면
// **추출이 틀린 것**이므로 스스로 걸러 낼 수 있다 — 이 스크립트는 그 편차를 함께 낸다.
//
// ⚠️ 이 자는 표식이 있는 교재에만 쓸 수 있다. 표식 없는 교재의 지문은 여전히
//   문서 평균으로만 잴 수 있고, 그래서 **두 값을 나란히 낸다** — 하나로 합치면
//   어느 쪽이 정밀한 값인지 알 수 없게 된다.
//
// 재실행 안전: 코퍼스를 읽기 전용으로 연다. 아무것도 쓰지 않는다.
//
// 실행:
//   node scripts/textbook-corpus/passage-ruler.mjs
//   node scripts/textbook-corpus/passage-ruler.mjs --out <경로.json>

import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { syllables } from './analyze.mjs'
import { loadSources, storePaths } from './lib.mjs'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const outPath = arg('out') ?? 'docs/reports/passage-ruler.json'

const sp = storePaths(loadSources().store)
const db = new DatabaseSync(sp.db, { readOnly: true })

const rows = db
  .prepare(
    `SELECT d.id, d.publisher, d.series, d.grade_band, d.grade_min, d.role, p.p, p.text
     FROM pages p JOIN docs d ON d.id = p.doc_id
     WHERE d.category='독해' AND d.grade_min <= 9 AND p.text GLOB '*[0-9] words*'
     ORDER BY d.grade_min, d.series, p.p`
  )
  .all()

/** 영어 줄만 남긴다 — `analyze.mjs` 와 같은 기준(한글이 더 많은 줄은 지문이 아니다). */
function englishLines(text) {
  const out = []
  for (const line of String(text).split('\n')) {
    const en = (line.match(/[A-Za-z]/g) || []).length
    const ko = (line.match(/[가-힣]/g) || []).length
    if (en >= 20 && en > ko * 2) out.push(line.trim())
  }
  return out
}

function readability(t) {
  const sentences = (t.match(/[.!?]["')\]]*(\s|$)/g) || []).length
  const words = t.match(/[A-Za-z][A-Za-z'-]*/g) || []
  if (!sentences || !words.length) return null
  let syl = 0
  for (const w of words) syl += syllables(w.toLowerCase())
  return {
    fk: +(0.39 * (words.length / sentences) + 11.8 * (syl / words.length) - 15.59).toFixed(2),
    sent: +(words.length / sentences).toFixed(1),
    words: words.length,
    sentences,
  }
}

const passages = []
for (const r of rows) {
  // 한 쪽에 표식이 여럿일 수 있다(지문 두 개가 실린 쪽).
  const marks = [...String(r.text).matchAll(/(\d{2,4})\s*words/gi)]
  for (const m of marks) {
    const declared = Number(m[1])
    // 교재 지문의 상식 범위 밖이면 표식이 아니라 다른 숫자다(예: "1000 words 목표").
    if (declared < 40 || declared > 400) continue

    const after = String(r.text).slice(m.index + m[0].length)
    const lines = englishLines(after)
    if (!lines.length) continue

    // 선언된 어수만큼만 가져온다 — 그 뒤는 문항·어휘 목록이다.
    const all = lines.join(' ')
    const words = all.match(/[A-Za-z][A-Za-z'-]*/g) || []
    if (words.length < declared * 0.6) continue // 지문이 잘려 들어왔다 — 버린다

    // 낱말 단위로 자르되 **문장 끝에서 멈춘다** — 중간에서 끊으면 문장 수가 틀어져
    //   FK 가 통째로 어긋난다(그게 이 자의 핵심 값이다).
    let cut = ''
    let n = 0
    for (const seg of all.split(/(?<=[.!?]["')\]]?)\s+/)) {
      const c = (seg.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
      if (n && n + c > declared * 1.25) break
      cut = cut ? `${cut} ${seg}` : seg
      n += c
      if (n >= declared * 0.9) break
    }
    const m2 = readability(cut)
    if (!m2) continue

    passages.push({
      publisher: r.publisher,
      series: r.series,
      gradeBand: r.grade_band,
      gradeMin: r.grade_min,
      role: r.role,
      page: r.p,
      declaredWords: declared,
      ...m2,
      // 선언값과 얼마나 어긋났나 — 크면 추출이 틀렸다는 신호다.
      drift: +(((m2.words - declared) / declared) * 100).toFixed(1),
      head: cut.slice(0, 90),
    })
  }
}

// ── 출력 ─────────────────────────────────────────────────────────────
const pad = (s, w) => String(s).padEnd(w)
const lp = (s, w) => String(s).padStart(w)
const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null)

const clean = passages.filter((p) => Math.abs(p.drift) <= 25)
console.log(`\n표식이 있는 쪽 ${rows.length} · 뽑아낸 지문 ${passages.length} · 편차 25% 이내 ${clean.length}\n`)

const byGrade = new Map()
for (const p of clean) {
  const k = `${p.gradeMin}|${p.gradeBand}`
  if (!byGrade.has(k)) byGrade.set(k, [])
  byGrade.get(k).push(p)
}

console.log(
  pad('학년대', 12) + lp('지문', 5) + lp('선언어수', 9) + lp('실측어수', 9) + lp('FK중앙', 8) + lp('FK p25', 8) + lp('FK p75', 8) + lp('문장', 7)
)
console.log('─'.repeat(66))
const perGrade = []
for (const [k, list] of [...byGrade.entries()].sort((a, b) => Number(a[0].split('|')[0]) - Number(b[0].split('|')[0]))) {
  const band = k.split('|')[1]
  const fks = list.map((p) => p.fk).sort((a, b) => a - b)
  const q = (p) => fks[Math.min(fks.length - 1, Math.floor(fks.length * p))]
  const row = {
    gradeBand: band,
    gradeMin: Number(k.split('|')[0]),
    passages: list.length,
    declaredMedian: med(list.map((p) => p.declaredWords)),
    wordsMedian: med(list.map((p) => p.words)),
    fkMedian: q(0.5),
    fkP25: q(0.25),
    fkP75: q(0.75),
    sentMedian: med(list.map((p) => p.sent)),
  }
  perGrade.push(row)
  console.log(
    pad(band, 12) + lp(row.passages, 5) + lp(row.declaredMedian, 9) + lp(row.wordsMedian, 9) +
      lp(row.fkMedian, 8) + lp(row.fkP25, 8) + lp(row.fkP75, 8) + lp(row.sentMedian, 7)
  )
}

console.log('\n※ 문서 평균 사다리(초3~4 3.33 · 초5~6 4.42 · 중1 7.60 · 중3 10.67)와 나란히 볼 것.')
console.log('  두 값이 갈리면 문서 평균이 지문 말고 다른 것을 함께 세고 있었다는 뜻이다.')

fs.writeFileSync(
  path.resolve(outPath),
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      method:
        '교재에 인쇄된 "N words" 표식으로 지문 위치·길이를 잡고, 문장 끝에서 잘라 FK 를 잰다. 선언값 대비 편차 25% 초과는 추출 실패로 보고 버린다.',
      markedPages: rows.length,
      extracted: passages.length,
      kept: clean.length,
      perGrade,
      passages: clean,
    },
    null,
    2
  )
)
db.close()
console.log(`\n기록 → ${outPath}`)
