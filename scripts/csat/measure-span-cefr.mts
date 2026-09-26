// scripts/csat/measure-span-cefr.mts
//
// **글 전체의 CEFR 과 그 안 164어 구간의 CEFR 은 같은가 — 읽기 전용 · 집계만.**
//
// ── 왜 이걸 재나 ─────────────────────────────────────────────────────
// 적격 게이트는 `library_articles.cefr_level` 을 본다. 그 값은 **글 전체**로 계산됐다.
// 그런데 학습자가 읽는 것은 **164어 구간**이다(기출 802편 실측: 중앙 164 · p25 144 · p75 188).
//
// 1,697어짜리 PLOS essay 가 C1 이라고 해서 그 안의 164어 구간이 전부 C1 인 것은 아니다.
// 만약 구간 단위로 재면 B2 가 상당수 나온다면, **막힌 재고의 상당 부분은 「너무 어려운 글」이
// 아니라 「너무 긴 글」**이고 처방이 완전히 달라진다 — 새 원천을 사는 대신 자르면 된다.
//
// 반대로 구간을 잘라도 등급이 안 내려가면 그 재고는 **정말로 밴드 밖**이고,
// 발췌 경로를 더 돌리는 것은 낭비다(PLOS 발췌 11,601편 중 열린 것이 16.4% 인 사실과 맞춰 읽는다).
//
// ── 무엇을 재나 ──────────────────────────────────────────────────────
// 같은 글에 대해 **세 가지 길이**의 CEFR 을 같은 식으로 계산해 비교한다:
//   · 전체
//   · 164어 슬라이딩 구간 전부(문장 경계로 자른다 — 낱말 수로 자르면 문장이 토막나 가독성이 튄다)
//   · 그 구간들의 최빈 등급 / 최저 등급 / 밴드(≤B2) 안 비율
//
// 식은 정본 `analyze/cefr-detect.ts` 의 `aggregate` 와 같다 — 신호 1 어휘(0.5) + 신호 2 가독성(0.3),
// LLM 이 없으므로 0.8 로 재정규화. **다른 식으로 잰 값과 비교하면 안 된다**(DD-57 이 그 실수를 기록했다).
//
// 입력은 이미 떠 둔 표본 청크다(`.agent-logs/source-scorecard/*-g0-*.json`) — DB 를 다시 안 읽는다.
// ⚠️ 본문은 읽기만 하고 출력하지 않는다. 수치만 낸다.
//
// 실행: pnpm exec tsx scripts/csat/measure-span-cefr.mts --dir <chunk dir> [--span 164] [--json out.json]

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
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
const argOf = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : d
}
const DIR = resolve(argOf('dir', '.agent-logs/source-scorecard'))
/** 기출 지문 중앙값. p25 144 · p75 188 이므로 구간 허용폭도 그 창으로 둔다. */
const SPAN = Number(argOf('span', '164'))
const SPAN_MIN = 140
const SPAN_MAX = 200

const byReadability = (fre: number): Cefr =>
  fre >= 90 ? 'A1' : fre >= 80 ? 'A2' : fre >= 70 ? 'B1' : fre >= 55 ? 'B2' : fre >= 40 ? 'C1' : 'C2'

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
console.log(`사전 ${dict.size.toLocaleString()}낱말 · 구간 ${SPAN}어(${SPAN_MIN}~${SPAN_MAX})`)

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

/** 정본 `aggregate` 와 같은 가중·반올림(LLM 없음 → 0.8 재정규화). */
const consensus = (v: Cefr, r: Cefr): Cefr => {
  const i = (l: Cefr) => CEFR.indexOf(l)
  return CEFR[Math.max(0, Math.min(5, Math.round((i(v) * 0.5 + i(r) * 0.3) / 0.8)))]!
}
const levelOf = (text: string): Cefr =>
  consensus(byVocab(text), byReadability(readability.fleschReadingEase(text) as number))

/**
 * **문장 경계로 자른다.** 낱말 수로 자르면 문장이 토막나 Flesch 가 튀어
 * 「짧게 자르면 쉬워진다」는 가짜 신호가 나온다 — 그건 글이 쉬워진 것이 아니라 계산이 깨진 것이다.
 */
