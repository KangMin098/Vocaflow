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

/**
 * ⚠️ `market-spec.json` 의 학년별 창은 **여기서 쓰지 않는다.**
 *
 * 예전엔 그 창(초6 44~121 · 중1 46~154)의 합집합 42~173어로 조회했다. 그런데 그 값은
 * 쪽에서 영문 덩어리를 찾아내는 검출기 산출이라 직독직해 조각이 섞여 하한이 40어대다 —
 * **출판사가 인쇄한 어수는 최소 97어이고 한 건도 그 밑이 없다**
 * (`docs/reports/passage-length-recheck-20260903.md`).
 *
 * 그 창으로 조회하면 두 방향으로 틀린다: 시중에 없는 짧은 글(62어)이 들어오고,
 * 시중 규격의 긴 지문(174~198어)은 **조회에서부터 빠진다.**
 */

/**
 * **2022 개정 교육과정 기본어휘 별표 — 자는 패키지가 소유한다.**
 *
 * 예전엔 이 파일이 `shared_dictionary.list_tags` 를 직접 읽어 **자기 사본**을 만들었다.
 * 그러면 같은 공식이 두 벌이 되고, 한쪽만 고쳐졌을 때 두 값이 조용히 갈린다 —
 * FK 에서 이미 배운 실수다(`readability.ts` 머리말).
 *
 * 정본은 `packages/library-pipeline/src/textbook/curriculum.ts` 이고, 그 문턱은
 * **시중 지문 196쪽 실측**(2026-09-04 · `passage-mine.mjs`)에서 나왔다.
 */
const { curriculumFit, CURRICULUM_SPEC } = await import(
  '../../packages/library-pipeline/src/textbook/curriculum.ts'
)

/**
 * **지문 어수 창의 정본** — 출판사가 인쇄한 어수 실측(n=59 · 최소 97 · 중앙 132 · 최대 198).
 *
 * ⚠️ `market-spec.json` 의 학년별 창(초6 44~121 · 중1 46~154)을 쓰면 안 된다.
 *   그쪽은 쪽에서 영문 덩어리를 찾아내는 검출기 산출이라 직독직해 조각이 섞여
 *   **하한이 40어대**다 — 시중이 97어 밑을 한 건도 선언하지 않는데도 그렇다.
 *   그 창으로 재면 시중 규격 지문(132어)이 떨어지고 시중에 없는 짧은 글이 통과한다.
 */
const { PASSAGE_WORDS } = await import(
  '../../packages/library-pipeline/src/textbook/readability.ts'
)
/** 조회 창 = 지문 어수 창. 둘을 다르게 두면 재는 모집단과 판정 기준이 어긋난다. */
const WIN = PASSAGE_WORDS

/**
 * FK 밴드 → 학교급. 어휘 문턱이 학교급마다 다르므로(초등 43.3% · 중등 44.0%) 어느 자를
 * 댈지 여기서 정한다. **어수창은 밴드로 갈리지 않는다** — 시중 선언 어수를 학년대로 갈라
 * 보면 중1~중3 한 밴드가 97~198어로 전체 범위와 같다(`readability.PASSAGE_WORDS` 머리말).
 */
const BAND_SPEC = {
  '초3~4': { school: 'elementary' },
  '초5~6': { school: 'elementary' },
  '초6~중1': { school: 'elementary' },
  '중1~2': { school: 'middle' },
  중3: { school: 'middle' },
}

const { data: rows, error } = await db
  .from('library_articles')
  .select('source, title, content, word_count, cefr_level, register, article_v_level')
  .in('status', ['ready', 'published'])
  .eq('display_only', false)
  .gte('word_count', WIN.min)
  .lte('word_count', WIN.max)
if (error) throw new Error('지문 조회 실패: ' + error.message)

/**
 * **적합 판정은 세 축을 동시에 통과해야 한다.**
 *
 * 하나만 보면 반드시 틀린다 — 실측으로 두 번 겪었다:
 *   · 어수만 → FK 15.37 짜리 NASA 사진설명이 초6 자리를 통과했다(45% 오분류)
 *   · FK 만  → Little Women(1868)·Tom Sawyer(1876)가 초6~중1 로 나왔다(19세기 어휘)
 *
 * 그래서 ① 어수창(시중) ② FK 밴드(시중) ③ 교육과정 어휘(시중 p90) 셋을 함께 건다.
 * **떨어진 축을 기록한다** — "몇 편이 적합인가" 보다 "어디서 떨어지는가" 가 다음 작업을 정한다.
 */
