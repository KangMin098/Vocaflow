// scripts/textbook/grade-level-bench.mjs
//
// **우리 지문이 그 학년의 난이도인가** — 시중 학년별 실측 눈금과 대조.
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// 지금까지 잰 것은 **어수(길이)** 뿐이다(`market-spec.json` p10~p90). 길이가 맞아도
// 난이도가 어긋나면 그 학년 교재가 아니다 — 초6 지문 자리에 C1 천문학 글이 들어와도
// 100어이기만 하면 통과한다. 실제로 그렇게 되어 있었다(실측 2026-09-02):
//
//     초·중 창(42~173어) 270편의 CEFR — **C1 73 · C2 8** · B2 50 · B1 52 · A1~A2 48
//
// C1/C2 81편은 전부 NASA 사진 설명글이다. 짧지만 천문 어휘라 어렵고,
// 방금 넣은 이야기(StoryWeaver)는 A1~A2 라 쉽다. **가운데가 비어 있다.**
//
// ── 자는 시중 코퍼스가 이미 갖고 있다 ────────────────────────────────
// `textbook-corpus` 가 79종을 Flesch-Kincaid 로 재 놓았고 학년대와 단조 증가한다:
//
//     초3~4 3.33 · 초5~6 4.42 · 초6 4.57 · 중1 7.60 · 중2 7.47 · **중3 10.67**
//
// **같은 공식으로 재야 비교가 성립한다.** 그래서 `textbook-corpus/analyze.mjs` 의
// `syllables()` 를 import 한다 — 여기서 다시 구현하면 두 자가 조용히 갈린다.
//
// ⚠️ FK 는 문장 길이와 음절 수만 본다. **어휘 친숙도를 모른다** — "photosynthesis" 와
//   "unhappiness" 를 같은 5음절로 센다. 그래서 CEFR·V-Level 과 **함께** 본다.
//   한 자만 믿으면 NASA 사진설명(FK 낮음 · CEFR C1)이 초등용으로 보인다.
//
// 재실행 안전: 읽기만 한다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/grade-level-bench.mjs
//   pnpm dlx tsx scripts/textbook/grade-level-bench.mjs --out <경로.json>

import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { syllables } from '../textbook-corpus/analyze.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const outPath = arg('out') ?? 'docs/reports/grade-level-bench.json'

