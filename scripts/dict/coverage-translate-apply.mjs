// scripts/dict/coverage-translate-apply.mjs
// coverage_lexicon 한국어 적용 — 서브에이전트 산출(*.out.json: {word, meaning_ko}) → coverage_lexicon.meaning_ko.
//   게이트: 한글 포함(영어 echo 거부)·길이 2~200·비어있지 않음. 멱등(이미 있으면 skip).
// 실행: node scripts/dict/coverage-translate-apply.mjs --dir scripts/dict/covtr [--commit]
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const DIR = arg('--dir', 'scripts/dict/covtr')
const COMMIT = process.argv.includes('--commit')
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

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
    const mk = e.meaning_ko.trim()
    if (!mk || mk.length > 200) { rej.count++; rej.reasons.len = (rej.reasons.len || 0) + 1; continue }
    if (!/[가-힣]/.test(mk)) { rej.count++; rej.reasons['no-hangul'] = (rej.reasons['no-hangul'] || 0) + 1; continue } // 영어 echo 거부
    items.set(e.word.toLowerCase(), mk)
  }
}
console.log(`files: ${files} · valid: ${items.size} · rejected: ${rej.count}`, rej.reasons)
if (!COMMIT) {
  console.log('DRY-RUN. 샘플:'); let n = 0
  for (const [w, mk] of items) { if (n++ >= 12) break; console.log(' ', w, '→', mk) }
  process.exit(0)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let updated = 0, skipped = 0, failed = 0
const entries = [...items.entries()], CONC = 12
const apply = async ([word, mk]) => {
  for (let t = 0; t < 4; t++) {
    const { data: cur, error: se } = await db.from('coverage_lexicon').select('meaning_ko').eq('word', word).limit(1)
    if (se) { await sleep(300 * (t + 1)); continue }
    if (!cur || !cur.length) { skipped++; return }
    if (cur[0].meaning_ko) { skipped++; return } // 이미 있으면 skip(멱등)
    const { error } = await db.from('coverage_lexicon').update({ meaning_ko: mk, updated_at: new Date().toISOString() }).eq('word', word)
    if (!error) { updated++; return }
    await sleep(300 * (t + 1))
  }
  failed++
}
for (let i = 0; i < entries.length; i += CONC) {
  await Promise.all(entries.slice(i, i + CONC).map(apply))
  if ((i + CONC) % 2400 < CONC) console.log(`  ${Math.min(i + CONC, entries.length)}/${entries.length} (updated ${updated}, skipped ${skipped}, failed ${failed})`)
}
console.log(`done. updated ${updated}, skipped ${skipped}, failed ${failed}`)
