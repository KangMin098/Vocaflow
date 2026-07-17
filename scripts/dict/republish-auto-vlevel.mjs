// scripts/dict/republish-auto-vlevel.mjs
// auto-vlevel-v1..9 공용단어장 재발행 — VRL 재분류 이후 드리프트(세트 멤버가 더 이상 해당 v_level 아님) 해소.
//   기준(원 curation_query 충실 재구성): v_level=N · list_tags && <tags> · skill_level=3 · meaning_ko present
//   · pos in (noun,verb,adjective,adverb) · char_length(word)>=3 · ORDER BY frequency_rank ASC NULLS LAST, word · LIMIT qty.
//   검증 게이트: V1 재현이 현 멤버와 100% 일치함을 확인 후 작성(태그 해석 정확).
// 실행: node scripts/dict/republish-auto-vlevel.mjs           (dry-run: 세트별 recon/overlap/±diff)
//       node scripts/dict/republish-auto-vlevel.mjs --commit  (shared_words 교체 + word_count/regenerated_at 갱신)
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const COMMIT = process.argv.includes('--commit')
const NGSL = ['ngsl_1.2', 'ngsl_gr_1.0', 'ngsl_spoken_1.2']
const CSAT = ['csat-prep-core-2k', 'csat-prep-ext-1.8k']
const BSL = ['bsl_1.20']
const NAWL = ['nawl_1.2']
// 원 curation_query 그대로: V1-7 = ngsl∪csat, V8 = ngsl∪bsl, V9 = ngsl∪bsl∪nawl
const SETS = [
  { slug: 'auto-vlevel-v1', v: 1, qty: 100, tags: [...NGSL, ...CSAT] },
  { slug: 'auto-vlevel-v2', v: 2, qty: 150, tags: [...NGSL, ...CSAT] },
  { slug: 'auto-vlevel-v3', v: 3, qty: 150, tags: [...NGSL, ...CSAT] },
  { slug: 'auto-vlevel-v4', v: 4, qty: 200, tags: [...NGSL, ...CSAT] },
  { slug: 'auto-vlevel-v5', v: 5, qty: 200, tags: [...NGSL, ...CSAT] },
  { slug: 'auto-vlevel-v6', v: 6, qty: 200, tags: [...NGSL, ...CSAT] },
  { slug: 'auto-vlevel-v7', v: 7, qty: 200, tags: [...NGSL, ...CSAT] },
  { slug: 'auto-vlevel-v8', v: 8, qty: 200, tags: [...NGSL, ...BSL] },
  { slug: 'auto-vlevel-v9', v: 9, qty: 200, tags: [...NGSL, ...BSL, ...NAWL] },
]
const CONTENT_POS = ['noun', 'verb', 'adjective', 'adverb']

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

async function reconPool(cfg) {
  // 기준 매칭 행 전수 fetch(v_level 고정이라 소량) → JS에서 freq 정렬·qty 컷
  const rows = []
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, meaning_ko, primary_pos, pos, cefr_level, example_en, ipa, ipa_us, ipa_uk, frequency_rank, list_tags, skill_level')
      .eq('v_level', cfg.v).eq('skill_level', 3).not('meaning_ko', 'is', null)
      .in('pos', CONTENT_POS).gt('word', cursor).order('word', { ascending: true }).limit(1000)
    if (error) throw error
    if (!data.length) break
    rows.push(...data); cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
  const tagset = new Set(cfg.tags)
  const eligible = rows.filter((r) =>
    (r.word || '').length >= 3 &&
    Array.isArray(r.list_tags) && r.list_tags.some((t) => tagset.has(t)))
  eligible.sort((a, b) => (a.frequency_rank ?? Number.MAX_SAFE_INTEGER) - (b.frequency_rank ?? Number.MAX_SAFE_INTEGER) || a.word.localeCompare(b.word))
  return eligible.slice(0, cfg.qty)
}

async function currentMembers(slug) {
  const { data: s } = await db.from('shared_word_sets').select('id').eq('slug', slug).limit(1)
  if (!s || !s.length) return { id: null, words: new Set() }
  const { data: w } = await db.from('shared_words').select('word').eq('set_id', s[0].id)
  return { id: s[0].id, words: new Set((w ?? []).map((x) => (x.word || '').toLowerCase())) }
}

let totalAdded = 0, totalRemoved = 0
for (const cfg of SETS) {
  const pool = await reconPool(cfg)
  const { id, words: cur } = await currentMembers(cfg.slug)
  const reconWords = pool.map((r) => r.word.toLowerCase())
  const added = reconWords.filter((w) => !cur.has(w))
  const removed = [...cur].filter((w) => !reconWords.includes(w))
  totalAdded += added.length; totalRemoved += removed.length
  console.log(`${cfg.slug} (v${cfg.v}, qty ${cfg.qty}): recon ${pool.length} · current ${cur.size} · +${added.length} -${removed.length}`)
  if (!COMMIT) {
    if (added.length) console.log(`   + ${added.slice(0, 8).join(', ')}${added.length > 8 ? ' …' : ''}`)
    if (removed.length) console.log(`   - ${removed.slice(0, 8).join(', ')}${removed.length > 8 ? ' …' : ''}`)
    continue
  }
  if (!id) { console.warn(`   ⚠️ set ${cfg.slug} not found — skip`); continue }
  if (pool.length !== cfg.qty) { console.warn(`   ⚠️ recon ${pool.length} != qty ${cfg.qty} — skip(안전)`); continue }
  // 교체: 기존 단어 삭제 → 재삽입
  await db.from('shared_words').delete().eq('set_id', id)
  const rows = pool.map((r, i) => ({
    set_id: id, word: r.word, lemma: r.word, meaning_ko: r.meaning_ko,
    part_of_speech: r.primary_pos ?? r.pos ?? null, cefr_level: r.cefr_level,
    example_en: r.example_en, ipa: r.ipa ?? r.ipa_us ?? r.ipa_uk ?? null,
    sort_order: i + 1, chapter: null,
  }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('shared_words').insert(rows.slice(i, i + 500))
    if (error) { console.error(`   ❌ insert ${cfg.slug}:`, error.message); process.exit(1) }
  }
  await db.from('shared_word_sets').update({ word_count: rows.length, regenerated_at: new Date().toISOString() }).eq('id', id)
  console.log(`   ✅ replaced → ${rows.length} words`)
}
console.log(`\n${COMMIT ? 'APPLIED' : 'DRY-RUN'} · total +${totalAdded} -${totalRemoved} across ${SETS.length} sets`)
