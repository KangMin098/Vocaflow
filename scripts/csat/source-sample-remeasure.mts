// scripts/csat/source-sample-remeasure.mts
//
// **원천별 표본을 한 자로 다시 잰다.**
//
// ── 왜 이 도구가 생겼는가 (2026-09-23) ────────────────────────────────
// 소스GET 실측을 원천군마다 다른 에이전트가 병렬로 돌렸는데, 각자 **논증 표지 목록을
// 스스로 정했다** — 28개 · 40개 · 70개. 그래서 돌아온 `argument_marker_pct` 는
// 원천 간 비교가 불가능한 값인데, 나는 그것으로 순위표를 만들었다.
//
// 그 오류가 실제 판정을 뒤집은 사례가 있다: EconStor 를 「길이는 맞는데 논증이 없다」
// (주장동사 1.5%)로 기록했는데, 그 1.5% 는 argue/claim/contend/propose **네 낱말만**
// 센 값이었다. 표준 집합으로 다시 재니 문장의 **23.2%** 가 표지를 갖는다.
// 「논증이 없는 원천」이 아니라 **「표지 정의가 좁았던 측정」**이었다.
//
// 그래서 이 파일이 **표지 집합·어수·문장 분할의 정본**이다. 원천별 표본 JSON 의
// `text` 를 읽어 전부 같은 규칙으로 다시 재고, 재지 못한 원천은 **재지 못했다고 적는다**
// (빈 값을 0 으로 채우면 「논증 없음」으로 읽힌다 — 그게 EconStor 에서 일어난 일이다).
//
// 사용:
//   pnpm dlx tsx scripts/csat/source-sample-remeasure.mts --dir <스크래치패드> [--out <경로>]
//
// 읽기 전용. DB 접속 없음.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const argOf = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const DIR = resolve(argOf('dir', '.'))
const OUT = resolve(argOf('out', 'docs/reports/data/sources-remeasured.json'))

/**
 * **논증 표지 정본.** 넓은 담화 표지까지 포함한다 — 좁히면 EconStor 사고가 재현된다.
 * 셋으로 나눠 함께 보고한다: 좁게 세면 왜 낮아지는지가 수치로 남아야 한다.
 */
const CLAIM_VERBS = [
  'argue', 'argues', 'argued', 'argument', 'arguments', 'claim', 'claims', 'claimed',
  'contend', 'contends', 'assert', 'asserts', 'posit', 'posits', 'propose', 'proposes', 'proposed',
]
const MODALS = ['should', 'must', 'ought', 'need to', 'cannot', 'shouldnt']
const DISCOURSE = [
  'however', 'therefore', 'thus', 'hence', 'moreover', 'furthermore', 'nevertheless', 'nonetheless',
  'although', 'though', 'whereas', 'despite', 'consequently', 'because', 'yet', 'instead', 'rather',
  'in contrast', 'on the other hand', 'on the contrary', 'by contrast', 'in fact', 'indeed',
  'evidence', 'suggest', 'suggests', 'suggested', 'conclude', 'concludes', 'concluded',
  'imply', 'implies', 'arguably', 'debate', 'dispute', 'critics', 'scholars', 'for example',
]
/** 세 계열의 합집합이 정본 비율이다. */
const BROAD = [...new Set([...CLAIM_VERBS, ...MODALS, ...DISCOURSE])]

/** 기출 지문 기준선 — 이 값들과만 비교한다(다른 자로 잰 값과 섞지 않는다). */
const TARGET = { median: 164, p25: 144, p75: 188 }

const clean = (s: string): string =>
  s.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()

