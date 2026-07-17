// scripts/dict/sense-apply.mjs
// 서브에이전트가 authoring 한 sense 완성 결과(*.out.json)를 shared_dictionary 에 일괄 적용.
//   각 항목 {word, meanings_ko:[{pos,meaning,v_level}...]} → meanings_ko 갱신 + flat pos/meaning_ko=meanings_ko[0] + shared_words 동기화.
//   검증: pos 화이트리스트·v_level 정수·2+ senses·word 실재. 실패 항목은 스킵 로그.
// 실행: node scripts/dict/sense-apply.mjs [--dir scripts/dict/sense-chunks] [--commit]
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const DIR = arg('--dir', 'scripts/dict/sense-chunks')
const COMMIT = process.argv.includes('--commit')
const POS_OK = new Set(['noun', 'verb', 'adjective', 'adverb', 'interjection', 'preposition', 'conjunction', 'pronoun', 'determiner'])

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

// 수집 + 검증
const items = new Map() // word → meanings_ko
let files = 0, bad = 0
for (const f of fs.readdirSync(DIR)) {
  if (!/\.out\.json$/.test(f)) continue
  files++
  let arr
  try { arr = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) } catch { console.warn('parse fail', f); continue }
  if (!Array.isArray(arr)) continue
  for (const e of arr) {
    if (!e || typeof e.word !== 'string' || !Array.isArray(e.meanings_ko) || e.meanings_ko.length < 2) { bad++; continue }
    let ok = true
    for (const m of e.meanings_ko) {
      if (!m || !POS_OK.has(m.pos) || typeof m.meaning !== 'string' || !m.meaning.trim() || !Number.isInteger(m.v_level) || m.v_level < 1 || m.v_level > 11) { ok = false; break }
    }
    if (!ok) { bad++; continue }
    items.set(e.word.toLowerCase(), e.meanings_ko) // 중복 word는 마지막 우선
  }
}
console.log(`files: ${files} · valid words: ${items.size} · rejected: ${bad}`)
if (!COMMIT) { console.log('DRY-RUN (--commit 로 적용). 샘플:'); let n = 0; for (const [w, mk] of items) { if (n++ >= 12) break; console.log(' ', w, '→', mk.map((m) => m.pos[0] + ':' + m.meaning).join(' | ')) } process.exit(0) }

// 적용
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let done = 0, failed = 0, skipped = 0
const entries = [...items.entries()]
const CONC = 12
const apply = async ([word, mk]) => {
  const flatPos = mk[0].pos, flatMean = mk[0].meaning
  for (let t = 0; t < 4; t++) {
    // 현재 단일-sense인 것만 갱신(이미 다중이면 사람 손댄 것일 수 있어 스킵)
    const { data: cur } = await db.from('shared_dictionary').select('meanings_ko').eq('word', word).limit(1)
    if (!cur || !cur.length) { skipped++; return }
    if (Array.isArray(cur[0].meanings_ko) && cur[0].meanings_ko.length >= 2) { skipped++; return }
    const { error } = await db.from('shared_dictionary')
      .update({ meanings_ko: mk, pos: flatPos, meaning_ko: flatMean }).eq('word', word)
    if (!error) {
      await db.from('shared_words').update({ meaning_ko: flatMean }).eq('word', word)
      return
    }
    await sleep(300 * (t + 1))
  }
  failed++
}
for (let i = 0; i < entries.length; i += CONC) {
  await Promise.all(entries.slice(i, i + CONC).map(apply))
  done += Math.min(CONC, entries.length - i)
  if (done % 240 < CONC) console.log(`  ${done}/${entries.length} (failed ${failed}, skipped ${skipped})`)
}
console.log(`done. applied ~${entries.length - failed - skipped}, failed ${failed}, skipped ${skipped}`)
