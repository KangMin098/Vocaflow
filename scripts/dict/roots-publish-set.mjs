// scripts/dict/roots-publish-set.mjs
//
// ⚠️ SUPERSEDED (2026-08-15) — 컴포저가 같은 세트를 만든다:
//     pnpm vcb:compose --blueprint root-etymology --count 1500 --group-cap 10 [--commit]
//   차이: 컴포저는 레시피와 7지표 점수를 curation_query 에 남기고 통과선 0.80 미달이면 발행을 막는다.
//   이 스크립트는 자기만의 curation_query 방언({org:'root',...})을 쓰고 채점이 없다.
//   새 유형이 필요하면 이 파일을 복사하지 말고 blueprints.ts 에 한 항목을 추가할 것
//   (그렇게 하지 않으면 6번째 방언이 생긴다 — docs/VCB_REDESIGN.md §0).
//
// 어원별 단어장 생성·발행 — word_root_links + shared_dictionary → shared_word_sets + shared_words.
//   챕터 = 어근(gloss). 각 단어는 1챕터(affix 'root' 우선, 동률 시 productive root). 어근당 cap.
//   멱등: slug 존재 시 그 set 의 shared_words 삭제 후 재삽입(set row 는 update).
// 실행: node scripts/dict/roots-publish-set.mjs [--commit] [--per-root 10] [--cap 1500]
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const COMMIT = process.argv.includes('--commit')
const PER_ROOT = parseInt(arg('--per-root', '10'), 10)
const CAP = parseInt(arg('--cap', '1500'), 10)
const SLUG = 'etymology-core'

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })
const affixOf = (notes) => { const n = (notes || '').toLowerCase(); return n.startsWith('prefix') ? 'prefix' : n.startsWith('suffix') ? 'suffix' : 'root' }
const NOISE = new Set(['archaic_literary', 'period_cultural', 'phrase_unit', 'brand', 'abbreviation', 'proper_noun'])

// 1) roots + links
const { data: roots } = await db.from('word_roots').select('id,root,gloss_ko,origin,notes')
const rootById = new Map(roots.map((r) => [r.id, r]))
const links = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('word_root_links').select('word,root_id,affix_type').range(from, from + 999)
  if (error) { console.error(error.message); process.exit(1) }
  links.push(...data); if (!data || data.length < 1000) break
}
const linkCountByRoot = new Map()
for (const l of links) linkCountByRoot.set(l.root_id, (linkCountByRoot.get(l.root_id) || 0) + 1)

// 2) dict info for linked words (band v3-11, noise 제외)
const words = [...new Set(links.map((l) => l.word))]
const dict = new Map()
for (let i = 0; i < words.length; i += 300) {
  const { data, error } = await db.from('shared_dictionary')
    .select('word,v_level,frequency_rank,meaning_ko,example_en,pos,cefr_level,ipa,word_register')
    .in('word', words.slice(i, i + 300)).not('classified_by', 'is', null)
  if (error) { console.error(error.message); process.exit(1) }
  for (const r of (data || [])) {
    if (r.v_level == null || r.v_level < 3 || r.v_level > 11) continue
    if (NOISE.has(r.word_register || 'standard')) continue
    dict.set(r.word.toLowerCase(), r)
  }
}

// 3) 각 단어 → 대표 챕터 root (affix 'root' 우선, 동률 시 productive)
const wordRoot = new Map()
for (const l of links) {
  const w = l.word.toLowerCase(); if (!dict.has(w)) continue
  const prev = wordRoot.get(w)
  const score = (l.affix_type === 'root' ? 1000 : 0) + (linkCountByRoot.get(l.root_id) || 0)
  if (!prev || score > prev.score) wordRoot.set(w, { root_id: l.root_id, score })
}

