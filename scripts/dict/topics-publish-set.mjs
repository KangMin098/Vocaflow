// scripts/dict/topics-publish-set.mjs
//
// ⚠️ SUPERSEDED (2026-08-15) — 컴포저가 같은 세트를 만든다:
//     pnpm vcb:compose --blueprint topic-field --theme 여행 --count 500 [--commit]
//   차이: 컴포저는 목차를 먼저 짜고 그룹에서 예산을 채우므로 챕터가 굶지 않는다(이 스크립트는
//   빈도 상위가 몰린 챕터만 남는다). 레시피·점수도 curation_query 에 남는다.
//   새 유형은 이 파일 복사가 아니라 blueprints.ts 한 항목으로 (docs/VCB_REDESIGN.md §0).
//
// 주제별 단어장 생성·발행 — dictionary_categories(L1테마→L2→L3) + dictionary_word_categories → shared_word_sets/shared_words.
//   L1 테마 = 세트, L2 = 챕터(korean_learner_note), 단어는 L3 매핑 롤업. 어근당→챕터당 cap.
//   category='themed', subcategory='topic'. 멱등(slug 재실행 시 words 교체).
// 실행: node scripts/dict/topics-publish-set.mjs [theme1,theme2|all] [--commit] [--per-set 500] [--per-ch 150]
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const COMMIT = process.argv.includes('--commit')
const PER_SET = parseInt(arg('--per-set', '500'), 10)
const PER_CH = parseInt(arg('--per-ch', '150'), 10)
const THEME_ARG = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'all'
const NOISE = new Set(['archaic_literary', 'period_cultural', 'phrase_unit', 'brand', 'abbreviation', 'proper_noun'])
const EMOJI = { '음식과 음료': '🍽️', '여행': '✈️', '건강': '🏥', '일과 비즈니스': '💼', '과학과 기술': '🔬', '자연 세계': '🌿', '사람': '👤', '정치와 사회': '🏛️', '문화': '🎭', '외모': '👗', '언어 기능': '💬', '동물': '🐾', '집과 건물': '🏠', '스포츠': '⚽', '개념': '💡', '의사소통': '📣', '시간과 공간': '🕰️', '여가': '🎨' }
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

// 1) 전 카테고리 트리
const { data: cats, error: ce } = await db.from('dictionary_categories').select('id,level,parent_id,name_ko,name_en,sort_order')
if (ce) { console.error(ce.message); process.exit(1) }
const byId = new Map(cats.map((c) => [c.id, c]))
const childrenOf = (pid) => cats.filter((c) => c.parent_id === pid)
const l1s = cats.filter((c) => c.level === 1)
const targets = THEME_ARG === 'all' ? l1s.map((c) => c.name_ko) : THEME_ARG.split(',').map((s) => s.trim())

async function fetchIn(table, col, ids, select) {
  const out = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from(table).select(select).in(col, ids.slice(i, i + 200))
    if (error) { console.error(table, error.message); process.exit(1) }
    out.push(...(data || []))
  }
  return out
}

let published = 0
for (const themeName of targets) {
  const l1 = l1s.find((c) => c.name_ko === themeName)
  if (!l1) { console.warn('theme not found:', themeName); continue }
  const l2s = childrenOf(l1.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const l3ToL2 = new Map()
  const l3ids = []
  for (const l2 of l2s) for (const l3 of childrenOf(l2.id)) { l3ToL2.set(l3.id, l2.id); l3ids.push(l3.id) }

  // word → L2 (첫 매핑) via L3
  const wc = await fetchIn('dictionary_word_categories', 'category_id', l3ids, 'word,category_id')
  const wordL2 = new Map()
  for (const r of wc) { const l2 = l3ToL2.get(r.category_id); if (l2 && !wordL2.has(r.word)) wordL2.set(r.word, l2) }

  // dict 정보 (밴드/노이즈 필터)
  const words = [...wordL2.keys()]
  const dict = new Map()
  for (const r of await fetchIn('shared_dictionary', 'word', words, 'word,v_level,frequency_rank,meaning_ko,example_en,pos,cefr_level,ipa,word_register,classified_by')) {
    if (!r.classified_by || r.v_level == null || r.v_level < 3 || r.v_level > 11) continue
    if (NOISE.has(r.word_register || 'standard')) continue
    dict.set(r.word.toLowerCase(), r)
  }

  // 챕터(L2)별 그룹 + cap
  const byL2 = new Map()
  for (const [w, l2] of wordL2) { const d = dict.get(w.toLowerCase()); if (!d) continue; if (!byL2.has(l2)) byL2.set(l2, []); byL2.get(l2).push({ w: w.toLowerCase(), d }) }
  const members = []
  let chapNo = 0
  for (const l2 of l2s) {
    const list = (byL2.get(l2.id) || []).sort((x, y) => ((x.d.frequency_rank ?? 1e9) - (y.d.frequency_rank ?? 1e9)) || (x.d.v_level - y.d.v_level)).slice(0, PER_CH)
    if (list.length < 3) continue
    chapNo++
    for (const it of list) members.push({ ...it, chapter: chapNo, note: byId.get(l2.id).name_ko })
    if (members.length >= PER_SET) break
  }
  const capped = members.slice(0, PER_SET)
  const chapters = new Set(capped.map((m) => m.chapter)).size
  console.log(`[${themeName}] members: ${capped.length} · chapters(L2): ${chapters}`)
  if (!COMMIT) { console.log('  샘플:', capped.slice(0, 8).map((m) => m.w).join(', ')); continue }

  // 발행
  const cefrCounts = {}; for (const m of capped) cefrCounts[m.d.cefr_level] = (cefrCounts[m.d.cefr_level] || 0) + 1
  const medianCefr = Object.entries(cefrCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'B1'
  const slug = `topic-${slugify(l1.name_en)}`
  const setRow = {
    slug, title: `${themeName} 주제 어휘`, category: 'themed', subcategory: 'topic',
    description: `${themeName} 관련 어휘를 소주제(${chapters}챕터)로 묶어 학습.`,
    cefr_level: medianCefr, word_count: capped.length, is_published: true,
    cover_emoji: EMOJI[themeName] ?? '🎨', auto_curated: true, version: 1,
    curation_query: { org: 'topic', version: '1.0', theme: l1.name_en, filters: { v_level: [3, 11], per_set: PER_SET, per_chapter: PER_CH }, source: 'dictionary_word_categories' },
  }
  const { data: existing } = await db.from('shared_word_sets').select('id').eq('slug', slug).maybeSingle()
  let setId
  if (existing) { setId = existing.id; await db.from('shared_word_sets').update(setRow).eq('id', setId); await db.from('shared_words').delete().eq('set_id', setId) }
  else { const { data, error } = await db.from('shared_word_sets').insert(setRow).select('id').single(); if (error) { console.error('set insert', error.message); process.exit(1) } setId = data.id }
  const rows = capped.map((m, i) => ({ set_id: setId, word: m.w, lemma: m.w, meaning_ko: m.d.meaning_ko, example_en: m.d.example_en, part_of_speech: m.d.pos, cefr_level: m.d.cefr_level, ipa: m.d.ipa, sort_order: i, chapter: m.chapter, korean_learner_note: m.note }))
  for (let i = 0; i < rows.length; i += 500) { const { error } = await db.from('shared_words').insert(rows.slice(i, i + 500)); if (error) { console.error('words insert', error.message); process.exit(1) } }
  console.log(`  ✓ published ${slug} (${setId}) · ${rows.length} words · ${chapters} chapters`)
  published++
}
console.log(`done. published sets: ${published}`)
