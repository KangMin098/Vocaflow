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

import { looksLikeProse } from './prose-gate.mjs'

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

/**
 * **서로 겹치지 않는 지문 슬롯** — 이게 "지문 몇 개" 의 정직한 답이다.
 *
 * 유형별 합계(위)는 같은 대목을 여러 유형이 세므로 지문 수가 아니다. 한 글을 한 번만
 * 훑으면서, 어느 유형이든 대역을 만족하는 창을 **겹치지 않게** 잘라 세면
 * 실제로 뽑아낼 수 있는 지문 수의 상한이 나온다. 창 하나에 여러 유형이 맞으면
 * 그중 하나로만 센다(문항 유형은 나중에 고르면 되고, 지문 자체는 하나다).
 */
function distinctSlots(text) {
  const sents = splitSentences(text)
  const wordsPer = sents.map((s) => W(s))
  const byType = []
  let i = 0
  while (i < sents.length) {
    let acc = []
    let j = i
    let matched = -1
    let matchedType = null
    while (j < sents.length) {
      acc = acc.concat(wordsPer[j])
      j++
      // 어떤 유형의 최대 낱말 수도 못 넘으면 더 붙일 이유가 없다.
      if (acc.length > SLOT_MAX_WORDS) break
      const m = metricsOf(acc, j - i)
      // ⚠️ 처음에는 `TYPES.find` 로 **먼저 나오는 유형**에 귀속시켰다. 그랬더니
      //   R-IRRELEVANT(낱말 51~174)·R-NOTICE(68~99) 처럼 **대역이 헐거운 유형**이
      //   슬롯의 60% 를 먹었다 — 창을 짧게 끊어 더 많이 세게 되고, 그러면 "지문 수" 가
      //   실제보다 부풀려진다. 창은 **가장 좁게 맞는 유형**에 귀속시킨다.
      const t = NARROW_FIRST.find((t) => inBand(m, BANDS[t]))
      if (!t) continue
      if (!looksLikeProse(sents.slice(i, j).join(' '), acc)) continue
      matched = j
      matchedType = t
      break
    }
    if (matched > 0) { byType.push(matchedType); i = matched } else { i++ }
  }
  return byType
}

/**
 * 슬롯을 셀 때 쓰는 **본문 지문 유형**만 — 최소 낱말 수 105 이상.
 *
 * ⚠️ 이걸 안 걸었을 때 R-IRRELEVANT(51~174)·R-NOTICE(68~99)가 슬롯의 60% 를 먹었다.
 *   탐욕 창은 **가장 짧게 맞는 지점에서 끊기므로**, 하한이 51·68 인 유형이 있으면
 *   51~99 낱말짜리 조각이 계속 잘려 나온다. 그건 지문이 아니라 조각이고,
 *   그 수를 "지문 몇 개" 로 보고하면 목표 달성률이 통째로 부풀려진다.
 *   (R-NOTICE 는 안내문, R-IRRELEVANT 는 문장 하나가 더 붙은 형식이라 하한이 낮다.)
 */
const SLOT_TYPES = TYPES.filter((t) => BANDS[t].words.lo >= 105)
/** 대역 폭이 좁은 유형부터 — 창을 가장 구체적으로 맞는 유형에 귀속시킨다. */
const SLOT_MAX_WORDS = Math.max(...SLOT_TYPES.map((t) => BANDS[t].words.hi))
const NARROW_FIRST = [...SLOT_TYPES].sort(
  (a, b) => (BANDS[a].words.hi - BANDS[a].words.lo) - (BANDS[b].words.hi - BANDS[b].words.lo),
)
const slotByType = new Map()
let slots = 0
for (const a of corpus) {
  for (const t of distinctSlots(a.content)) {
    slots++
    slotByType.set(t, (slotByType.get(t) ?? 0) + 1)
  }
}
report.distinctSlots = slots
report.distinctByType = Object.fromEntries(slotByType)
console.log(`\n겹치지 않는 지문 슬롯 **${slots.toLocaleString()}개** — 유형이 겹치면 하나로만 센다.`)
// ⚠️ 이 복합 수치에는 구조적 편향이 남는다 — 탐욕 창은 가장 짧게 맞는 지점에서 끊기므로
//   **하한(words.lo)이 가장 낮은 유형**이 절단을 독식한다. 하한 105 미만을 뺀 뒤에도
//   R-CHART(107)가 최다가 됐다. 그래서 단위로 쓸 것은 아래가 아니라 **위의 유형별 창 수**다
//   (각 유형 안에서는 이미 겹치지 않으므로 그 값은 그대로 "그 유형 지문 몇 개" 다).
console.log(`  ⚠️ 복합 수치는 하한이 낮은 유형이 절단을 독식하는 편향이 있다 — 단위로는 위의 유형별 창 수를 쓸 것.`)
for (const [t, n] of [...slotByType].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
  console.log(`  ${t.padEnd(13)} ${String(n).padStart(6)}`)
}
for (const [label, target] of [['1단계', 10000], ['2단계', 30000], ['3단계', 50000]]) {
  const pct = (100 * slots) / target
  console.log(`  ${label} ${target.toLocaleString().padStart(6)} → ${pct >= 100 ? '달성' : '미달'} ${pct.toFixed(1)}%`)
}
console.log(
  `\n어느 유형이든 대역에 드는 창을 가진 글 ${perArticleAny.size} / ${corpus.length}` +
    ` (${((100 * perArticleAny.size) / Math.max(1, corpus.length)).toFixed(1)}%)`,
)
console.log(`유형별 창 합계 ${anyWindows} — ⚠️ 유형끼리 겹칠 수 있으므로 지문 수가 아니라 **상한**이다.`)

if (outPath) {
  fs.writeFileSync(path.resolve(outPath), JSON.stringify(report, null, 2))
  console.log(`\n→ ${outPath}`)
}
