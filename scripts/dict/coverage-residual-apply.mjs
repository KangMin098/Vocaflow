// scripts/dict/coverage-residual-apply.mjs
// 추출 누락 실단어 적재 — 서브에이전트 산출(*.out.json: {word, meaning_ko, pos}) → coverage_lexicon INSERT.
//   source='content_residual', gloss_en/frequency_rank=null(도서·기사 잔여 실단어, kaikki 부재).
//   게이트: 한글 포함(외국어/영어 echo 거부)·길이 2~200. 멱등(이미 있으면 skip, upsert do-nothing).
// 실행: node scripts/dict/coverage-residual-apply.mjs --dir scripts/dict/covres [--commit]
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const DIR = arg('--dir', 'scripts/dict/covres')
const COMMIT = process.argv.includes('--commit')
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

const POS_OK = new Set(['noun', 'verb', 'adjective', 'adverb', 'interjection', 'preposition', 'conjunction', 'pronoun', 'determiner', 'numeral'])
const items = new Map()
const rej = { count: 0, reasons: {} }
let files = 0
for (const f of fs.readdirSync(DIR)) {
  if (!/\.out\.json$/.test(f)) continue
  files++
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) } catch { console.warn('parse fail', f); continue }
  if (!Array.isArray(arr)) continue
  for (const e of arr) {
    if (!e || typeof e.word !== 'string' || typeof e.meaning_ko !== 'string') { rej.count++; rej.reasons.malformed = (rej.reasons.malformed || 0) + 1; continue }
    const w = e.word.toLowerCase().trim()
    const mk = e.meaning_ko.trim()
    if (!w || !/^[a-z][a-z'-]*$/.test(w)) { rej.count++; rej.reasons.badword = (rej.reasons.badword || 0) + 1; continue }
    if (!mk || mk.length > 200) { rej.count++; rej.reasons.len = (rej.reasons.len || 0) + 1; continue }
    if (!/[가-힣]/.test(mk)) { rej.count++; rej.reasons['no-hangul'] = (rej.reasons['no-hangul'] || 0) + 1; continue } // 외국어/영어 echo 거부
    const pos = typeof e.pos === 'string' && POS_OK.has(e.pos) ? e.pos : null
    items.set(w, { meaning_ko: mk, pos })
  }
}
console.log(`files: ${files} · valid: ${items.size} · rejected: ${rej.count}`, rej.reasons)
if (!COMMIT) {
  console.log('DRY-RUN. 샘플:'); let n = 0
  for (const [w, v] of items) { if (n++ >= 12) break; console.log(' ', w, '→', v.meaning_ko, v.pos ? `(${v.pos})` : '') }
  process.exit(0)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let inserted = 0, skipped = 0, failed = 0
const entries = [...items.entries()], CONC = 12
const apply = async ([word, v]) => {
  for (let t = 0; t < 4; t++) {
    const { data: cur, error: se } = await db.from('coverage_lexicon').select('word, meaning_ko').eq('word', word).limit(1)
    if (se) { await sleep(300 * (t + 1)); continue }
    if (cur && cur.length) { skipped++; return } // 이미 존재(멱등)
    const { error } = await db.from('coverage_lexicon').insert({
      word, pos: v.pos, gloss_en: null, ipa: null, meaning_ko: v.meaning_ko,
      frequency_rank: null, source: 'content_residual',
    })
    if (!error) { inserted++; return }
    if (error.code === '23505') { skipped++; return } // race: 동시 삽입
    await sleep(300 * (t + 1))
  }
  failed++
}
for (let i = 0; i < entries.length; i += CONC) {
  await Promise.all(entries.slice(i, i + CONC).map(apply))
  if ((i + CONC) % 1200 < CONC) console.log(`  ${Math.min(i + CONC, entries.length)}/${entries.length} (inserted ${inserted}, skipped ${skipped}, failed ${failed})`)
}
console.log(`done. inserted ${inserted}, skipped ${skipped}, failed ${failed}`)
