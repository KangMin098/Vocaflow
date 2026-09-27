// scripts/csat/source-doc-inspect.mts
//
// **원문 단위로 점검한다 — 판정 단위를 고친 것이다.**
//
// ── 무엇이 틀렸었나 (2026-09-23) ──────────────────────────────────────
// 나는 **토막**(164어 조각)을 뽑아 「그대로 쓸 수 있는가」로 판정했고 160건 중
// usable 0 이라는 결론을 냈다. 그런데 목표는 **원문 확보**다 — 여러 유형의 교재는
// 그 원문에서 **파이프라인이 만든다**(`itemWordSpec` 이 유형마다 다른 창을 쓴다).
//
// 판정 단위가 틀리면 처방이 뒤집힌다:
//   토막 단위  「인용이 들어 있다」 → 이 토막 탈락
//   원문 단위  「인용이 들어 있다」 → **정제 대상**이지 원문을 버릴 이유가 아니다
//   토막 단위  「앞 문단을 가리킨다」 → 이 토막 탈락
//   원문 단위  파이프라인이 **자를 자리를 고르면** 되는 문제다
//
// 그래서 원문에 대해 묻는 것은 다르다:
//   ① 정제 가능한가 — 인용·러닝헤더·참고문헌·표를 걷어내면 산문이 얼마나 남는가
//   ② 그 산문이 **여러 유형을 낼 만큼** 되는가 (유형별 창 넷을 동시에 채우는가)
//   ③ 영어인가 · 라이선스 경로가 있는가
//   ④ (기계로 못 봄) 화제·장르가 한국 고등학생 교재에 맞는가 → 읽어서 판정
//
// 이 도구는 ①~③ 을 재고, ④ 를 위한 읽기 청크를 **원문 단위로** 내보낸다.
//
// 사용: pnpm dlx tsx scripts/csat/source-doc-inspect.mts --dir <스크래치패드>
// 읽기 전용.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  CSAT_ITEM_WORDS,
  CSAT_LONG_ITEM_WORDS,
  SCHOOL_PARAGRAPH_WORDS,
  SCHOOL_SENTENCE_WORDS,
} from '@vocaflow/library-pipeline'

const argOf = (n: string, d: string): string => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const DIR = resolve(argOf('dir', '.'))
const OUT = resolve(argOf('out', 'docs/reports/data/source-doc-inspect.json'))
const CHUNK_DIR = argOf('chunks', DIR)

const W = (t: string): number => (t.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
const sentencesOf = (t: string): string[] =>
  t.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).map((s) => s.trim())
    .filter((s) => (s.match(/[A-Za-z]+/g) ?? []).length >= 4)

// ── ① 정제 ────────────────────────────────────────────────────────────
/**
 * **원문에서 걷어낼 것들.** 토막 판정 때는 「이게 있으면 탈락」이었는데
 * 원문 판정에서는 **지우고 남는 것을 본다.** 같은 패턴, 반대 용도다.
 */
