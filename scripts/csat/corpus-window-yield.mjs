// scripts/csat/corpus-window-yield.mjs
//
// **모은 글에서 수능 대역에 맞는 지문을 몇 개나 잘라낼 수 있는가.**
//
// ── 왜 이 자가 필요한가 ──────────────────────────────────────────────
// `check-passage-band.mjs` 는 **지문 하나**를 유형 대역에 대고 잰다. 그런데 §10.14 는
// 저장소 글 531편을 그 자로 재서 "동시 만족 2편"이라는 결론을 냈다.
//
// 그 측정에는 단위 불일치가 있다. 대역은 **단일 지문(120~200 낱말)** 에서 만든 것인데
// 모은 글은 600~5,000 낱말이다. 5,000 낱말짜리 논문 에세이는 `words 124~163` 을
// 만족할 수 없다 — 길이가 30배다. 즉 "글이 대역 밖" 은 당연하고, 물어야 할 것은 다르다:
//
//   **그 글에서 대역에 맞는 창(window)을 잘라낼 수 있는가.**
//
// 수능 지문도 원래 그렇게 만들어진다 — 원문을 통째로 싣지 않고 한 대목을 발췌·손질한다.
// 그래서 이 자는 문장 경계를 따라 창을 밀며, 유형 대역을 만족하는 창의 수를 센다.
//
// ⚠️ 이 숫자는 "수능 문항이 몇 개 나온다" 가 아니라 **"대역에 드는 지문 후보가 몇 개냐"** 다.
//   문항이 되려면 논리 구조(빈칸 자리·순서 단서·요지)가 있어야 하고 그건 여기서 안 본다.
//   과대 해석 금지 — 이건 **상한**이지 산출량이 아니다.
//
// 실행:
//   pnpm dlx tsx scripts/csat/corpus-window-yield.mjs                    # 전수
//   pnpm dlx tsx scripts/csat/corpus-window-yield.mjs --source plos      # 소스 한정
//   pnpm dlx tsx scripts/csat/corpus-window-yield.mjs --limit 400        # 표본
//   pnpm dlx tsx scripts/csat/corpus-window-yield.mjs --type R-BLANK
//   … [--out <경로.json>]
//
// 재실행 안전: 읽기만 한다. DB 에 쓰지 않는다.

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const onlySource = arg('source')
const onlyType = arg('type')
const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity
const outPath = arg('out')

const BANDS = JSON.parse(
  fs.readFileSync(path.resolve('scripts/csat/data/type-bands-all.json'), 'utf8'),
).bands

/** 독해 유형만 — 듣기(L-*)는 대본이라 글 코퍼스와 단위가 다르다. */
const READING_TYPES = Object.keys(BANDS).filter(
  (t) => t.startsWith('R-') && BANDS[t].ok && BANDS[t].words && BANDS[t].sentLen && BANDS[t].wordLen,
)
const TYPES = onlyType ? READING_TYPES.filter((t) => t === onlyType) : READING_TYPES
if (!TYPES.length) {
  console.error(`대역이 있는 독해 유형이 없다. 쓸 수 있는 것: ${READING_TYPES.join(' ')}`)
  process.exit(2)
}

