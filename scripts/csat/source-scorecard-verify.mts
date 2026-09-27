// scripts/csat/source-scorecard-verify.mts
//
// **에이전트 산출을 계약으로 받아 대조한다 — 보고 문장을 근거로 쓰지 않는다.**
//
// 서브에이전트는 `*-g0-<pid>.json` 을 읽고 `*-g0-<pid>.out.json` 을 쓴다. 이 스크립트는
// 그 출력이 **입력과 같은 표본인지**(해시) · **빠진 항목이 없는지**(건수) ·
// **열거형을 벗어나지 않았는지**(스키마) 를 직접 확인한다. 하나라도 어긋나면 그 원천은
// FAIL 로 남고 집계에서 빠진다 — 조용히 통과시키면 채점표가 근거 없는 수치를 갖는다.
//
// 통과한 것만으로 **3중 합의 CEFR** 을 낸다(어휘 0.5 + 가독성 0.3 + LLM 0.2 — 정본
// `cefr-detect.ts` 의 `aggregate` 와 같은 가중·반올림). 앞 둘은 export 가 이미 계산해
// 청크에 넣어 뒀고 해시로 잠겨 있으므로 **에이전트가 바꿀 수 없다.**
//
// 기준선(비교 대상):
//   CEFR — 기출 802편 같은 식 측정(DD-57 정정) B2 51.2 · B1 31.7 · A2 14.8 · C1 0.6 · C2 0
//   소재 — 기출 218편 8분류(`docs/reports/topic-gap.json` target)
//
// ⚠️ 리포트에는 **원문이 한 조각도 안 나간다** — 이 스크립트의 출력은 수치와 id 뿐이다.
//
// 실행: pnpm exec tsx scripts/csat/source-scorecard-verify.mts --dir <chunk dir> [--json out.json]

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
type Cefr = (typeof CEFR)[number]

const REGISTERS = ['expository', 'argumentative', 'narrative', 'news', 'reference'] as const
const TOPICS = [
  '과학·자연',
  '사회·경제',
  '심리·인지',
  '교육·언어',
  '예술·문화',
  '역사·인류',
  '기술·매체',
  '철학·윤리',
  '분류불가',
] as const
const DEFECTS = [
  'none',
  'boilerplate',
  'duplicated',
  'fragment',
  'table-or-list',
  'caption',
  'citation-apparatus',
  'non-prose',
] as const

/** 기출 소재 분포 — `docs/reports/topic-gap.json` 의 target(218편 분류분). */
const EXAM_TOPIC: Record<string, number> = {
  '과학·자연': 23.4,
  '사회·경제': 18.3,
  '예술·문화': 17.9,
  '심리·인지': 14.2,
  '교육·언어': 11.5,
  '기술·매체': 6.0,
  '역사·인류': 5.5,
  '철학·윤리': 3.2,
}
/** 기출 CEFR — DD-57 정정(802편 · 어휘 0.5 + 가독성 0.3). */
const EXAM_CEFR: Record<string, number> = { A2: 14.8, B1: 31.7, B2: 51.2, C1: 0.6, C2: 0 }

const argOf = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback
}
const DIR = resolve(argOf('dir', '.agent-logs/source-scorecard'))

/** 합의 — LLM 이 있으면 0.5/0.3/0.2, 없으면 0.8 로 재정규화(정본 `aggregate` 와 같다). */
function consensus(vocab: Cefr, read: Cefr, llm: Cefr | null): Cefr {
  const idx = (l: Cefr) => CEFR.indexOf(l)
  const num = idx(vocab) * 0.5 + idx(read) * 0.3 + (llm ? idx(llm) * 0.2 : 0)
  const den = llm ? 1.0 : 0.8
  return CEFR[Math.max(0, Math.min(5, Math.round(num / den)))]!
}

const pct = (cell: Record<string, number>) => {
  const total = Object.values(cell).reduce((a, b) => a + b, 0) || 1
  return Object.fromEntries(
    Object.entries(cell)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => [k, +((v / total) * 100).toFixed(1)]),
  )
}

type Failure = { source: string; check: string; detail: string }
const failures: Failure[] = []
const results: Record<string, unknown>[] = []