/** `textbook-corpus/analyze.mjs` 와 **같은 식**. 다르게 쓰면 비교가 무의미해진다. */
function readability(text) {
  const sentences = (text.match(/[.!?]["')\]]*(\s|$)/g) || []).length
  const words = text.match(/[A-Za-z][A-Za-z'-]*/g) || []
  if (!sentences || !words.length) return null
  let syl = 0
  let longWords = 0
  for (const w of words) {
    const s = syllables(w.toLowerCase())
    syl += s
    if (s >= 3) longWords++
  }
  const avgSentenceLen = words.length / sentences
  const sylPerWord = syl / words.length
  return {
    fk: +(0.39 * avgSentenceLen + 11.8 * sylPerWord - 15.59).toFixed(2),
    fog: +(0.4 * (avgSentenceLen + 100 * (longWords / words.length))).toFixed(2),
    sent: +avgSentenceLen.toFixed(1),
    syl: +sylPerWord.toFixed(3),
    words: words.length,
  }
}

// ── 시중 눈금 ────────────────────────────────────────────────────────
const sources = JSON.parse(
  fs.readFileSync(path.resolve('scripts/textbook-corpus/sources.json'), 'utf8')
)
const corpus = new DatabaseSync(path.join(sources.store, 'corpus.db'), { readOnly: true })
const marketRows = corpus
  .prepare(
    `SELECT grade_band, grade_min, COUNT(*) docs,
       ROUND(AVG(fk_grade),2) fk, ROUND(AVG(avg_sent_len),1) sent, ROUND(AVG(syl_per_word),3) syl
     FROM docs WHERE category='독해' AND fk_grade IS NOT NULL AND grade_min <= 9
     GROUP BY 1,2 ORDER BY grade_min, fk`
  )
  .all()
corpus.close()

/**
 * 학년 → 허용 FK 창.
 *
 * 시중 같은 학년대 안에서도 교재마다 흔들린다(중1 7.17~7.60 · 중3 7.74~10.67).
 * 그래서 한 점이 아니라 **이웃 학년까지 걸친 창**으로 본다 — 점으로 판정하면
 * 멀쩡한 지문이 전부 부적합으로 나온다.
 */
const BANDS = [
  { id: '초3~4', min: 1.5, max: 4.0 },
  { id: '초5~6', min: 3.5, max: 5.5 },
  { id: '초6~중1', min: 4.5, max: 7.0 },
  { id: '중1~2', min: 6.5, max: 9.0 },
  { id: '중3', min: 8.5, max: 12.0 },
]
const bandOf = (fk) =>
  BANDS.find((b) => fk >= b.min && fk <= b.max)?.id ?? (fk < 1.5 ? '초3 미만' : '중3 초과')

// ── 우리 지문 ────────────────────────────────────────────────────────
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const market = JSON.parse(
  fs.readFileSync(path.resolve('packages/library-pipeline/src/textbook/market-spec.json'), 'utf8')
).passageWords
const WIN = {
  min: Math.min(...['초6', '중1', '중2', '중3'].map((k) => market[k].words.p10)),
  max: Math.max(...['초6', '중1', '중2', '중3'].map((k) => market[k].words.p90)),
}

/**
 * **2022 개정 교육과정 기본어휘 별표** — 이 조사의 두 번째 자, 그리고 더 정본에 가까운 쪽.
 *
 * FK 는 미국 문헌 공식이고 **어휘 친숙도를 모른다.** 한국 초·중 학습자에게 "그 학년 수준" 은
 * 문장 길이가 아니라 **교육과정이 그 학년에 배우라고 정한 낱말 안에 있는가**로 정해진다.
 * 그 목록이 이미 `shared_dictionary.list_tags` 에 들어 있다:
 *
 *     kcurr2022_1 초등 808 · kcurr2022_2 중등 1,211 · kcurr2022_0 고등 1,006
 *
 * 그래서 지문마다 **내용어가 별표 안에 몇 % 드는지**를 잰다. 초등 별표 적중이 높으면
 * 초등 지문이고, 고등 별표까지 가야 채워지면 그 학년 지문이 아니다.
 *
 * ⚠️ 굴절형을 정확히 되돌리지 않는다(`-s`·`-ed`·`-ing` 만 벗긴다). 그래서 이 값은
 *   **하한**이다 — 실제 적중은 이보다 높다. 소스끼리 견주는 데는 같은 잣대라 문제없지만,
 *   "적중 62%" 를 절대값으로 인용하면 과소평가한다.
 */
const dictRows = []
for (let from = 0; ; from += 1000) {
  const { data, error: e } = await db
    .from('shared_dictionary')
    .select('word, list_tags')
    .overlaps('list_tags', ['kcurr2022_1', 'kcurr2022_2', 'kcurr2022_0'])
    .range(from, from + 999)
  if (e) throw new Error('별표 조회 실패: ' + e.message)
  if (!data?.length) break
  dictRows.push(...data)
  if (data.length < 1000) break
}
const ELEM_SET = new Set()
const MID_SET = new Set()
const HIGH_SET = new Set()
for (const r of dictRows) {
  const w = String(r.word).toLowerCase()
  const t = r.list_tags ?? []
  if (t.includes('kcurr2022_1')) ELEM_SET.add(w)
  if (t.includes('kcurr2022_2')) MID_SET.add(w)
  if (t.includes('kcurr2022_0')) HIGH_SET.add(w)
}

/** 기능어는 어느 학년에나 있다 — 적중률을 재는 분모에서 뺀다. 안 빼면 전부 90%대가 된다. */
const FUNC = new Set(
  (
    'a an the and or but if of to in on at by for with from as is are was were be been being am do does did have has had ' +
    'i you he she it we they me him her us them my your his its our their this that these those there here not no yes ' +
    'so then than too very can could will would shall should may might must up down out off over under again more most'
  ).split(' ')
)
/** 굴절 되돌리기 — 완전하지 않다. 그래서 적중률은 하한이다. */
const stem = (w) =>
  w.endsWith('ies') && w.length > 4
    ? w.slice(0, -3) + 'y'
    : w.endsWith('es') && w.length > 4
      ? w.slice(0, -2)
      : w.endsWith('s') && !w.endsWith('ss') && w.length > 3
        ? w.slice(0, -1)
        : w.endsWith('ing') && w.length > 5
          ? w.slice(0, -3)
          : w.endsWith('ed') && w.length > 4
            ? w.slice(0, -2)
            : w

function curriculumCoverage(text) {
  const ws = (text.match(/[A-Za-z][A-Za-z'-]*/g) || []).map((w) => w.toLowerCase())
  const content = ws.filter((w) => !FUNC.has(w) && w.length > 1)
  if (!content.length) return null
  let elem = 0
  let mid = 0
  let high = 0
  for (const w of content) {
    const s = stem(w)
    const inElem = ELEM_SET.has(w) || ELEM_SET.has(s)
    const inMid = MID_SET.has(w) || MID_SET.has(s)
    const inHigh = HIGH_SET.has(w) || HIGH_SET.has(s)
    if (inElem) elem++
    if (inElem || inMid) mid++
    if (inElem || inMid || inHigh) high++
  }
  return {
    n: content.length,
    elemPct: +((elem / content.length) * 100).toFixed(1),
    midPct: +((mid / content.length) * 100).toFixed(1),
    highPct: +((high / content.length) * 100).toFixed(1),
  }
}

const { data: rows, error } = await db
  .from('library_articles')
  .select('source, title, content, word_count, cefr_level, register, article_v_level')
  .in('status', ['ready', 'published'])
  .eq('display_only', false)
  .gte('word_count', WIN.min)
  .lte('word_count', WIN.max)
if (error) throw new Error('지문 조회 실패: ' + error.message)

const scored = []
for (const r of rows) {
  const m = readability(r.content ?? '')
  if (!m) continue
  const cov = curriculumCoverage(r.content ?? '')
  scored.push({
    ...m,
    cov,
    source: r.source,
    title: r.title,
    cefr: r.cefr_level,
    register: r.register,
    v: r.article_v_level,
    band: bandOf(m.fk),
  })
}

// ── 출력 ─────────────────────────────────────────────────────────────
const pad = (s, w) => String(s).padEnd(w)
const lp = (s, w) => String(s).padStart(w)

console.log(`\n■ 시중 초·중 독해 눈금 (79종 코퍼스 · 같은 FK 공식)\n`)
console.log(pad('학년대', 12) + lp('교재', 5) + lp('FK', 7) + lp('문장', 7) + lp('syl/w', 8))
console.log('─'.repeat(39))
for (const m of marketRows)
  console.log(pad(m.grade_band, 12) + lp(m.docs, 5) + lp(m.fk, 7) + lp(m.sent, 7) + lp(m.syl, 8))

console.log(`\n■ 우리 지문 ${scored.length}편 (${WIN.min}~${WIN.max}어) — 같은 자로 잰 값\n`)
const bySource = new Map()
for (const s of scored) {
  const k = s.source
  const v = bySource.get(k) ?? { n: 0, fk: [], sent: [], elem: [], mid: [], cefr: new Map() }
  v.n++
  v.fk.push(s.fk)
  v.sent.push(s.sent)
  if (s.cov) {
    v.elem.push(s.cov.elemPct)
    v.mid.push(s.cov.midPct)
  }
  v.cefr.set(s.cefr ?? '-', (v.cefr.get(s.cefr ?? '-') ?? 0) + 1)
  bySource.set(k, v)
}
const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null)
console.log(
  pad('소스', 20) +
    lp('편수', 5) +
    lp('FK중앙', 8) +
    lp('문장', 7) +
    lp('밴드', 10) +
    lp('초등별표%', 10) +
    lp('+중등%', 9) +
    '  CEFR'
)
console.log('─'.repeat(91))
for (const [k, v] of [...bySource.entries()].sort((a, b) => b[1].n - a[1].n)) {
  const fk = med(v.fk)
  const cefr = [...v.cefr.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${c}${n}`)
    .join(' ')
  console.log(
    pad(k, 20) +
      lp(v.n, 5) +
      lp(fk, 8) +
      lp(med(v.sent), 7) +
      lp(bandOf(fk), 10) +
      lp(med(v.elem) ?? '—', 10) +
      lp(med(v.mid) ?? '—', 9) +
      '  ' +
      cefr
  )
}

console.log(`\n■ 학년 밴드별 우리 재고 — **여기가 이 조사의 답이다**\n`)
const byBand = new Map()
for (const s of scored) byBand.set(s.band, (byBand.get(s.band) ?? 0) + 1)
const ORDER = ['초3 미만', ...BANDS.map((b) => b.id), '중3 초과']
console.log(pad('밴드', 12) + lp('FK창', 12) + lp('우리 편수', 10))
console.log('─'.repeat(34))
for (const id of ORDER) {
  const b = BANDS.find((x) => x.id === id)
  const n = byBand.get(id) ?? 0
  console.log(
    pad(id, 12) + lp(b ? `${b.min}~${b.max}` : '—', 12) + lp(n, 10) + (n === 0 ? '  ← 빈칸' : '')
  )
}

const report = {
  measuredAt: new Date().toISOString(),
  window: WIN,
  formula:
    'Flesch-Kincaid — textbook-corpus/analyze.mjs 와 동일 (0.39·문장길이 + 11.8·음절/낱말 − 15.59)',
  caveat:
    'FK 는 어휘 친숙도를 모른다. NASA 사진설명은 FK 가 낮아도 CEFR C1 이다 — 반드시 CEFR·V-Level 과 함께 본다.',
  marketBands: marketRows,
  bands: BANDS,
  ourByBand: ORDER.map((id) => ({ band: id, n: byBand.get(id) ?? 0 })),
  ourBySource: [...bySource.entries()].map(([k, v]) => ({
    source: k,
    n: v.n,
    fkMedian: med(v.fk),
    sentMedian: med(v.sent),
    curriculumElemPct: med(v.elem),
    curriculumElemMidPct: med(v.mid),
    band: bandOf(med(v.fk)),
    cefr: Object.fromEntries(v.cefr),
  })),
  items: scored.map((s) => ({
    source: s.source,
    title: s.title,
    fk: s.fk,
    sent: s.sent,
    words: s.words,
    cefr: s.cefr,
    band: s.band,
  })),
}
fs.writeFileSync(path.resolve(outPath), JSON.stringify(report, null, 2))
console.log(`\n기록 → ${outPath}`)
console.log(
  '⚠️ FK 는 어휘를 모른다 — CEFR 열을 함께 볼 것. 한 자만 믿으면 C1 천문학 글이 초등용으로 보인다.'
)
