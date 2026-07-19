// scripts/dict/kaikki-extra-apply.mjs
// #4·#5 적용 — data/kaikki-extra.json → shared_dictionary.
//   --relations : homophones·rhyme_key·derived_forms·related_terms 컬럼(결측만).
//   --enrich    : example_en 결측 채움 + synonyms 결측/부족 보강(모두 kaikki 외부사실=무환각).
//   기본 dry-run. --commit 로 적용.
// 실행: node scripts/dict/kaikki-extra-apply.mjs --relations --commit
import fs from 'node:fs'
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const RELATIONS = process.argv.includes('--relations')
const ENRICH = process.argv.includes('--enrich')
const COMMIT = process.argv.includes('--commit')
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })
const map = Object.create(null) // 프로토타입 오염 방지
for (const line of fs.readFileSync('scripts/dict/data/kaikki-extra.jsonl', 'utf8').split('\n')) {
  if (!line) continue
  try { const o = JSON.parse(line); map[o.w] = o } catch { /* skip */ }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 대상 행 로드(추출대상 register + 필요 컬럼)
const rows = []
{
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, example_en, synonyms, homophones, rhyme_key, derived_forms, related_terms, word_register')
      .not('classified_by', 'is', null).gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) rows.push(r)
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
}
console.log(`대상 행: ${rows.length}`)

// 업데이트 계획
const plan = []
for (const r of rows) {
  const e = map[r.word.toLowerCase()]; if (!e) continue
  const upd = {}
  if (RELATIONS) {
    if ((!r.homophones || !r.homophones.length) && e.homophones?.length) upd.homophones = e.homophones
    if (!r.rhyme_key && e.rhyme_key) upd.rhyme_key = e.rhyme_key
    if ((!r.derived_forms || !r.derived_forms.length) && e.derived?.length) upd.derived_forms = e.derived
    if ((!r.related_terms || !r.related_terms.length) && e.related?.length) upd.related_terms = e.related
  }
  if (ENRICH) {
    const exPool = [...new Set((e.senses || []).flatMap((s) => s.examples || []))]
    const synPool = [...new Set((e.senses || []).flatMap((s) => s.synonyms || []))]
    if ((!r.example_en || !r.example_en.trim()) && exPool.length) upd.example_en = exPool[0]
    if ((!r.synonyms || r.synonyms.length < 3) && synPool.length) {
      const merged = [...new Set([...(r.synonyms || []), ...synPool])].slice(0, 10)
      if (merged.length > (r.synonyms?.length || 0)) upd.synonyms = merged
    }
  }
  if (Object.keys(upd).length) plan.push([r.word, upd])
}
const tally = (k) => plan.filter(([, u]) => k in u).length
console.log(`업데이트 계획: ${plan.length}행`)
console.log(`  homophones ${tally('homophones')} · rhyme_key ${tally('rhyme_key')} · derived_forms ${tally('derived_forms')} · related_terms ${tally('related_terms')} · example_en ${tally('example_en')} · synonyms ${tally('synonyms')}`)
if (!COMMIT) {
  console.log('DRY-RUN. 샘플:')
  for (const [w, u] of plan.slice(0, 8)) console.log(' ', w, '→', JSON.stringify(u).slice(0, 150))
  process.exit(0)
}
let updated = 0, failed = 0
const CONC = 12
const apply = async ([word, upd]) => {
  for (let t = 0; t < 4; t++) {
    const { error } = await db.from('shared_dictionary').update(upd).eq('word', word)
    if (!error) { updated++; return }
    await sleep(300 * (t + 1))
  }
  failed++
}
for (let i = 0; i < plan.length; i += CONC) {
  await Promise.all(plan.slice(i, i + CONC).map(apply))
  if ((i + CONC) % 2400 < CONC) console.log(`  ${Math.min(i + CONC, plan.length)}/${plan.length} (updated ${updated}, failed ${failed})`)
}
console.log(`done. updated ${updated}, failed ${failed}`)
