// scripts/dict/csat-corpus-diff.mjs
//
// **원문 코퍼스를 사전 DB 에 맞춰 정규화하고 격차를 잰다 — 읽기 전용.**
// 산출: scripts/dict/csat-corpus/normalized.json (적재 단계 입력) + diff.json (보고)
//
// 여기서 하는 일 세 가지:
//  1. **굴절형 접기** — winkNLP 가 students·algorithms·preferred 를 원형으로 못 돌리는 경우가 있다.
//     그대로 두면 student 와 students 로 빈도가 갈린다. `shared_dictionary.inflected_forms`
//     (15,210 lemma 권위화)로 표제어에 합친다.
//  2. **인명 가르기** — 듣기 대화의 Sean·Clara·Mia 가 빈도 상위를 차지한다. 사전에 없고
//     고유명사 태깅 비율이 높은 것을 인명 후보로 분리한다. POS 만으로 자르면 제목 속
//     science·university·art 가 같이 날아가므로 **사전 존재 여부를 1차 기준**으로 쓴다.
//  3. 기존 `lexicon_frequencies` source_id=1 과 대조.
//
// 실행: pnpm dlx tsx scripts/dict/csat-corpus-diff.mjs

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const corpus = JSON.parse(fs.readFileSync('scripts/dict/csat-corpus/corpus.json', 'utf8'))
const YEARS = corpus.years