function spans(text: string): string[] {
  const sents = text
    .replace(/\s+/g, ' ')
    .match(/[^.!?]+[.!?]+["')\]]?\s*/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? []
  const out: string[] = []
  let buf: string[] = []
  let w = 0
  for (const s of sents) {
    const sw = s.split(/\s+/).length
    buf.push(s)
    w += sw
    if (w >= SPAN) {
      if (w <= SPAN_MAX) out.push(buf.join(' '))
      buf = []
      w = 0
    }
  }
  if (w >= SPAN_MIN && w <= SPAN_MAX) out.push(buf.join(' '))
  return out
}

const files = readdirSync(DIR).filter((f) => f.includes('-g0-') && f.endsWith('.json') && !f.endsWith('.out.json'))
const rows: Record<string, unknown>[] = []

for (const f of files.sort()) {
  const chunk = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as {
    source: string
    items: { excerpt: string; measuredWords: number; dbCefr: string | null }[]
  }
  const whole: Record<string, number> = {}
  const span: Record<string, number> = {}
  let itemsWithSpans = 0
  let spanCount = 0
  let improved = 0
  let worsened = 0
  let same = 0

  for (const it of chunk.items) {
    const text = (it.excerpt ?? '').trim()
    if (text.split(/\s+/).length < SPAN_MIN) continue
    const w = levelOf(text)
    whole[w] = (whole[w] ?? 0) + 1
    const ss = spans(text)
    if (!ss.length) continue
    itemsWithSpans++
    let anyBetter = false
    let anyWorse = false
    for (const s of ss) {
      const lv = levelOf(s)
      span[lv] = (span[lv] ?? 0) + 1
      spanCount++
      if (CEFR.indexOf(lv) < CEFR.indexOf(w)) anyBetter = true
      if (CEFR.indexOf(lv) > CEFR.indexOf(w)) anyWorse = true
    }
    if (anyBetter) improved++
    else if (anyWorse) worsened++
    else same++
  }

  const inBand = (m: Record<string, number>) => {
    const tot = Object.values(m).reduce((a, b) => a + b, 0) || 1
    return +(((m['A1'] ?? 0) + (m['A2'] ?? 0) + (m['B1'] ?? 0) + (m['B2'] ?? 0)) / tot * 100).toFixed(1)
  }
  const pct = (m: Record<string, number>) => {
    const tot = Object.values(m).reduce((a, b) => a + b, 0) || 1
    return Object.fromEntries(
      CEFR.filter((k) => m[k]).map((k) => [k, +(((m[k] ?? 0) / tot) * 100).toFixed(1)]),
    )
  }

  rows.push({
    source: chunk.source,
    itemsMeasured: Object.values(whole).reduce((a, b) => a + b, 0),
    itemsWithSpans,
    spansExtracted: spanCount,
    spansPerItem: itemsWithSpans ? +(spanCount / itemsWithSpans).toFixed(2) : 0,
    wholeCefr: pct(whole),
    wholeInBandPct: inBand(whole),
    spanCefr: pct(span),
    spanInBandPct: inBand(span),
    /** 구간으로 자르면 등급이 내려간 글 / 올라간 글 / 그대로인 글. */
    itemsImproved: improved,
    itemsWorsened: worsened,
    itemsSame: same,
    bandGainPoints: +(inBand(span) - inBand(whole)).toFixed(1),
  })
}

rows.sort((a, b) => (b['spansExtracted'] as number) - (a['spansExtracted'] as number))
const out = {
  readOnly: true,
  what: `글 전체 CEFR vs ${SPAN}어 구간 CEFR — 같은 3중 합의 식(어휘 0.5 + 가독성 0.3, LLM 없음 → 0.8 재정규화)`,
  spanSpec: { target: SPAN, min: SPAN_MIN, max: SPAN_MAX, basis: '기출 802편 실측 중앙 164 · p25 144 · p75 188' },
  rows,
}
const jp = argOf('json', '')
if (jp) writeFileSync(resolve(jp), JSON.stringify(out, null, 2))
console.log(
  `${'원천'.padEnd(18)} 글수  구간수  구간/글   전체밴드내  구간밴드내   증감   내려감/올라감/동일`,
)
for (const r of rows) {
  console.log(
    `${String(r['source']).padEnd(18)} ${String(r['itemsMeasured']).padStart(4)} ${String(r['spansExtracted']).padStart(6)} ${String(r['spansPerItem']).padStart(7)}   ${String(r['wholeInBandPct']).padStart(8)}%   ${String(r['spanInBandPct']).padStart(8)}%  ${String(r['bandGainPoints']).padStart(6)}   ${r['itemsImproved']}/${r['itemsWorsened']}/${r['itemsSame']}`,
  )
}
