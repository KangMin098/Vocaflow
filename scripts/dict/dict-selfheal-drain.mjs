// scripts/dict/dict-selfheal-drain.mjs
// 3R-Ⓒ 자기치유 자동 배선 (드레인) — LCP ingest 가 미해소어를 쌓는
// `archaic_candidates`(collect_archaic_candidates RPC, process/route.ts) 를 소스로,
// Wiktionary 게이트(dict-selfheal-core) 통과분을 `lexicon_clean` 에 자동 적재.
// → 다음 lookup_word_meaning 부터 coverage-clean 티어로 해소 (사전 자가성장).
// 뜻 생성 LLM 0: Wiktionary 정의 → Google 번역.
// 핫패스(ingest 요청) 밖 드레인이라 외부 조회 지연이 ingest 를 막지 않음.
//
// 배치 캡: LIMIT(기본 150) · 임계: MINOCC(3) OR MINBOOKS(2) · DIALECT=1 이면 방언 포함.
// 실행(수동/크론/Claude Code 드레인): node scripts/dict/dict-selfheal-drain.mjs
//
// SOURCE=corpus (v06.35) — 후보를 archaic_candidates 임계가 아니라
//   **현재 카탈로그에서 실제로 미해결인 단어**(library_book_vocabularies 에서
//   lemma IS NULL · noise_kind IS NULL · resolved_via IN (not_found,invalid))로 잡는다.
//   왜 필요한가: 기본 임계(freq>=3 OR books>=2)는 비용 캡이라, 카탈로그 미해결 482개 중
//   46개만 통과한다. 나머지 436개는 hapax 라 영원히 드레인되지 않는다.
//   실행: SOURCE=corpus LIMIT=500 node scripts/dict/dict-selfheal-drain.mjs
import fs from 'node:fs'
import { FRAGMENTS, resolveGloss, translateKo, koQualityOk, sleep } from './dict-selfheal-core.mjs'

const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\r/g, '') }
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const Hget = { apikey: SVC, Authorization: 'Bearer ' + SVC }
const Hins = { ...Hget, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }
const MINOCC = parseInt(process.env.MINOCC || '3'), MINBOOKS = parseInt(process.env.MINBOOKS || '2')
const LIMIT = parseInt(process.env.LIMIT || '150'), INCLUDE_DIALECT = process.env.DIALECT === '1'

async function getJson(url) { for (let a = 0; a < 4; a++) { try { const r = await fetch(url, { headers: Hget }); if (r.ok) return await r.json() } catch {} await sleep(400 * (a + 1)) } return null }
async function insLexicon(b) { for (let i = 0; i < 6; i++) { try { const r = await fetch(SB + '/rest/v1/lexicon_clean', { method: 'POST', headers: Hins, body: JSON.stringify(b) }); if (r.ok || r.status === 409) return true } catch {} await sleep(500 * (i + 1)) } return false }

// 1) 후보
const SOURCE = process.env.SOURCE || 'candidates'
let cands = []
if (SOURCE === 'corpus') {
  // 현재 카탈로그 미해결어 — 빈도 임계 없이 전수. 중복 word 는 dedupe.
  const seen = new Map()
  for (let off = 0; off < 40000; off += 1000) {
    const d = await getJson(`${SB}/rest/v1/library_book_vocabularies?select=word,frequency_in_book&lemma=is.null&noise_kind=is.null&resolved_via=in.(not_found,invalid)&limit=1000&offset=${off}`)
    if (!Array.isArray(d) || !d.length) break
    for (const x of d) {
      const w = (x.word || '').toLowerCase()
      seen.set(w, (seen.get(w) || 0) + (x.frequency_in_book || 1))
    }
    if (d.length < 1000) break
  }
  cands = [...seen.entries()]
    .map(([word, total_frequency]) => ({ word, total_frequency, book_count: 1 }))
    .sort((a, b) => b.total_frequency - a.total_frequency)
} else {
  for (let off = 0; off < 20000 && cands.length < LIMIT * 6; off += 1000) {
    const d = await getJson(`${SB}/rest/v1/archaic_candidates?select=word,total_frequency,book_count&or=(total_frequency.gte.${MINOCC},book_count.gte.${MINBOOKS})&order=total_frequency.desc&limit=1000&offset=${off}`)
    if (!Array.isArray(d) || !d.length) break
    cands = cands.concat(d); if (d.length < 1000) break
  }
}
cands = cands.filter(c => /^[a-z]{3,}$/.test((c.word || '').toLowerCase()) && !FRAGMENTS.has((c.word || '').toLowerCase()))
console.error(
  SOURCE === 'corpus'
    ? `카탈로그 미해결어(임계 없음): ${cands.length}`
    : `archaic_candidates 임계통과: ${cands.length} (freq>=${MINOCC} OR books>=${MINBOOKS})`,
)

// 2) 이미 lexicon_clean 존재분 제외 (멱등) — in.() 청크 조회
const already = new Set()
for (let i = 0; i < cands.length; i += 150) {
  const list = cands.slice(i, i + 150).map(c => c.word.toLowerCase())
  const d = await getJson(`${SB}/rest/v1/lexicon_clean?select=word&word=in.(${list.map(encodeURIComponent).join(',')})`)
  if (Array.isArray(d)) for (const x of d) already.add(x.word)
}
const todo = cands.filter(c => !already.has(c.word.toLowerCase())).slice(0, LIMIT)
console.error(`미적재 대상(캡 ${LIMIT}): ${todo.length} · 기존제외 ${already.size}`)

// 3) 게이트 + 번역 + 적재
const recs = [], tally = { ok: 0, dialect: 0, 'no-en': 0, reject: 0, thin: 0, notrans: 0 }
let done = 0
for (const c of todo) {
  const w = c.word.toLowerCase()
  const r = await resolveGloss(w)
  if (!r.en) { tally[r.status.startsWith('reject') ? 'reject' : (tally[r.status] !== undefined ? r.status : 'thin')]++; if (++done % 30 === 0) console.error(`  ${done}/${todo.length} ok=${tally.ok}`); await sleep(120); continue }
  if (r.dialect && !INCLUDE_DIALECT) { tally.dialect++; if (++done % 30 === 0) console.error(`  ${done}/${todo.length} ok=${tally.ok}`); await sleep(120); continue }
  const ko = await translateKo(r.en)
  if (!ko || !koQualityOk(ko)) { tally.notrans++; if (++done % 30 === 0) console.error(`  ${done}/${todo.length} ok=${tally.ok}`); await sleep(120); continue }
  recs.push({ word: w, lang: 'en', meaning_ko: ko, gloss_en: r.en, gloss_source: 'wiktionary', ko_source: 'wikt-selfheal', is_valid_word: true })
  tally.ok++
  if (++done % 30 === 0) console.error(`  ${done}/${todo.length} ok=${tally.ok}`)
  await sleep(120)
}
let loaded = 0
for (let i = 0; i < recs.length; i += 200) if (await insLexicon(recs.slice(i, i + 200))) loaded += recs.slice(i, i + 200).length
console.error('\n=== 드레인 결과 ===')
console.error(JSON.stringify(tally))
console.error(`적재: ${loaded}/${recs.length}  (방언 포함=${INCLUDE_DIALECT})`)
console.error('예시:', recs.slice(0, 10).map(r => r.word + '→' + r.meaning_ko.slice(0, 16)).join(' · '))