const STRIP: RegExp[] = [
  /\([A-Z][A-Za-z'’-]+(?:\s+(?:et al\.?|and|&)\s+[A-Z][A-Za-z'’-]+)?[,\s]+\d{4}[a-z]?(?::\s*[\d–-]+)?\)/g, // (Author, 2020)
  /\([^)]{0,40}(?:et al\.?|,\s*\d{4})[^)]{0,40}\)/g, // 남은 괄호 인용
  /\[\d{1,3}(?:[,–-]\s*\d{1,3})*\]/g, // [12]
  /\(\s*[,;\s]*\)/g, // 저자명이 지워진 빈 괄호 — 이게 문장을 무너뜨린다
  /https?:\/\/\S+/g,
  /&[a-z]+;/g,
]
/** 문장 단위로 버릴 것 — 지우면 문장이 남지 않는 종류다. */
const DROP_SENTENCE: RegExp[] = [
  /\b(?:CRediT|Funding information|Data availability|Competing interests|Acknowledge?ments?|Conflicts? of interest|upon reasonable request|Downloaded from)\b/i,
  /\b(?:Fig(?:ure)?|Table|Panel|Appendix|Equation)\s+\(?[A-Z]?\d/i,
  /\bdoi\.org|\bISSN\b|\bVol\.\s*\d/i,
  /\*{2,}\s*p\s*[<>=]|standard errors|clustered/i,
  /^[A-Z][A-Z\s,&']{12,}$/, // 대문자 러닝헤더 줄
  /[a-z][HB][a-z]{2,}/, // OCR 붕괴 producHon · interacBon
  /[ﬀ-ﬆ]/, // 합자
]
/** 영어인가 — 로마자 전사 비영어는 ASCII 를 통과하므로 기능어로 본다. */
const STOP = new Set('the of and to in a is that for it as with was on be by are this not from or an at which have has but they we their can more one all other than when'.split(' '))
function englishRatio(t: string): number {
  const toks = (t.toLowerCase().match(/[a-z]+/g) ?? []).slice(0, 5000)
  if (toks.length < 50) return 0
  return toks.filter((x) => STOP.has(x)).length / toks.length
}

function cleanProse(body: string): string {
  let t = body
  for (const re of STRIP) t = t.replace(re, ' ')
  return sentencesOf(t).filter((s) => !DROP_SENTENCE.some((re) => re.test(s))).join(' ')
}

// ── ② 여러 유형을 낼 수 있는가 ────────────────────────────────────────
const WINDOWS = [
  { key: 'school_sentence', ...SCHOOL_SENTENCE_WORDS },
  { key: 'school_paragraph', ...SCHOOL_PARAGRAPH_WORDS },
  { key: 'csat_short', ...CSAT_ITEM_WORDS },
  { key: 'csat_long', ...CSAT_LONG_ITEM_WORDS },
] as const

/** 창별로 낼 수 있는 토막 수. **창마다 독립**이다 — 같은 본문을 다르게 자르는 것이다. */
function yieldByWindow(prose: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const w of WINDOWS) {
    let buf = 0
    let n = 0
    for (const s of sentencesOf(prose)) {
      const k = W(s)
      if (buf + k > w.max && buf > 0) { if (buf >= w.min) n++; buf = 0 }
      buf += k
    }
    if (buf >= w.min && buf <= w.max) n++
    out[w.key] = n
  }
  return out
}

interface Doc {
  id: string
  source: string
  words_raw: number
  words_prose: number
  keep_pct: number
  english_ratio: number
  yield: Record<string, number>
  types_covered: number
  verdict: 'inspect' | 'reject'
  reject_reason: string | null
}

const SRC: [string, string, string[], string][] = [
  ['olh', 'ft-olh-samples.json', ['body_prose', 'body_trimmed'], 'pk'],
  ['econstor', 'ft-econstor-samples.json', ['bodyText'], 'handle'],
  ['scielo', 'ft-scielo-samples.json', ['body_text'], 'pid'],
  ['openalex', 'ft-openalex-samples.json', ['extracted_text'], 'idx'],
]

const docs: Doc[] = []
const forReading: { id: string; source: string; words: number; prose: string }[] = []

for (const [name, file, keys, idKey] of SRC) {
  let arr: Record<string, unknown>[] = []
  try {
    const j = JSON.parse(readFileSync(join(DIR, file), 'utf8'))
    arr = (Array.isArray(j) ? j : ((j as { samples?: unknown[] }).samples ?? Object.values(j).find(Array.isArray) ?? [])) as Record<string, unknown>[]
  } catch { continue }

  for (let i = 0; i < arr.length; i++) {
    const x = arr[i]
    const body = keys.map((k) => x?.[k]).find((v) => typeof v === 'string' && (v as string).length > 500) as string | undefined
    if (!body) continue
    const prose = cleanProse(body)
    const wr = W(body)
    const wp = W(prose)
    const er = englishRatio(prose)
    const y = yieldByWindow(prose)
    const covered = WINDOWS.filter((w) => (y[w.key] ?? 0) > 0).length

    let verdict: Doc['verdict'] = 'inspect'
    let reason: string | null = null
    // **원문을 버리는 이유는 셋뿐이다** — 나머지는 정제로 푼다.
    if (er < 0.12) { verdict = 'reject'; reason = `영어가 아니다(기능어 ${(er * 100).toFixed(1)}%)` }
    else if (wp < 300) { verdict = 'reject'; reason = `정제 후 산문 ${wp}어 — 유형을 낼 양이 안 된다` }
    else if (wp / Math.max(1, wr) < 0.35) { verdict = 'reject'; reason = `정제 후 ${((wp / wr) * 100).toFixed(0)}% 만 남는다 — 본문이 아니라 표·서지다` }

    const id = `${name}:${String(x?.[idKey] ?? i)}`
    docs.push({
      id, source: name, words_raw: wr, words_prose: wp,
      keep_pct: Number(((wp / Math.max(1, wr)) * 100).toFixed(1)),
      english_ratio: Number(er.toFixed(3)),
      yield: y, types_covered: covered, verdict, reject_reason: reason,
    })
    if (verdict === 'inspect') forReading.push({ id, source: name, words: wp, prose })
  }
}

// ── 보고 ──────────────────────────────────────────────────────────────
const by: Record<string, { n: number; inspect: number; keep: number[]; cov: number[] }> = {}
for (const d of docs) {
  const b = (by[d.source] ??= { n: 0, inspect: 0, keep: [], cov: [] })
  b.n++
  if (d.verdict === 'inspect') { b.inspect++; b.keep.push(d.keep_pct); b.cov.push(d.types_covered) }
}
const med = (a: number[]): number => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0)

