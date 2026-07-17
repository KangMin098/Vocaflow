// scripts/dict/kaikki-sense-apply.mjs
// sense 깊이 확대 적용 — 서브에이전트 산출(*.out.json = [{word, meanings_ko:[{pos,meaning,v_level}]}])을 shared_dictionary 에.
//   meanings_ko 교체 + flat pos/meaning_ko = meanings_ko[0] + shared_words 동기화.
//   가드: 신규 sense 수 > 현 sense 수(추가만·손실 방지) · pos 화이트리스트 · v_level 1-11 · meaning 비어있지 않음.
// 실행: node scripts/dict/kaikki-sense-apply.mjs --dir scripts/dict/ksense-p1 [--commit]
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const DIR = arg('--dir', 'scripts/dict/ksense-p1')
const COMMIT = process.argv.includes('--commit')
const POS_OK = new Set(['noun', 'verb', 'adjective', 'adverb', 'interjection', 'preposition', 'conjunction', 'pronoun', 'determiner'])
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

const items = new Map()
let files = 0, bad = 0
for (const f of fs.readdirSync(DIR)) {
  if (!/\.out\.json$/.test(f)) continue
  files++
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) } catch { console.warn('parse fail', f); continue }
  if (!Array.isArray(arr)) continue
  for (const e of arr) {
    if (!e || typeof e.word !== 'string' || !Array.isArray(e.meanings_ko) || e.meanings_ko.length < 2) { bad++; continue }
    let ok = true
    for (const m of e.meanings_ko) {
      if (!m || !POS_OK.has(m.pos) || typeof m.meaning !== 'string' || !m.meaning.trim() || !Number.isInteger(m.v_level) || m.v_level < 1 || m.v_level > 11) { ok = false; break }
    }
    if (!ok) { bad++; continue }
    items.set(e.word.toLowerCase(), e.meanings_ko.map((m) => ({ pos: m.pos, meaning: m.meaning.trim(), v_level: m.v_level })))
  }
}
console.log(`files: ${files} · valid words: ${items.size} · rejected: ${bad}`)
if (!COMMIT) {
  console.log('DRY-RUN. 샘플:'); let n = 0
  for (const [w, mk] of items) { if (n++ >= 10) break; console.log(' ', w, '→', mk.map((m) => m.pos[0] + ':' + m.meaning + '(v' + m.v_level + ')').join(' | ')) }
  process.exit(0)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let updated = 0, skipped = 0, failed = 0
const entries = [...items.entries()], CONC = 12
const apply = async ([word, mk]) => {
  for (let t = 0; t < 4; t++) {
    const { data: cur, error: se } = await db.from('shared_dictionary').select('meanings_ko').eq('word', word).limit(1)
    if (se) { await sleep(300 * (t + 1)); continue }
    if (!cur || !cur.length) { skipped++; return }
    const curN = Array.isArray(cur[0].meanings_ko) ? cur[0].meanings_ko.length : 0
    if (mk.length <= curN) { skipped++; return } // 추가 없으면 스킵(가드)
    const { error } = await db.from('shared_dictionary')
      .update({ meanings_ko: mk, pos: mk[0].pos, meaning_ko: mk[0].meaning }).eq('word', word)
    if (!error) { await db.from('shared_words').update({ meaning_ko: mk[0].meaning }).eq('word', word); updated++; return }
    await sleep(300 * (t + 1))
  }
  failed++
}
for (let i = 0; i < entries.length; i += CONC) {
  await Promise.all(entries.slice(i, i + CONC).map(apply))
  if ((i + CONC) % 240 < CONC) console.log(`  ${Math.min(i + CONC, entries.length)}/${entries.length} (updated ${updated}, skipped ${skipped}, failed ${failed})`)
}
console.log(`done. updated ${updated}, skipped ${skipped}, failed ${failed}`)
