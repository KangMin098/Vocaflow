// scripts/csat/measure-hss-abstracts.mts
//
// **인문사회 CC-BY 초록이 기출 지문 규격(164어)에 드는가 — 읽기 전용 · 집계만 출력.**
//
// ── 왜 이걸 재나 ─────────────────────────────────────────────────────
// 앞선 정찰은 「오픈액세스 논문을 더 넣어도 소용없다」로 끝났다. 그런데 그 결론은
// **PLOS · Frontiers · Europe PMC 만 재고 일반화한 것**이고, 셋 다 생의학·STEM 이다.
// 수능 지문의 실제 출처를 역추적하니 **인문·사회**였다(문화연구·정치학·영화이론·기호학).
// 인문사회 학술지는 **한 번도 재본 적이 없다.** 이 스크립트가 그 공백을 메운다.
//
// 구조가 다를 것이라고 볼 근거가 있다:
//   · 구조화 초록(Background/Methods/Results/Conclusion)이 없다 → 산문 한 덩이
//   · 방법·통계 절이 없다 → 인용 밀도가 낮다
//   · 초록이 논지 요약이다 → **주장 + 근거**가 초록 안에 들어 있다
//
// ⚠️ 재는 것은 **초록**이다. 전문이 아니다. OpenAlex 는 전문을 주지 않는다
//   (`abstract_inverted_index` 뿐). 초록이 규격에 들면 **전문 없이도 지문이 된다**는 뜻이므로
//   그 자체가 결론을 가른다 — 그래서 먼저 잰다.
//
// ⚠️ **저작권 경계**: 본문을 출력하지 않는다. 길이·등급 분포만 낸다(A1).
//
// 식은 정본 `analyze/cefr-detect.ts` 의 `aggregate` 와 같다 — 어휘(0.5) + 가독성(0.3),
// LLM 이 없으므로 0.8 로 재정규화. 기준선은 기출 802편 같은 식 측정(DD-57 정정).
//
// 실행: pnpm exec tsx scripts/csat/measure-hss-abstracts.mts [--per-field 200] [--json out.json]

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'
import { processText } from '@vocaflow/wlp'

for (const line of readFileSync(resolve('apps/web/.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, '')
}
const req = createRequire(resolve('packages/library-pipeline/package.json'))
const readabilityModule = req('text-readability')
const readability = readabilityModule.default ?? readabilityModule
const db = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  { auth: { persistSession: false } },
)

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
type Cefr = (typeof CEFR)[number]
const MAILTO = 'killerapp51@empal.com'
const UA = `Vocaflow-SourceProbe/1.0 (mailto:${MAILTO})`

const argOf = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : d
}
const PER_FIELD = Number(argOf('per-field', '200'))
/** 기출 지문 실측 — 중앙 164 · p25 144 · p75 188. */
const SPEC_MIN = 140
const SPEC_MAX = 200

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** OpenAlex 분야 — 생의학 대조군(27 의학)을 일부러 함께 넣는다. 비교 없는 수치는 근거가 약하다. */
const FIELDS: [string, string][] = [
  ['12', '예술·인문'],
  ['32', '심리학'],
  ['33', '사회과학'],
  ['20', '경제·계량'],
  ['14', '경영'],
  ['27', '의학(대조군)'],
]

const byReadability = (fre: number): Cefr =>
  fre >= 90 ? 'A1' : fre >= 80 ? 'A2' : fre >= 70 ? 'B1' : fre >= 55 ? 'B2' : fre >= 40 ? 'C1' : 'C2'

// ── 사전 ──────────────────────────────────────────────────────────────
const dict = new Map<string, Cefr>()
for (let from = ''; ; ) {
  let q = db.from('shared_dictionary').select('word, cefr_level').order('word').limit(1000)
  if (from) q = q.gt('word', from)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  if (!data?.length) break
  for (const r of data) {
    const lv = r.cefr_level as string | null
    if (lv && (CEFR as readonly string[]).includes(lv)) dict.set(r.word as string, lv as Cefr)
  }
  from = data.at(-1)!.word as string
  if (data.length < 1000) break
}
console.log(`사전 ${dict.size.toLocaleString()}낱말 · 분야당 ${PER_FIELD}편 · 규격 ${SPEC_MIN}~${SPEC_MAX}어`)

function byVocab(text: string): Cefr {
  const counts: Record<Cefr, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 }
  let known = 0
  for (const t of processText(text).sentences.flatMap((s) => s.tokens)) {
    const lemma = (t.lemma ?? '').toLowerCase()
    if (!lemma || lemma.length < 2 || /\d/.test(lemma)) continue
    const lv = dict.get(lemma)
    if (!lv) continue
    counts[lv]++
    known++
  }
  if (!known) return 'B1'
  let cum = 0
  for (const lv of CEFR) {
    cum += counts[lv]
    if (cum / known >= 0.8) return lv
  }
  return 'C2'
}
const consensus = (v: Cefr, r: Cefr): Cefr => {
  const i = (l: Cefr) => CEFR.indexOf(l)
  return CEFR[Math.max(0, Math.min(5, Math.round((i(v) * 0.5 + i(r) * 0.3) / 0.8)))]!
}