// `manifest-*` 는 청크가 아니다 — 이름만으로 거르면 다음 사람이 청크를 `manifest-…` 로 부르는 날 조용히 빠진다.
// 그래서 **계약과 items 유무**로 거른다(모양이 판정 근거다).
const chunkFiles = readdirSync(DIR).filter((f) => {
  if (!f.endsWith('.json') || f.endsWith('.out.json')) return false
  try {
    const j = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as { contract?: string; items?: unknown[] }
    return j.contract === 'source-scorecard/v1' && Array.isArray(j.items)
  } catch {
    return false
  }
})

for (const file of chunkFiles.sort()) {
  const chunk = JSON.parse(readFileSync(join(DIR, file), 'utf8')) as {
    contract: string
    source: string
    stockLive: number
    sampled: number
    itemsSha256: string
    items: Record<string, any>[]
  }
  const source = chunk.source
  const outFile = join(DIR, file.replace(/\.json$/, '.out.json'))

  // ── 검사 1 — 입력 자체의 무결성(에이전트가 청크를 고쳤는가) ──────────
  const recomputed = createHash('sha256')
    .update(JSON.stringify(chunk.items.map((i) => ({ id: i['id'], e: i['excerpt'], s: i['signals'] }))))
    .digest('hex')
  if (recomputed !== chunk.itemsSha256) {
    failures.push({ source, check: 'chunk-sha256', detail: '청크가 export 이후 바뀌었다' })
    continue
  }

  if (!existsSync(outFile)) {
    failures.push({ source, check: 'missing-out', detail: `${file.replace(/\.json$/, '.out.json')} 없음` })
    continue
  }
  const out = JSON.parse(readFileSync(outFile, 'utf8')) as {
    contract?: string
    source?: string
    itemsSha256?: string
    judgements?: Record<string, any>[]
  }

  // ── 검사 2 — 계약·원천·해시 대조 ────────────────────────────────────
  if (out.contract !== 'source-scorecard-out/v1') {
    failures.push({ source, check: 'contract', detail: `contract=${out.contract}` })
    continue
  }
  if (out.source !== source) {
    failures.push({ source, check: 'source-mismatch', detail: `out.source=${out.source}` })
    continue
  }
  if (out.itemsSha256 !== chunk.itemsSha256) {
    failures.push({ source, check: 'sha-mismatch', detail: '다른 표본을 판정했다' })
    continue
  }

  // ── 검사 3 — 건수·id 집합 ───────────────────────────────────────────
  const judged = new Map<string, Record<string, any>>()
  for (const j of out.judgements ?? []) if (j?.['id']) judged.set(String(j['id']), j)
  const wantIds = chunk.items.map((i) => String(i['id']))
  const missing = wantIds.filter((id) => !judged.has(id))
  const extra = [...judged.keys()].filter((id) => !wantIds.includes(id))
  if (missing.length || extra.length) {
    failures.push({
      source,
      check: 'count',
      detail: `판정 ${judged.size}/${wantIds.length} · 누락 ${missing.length} · 외래 ${extra.length}`,
    })
    continue
  }

  // ── 검사 4 — 스키마·범위 ────────────────────────────────────────────
  const bad: string[] = []
  for (const id of wantIds) {
    const j = judged.get(id)!
    if (!(CEFR as readonly string[]).includes(j['llmCefr'])) bad.push(`${id}:llmCefr=${j['llmCefr']}`)
    if (!(REGISTERS as readonly string[]).includes(j['register'])) bad.push(`${id}:register=${j['register']}`)
    if (!(TOPICS as readonly string[]).includes(j['topic'])) bad.push(`${id}:topic=${j['topic']}`)
    if (!(DEFECTS as readonly string[]).includes(j['defect'])) bad.push(`${id}:defect=${j['defect']}`)
    if (typeof j['selfContained'] !== 'boolean') bad.push(`${id}:selfContained`)
    if (typeof j['prose'] !== 'boolean') bad.push(`${id}:prose`)
    if (!Array.isArray(j['csatTypes'])) bad.push(`${id}:csatTypes`)
    if (bad.length > 8) break
  }
  if (bad.length) {
    failures.push({ source, check: 'schema', detail: bad.slice(0, 8).join(' · ') })
    continue
  }

  // ── 통과 — 합의 계산 + 집계 ─────────────────────────────────────────
  const cefrDist: Record<string, number> = {}
  const registerDist: Record<string, number> = {}
  const topicDist: Record<string, number> = {}
  const defectDist: Record<string, number> = {}
  const typeHits: Record<string, number> = {}
  let selfContained = 0
  let prose = 0
  let hitRateSum = 0
  let tooShort = 0
  const wordCounts: number[] = []
  const signalGap: Record<string, number> = {}

  for (const item of chunk.items) {
    const j = judged.get(String(item['id']))!
    const sig = item['signals'] as { vocabCefr: Cefr; readabilityCefr: Cefr; vocabHitRate: number; tooShort: boolean }
    if (sig.tooShort) tooShort++
    const level = consensus(sig.vocabCefr, sig.readabilityCefr, j['llmCefr'] as Cefr)
    cefrDist[level] = (cefrDist[level] ?? 0) + 1
    registerDist[j['register']] = (registerDist[j['register']] ?? 0) + 1
    topicDist[j['topic']] = (topicDist[j['topic']] ?? 0) + 1
    defectDist[j['defect']] = (defectDist[j['defect']] ?? 0) + 1
    for (const t of j['csatTypes'] as string[]) typeHits[t] = (typeHits[t] ?? 0) + 1
    if (j['selfContained']) selfContained++
    if (j['prose']) prose++
    hitRateSum += sig.vocabHitRate
    wordCounts.push(Number(item['measuredWords'] ?? 0))
    const gap = `${sig.vocabCefr}/${sig.readabilityCefr}/${j['llmCefr']}`
    signalGap[gap] = (signalGap[gap] ?? 0) + 1
  }

  const n = chunk.items.length
  const cefrPct = pct(cefrDist)
  const topicPct = pct(topicDist)
  // 소재 적합 — 기출 분포와의 총변동거리(0=같음, 100=완전히 다름). 분류불가는 기출에 없으므로 차이로 센다.
  const tvd =
    Object.keys({ ...EXAM_TOPIC, ...topicPct }).reduce(
      (acc, k) => acc + Math.abs((topicPct[k] ?? 0) - (EXAM_TOPIC[k] ?? 0)),
      0,
    ) / 2
  const cefrTvd =
    Object.keys({ ...EXAM_CEFR, ...cefrPct }).reduce(
      (acc, k) => acc + Math.abs((cefrPct[k] ?? 0) - (EXAM_CEFR[k] ?? 0)),
      0,
    ) / 2
  wordCounts.sort((a, b) => a - b)

  results.push({
    source,
    stockLive: chunk.stockLive,
    sampled: n,
    verified: true,
    consensusCefr: cefrPct,
    /** 기출 CEFR 분포와의 거리 — 낮을수록 기출을 닮았다. */
    cefrDistanceToExam: +cefrTvd.toFixed(1),
    /** 기출 상한(B2) 안에 드는 비율. */
    inBandPct: +(((cefrDist['A1'] ?? 0) + (cefrDist['A2'] ?? 0) + (cefrDist['B1'] ?? 0) + (cefrDist['B2'] ?? 0)) / n * 100).toFixed(1),
    register: pct(registerDist),
    topic: topicPct,
    topicDistanceToExam: +tvd.toFixed(1),
    defect: pct(defectDist),
    cleanPct: +(((defectDist['none'] ?? 0) / n) * 100).toFixed(1),
    selfContainedPct: +((selfContained / n) * 100).toFixed(1),
    prosePct: +((prose / n) * 100).toFixed(1),
    csatTypeHits: pct(typeHits),
    csatTypeCoverage: Object.keys(typeHits).filter((t) => t !== 'none').length,
    vocabHitRateAvg: +((hitRateSum / n) * 100).toFixed(1),
    tooShort,
    wordsMedian: wordCounts[Math.floor(n / 2)] ?? 0,
    signalGapTop: Object.fromEntries(Object.entries(signalGap).sort((a, b) => b[1] - a[1]).slice(0, 4)),
  })
}

const out = {
  readOnly: true,
  contract: 'source-scorecard/v1',
  verifiedAt: new Date().toISOString(),
  baseline: { cefr: EXAM_CEFR, topic: EXAM_TOPIC, note: 'DD-57 정정 802편 · topic-gap.json 218편' },
  passed: results.length,
  failed: failures.length,
  failures,
  sources: results.sort((a, b) => (b['stockLive'] as number) - (a['stockLive'] as number)),
}
const jsonPath = argOf('json', '')
if (jsonPath) writeFileSync(resolve(jsonPath), JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
