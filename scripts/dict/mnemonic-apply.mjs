// scripts/dict/mnemonic-apply.mjs
// M2 니모닉 적용 — 서브에이전트 산출(*.out.json: {word, mnemonic_ko})을 shared_dictionary.mnemonic_ko 에.
//   검증: 비어있지 않은 문자열 · 과도 길이 컷(<=120자) · 멱등(이미 있으면 스킵, --overwrite 로 갱신).
// 실행: node scripts/dict/mnemonic-apply.mjs --dir scripts/dict/mnem-p1 [--commit] [--overwrite]
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const DIR = arg('--dir', 'scripts/dict/mnem-chunks')
const COMMIT = process.argv.includes('--commit')
const OVERWRITE = process.argv.includes('--overwrite')

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

const items = new Map() // word → mnemonic
let files = 0, bad = 0
for (const f of fs.readdirSync(DIR)) {
  if (!/\.out\.json$/.test(f)) continue
  files++
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) } catch { console.warn('parse fail', f); continue }
  if (!Array.isArray(arr)) continue
  for (const e of arr) {
    if (!e || typeof e.word !== 'string' || typeof e.mnemonic_ko !== 'string') { bad++; continue }
    const mn = e.mnemonic_ko.trim()
    if (!mn || mn.length > 120) { bad++; continue }
    items.set(e.word.toLowerCase(), mn)
  }
}
console.log(`files: ${files} · mnemonics: ${items.size} · rejected: ${bad}`)
if (!COMMIT) {
  console.log('DRY-RUN (--commit 로 적용). 샘플:')
  let n = 0; for (const [w, mn] of items) { if (n++ >= 14) break; console.log(' ', w, '→', mn) }
  process.exit(0)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let updated = 0, skipped = 0, failed = 0
const entries = [...items.entries()]
const CONC = 12
const apply = async ([word, mn]) => {
  for (let t = 0; t < 4; t++) {
    const { data: cur } = await db.from('shared_dictionary').select('mnemonic_ko').eq('word', word).limit(1)
    if (!cur || !cur.length) { skipped++; return }
    if (!OVERWRITE && cur[0].mnemonic_ko && cur[0].mnemonic_ko.trim()) { skipped++; return }
    const { error } = await db.from('shared_dictionary').update({ mnemonic_ko: mn }).eq('word', word)
    if (!error) { updated++; return }
    await sleep(300 * (t + 1))
  }
  failed++
}
for (let i = 0; i < entries.length; i += CONC) {
  await Promise.all(entries.slice(i, i + CONC).map(apply))
  if ((i + CONC) % 240 < CONC) console.log(`  ${Math.min(i + CONC, entries.length)}/${entries.length} (updated ${updated}, skipped ${skipped}, failed ${failed})`)
}
console.log(`done. updated ${updated}, skipped ${skipped}, failed ${failed}`)
