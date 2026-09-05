// scripts/textbook-corpus/passage-mine.mjs
//
// **시중 교재의 지문을 캐낸다 — 표식이 없는 쪽에서도.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// `passage-ruler.mjs` 는 출판사가 스스로 인쇄한 `129 words` 표식을 단서로 지문을 뽑는다.
// 정확하지만 표식이 있는 쪽에만 쓸 수 있고, 그 결과 **초등 표본이 1~4편**이다
// (실측 2026-09-03: 59편 중 46편이 중1~중3). 초등 칸의 자가 없다는 뜻이고,
// 자가 없으면 "초등 지문으로 적합한가" 를 물을 수 없다.
//
// 그런데 미리보기·본책 쪽에는 지문이 **영어 줄 덩어리**로 그대로 실려 있다. 표식이 없을 뿐이다.
// 이 스크립트는 그 덩어리를 캐낸다.
//
// ── 이 도구는 **어휘 축만** 낸다 — 어수·FK 는 내지 않는다 ─────────────
// 처음엔 어수·FK 까지 내려고 만들었고, 자가 검증에서 **막혔다**: 표식 있는 쪽에서 캐낸
// 덩어리를 선언 어수와 맞대니 편차 중앙 **53.5%** · ±25% 안 25% 였다(실측 2026-09-04).
// PDF 다단 조판이라 한 지문이 여러 덩어리로 갈리거나 옆 단이 섞인다. 그 상태로 잰
// 문장 길이는 원문의 문장 길이가 아니므로 **FK 는 성립하지 않는다.**
//
// 그런데 **교육과정 별표 적중은 덩어리 경계에 영향받지 않는다** — 어떤 낱말이 나왔는지만
// 세기 때문이다. 순서가 섞여도, 두 단이 붙어도 낱말 집합은 그 쪽의 낱말 집합이다.
// 그래서 이 도구는 어휘 축 하나만 낸다. 어수·FK 는 `passage-ruler.mjs`(선언 표식 기반)와
// `market-spec.json` 이 이미 갖고 있다.
//
// ── 그 축은 어떻게 검증하는가 ────────────────────────────────────────
// 표식이 있는 쪽에서 **두 가지 방법으로 같은 값을 잰다**:
//   ① 표식 기반 정확 추출(`passage-ruler` 와 같은 규칙)의 `outsidePct`
//   ② 이 도구의 쪽 단위 추출의 `outsidePct`
// 둘이 몇 %p 어긋나는지가 이 도구의 오차다. 맞대 보지 않고 "캐냈다" 고 말하면
// 그 값은 근거가 아니라 짐작이다.
//
// ── 무엇을 버리는가 ──────────────────────────────────────────────────
// 교재 쪽에는 지문 말고도 선택지 묶음·어휘 목록·구문 해설 조각·지시문이 섞여 있다.
// 이것들이 섞이면 사다리의 아래쪽이 오염된다(`market-spec` 이 실제로 그렇게 오염됐다 —
// `docs/reports/passage-length-recheck-20260903.md`). 그래서 덩어리마다 6개 조건을 건다.
//
// ⚠️ 정답해설(role='정답해설')은 **쓰지 않는다.** 초등 해설지는 한글 해석만 싣고
//   영어 지문을 다시 싣지 않는다(실측). 중등 해설지에 영어가 있어도 그것은 구문 조각이다.
// ⚠️ PDF 다단 조판이라 줄 순서가 원문과 다를 수 있다. 어수·어휘 적중은 순서에 영향받지
//   않지만 **문장 길이(FK)는 받는다** — 그래서 검증 블록의 FK 편차를 함께 본다.
//
// 재실행 안전: 코퍼스를 읽기 전용으로 연다. 아무것도 쓰지 않는다(`--out` 이면 리포트만).
//
// 실행:
//   node scripts/textbook-corpus/passage-mine.mjs
//   node scripts/textbook-corpus/passage-mine.mjs --out docs/reports/passage-mine.json

import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { syllables } from './analyze.mjs'
import { loadSources, storePaths } from './lib.mjs'