/** OpenAlex 는 초록을 역색인으로 준다 — 위치로 되돌린다. */
function fromInverted(inv: Record<string, number[]> | null): string {
  if (!inv) return ''
  const slots: string[] = []
  for (const [word, positions] of Object.entries(inv)) for (const p of positions) slots[p] = word
  return slots.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * **구조화 초록인가.** 생의학은 `Background:` `Methods:` 라벨을 달고, 인문사회는 안 단다.
 * 이 비율 차이가 「두 모집단이 다르다」의 가장 단단한 증거다.
 */
const STRUCTURED = /\b(background|objectives?|methods?|results?|conclusions?|purpose|design|setting|participants|measurements|findings)\s*[:.]/i

/** 논지 표지 — 주장을 세우는 글이 쓰는 말. 있다고 논증문인 것은 아니지만, 없으면 거의 아니다. */
const THESIS = /\b(I |we )?(argue|contend|claim|propose|suggest that|demonstrate that|show that|maintain that)\b|\bthis (article|paper|essay) (argues|contends|claims|proposes|shows|demonstrates)\b/i

type Row = { field: string; label: string }
const out: Record<string, unknown>[] = []

for (const [id, label] of FIELDS) {
  const words: number[] = []
  const levels: Record<string, number> = {}
  let structured = 0
  let thesis = 0
  let inSpec = 0
  let n = 0
  let cursor = '*'

  while (n < PER_FIELD) {
    const url =
      `https://api.openalex.org/works?per-page=100&cursor=${encodeURIComponent(cursor)}&mailto=${MAILTO}` +
      `&select=id,abstract_inverted_index,publication_year` +
      `&filter=best_oa_location.license:cc-by,language:en,type:article,has_abstract:true,primary_topic.field.id:fields/${id}`
    let body: string
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA } })
      if (!res.ok) {
        console.log(`  ${label}: HTTP ${res.status} — 중단`)
        break
      }
      body = await res.text()
    } catch (e) {
      console.log(`  ${label}: ${(e as Error).message} — 중단`)
      break
    }
    const j = JSON.parse(body) as {
      results: { abstract_inverted_index: Record<string, number[]> | null }[]
      meta: { next_cursor: string | null }
    }
    if (!j.results?.length) break
    for (const w of j.results) {
      if (n >= PER_FIELD) break
      const text = fromInverted(w.abstract_inverted_index)
      const wc = text.split(/\s+/).filter(Boolean).length
      // 너무 짧은 것은 초록이 아니라 한 줄 요약이다 — 가독성이 불안정해 센 수를 왜곡한다.
      if (wc < 60) continue
      n++
      words.push(wc)
      if (wc >= SPEC_MIN && wc <= SPEC_MAX) inSpec++
      if (STRUCTURED.test(text)) structured++
      if (THESIS.test(text)) thesis++
      const lv = consensus(byVocab(text), byReadability(readability.fleschReadingEase(text) as number))
      levels[lv] = (levels[lv] ?? 0) + 1
    }
    cursor = j.meta.next_cursor ?? ''
    if (!cursor) break
    await sleep(250)
  }

  words.sort((a, b) => a - b)
  const pct = (m: Record<string, number>) => {
    const t = Object.values(m).reduce((a, b) => a + b, 0) || 1
    return Object.fromEntries(CEFR.filter((k) => m[k]).map((k) => [k, +(((m[k] ?? 0) / t) * 100).toFixed(1)]))
  }
  const inBand =
    (((levels['A1'] ?? 0) + (levels['A2'] ?? 0) + (levels['B1'] ?? 0) + (levels['B2'] ?? 0)) / Math.max(1, n)) * 100

  const row = {
    field: id,
    label,
    measured: n,
    wordsP25: words[Math.floor(n * 0.25)] ?? null,
    wordsMedian: words[Math.floor(n * 0.5)] ?? null,
    wordsP75: words[Math.floor(n * 0.75)] ?? null,
    inSpecPct: +((inSpec / Math.max(1, n)) * 100).toFixed(1),
    structuredPct: +((structured / Math.max(1, n)) * 100).toFixed(1),
    thesisMarkerPct: +((thesis / Math.max(1, n)) * 100).toFixed(1),
    cefr: pct(levels),
    inBandPct: +inBand.toFixed(1),
  }
  out.push(row)
  console.log(
    `  ${label.padEnd(14)} n=${String(n).padStart(3)} · 어수 ${row.wordsP25}/${row.wordsMedian}/${row.wordsP75}` +
      ` · 규격내 ${String(row.inSpecPct).padStart(5)}% · 구조화초록 ${String(row.structuredPct).padStart(5)}%` +
      ` · 논지표지 ${String(row.thesisMarkerPct).padStart(5)}% · 밴드내 ${String(row.inBandPct).padStart(5)}%`,
  )
}

const payload = {
  readOnly: true,
  what: 'OpenAlex CC-BY·영어·분야별 초록의 길이·구조·난이도 — 인문사회 vs 생의학 대조',
  spec: { min: SPEC_MIN, max: SPEC_MAX, basis: '기출 802편 실측 중앙 164 · p25 144 · p75 188' },
  cefrMethod: '정본 aggregate 와 같은 식(어휘 0.5 + 가독성 0.3, LLM 없음 → 0.8 재정규화)',
  baselineExamCefr: { A2: 14.8, B1: 31.7, B2: 51.2, C1: 0.6, C2: 0 },
  rows: out,
}
const jp = argOf('json', '')
if (jp) writeFileSync(resolve(jp), JSON.stringify(payload, null, 2))
console.log('\n' + JSON.stringify(payload.rows.map((r) => [r['label'], r['cefr']]), null, 1))
