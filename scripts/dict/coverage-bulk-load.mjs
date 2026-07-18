// scripts/dict/coverage-bulk-load.mjs
// coverage_lexicon 벌크 적재 — kaikki 단일어·content POS·실 gloss·비고유명사·코어 밖 → word·pos·gloss_en·ipa.
//   학습 core(shared_dictionary)와 분리된 독해 커버리지 참조 사전. meaning_ko는 NULL(demand 채움).
// 실행: node --max-old-space-size=4096 scripts/dict/coverage-bulk-load.mjs [--commit]
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const COMMIT = process.argv.includes('--commit')
const SRC = 'scripts/dict/data/kaikki-en-words.jsonl'
const POS_MAP = { noun: 'noun', verb: 'verb', adj: 'adjective', adv: 'adverb', intj: 'interjection', prep: 'preposition', conj: 'conjunction', pron: 'pronoun', det: 'determiner', num: 'numeral' }
const FORM = /^(Abbreviation|Initialism|Acronym|Clipping|Alternative (form|spelling)|Alt form|Misspelling|plural of|past (tense|participle) of|present participle of|singular of|comparative of|superlative of|inflection of|synonym of|Contraction|Ellipsis|Eye dialect|Only used in|Used )/i
const POS_PRIORITY = { noun: 5, verb: 4, adjective: 3, adverb: 2 }

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

// 코어 단어셋(제외)
const core = new Set()
{ let cur = ''; for (;;) { const { data } = await db.from('shared_dictionary').select('word').gt('word', cur).order('word').limit(1000); if (!data || !data.length) break; for (const r of data) core.add(r.word.toLowerCase()); cur = data[data.length - 1].word; if (data.length < 1000) break } }
console.log('core 제외셋:', core.size)

const map = Object.create(null) // word → {pos, gloss, ipa}
const rl = readline.createInterface({ input: fs.createReadStream(SRC, { encoding: 'utf8' }), crlfDelay: Infinity })
let n = 0
try {
for await (const line of rl) {
  n++; if (n % 500000 === 0) console.log('  scan', n)
  if (!line) continue
  let o; try { o = JSON.parse(line) } catch { continue }
  const w = (o.word || '').toLowerCase()
  if (!w || !/^[a-z][a-z'-]*[a-z]$/.test(w) || w.length < 2 || core.has(w)) continue
  const pos = POS_MAP[o.pos]; if (!pos) continue // content POS만(고유명사 name 제외)
  // 실 gloss(leaf, 형태포인터 제외)
  let gloss = null
  for (const s of (o.senses || [])) {
    if (Array.isArray(s.form_of) && s.form_of.length) continue // 굴절형 skip(추출이 lemma로 해소)
    const gs = Array.isArray(s.glosses) && s.glosses.length ? s.glosses : (Array.isArray(s.raw_glosses) ? s.raw_glosses : [])
    const g = gs.length ? gs[gs.length - 1] : null
    if (g && typeof g === 'string' && g.length <= 250 && !g.trim().endsWith(':') && !FORM.test(g.trim())) { gloss = g.trim(); break }
  }
  if (!gloss) continue
  // ipa(word-level)
  let ipa = null
  for (const s of (o.sounds || [])) if (s.ipa) { ipa = s.ipa; break }
  const cur = map[w]
  if (!cur) map[w] = { pos, gloss, ipa }
  else {
    // 더 우선순위 높은 POS면 gloss/pos 교체, ipa는 있으면 유지/보충
    if ((POS_PRIORITY[pos] || 1) > (POS_PRIORITY[cur.pos] || 1)) { cur.pos = pos; cur.gloss = gloss }
    if (!cur.ipa && ipa) cur.ipa = ipa
  }
}
rl.close()
} catch (err) { console.error('SCAN ERROR line', n, err.message); process.exit(1) }

const words = Object.keys(map)
console.log('coverage 후보:', words.length)
if (!COMMIT) {
  console.log('DRY-RUN. 샘플:'); for (const w of words.slice(0, 10)) console.log(' ', w, JSON.stringify(map[w]).slice(0, 120))
  process.exit(0)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let inserted = 0, failed = 0
const BATCH = 1000
for (let i = 0; i < words.length; i += BATCH) {
  const rows = words.slice(i, i + BATCH).map((w) => ({ word: w, pos: map[w].pos, gloss_en: map[w].gloss, ipa: map[w].ipa, source: 'kaikki' }))
  let ok = false
  for (let t = 0; t < 4; t++) {
    const { error } = await db.from('coverage_lexicon').upsert(rows, { onConflict: 'word', ignoreDuplicates: true })
    if (!error) { ok = true; break }
    await sleep(400 * (t + 1))
  }
  if (ok) inserted += rows.length; else failed += rows.length
  if ((i + BATCH) % 50000 < BATCH) console.log(`  ${Math.min(i + BATCH, words.length)}/${words.length} (inserted ${inserted}, failed ${failed})`)
}
console.log(`done. inserted ${inserted}, failed ${failed}`)
