// scripts/dict/csat-corpus-apply.mjs
//
// **원문 실측을 `lexicon_frequencies`(source_id=1 · kice_csat)에 반영한다.**
// 기본은 dry-run — `--commit` 을 줘야 쓴다. 재실행 안전(같은 입력이면 같은 결과).
//
// ── 왜 raw_count 를 빈도로 바꾸지 않는가 (중요) ──────────────────────
// `apps/web/src/lib/vcb/compose/resolve.ts:667` 이 **raw_count 를 "출제된 연도 수" 로 읽고**
// `spec.min_years` 필터를 그 컬럼에 건다. 여기서 raw_count 를 토큰 빈도로 갈아끼우면
// `min_years: 3` 이 조용히 "3회 이상 등장" 이 되어 훨씬 헐거운 조건이 된다 —
// 오류 없이 세트 구성만 틀어진다. 그래서 **축은 그대로 두고 값만 실측으로 고친다.**
//
//   raw_count          등장 연도 수      ← 축 유지, 값 정정 (실측 불일치 1,419건)
//   frequency_tier     1y→2 · 2~3y→3 · 4y+→4  ← 기존 규칙 유지, 실측 연도로 재계산
//   normalized_freq    **토큰 실빈도 per 10k** ← 의미 정정 (기존값은 연도비율×10000 이었다)
//   rank_in_source     토큰 실빈도 순위        ← 의미 정정
//   appears_every_year 13개년 전부 등장        ← 기존 전행 false 였다
//   metadata           question_history 보존 + token_count·by_year·evidence 추가
//
// 원문에서 확인되지 않은 기존 행(구동사 `account for`·`fossil fuel` 등 다어절이 대부분)은
// **지우지 않는다** — 단일 토큰 코퍼스로는 원래 확인할 수 없는 종류다. 표시만 남긴다.
//
// 실행:
//   pnpm dlx tsx scripts/dict/csat-corpus-apply.mjs            # 계산만 (읽기 전용)
//   pnpm dlx tsx scripts/dict/csat-corpus-apply.mjs --commit   # 쓴다

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const commit = process.argv.includes('--commit')
const SOURCE_ID = 1

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const norm = JSON.parse(fs.readFileSync('scripts/dict/csat-corpus/normalized.json', 'utf8'))
const corpus = JSON.parse(fs.readFileSync('scripts/dict/csat-corpus/corpus.json', 'utf8'))
const YEARS = norm.years
const TOTAL_TOKENS = corpus.total_content_tokens

// `lexicon_frequencies.lemma` 는 shared_dictionary(word) FK 다 — 사전에 없는 낱말은 넣을 수 없다.
const rows = norm.rows.filter((r) => r.in_dict)
rows.sort((a, b) => b.total - a.total || a.lemma.localeCompare(b.lemma))

const tier = (yearsN) => (yearsN >= 4 ? 4 : yearsN >= 2 ? 3 : 2)

// ── 기존 행 읽기 — question_history 를 잃지 않기 위해 ────────────────
const existing = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('lexicon_frequencies')
    .select('id, lemma, raw_count, normalized_freq, rank_in_source, frequency_tier, appears_every_year, metadata')
    .eq('source_id', SOURCE_ID).range(from, from + 999)
  if (error) throw new Error(`기존 행 조회 실패: ${error.message}`)
  existing.push(...data)
  if (data.length < 1000) break
}
const existingByLemma = new Map(existing.map((e) => [e.lemma, e]))

const payload = rows.map((r, i) => {
  const prev = existingByLemma.get(r.lemma)
  const meta = { ...(prev?.metadata ?? {}) }
  meta.years_appeared = r.years_appeared
  meta.token_count = r.total
  meta.by_year = r.by_year
  meta.evidence = 'corpus_v1'
  meta.corpus_note = '수능 원문 13개년 실측 (2014~2026 · 홀/짝 중복 제거 · 2014_B 추출사고 제외)'
  if (r.folded_from.length) meta.folded_from = r.folded_from
  return {
    lemma: r.lemma,
    source_id: SOURCE_ID,
    raw_count: r.years_n,
    normalized_freq: Number(((r.total / TOTAL_TOKENS) * 10000).toFixed(4)),
    rank_in_source: i + 1,
    frequency_tier: tier(r.years_n),
    appears_every_year: r.appears_every_year,
    year_from: YEARS[0],
    year_to: YEARS[YEARS.length - 1],
    metadata: meta,
  }
})

