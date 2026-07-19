// scripts/dict/republish-auto-vlevel.mjs
// auto-vlevel-v1..9 재발행 — VRL 드리프트 해소 + P1 품질 게이트(굴절/파생 제외·표제어 우선).
//   기준(원 curation_query): v_level=N · list_tags && <tags> · skill_level=3 · meaning_ko present
//   · pos in (noun,verb,adjective,adverb) · char_length(word)>=3 · ORDER BY frequency_rank ASC NULLS LAST, word · LIMIT qty.
//   ★ P1 품질 게이트(v06.258): (R1) 다른 표제어의 굴절형(inflected_forms 역참조) 제외 — are/been/was 류 근절.
//                             (R2) 파생 -ing/-ed 중 base 표제어가 사전에 실재하는 것 제외 — backing/takings/birding 류 근절.
//     → 저레벨 세트 오염(V1 굴절 35%·V2-3 파생 30%) 제거. 검증: 필터 후에도 pool ≥ qty(전 레벨).
//   --no-quality 로 P1 끄고 원 동작(굴절/파생 포함) 재현 가능.
// 실행: node scripts/dict/republish-auto-vlevel.mjs            (dry-run: 세트별 pool/±diff/head)
//       node scripts/dict/republish-auto-vlevel.mjs --commit   (shared_words 교체 + word_count/regenerated_at)
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const COMMIT = process.argv.includes('--commit')
const QUALITY = !process.argv.includes('--no-quality') // P1 게이트 기본 ON
const NGSL = ['ngsl_1.2', 'ngsl_gr_1.0', 'ngsl_spoken_1.2']
const CSAT = ['csat-prep-core-2k', 'csat-prep-ext-1.8k']
const BSL = ['bsl_1.20'], NAWL = ['nawl_1.2']
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

// ── P1 게이트용 전역 집합 (한 번만 prefetch) ──
const inflForms = new Set() // 다른 표제어의 굴절형 (R1)
const contentWords = new Set() // content-POS + 뜻 보유 표제어 (R2 base 존재 확인)
if (QUALITY) {
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, pos, meaning_ko, inflected_forms').gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      const w = (r.word || '').toLowerCase()
      if (r.meaning_ko && CONTENT_POS.includes(r.pos)) contentWords.add(w)
      if (Array.isArray(r.inflected_forms)) for (const f of r.inflected_forms) inflForms.add((f || '').toLowerCase())
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
}
// -ing/-ed 파생어의 base 후보 stem들 (표준 역굴절)
function deInflectStems(w) {
  const s = []
  const m = w.match(/^(.+?)(ing|ed)$/)
  if (!m) return s
  const stem = m[1]
  s.push(stem, stem + 'e')
  if (/(.)\1$/.test(stem)) s.push(stem.slice(0, -1)) // running→run
  if (w.endsWith('ied')) s.push(w.slice(0, -3) + 'y') // studied→study
  if (w.endsWith('ed')) s.push(w.slice(0, -1)) // -ed 만 뗀 형태도 (freed→free 는 위 stem+e)
  return s
}
function isDerivation(w) {
  // w 자체 + (복수형이면) 단수형까지 -ing/-ed 파생 검사 (takings→taking→take)
  const cands = [w]
  if (w.endsWith('s') && w.length > 4) cands.push(w.slice(0, -1))
  return cands.some((c) => /(ing|ed)$/.test(c) && deInflectStems(c).some((b) => b !== w && b !== c && contentWords.has(b)))
}

async function reconPool(cfg) {
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
  let exclInfl = 0, exclDeriv = 0
  const eligible = rows.filter((r) => {
    const w = (r.word || '').toLowerCase()
    if (w.length < 3) return false
    if (!(Array.isArray(r.list_tags) && r.list_tags.some((t) => tagset.has(t)))) return false
    if (QUALITY) {
      if (inflForms.has(w)) { exclInfl++; return false }        // R1
      if (isDerivation(w)) { exclDeriv++; return false }        // R2
    }
    return true
  })
  eligible.sort((a, b) => (a.frequency_rank ?? Number.MAX_SAFE_INTEGER) - (b.frequency_rank ?? Number.MAX_SAFE_INTEGER) || a.word.localeCompare(b.word))
  return { pool: eligible.slice(0, cfg.qty), exclInfl, exclDeriv }
}

async function currentMembers(slug) {
  const { data: s } = await db.from('shared_word_sets').select('id').eq('slug', slug).limit(1)
  if (!s || !s.length) return { id: null, words: new Set() }
  const { data: w } = await db.from('shared_words').select('word').eq('set_id', s[0].id)
  return { id: s[0].id, words: new Set((w ?? []).map((x) => (x.word || '').toLowerCase())) }
}

let tAdd = 0, tRem = 0
for (const cfg of SETS) {
  const { pool, exclInfl, exclDeriv } = await reconPool(cfg)
  const { id, words: cur } = await currentMembers(cfg.slug)
  const reconWords = pool.map((r) => r.word.toLowerCase())
  const added = reconWords.filter((w) => !cur.has(w))
  const removed = [...cur].filter((w) => !reconWords.includes(w))
  tAdd += added.length; tRem += removed.length
  console.log(`${cfg.slug} (v${cfg.v}): pool ${pool.length}/${cfg.qty} · +${added.length} -${removed.length}${QUALITY ? ` · excl infl ${exclInfl}/deriv ${exclDeriv}` : ''}`)
  if (!COMMIT) {
    console.log(`   head: ${pool.slice(0, 12).map((r) => r.word).join(', ')}`)
    continue
  }
  if (!id) { console.warn(`   ⚠️ ${cfg.slug} not found — skip`); continue }
  if (pool.length < Math.min(cfg.qty, 50)) { console.warn(`   ⚠️ pool ${pool.length} too small — skip(안전)`); continue }
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
console.log(`\n${COMMIT ? 'APPLIED' : 'DRY-RUN'}${QUALITY ? ' [P1 quality gate ON]' : ' [raw]'} · total +${tAdd} -${tRem}`)