const scored = []
for (const r of rows) {
  const m = readability(r.content ?? '')
  if (!m) continue
  const band = bandOf(m.fk)
  const spec = BAND_SPEC[band] ?? null
  const win = spec ? PASSAGE_WORDS : null
  const fit = spec ? curriculumFit(r.content ?? '', spec.school) : null

  const failed = []
  if (!spec) failed.push('밴드밖')
  if (win && (m.words < win.min || m.words > win.max)) failed.push('어수창')
  if (fit && !fit.pass) failed.push('어휘')
  if (spec && !fit) failed.push('어휘못잼')

  scored.push({
    ...m,
    cov: fit?.coverage ?? null,
    pctile: fit?.marketPercentile ?? null,
    source: r.source,
    title: r.title,
    cefr: r.cefr_level,
    register: r.register,
    v: r.article_v_level,
    band,
    school: spec?.school ?? null,
    fits: failed.length === 0,
    failed,
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
    v.elem.push(s.cov.star1Pct)
    v.mid.push(s.cov.throughStar2Pct)
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

console.log(`\n■ 학년 밴드별 우리 재고 — 3축 동시 판정\n`)
const ORDER = ['초3 미만', ...BANDS.map((b) => b.id), '중3 초과']
console.log(
  pad('밴드', 12) + lp('FK창', 11) + lp('어수창', 11) + lp('FK통과', 8) +
    lp('+어수', 7) + lp('+어휘=적합', 11) + lp('시중자리', 9)
)
console.log('─'.repeat(70))
let fitTotal = 0
for (const id of ORDER) {
  const b = BANDS.find((x) => x.id === id)
  const list = scored.filter((s) => s.band === id)
  const spec = BAND_SPEC[id] ?? null
  const win = spec ? PASSAGE_WORDS : null
  const inWin = list.filter((s) => !s.failed.includes('어수창'))
  const fit = list.filter((s) => s.fits)
  fitTotal += fit.length
  const pcts = fit.map((s) => s.pctile).filter((x) => x != null)
  console.log(
    pad(id, 12) +
      lp(b ? `${b.min}~${b.max}` : '—', 11) +
      lp(win ? `${win.min}~${win.max}` : '—', 11) +
      lp(list.length, 8) +
      lp(spec ? inWin.length : '—', 7) +
      lp(spec ? fit.length : '—', 11) +
      lp(pcts.length ? med(pcts) : '—', 9) +
      (spec && fit.length === 0 ? '  ← 빈칸' : '') +
      (spec?.borrowed ? '  (어수창 빌림)' : '')
  )
}
console.log('─'.repeat(70))
console.log(pad('3축 통과 합계', 12) + lp(fitTotal, 47))

// § 어디서 떨어지는가 — 다음 작업을 정하는 것은 이 표다
console.log(`\n■ 탈락 사유 (중복 계수 · 밴드 안에 든 ${scored.filter((s) => BAND_SPEC[s.band]).length}편 기준)\n`)
const why = new Map()
for (const s of scored) {
  if (!BAND_SPEC[s.band]) continue
  for (const f of s.failed) why.set(f, (why.get(f) ?? 0) + 1)
}
for (const [k, n] of [...why.entries()].sort((a, b) => b[1] - a[1]))
  console.log('  ' + pad(k, 10) + lp(n, 6))
if (!why.size) console.log('  (없음)')

console.log(
  `\n어휘 문턱: 초등 ${CURRICULUM_SPEC.outside.elementary.p90}% · 중등 ${CURRICULUM_SPEC.outside.middle.p90}%` +
    ` — 시중 지문 ${CURRICULUM_SPEC.outside.elementary.sample + CURRICULUM_SPEC.outside.middle.sample}쪽 실측 p90 (${CURRICULUM_SPEC.measuredAt})`
)
console.log('시중 자리 50 = 시중 중앙과 같은 결. 20 이면 시중보다 쉬운 글만 모은 것이다.')

const report = {
  measuredAt: new Date().toISOString(),
  window: WIN,
  formula:
    'Flesch-Kincaid — textbook-corpus/analyze.mjs 와 동일 (0.39·문장길이 + 11.8·음절/낱말 − 15.59)',
  caveat:
    'FK 는 어휘 친숙도를 모른다. NASA 사진설명은 FK 가 낮아도 CEFR C1 이다 — 반드시 CEFR·V-Level 과 함께 본다.',
  marketBands: marketRows,
  bands: BANDS,
  // 밴드마다 세 축을 따로 적는다 — 합계만 적으면 어디를 고쳐야 하는지 알 수 없다.
  ourByBand: ORDER.map((id) => {
    const list = scored.filter((s) => s.band === id)
    const spec = BAND_SPEC[id] ?? null
    return {
      band: id,
      n: list.length,
      inWordWindow: spec ? list.filter((s) => !s.failed.includes('어수창')).length : null,
      fits: spec ? list.filter((s) => s.fits).length : null,
      marketPercentileMedian: spec
        ? med(list.filter((s) => s.fits).map((s) => s.pctile).filter((x) => x != null))
        : null,
      wordWindow: spec ? PASSAGE_WORDS : null,
    }
  }),
  fitTotal,
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