const wordsOf = (s: string): string[] => clean(s).match(/[A-Za-z][A-Za-z'’-]*/g) ?? []

/** 문장 분할 — 약어에서 과하게 쪼개지 않도록 대문자 시작을 요구한다. */
const sentencesOf = (s: string): string[] =>
  clean(s)
    .split(/(?<=[.!?])\s+(?=[A-Z"'“])/)
    .map((x) => x.trim())
    .filter((x) => (x.match(/[A-Za-z]+/g) ?? []).length >= 5)

/** 표지 집합 하나에 대한 문장 비율. 낱말 경계로만 맞춘다(부분 일치 금지). */
function markerPct(text: string, markers: readonly string[]): number {
  const sents = sentencesOf(text)
  if (!sents.length) return 0
  const single = new Set(markers.filter((m) => !m.includes(' ')))
  const phrases = markers.filter((m) => m.includes(' '))
  let hit = 0
  for (const s of sents) {
    const lower = s.toLowerCase()
    const toks = lower.match(/[a-z][a-z'’-]*/g) ?? []
    if (toks.some((t) => single.has(t)) || phrases.some((p) => lower.includes(p))) hit++
  }
  return (hit / sents.length) * 100
}

/**
 * **문장 경계로 자른 140~200어 토막을 몇 개 낼 수 있는가.**
 *
 * 「문단 3개 묶음」으로 재려 했으나 표본 본문이 이미 정규화돼 문단 경계가 없었다.
 * 그리고 실제로 중요한 질문은 문단 수가 아니라 **잘라 쓸 수 있느냐**다.
 * 어수로 자르면 Flesch 가 깨지므로 **문장 경계에서만** 자른다.
 *
 * 겹치지 않게 앞에서부터 담다가 140 을 넘기면 한 토막으로 끊는다(200 초과면 버린다 —
 * 한 문장이 60어를 넘는 글에서 생긴다).
 */
function spanYield(text: string): { spans: number[]; usablePct: number } {
  const sents = sentencesOf(text)
  const spans: number[] = []
  let buf = 0
  let used = 0
  for (const s of sents) {
    const w = wordsOf(s).length
    buf += w
    if (buf >= 140) {
      if (buf <= 200) {
        spans.push(buf)
        used += buf
      }
      buf = 0
    }
  }
  const total = wordsOf(text).length
  return { spans, usablePct: total ? (used / total) * 100 : 0 }
}

const pct = (arr: number[], q: number): number => {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(s.length * q))]
}
const inBand = (arr: number[]): number =>
  arr.length ? (arr.filter((w) => w >= 140 && w <= 200).length / arr.length) * 100 : 0

interface Row {
  file: string
  source: string
  n: number
  words_p25: number
  words_median: number
  words_p75: number
  band_140_200_pct: number
  /** 표본 전체에서 문장 경계로 뽑아낸 140~200어 토막 수 */
  spans: number
  /** 편당 평균 토막 수 — 한 편에서 지문을 몇 개 낼 수 있는가 */
  spans_per_doc: number
  /** 본문 어수 중 토막에 실제로 담긴 비율 */
  usable_pct: number
  marker_broad_pct: number
  marker_claim_verbs_pct: number
  marker_discourse_pct: number
}

const rows: Row[] = []
const skipped: { file: string; reason: string }[] = []

for (const file of readdirSync(DIR).filter((f) => /samples.*\.json$/.test(f))) {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(join(DIR, file), 'utf8'))
  } catch {
    skipped.push({ file, reason: 'JSON 파싱 실패' })
    continue
  }
  const arr = Array.isArray(parsed)
    ? parsed
    : ((parsed as { samples?: unknown[] }).samples ?? [])
  const texts = (arr as { text?: unknown }[])
    .map((x) => (typeof x?.text === 'string' ? x.text : ''))
    .filter((t) => wordsOf(t).length >= 60)
  if (!texts.length) {
    // ⚠️ 0 으로 채우지 않는다 — 「논증 없음」으로 읽힌다.
    skipped.push({ file, reason: '본문 미저장 — 같은 자로 다시 잴 수 없다' })
    continue
  }
  const w = texts.map((t) => wordsOf(t).length)
  const yields = texts.map((t) => spanYield(t))
  const spanCount = yields.reduce((a, y) => a + y.spans.length, 0)
  const usable = yields.reduce((a, y) => a + y.usablePct, 0) / yields.length
  const joined = texts.join('\n\n')
  rows.push({
    file,
    source: file.replace(/-samples.*\.json$/, ''),
    n: texts.length,
    words_p25: pct(w, 0.25),
    words_median: pct(w, 0.5),
    words_p75: pct(w, 0.75),
    band_140_200_pct: Number(inBand(w).toFixed(1)),
    spans: spanCount,
    spans_per_doc: Number((spanCount / texts.length).toFixed(1)),
    usable_pct: Number(usable.toFixed(1)),
    marker_broad_pct: Number(markerPct(joined, BROAD).toFixed(1)),
    marker_claim_verbs_pct: Number(markerPct(joined, CLAIM_VERBS).toFixed(1)),
    marker_discourse_pct: Number(markerPct(joined, DISCOURSE).toFixed(1)),
  })
}

rows.sort((a, b) => b.spans_per_doc - a.spans_per_doc)

const pad = (s: string | number, n: number): string => String(s).padStart(n)
console.log(`기출 기준선  중앙 ${TARGET.median}어 · p25 ${TARGET.p25} · p75 ${TARGET.p75}`)
console.log('「토막」= 문장 경계로 자른 140~200어 덩이 · 「쓰이는 비율」= 본문 중 토막에 담긴 몫\n')
console.log('원천                 n   어수중앙  통째140~200   토막/편   쓰이는비율   표지(넓게)  주장동사만')
for (const r of rows) {
  console.log(
    `${r.source.padEnd(20)}${pad(r.n, 4)}${pad(r.words_median, 10)}${pad(r.band_140_200_pct + '%', 12)}` +
      `${pad(r.spans_per_doc, 10)}${pad(r.usable_pct + '%', 13)}${pad(r.marker_broad_pct + '%', 12)}${pad(r.marker_claim_verbs_pct + '%', 12)}`
  )
}
if (skipped.length) {
  console.log('\n같은 자로 못 잰 것 — 값을 0 으로 채우지 않는다:')
  for (const s of skipped) console.log(`  ${s.file.padEnd(34)} ${s.reason}`)
}

writeFileSync(
  OUT,
  JSON.stringify(
    { measuredAt: new Date().toISOString().slice(0, 10), contract: 'source-remeasure/v1', target: TARGET, markerSets: { broad: BROAD.length, claimVerbs: CLAIM_VERBS.length, discourse: DISCOURSE.length }, rows, skipped },
    null,
    2
  )
)
console.log(`\n기록: ${OUT}`)