console.log('원문 단위 점검 — 토막이 아니라 **원문**을 본다\n')
console.log('원천        원문   읽기대상   정제 후 남는 비율(중앙)   낼 수 있는 유형 수(중앙)')
for (const [k, v] of Object.entries(by)) {
  console.log(
    `${k.padEnd(12)}${String(v.n).padStart(4)}${String(v.inspect).padStart(10)}` +
      `${(med(v.keep) + '%').padStart(22)}${String(med(v.cov)).padStart(24)} / 4`
  )
}
const rej = docs.filter((d) => d.verdict === 'reject')
console.log(`\n기계로 버린 원문 ${rej.length} / ${docs.length}`)
const reasons: Record<string, number> = {}
for (const r of rej) { const k = (r.reject_reason ?? '').replace(/\d+/g, 'N'); reasons[k] = (reasons[k] ?? 0) + 1 }
for (const [k, v] of Object.entries(reasons)) console.log(`  ${v}건  ${k}`)

console.log('\n창별 총 산출(읽기 대상 원문 기준)')
for (const w of WINDOWS) {
  const tot = docs.filter((d) => d.verdict === 'inspect').reduce((a, d) => a + (d.yield[w.key] ?? 0), 0)
  const per = tot / Math.max(1, docs.filter((d) => d.verdict === 'inspect').length)
  console.log(`  ${w.key.padEnd(18)}${String(w.min).padStart(4)}~${String(w.max).padEnd(5)}${String(tot).padStart(7)}토막  (편당 ${per.toFixed(1)})`)
}

writeFileSync(OUT, JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), contract: 'source-doc-inspect/v1', n: docs.length, docs }, null, 2))
console.log(`\n기록: ${OUT}`)

// 읽기 청크 — **원문 단위**로 내보낸다(토막이 아니다).
const PER = 15
for (let c = 0; c * PER < forReading.length; c++) {
  const items = forReading.slice(c * PER, (c + 1) * PER).map((d) => ({
    id: d.id, source: d.source, words: d.words,
    // 원문 전체를 주면 읽기가 과하다 — 앞·중간·뒤 세 대목을 준다.
    head: d.prose.slice(0, 1400),
    middle: d.prose.slice(Math.floor(d.prose.length / 2), Math.floor(d.prose.length / 2) + 1400),
    tail: d.prose.slice(-1400),
  }))
  writeFileSync(join(CHUNK_DIR, `doc-read-${c + 1}.json`), JSON.stringify({ contract: 'source-doc-read/v1', chunk: c + 1, count: items.length, items }, null, 2))
}
console.log(`읽기 청크 ${Math.ceil(forReading.length / PER)}개 · ${CHUNK_DIR}`)