// `check-passage-band.mjs` 와 **같은 정의**를 쓴다. 다르면 두 자가 다른 것을 재게 된다.
const W = (s) => s.match(/[A-Za-z][A-Za-z'-]*/g) ?? []
const splitSentences = (s) =>
  s
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 3)

function metricsOf(words, sentCount) {
  return {
    words: words.length,
    sentLen: words.length / Math.max(1, sentCount),
    wordLen: words.reduce((s, x) => s + x.length, 0) / Math.max(1, words.length),
    ttr: new Set(words.map((x) => x.toLowerCase())).size / Math.max(1, words.length),
  }
}

/**
 * **산문 게이트** — 수치 대역만 보면 서지 블록이 통과한다.
 *
 * 실측 2026-08-30: PLOS 글의 첫 in-band 창이 지문이 아니라 인용 서지였다 —
 *   "Citation: Suthar AB, Bärnighausen T (2017) … PLoS Med 14(12): e1002469.
 *    https://doi.org/… Published: December 12, 2017 This is an open access article…"
 *   낱말 155 · 문장당 22.1 · 낱말길이 5.10 — 세 대역을 전부 만족한다.
 *   DOI·저자명이 **긴 낱말**로 세어지고 서지 블록이 **긴 문장**이 되기 때문이다.
 *
 * 즉 대역은 필요조건이지 충분조건이 아니다. 이 게이트가 없으면 수확량이 부풀려지고,
 * 그 숫자로 "소스가 충분하다" 는 결론을 내리게 된다. 걸러 내는 것은 산문이 아닌 것뿐이다.
 */
const NON_PROSE = [
  /https?:\/\//i,
  /\bdoi\.org\b|\bdoi:\s*10\./i,
  /\bCitation:\s/,
  /\bPublished:\s/,
  /\bCopyright:\s|\ball copyright\b|\bopen access article\b/i,
  /\bReceived:\s|\bAccepted:\s/,
  /\bFunding:\s|\bCompeting interests:\s|\bData Availability\b/i,
  /\bPLoS\b|\bPLOS\s(?:ONE|Med|Biol|Genet)\b/,
  /\be\d{6,}\b/, // PLOS 논문번호 e1002469
]

function looksLikeProse(text, words) {
  for (const re of NON_PROSE) if (re.test(text)) return false
  // 아주 긴 토큰(URL 잔재·식별자)과 숫자 과다는 산문이 아니다.
  if (words.some((w) => w.length > 24)) return false
  const digits = (text.match(/\d/g) ?? []).length
  if (digits / Math.max(1, text.length) > 0.05) return false
  // 대문자 약어·이니셜이 과하면 저자 목록이다 (예: "Suthar AB, Bärnighausen T").
  const initials = (text.match(/\b[A-Z]{1,3}\b/g) ?? []).length
  if (initials / Math.max(1, words.length) > 0.08) return false
  return true
}

const inBand = (m, b) =>
  m.words >= b.words.lo && m.words <= b.words.hi &&
  m.sentLen >= b.sentLen.lo && m.sentLen <= b.sentLen.hi &&
  m.wordLen >= b.wordLen.lo && m.wordLen <= b.wordLen.hi

/**
 * 문장 경계를 따라 창을 민다. 창은 **연속한 문장 묶음**이고, 낱말 수가 유형 대역의
 * words.hi 를 넘으면 멈춘다. 겹치는 창을 세면 같은 대목을 여러 번 세게 되므로,
 * 한 유형에서 **겹치지 않는** 창만 센다(맞으면 그 창 끝으로 시작점을 옮긴다).
 */
function windowYield(text, band) {
  const sents = splitSentences(text)
  const wordsPer = sents.map((s) => W(s))
  let hits = 0
  let i = 0
  while (i < sents.length) {
    let acc = []
    let j = i
    let matched = -1
    while (j < sents.length) {
      acc = acc.concat(wordsPer[j])
      j++
      if (acc.length > band.words.hi) break
      if (acc.length < band.words.lo) continue
      if (!inBand(metricsOf(acc, j - i), band)) continue
      // 대역을 통과해도 산문이 아니면 지문 후보가 아니다 — 위 NON_PROSE 주석 참조.
      if (!looksLikeProse(sents.slice(i, j).join(' '), acc)) continue
      matched = j
      break
    }
    if (matched > 0) { hits++; i = matched } else { i++ }
  }
  return hits
}

// ── 코퍼스 ─────────────────────────────────────────────────────────
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const rows = []
for (let from = 0; rows.length < LIMIT; from += 200) {
  let q = db
    .from('library_articles')
    .select('id, source, content, display_only')
    .not('content', 'is', null)
  if (onlySource) q = q.eq('source', onlySource)
  const { data, error } = await q.range(from, from + 199)
  if (error) throw new Error('조회 실패: ' + error.message)
  if (!data || data.length === 0) break
  rows.push(...data)
  if (data.length < 200) break
}
const corpus = rows.filter((r) => !r.display_only).slice(0, LIMIT === Infinity ? undefined : LIMIT)

console.log(`코퍼스 ${corpus.length}편 (파생 금지 제외) · 유형 ${TYPES.length}종\n`)
console.log(['유형'.padEnd(12), '대역(낱말/문장/낱말길이)'.padEnd(34), '창'.padStart(7), '글'.padStart(7), '글비율'].join(' '))

const report = { builtAt: new Date().toISOString(), corpus: corpus.length, types: {} }
const perArticleAny = new Set()

for (const t of TYPES) {
  const b = BANDS[t]
  let windows = 0
  let articles = 0
  for (const a of corpus) {
    const n = windowYield(a.content, b)
    if (n > 0) { articles++; perArticleAny.add(a.id) }
    windows += n
  }
  report.types[t] = { windows, articles }
  const bandStr = `${b.words.lo}~${b.words.hi} / ${b.sentLen.lo.toFixed(1)}~${b.sentLen.hi.toFixed(1)} / ${b.wordLen.lo.toFixed(2)}~${b.wordLen.hi.toFixed(2)}`
  console.log(
    [
      t.padEnd(12),
      bandStr.padEnd(34),
      String(windows).padStart(7),
      String(articles).padStart(7),
      ((100 * articles) / Math.max(1, corpus.length)).toFixed(1) + '%',
    ].join(' '),
  )
}

const anyWindows = Object.values(report.types).reduce((s, x) => s + x.windows, 0)
report.articlesWithAnyWindow = perArticleAny.size
report.totalWindows = anyWindows
console.log(
  `\n어느 유형이든 대역에 드는 창을 가진 글 ${perArticleAny.size} / ${corpus.length}` +
    ` (${((100 * perArticleAny.size) / Math.max(1, corpus.length)).toFixed(1)}%)`,
)
console.log(`유형별 창 합계 ${anyWindows} — ⚠️ 유형끼리 겹칠 수 있으므로 지문 수가 아니라 **상한**이다.`)

if (outPath) {
  fs.writeFileSync(path.resolve(outPath), JSON.stringify(report, null, 2))
  console.log(`\n→ ${outPath}`)
}