const newLemmas = payload.filter((p) => !existingByLemma.has(p.lemma))
const updated = payload.filter((p) => existingByLemma.has(p.lemma))
const yearsFixed = updated.filter((p) => existingByLemma.get(p.lemma).raw_count !== p.raw_count)
const tierFixed = updated.filter((p) => existingByLemma.get(p.lemma).frequency_tier !== p.frequency_tier)
const corpusLemmas = new Set(payload.map((p) => p.lemma))
const absent = existing.filter((e) => !corpusLemmas.has(e.lemma))

console.log('── 반영 예정 ─────────────────────────────────────────')
console.log(`대상 행          ${payload.length}   (신규 ${newLemmas.length} · 갱신 ${updated.length})`)
console.log(`  연도수 정정    ${yearsFixed.length}`)
console.log(`  tier 정정      ${tierFixed.length}`)
console.log(`  전연도 등장    ${payload.filter((p) => p.appears_every_year).length}  (기존 0)`)
console.log(`원문 미확인 유지 ${absent.length}  (지우지 않고 표시만)`)
console.log(`총 내용어 토큰   ${TOTAL_TOKENS.toLocaleString()} · 연도 ${YEARS.length}`)
console.log('')
console.log('상위 12 (토큰 실빈도):')
for (const p of payload.slice(0, 12)) {
  console.log(`  ${String(p.rank_in_source).padStart(3)}. ${p.lemma.padEnd(16)} 토큰 ${String(p.metadata.token_count).padStart(3)} · ${p.raw_count}개년${p.appears_every_year ? ' · 전연도' : ''}`)
}

if (!commit) {
  console.log('')
  console.log('dry-run — 쓰지 않았다. 반영하려면 --commit')
  process.exit(0)
}

// ── 쓰기 ────────────────────────────────────────────────────────────
let done = 0
for (let i = 0; i < payload.length; i += 200) {
  const chunk = payload.slice(i, i + 200)
  const { error } = await db.from('lexicon_frequencies').upsert(chunk, { onConflict: 'lemma,source_id' })
  if (error) throw new Error(`upsert 실패(${i}): ${error.message}`)
  done += chunk.length
  process.stdout.write(`\r적재 ${done}/${payload.length}`)
}
console.log('')

for (let i = 0; i < absent.length; i += 200) {
  const chunk = absent.slice(i, i + 200).map((e) => ({
    lemma: e.lemma, source_id: SOURCE_ID,
    metadata: { ...(e.metadata ?? {}), corpus_v1_absent: true,
      corpus_v1_absent_note: '13개년 원문 단일 토큰 대조에서 미확인 — 다어절 표현(account for·fossil fuel 등)이 대부분' },
  }))
  const { error } = await db.from('lexicon_frequencies').upsert(chunk, { onConflict: 'lemma,source_id' })
  if (error) throw new Error(`미확인 표시 실패(${i}): ${error.message}`)
}
console.log(`원문 미확인 ${absent.length}행 표시 완료`)

const { error: srcErr } = await db.from('frequency_data_sources').update({
  citation: '한국교육과정평가원 대학수학능력시험 영어 영역 2014~2026 (13개년) — 원문 실측 코퍼스 v1 (내용어 ' + TOTAL_TOKENS.toLocaleString() + ' 토큰)',
}).eq('id', SOURCE_ID)
if (srcErr) throw new Error(`출처 갱신 실패: ${srcErr.message}`)
console.log('frequency_data_sources 출처 문구 갱신 완료')