// 4) 챕터 그룹핑 + 어근당 cap (freq ASC NULLS LAST, v_level ASC)
const byRoot = new Map()
for (const [w, rr] of wordRoot) {
  if (!byRoot.has(rr.root_id)) byRoot.set(rr.root_id, [])
  byRoot.get(rr.root_id).push({ w, d: dict.get(w) })
}
// 어근 정렬: origin(latin,greek,other) → 생산성 desc
const originOrd = { latin: 0, greek: 1, other: 2 }
const rootOrder = [...byRoot.keys()].sort((a, b) => {
  const ra = rootById.get(a), rb = rootById.get(b)
  return (originOrd[ra.origin] - originOrd[rb.origin]) || ((linkCountByRoot.get(b) || 0) - (linkCountByRoot.get(a) || 0))
})
const members = []
for (const rid of rootOrder) {
  const r = rootById.get(rid)
  const list = byRoot.get(rid)
    .sort((x, y) => ((x.d.frequency_rank ?? 1e9) - (y.d.frequency_rank ?? 1e9)) || (x.d.v_level - y.d.v_level))
    .slice(0, PER_ROOT)
  if (list.length < 3) continue // 너무 작은 챕터 제외
  const chapter = `${r.root} — ${r.gloss_ko}`
  for (const it of list) members.push({ ...it, root: r, chapter })
  if (members.length >= CAP) break
}
const capped = members.slice(0, CAP)
const chapters = new Set(capped.map((m) => m.chapter)).size
console.log(`members: ${capped.length} · chapters(roots): ${chapters}`)
if (!COMMIT) {
  console.log('DRY-RUN. 샘플 챕터:', [...new Set(capped.map((m) => m.chapter))].slice(0, 6).join(' | '))
  console.log('샘플 단어:', capped.slice(0, 10).map((m) => m.w).join(', '))
  process.exit(0)
}

// 5) set upsert + members 재삽입
const cefrCounts = {}
for (const m of capped) cefrCounts[m.d.cefr_level] = (cefrCounts[m.d.cefr_level] || 0) + 1
const medianCefr = Object.entries(cefrCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'B2'
const setRow = {
  slug: SLUG, title: '어원으로 익히는 핵심 영단어', category: 'etymology', subcategory: 'etymology',
  description: '라틴·그리스 어근으로 단어를 계열째 익힌다. 어근당 한 챕터. 접두사·어근·접미사 포함.',
  cefr_level: medianCefr, word_count: capped.length, is_published: true, cover_emoji: '🏛️',
  auto_curated: true, version: 1,
  curation_query: { org: 'root', version: '1.0', filters: { v_level: [3, 11], per_root_cap: PER_ROOT, cap: CAP }, source: 'word_root_links' },
}
const { data: existing } = await db.from('shared_word_sets').select('id').eq('slug', SLUG).maybeSingle()
let setId
if (existing) {
  setId = existing.id
  await db.from('shared_word_sets').update({ ...setRow, regenerated_at: new Date(0).toISOString() }).eq('id', setId)
  await db.from('shared_words').delete().eq('set_id', setId)
} else {
  const { data, error } = await db.from('shared_word_sets').insert(setRow).select('id').single()
  if (error) { console.error('set insert fail', error.message); process.exit(1) }
  setId = data.id
}
// chapter = 어근 그룹 번호(smallint), 어근 라벨은 korean_learner_note 로 노출
const chapNum = new Map()
for (const m of capped) if (!chapNum.has(m.root.id)) chapNum.set(m.root.id, chapNum.size + 1)
const rows = capped.map((m, i) => ({
  set_id: setId, word: m.w, lemma: m.w, meaning_ko: m.d.meaning_ko, example_en: m.d.example_en,
  part_of_speech: m.d.pos, cefr_level: m.d.cefr_level, ipa: m.d.ipa, sort_order: i,
  chapter: chapNum.get(m.root.id),
  korean_learner_note: `어근 ${m.root.root} — ${m.root.gloss_ko}`,
}))
let ins = 0
for (let i = 0; i < rows.length; i += 500) {
  const { data, error } = await db.from('shared_words').insert(rows.slice(i, i + 500)).select('id')
  if (error) { console.error('words insert fail', error.message); process.exit(1) }
  ins += data?.length ?? 0
}
console.log(`published set ${setId} (${SLUG}) · words: ${ins} · chapters: ${chapters} · cefr: ${medianCefr}`)