const { curriculumCoverage } = await import(
  '../../packages/library-pipeline/src/textbook/curriculum.ts'
)

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const outPath = arg('out')

// ── 지문 후보를 가르는 조건 ──────────────────────────────────────────
/**
 * 교재 지문의 상식 범위. `market-spec.json` 의 창(40~200어)보다 **넓게** 잡는다 —
 * 창을 여기서 다시 좁히면 창을 정하려고 재는 값이 창에 갇힌다(순환).
 */
const MIN_WORDS = 35
const MAX_WORDS = 420
const MIN_SENTENCES = 3
/** 문장이 이보다 짧으면 어휘 목록, 길면 추출이 문장 경계를 놓친 것이다. */
const SENT_LEN = { min: 4, max: 34 }

/** 영어 줄 — `analyze.mjs`·`passage-ruler.mjs` 와 같은 기준. */
function isEnglishLine(line) {
  const en = (line.match(/[A-Za-z]/g) || []).length
  const ko = (line.match(/[가-힣]/g) || []).length
  return en >= 12 && en > ko * 2
}

/** 지문이 아닌 줄 — 여기서 덩어리를 끊는다. */
function isChrome(line) {
  const t = line.trim()
  if (/[①②③④⑤]/.test(t)) return true // 선택지 묶음
  if (/^\s*\d+\s*[.)]\s*$/.test(t)) return true // 문항 번호만 있는 줄
  if (/\b(words|WORDS)\b\s*$/.test(t)) return true // 어수 표식 줄
  if (/^[A-Z][A-Z\s&'-]{6,}$/.test(t)) return true // 전부 대문자 = 표제·배너
  // 낱말-뜻 나열(어휘 코너): 슬래시나 탭으로 잘게 갈린 짧은 조각
  if (t.split(/\s{3,}/).length >= 4 && (t.match(/[.!?]/g) || []).length === 0) return true
  return false
}

/**
 * **자립성 신호는 패키지 정본을 쓴다.**
 *
 * 처음엔 이 파일이 자기 사본을 들고 있었다. 그런데 2026-09-05 에 정본 쪽 규칙이 늘었고
 * (작은따옴표 대화 · `still`·`neither` 같은 접속부사), 사본을 그대로 두면 **시중 오탐률을
 * 옛 규칙으로 재고 새 규칙으로 판정하게 된다** — 문턱의 근거와 쓰임이 갈린다.
 * FK 에서 이미 배운 실수라 여기서 되풀이하지 않는다.
 */
const { standaloneSignals } = await import(
  '../../packages/library-pipeline/src/textbook/standalone.ts'
)

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

/**
 * 한 쪽에서 지문 덩어리를 캐낸다.
 *
 * 영어 줄이 이어지는 동안 모으고, 영어가 아니거나 지문이 아닌 줄에서 끊는다.
 * 끊긴 덩어리마다 §조건을 걸어 통과한 것만 돌려준다.
 */
function mineBlocks(text) {
  const out = []
  let buf = []
  const flush = () => {
    if (!buf.length) return
    const joined = buf.join(' ').replace(/\s+/g, ' ').trim()
    buf = []
    const m = readability(joined)
    if (!m) return
    if (m.words < MIN_WORDS || m.words > MAX_WORDS) return
    if (m.sentences < MIN_SENTENCES) return
    if (m.sent < SENT_LEN.min || m.sent > SENT_LEN.max) return
    // 소문자가 거의 없으면 표제 나열이다.
    const lower = (joined.match(/[a-z]/g) || []).length
    const upper = (joined.match(/[A-Z]/g) || []).length
    if (lower < upper * 3) return
    out.push({ text: joined, ...m })
  }
  for (const line of String(text).split('\n')) {
    if (isEnglishLine(line) && !isChrome(line)) buf.push(line.trim())
    else flush()
  }
  flush()
  return out
}

// ── 코퍼스 ───────────────────────────────────────────────────────────
const sp = storePaths(loadSources().store)
const db = new DatabaseSync(sp.db, { readOnly: true })

const rows = db
  .prepare(
    `SELECT d.id, d.publisher, d.series, d.grade_band, d.grade_min, d.role, p.p, p.text
     FROM pages p JOIN docs d ON d.id = p.doc_id
     WHERE d.category='독해' AND d.grade_min <= 9
       AND d.role IN ('본책','본문','미리보기','워크북')
     ORDER BY d.grade_min, d.series, p.p`
  )
  .all()
db.close()

/**
 * 표식 기반 정확 추출 — `passage-ruler.mjs` 와 **같은 규칙**이다.
 * 검증의 기준선이므로 여기서 다르게 쓰면 검증이 성립하지 않는다.
 */
function exactByMark(text) {
  const out = []
  for (const m of String(text).matchAll(/(\d{2,4})\s*words/gi)) {
    const declared = Number(m[1])
    if (declared < 40 || declared > 400) continue
    const after = String(text).slice(m.index + m[0].length)
    const lines = []
    for (const line of after.split('\n')) if (isEnglishLine(line)) lines.push(line.trim())
    if (!lines.length) continue
    const all = lines.join(' ')
    const words = all.match(/[A-Za-z][A-Za-z'-]*/g) || []
    if (words.length < declared * 0.6) continue
    let cut = ''
    let n = 0
    for (const seg of all.split(/(?<=[.!?]["')\]]?)\s+/)) {
      const c = (seg.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
      if (n && n + c > declared * 1.25) break
      cut = cut ? `${cut} ${seg}` : seg
      n += c
      if (n >= declared * 0.9) break
    }
    if (n >= declared * 0.6) out.push({ declared, text: cut, words: n })
  }
  return out
}

const mined = []
const verify = []
for (const r of rows) {
  const blocks = mineBlocks(r.text)
  if (!blocks.length) continue

  // 쪽 단위로 합친다 — 덩어리 경계가 원문과 다르므로 나눠 세는 것이 오히려 오차를 키운다.
  const pageText = blocks.map((b) => b.text).join(' ')
  const cov = curriculumCoverage(pageText)
  const st = standaloneSignals(pageText)
  const words = (pageText.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
  mined.push({
    docId: r.id,
    publisher: r.publisher,
    series: r.series,
    gradeBand: r.grade_band,
    gradeMin: r.grade_min,
    role: r.role,
    page: r.p,
    blocks: blocks.length,
    words,
    outsidePct: cov?.outsidePct ?? null,
    star1Pct: cov?.star1Pct ?? null,
    throughStar2Pct: cov?.throughStar2Pct ?? null,
    quotedPct: st?.quotedPct ?? null,
    opensAnaphoric: st?.opensAnaphoric ?? null,
    opensAsRecord: st?.opensAsRecord ?? null,
    hasFigureMark: st?.hasFigureMark ?? null,
    numericPct: st?.numericPct ?? null,
    head: pageText.slice(0, 80),
  })

  // 이 쪽에 선언 표식이 있으면 **검증 표본**이 된다 — 같은 값을 두 방법으로 잰다.
  const exact = exactByMark(r.text)
  if (exact.length === 1 && cov) {
    const ec = curriculumCoverage(exact[0].text)
    if (ec) {
      verify.push({
        series: r.series,
        page: r.p,
        declared: exact[0].declared,
        exactOutside: ec.outsidePct,
        minedOutside: cov.outsidePct,
        deltaPp: +(cov.outsidePct - ec.outsidePct).toFixed(1),
      })
    }
  }
}

// ── 출력 ─────────────────────────────────────────────────────────────
const pad = (s, w) => String(s).padEnd(w)
const lp = (s, w) => String(s).padStart(w)
const pct = (a, q) => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  return +s[Math.min(s.length - 1, Math.floor(s.length * q))].toFixed(1)
}

console.log(`\n지문 실린 쪽 ${mined.length} · 훑은 쪽 ${rows.length}\n`)

// § 검증 — 같은 쪽을 두 방법으로 재면 어휘 축이 얼마나 어긋나나
if (verify.length) {
  const d = verify.map((v) => Math.abs(v.deltaPp))
  const within = (t) => d.filter((x) => x <= t).length
  console.log('■ 자가 검증 — 어휘 축 (표식 기반 정확 추출 vs 쪽 단위 추출)')
  console.log(`  표본 ${verify.length}쪽 · 차이 중앙 ${pct(d, 0.5)}%p · p90 ${pct(d, 0.9)}%p`)
  console.log(
    `  ±3%p 안 ${within(3)} (${((within(3) / verify.length) * 100).toFixed(0)}%) · ` +
      `±7%p 안 ${within(7)} (${((within(7) / verify.length) * 100).toFixed(0)}%)`
  )
  console.log('  ⚠️ 이 도구는 어수·FK 를 내지 않는다 — 다단 조판이라 문장 경계가 원문과 다르다.\n')
} else {
  console.log('■ 자가 검증 — 표식이 있는 쪽을 하나도 못 찾았다. 이 결과는 검증되지 않았다.\n')
}

// § 학년대별 실측 — 이것이 만들려는 자다
const bands = new Map()
for (const m of mined) {
  const k = m.gradeBand ?? '미상'
  if (!bands.has(k)) bands.set(k, [])
  bands.get(k).push(m)
}
console.log('■ 학년대별 시중 지문의 교육과정 어휘 — 밖 % 와 별표 적중')
console.log(
  pad('학년대', 10) + lp('쪽', 5) + lp('밖%p25', 8) + lp('중앙', 7) + lp('p75', 7) + lp('p90', 7) +
    lp('별표1%중앙', 11) + lp('중학까지%', 10)
)
console.log('─'.repeat(72))
const sorted = [...bands.entries()].sort((a, b) => (a[1][0].gradeMin ?? 0) - (b[1][0].gradeMin ?? 0))
for (const [band, list] of sorted) {
  const o = list.filter((x) => x.outsidePct != null).map((x) => x.outsidePct)
  const s1 = list.filter((x) => x.star1Pct != null).map((x) => x.star1Pct)
  const s2 = list.filter((x) => x.throughStar2Pct != null).map((x) => x.throughStar2Pct)
  console.log(
    pad(band, 10) + lp(list.length, 5) + lp(pct(o, 0.25), 8) + lp(pct(o, 0.5), 7) +
      lp(pct(o, 0.75), 7) + lp(pct(o, 0.9), 7) + lp(pct(s1, 0.5), 11) + lp(pct(s2, 0.5), 10)
  )
}

// § 학교급으로 묶어 본다 — 밴드 표본이 얇아 이 값이 실제로 쓸 자다
console.log('\n■ 학교급별 — 문턱은 여기서 나온다')
console.log(
  pad('학교급', 10) + lp('쪽', 5) + lp('밖%중앙', 9) + lp('p75', 7) + lp('p90', 7) + lp('최대', 7) +
    lp('별표1%중앙', 11) + lp('중학까지%', 10)
)
console.log('─'.repeat(68))
const bySchool = new Map()
for (const m of mined) {
  const k = m.gradeMin <= 6 ? '초등' : '중등'
  if (!bySchool.has(k)) bySchool.set(k, [])
  bySchool.get(k).push(m)
}
for (const [k, list] of bySchool) {
  const o = list.filter((x) => x.outsidePct != null).map((x) => x.outsidePct)
  const s1 = list.filter((x) => x.star1Pct != null).map((x) => x.star1Pct)
  const s2 = list.filter((x) => x.throughStar2Pct != null).map((x) => x.throughStar2Pct)
  console.log(
    pad(k, 10) + lp(list.length, 5) + lp(pct(o, 0.5), 9) + lp(pct(o, 0.75), 7) +
      lp(pct(o, 0.9), 7) + lp(pct(o, 1), 7) + lp(pct(s1, 0.5), 11) + lp(pct(s2, 0.5), 10)
  )
}

if (outPath) {
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true })
  fs.writeFileSync(
    path.resolve(outPath),
    JSON.stringify({ measured_at: new Date().toISOString(), verify, mined }, null, 2)
  )
  console.log(`\n기록 → ${outPath}`)
}