async function pageAll(table, select, tune) {
  const out = []
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(select).range(from, from + 999)
    if (tune) q = tune(q)
    const { data, error } = await q
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}
async function fetchIn(table, col, values, select) {
  const out = []
  for (let i = 0; i < values.length; i += 400) {
    const { data, error } = await db.from(table).select(select).in(col, values.slice(i, i + 400))
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`)
    out.push(...data)
  }
  return out
}

// ── 1. 사전 존재 확인 ───────────────────────────────────────────────
const rawLemmas = corpus.rows.map((r) => r.lemma)
const dictRows = await fetchIn('shared_dictionary', 'word', rawLemmas, 'word')
const headwords = new Set(dictRows.map((d) => d.word))
const orphans = rawLemmas.filter((l) => !headwords.has(l))

// ── 2. 굴절형 → 표제어 매핑 ─────────────────────────────────────────
const fold = new Map()
for (let i = 0; i < orphans.length; i += 150) {
  const slice = orphans.slice(i, i + 150)
  const sliceSet = new Set(slice)
  const { data, error } = await db
    .from('shared_dictionary')
    .select('word, inflected_forms')
    .overlaps('inflected_forms', slice)
  if (error) throw new Error(`굴절형 조회 실패: ${error.message}`)
  for (const row of data) {
    for (const inf of row.inflected_forms ?? []) {
      // 표제어 자신이 코퍼스에 있으면 그쪽이 우선 — 굴절형을 표제어로 삼지 않는다.
      if (sliceSet.has(inf) && !fold.has(inf)) fold.set(inf, row.word)
    }
  }
}

// ── 2b. 규칙 fallback — inflected_forms 가 없는 표제어(전체 47k 중 15,210 만 보유)를 메운다.
// **굴절(-s·-ed·-ing)만 접는다.** -er·-ly·-ness 는 파생이라 별개 표제어이고
// (maker·provider·forager 는 실제로 사전에 없는 낱말이다), 접으면 결손이 숨는다.
function inflectionBases(w) {
  const c = new Set()
  if (w.endsWith('ies') && w.length > 4) c.add(w.slice(0, -3) + 'y')
  if (w.endsWith('es') && w.length > 3) { c.add(w.slice(0, -2)); c.add(w.slice(0, -1)) }
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 2) c.add(w.slice(0, -1))
  if (w.endsWith('ied') && w.length > 4) c.add(w.slice(0, -3) + 'y')
  if (w.endsWith('ed') && w.length > 3) { c.add(w.slice(0, -2)); c.add(w.slice(0, -1)) }
  if (w.endsWith('ing') && w.length > 4) { c.add(w.slice(0, -3)); c.add(w.slice(0, -3) + 'e') }
  // 자음 중복 (preferred→prefer, running→run)
  const m = w.match(/^(.*?)([bcdfglmnprstvz])\2(ed|ing)$/)
  if (m) c.add(m[1] + m[2])
  c.delete(w)
  return [...c].filter((x) => x.length >= 2)
}
// 한 번도 소문자로 쓰인 적 없는 낱말은 규칙 접기에서 제외한다 — james 가 jam 의 복수형으로
// 접혔다(실측). POS(PROPN)로 거르면 scientists 처럼 제목에서만 뽑힌 보통명사가 같이 막힌다.
const nameLikeRaw = new Map(corpus.rows.map((r) => [r.lemma, r.name_like === true]))
const stillOrphan = orphans.filter((l) => !fold.has(l) && nameLikeRaw.get(l) !== true)
const candidateBases = [...new Set(stillOrphan.flatMap(inflectionBases))]
const baseRows = await fetchIn('shared_dictionary', 'word', candidateBases, 'word')
const baseSet = new Set(baseRows.map((r) => r.word))
let ruleFolded = 0
for (const w of stillOrphan) {
  // 길이가 긴 후보부터 — sensing 은 sens 보다 sense 로 접혀야 한다(둘 다 표제어로 존재).
  const hit = inflectionBases(w).sort((a, b) => b.length - a.length).find((b) => baseSet.has(b))
  if (hit) { fold.set(w, hit); ruleFolded += 1 }
}

// ── 3. 접어서 다시 집계 ─────────────────────────────────────────────
const agg = new Map()
for (const r of corpus.rows) {
  const key = fold.get(r.lemma) ?? r.lemma
  const e = agg.get(key) ?? { lemma: key, total: 0, byYear: {}, propn_all: 0, propn_hits: 0, folded_from: [] }
  e.total += r.total
  for (const [y, n] of Object.entries(r.byYear)) e.byYear[y] = (e.byYear[y] ?? 0) + n
  e.propn_all += r.total
  e.propn_hits += Math.round(r.total * (r.propn_ratio ?? 0))
  if (key !== r.lemma) e.folded_from.push(r.lemma)
  agg.set(key, e)
}

const rows = [...agg.values()].map((e) => {
  const ys = Object.keys(e.byYear).map(Number).sort((a, b) => a - b)
  return {
    lemma: e.lemma,
    total: e.total,
    by_year: e.byYear,
    years_appeared: ys,
    years_n: ys.length,
    appears_every_year: ys.length === YEARS.length,
    propn_ratio: e.propn_all ? Number((e.propn_hits / e.propn_all).toFixed(3)) : 0,
    folded_from: e.folded_from,
    in_dict: headwords.has(e.lemma),
  }
})
const finalDictRows = await fetchIn('shared_dictionary', 'word', rows.map((r) => r.lemma), 'word')
const finalHeadwords = new Set(finalDictRows.map((d) => d.word))
for (const r of rows) r.in_dict = finalHeadwords.has(r.lemma)

rows.sort((a, b) => b.total - a.total || a.lemma.localeCompare(b.lemma))
rows.forEach((r, i) => { r.rank = i + 1 })

// ── 4. 사전에 없는 것을 인명 후보 / 사전 결손으로 가른다 ─────────────
// 기준: 고유명사 태깅 비율 ≥ 0.5 이면 인명·상호 후보. 그 아래는 사전이 비어 있는 것.
const notInDict = rows.filter((r) => !r.in_dict)
const isName = (r) => (nameLikeRaw.get(r.lemma) === true) && r.folded_from.every((f) => nameLikeRaw.get(f) === true)
const nameLike = notInDict.filter(isName)
const dictGap = notInDict.filter((r) => !isName(r))

// ── 5. 기존 kice_csat 대조 ──────────────────────────────────────────
const existing = await pageAll('lexicon_frequencies', 'lemma, raw_count, metadata', (q) => q.eq('source_id', 1))
const byLemma = new Map(rows.map((r) => [r.lemma, r]))
const existingSet = new Set(existing.map((e) => e.lemma))
const listOnly = existing.filter((e) => !byLemma.has(e.lemma)).map((e) => e.lemma)
const corpusOnly = rows.filter((r) => !existingSet.has(r.lemma))
let yearMismatch = 0
for (const e of existing) {
  const r = byLemma.get(e.lemma)
  if (!r) continue
  const listed = (e.metadata?.years_appeared ?? []).slice().sort((a, b) => a - b).join(',')
  if (listed !== r.years_appeared.join(',')) yearMismatch += 1
}

const report = {
  코퍼스: { 원시_lemma: corpus.rows.length, 접은_뒤: rows.length, 굴절형_접기: fold.size, 그중_규칙fallback: ruleFolded, 토큰: corpus.total_content_tokens, 연도: YEARS.length },
  사전대조: { 사전에_있음: rows.filter((r) => r.in_dict).length, 인명_후보: nameLike.length, 사전_결손: dictGap.length },
  기존_kice_csat: { 행수: existing.length, 원문에_없음: listOnly.length, 원문에만_있음: corpusOnly.length, 등장연도_불일치: yearMismatch },
  분포: { 전연도_등장: rows.filter((r) => r.appears_every_year).length, '6개년이상': rows.filter((r) => r.years_n >= 6).length, '1개년만': rows.filter((r) => r.years_n === 1).length },
}

fs.writeFileSync('scripts/dict/csat-corpus/normalized.json', JSON.stringify({ years: YEARS, report, rows }, null, 1))
fs.writeFileSync('scripts/dict/csat-corpus/diff.json', JSON.stringify({
  report,
  사전_결손_목록: dictGap,
  인명_후보_목록: nameLike.map((r) => ({ lemma: r.lemma, total: r.total, propn_ratio: r.propn_ratio })),
  굴절형_접기: [...fold.entries()].map(([surface, head]) => ({ surface, head })),
  원문에_없는_목록어: listOnly,
}, null, 1))

console.log(JSON.stringify(report, null, 1))
