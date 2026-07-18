// scripts/dict/example-match-apply.mjs
// per-sense 예문 적용 — 서브에이전트 산출(*.out.json: {word, senses:[{meaning, example}]})을 meanings_ko 각 sense.example 에.
//   grounding 게이트: example 은 반드시 그 단어의 제공 예문 풀(같은 dir chunk-NN.json)에 존재해야 함(무환각·편집 금지).
//   매칭: meaning 문자열로 meanings_ko sense 찾음(실패 시 인덱스). pos/v_level 보존, example 필드만 추가.
// 실행: node scripts/dict/example-match-apply.mjs --dir scripts/dict/exmatch [--commit]
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const DIR = arg('--dir', 'scripts/dict/exmatch')
const COMMIT = process.argv.includes('--commit')
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

// chunk-NN.json → 단어별 예문 풀(grounding)
const pool = Object.create(null)
for (const f of fs.readdirSync(DIR)) {
  if (!/^chunk-\d+\.json$/.test(f)) continue
  for (const e of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) pool[e.word.toLowerCase()] = new Set((e.examples || []))
}

// out.json → {word, senses:[{meaning, example}]}
const items = new Map()
const rej = { count: 0, reasons: {} }
let files = 0
for (const f of fs.readdirSync(DIR)) {
  if (!/\.out\.json$/.test(f)) continue
  files++
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) } catch { console.warn('parse fail', f); continue }
  if (!Array.isArray(arr)) continue
  for (const e of arr) {
    if (!e || typeof e.word !== 'string' || !Array.isArray(e.senses)) { rej.count++; continue }
    const w = e.word.toLowerCase(), pset = pool[w]
    if (!pset) { rej.count++; rej.reasons['no-pool'] = (rej.reasons['no-pool'] || 0) + 1; continue }
    const pairs = []
    for (const s of e.senses) {
      if (!s || typeof s.meaning !== 'string' || typeof s.example !== 'string' || !s.example.trim()) continue
      if (!pset.has(s.example.trim())) { rej.reasons['ungrounded-ex'] = (rej.reasons['ungrounded-ex'] || 0) + 1; continue } // 편집/지어냄 거부
      pairs.push({ meaning: s.meaning.trim(), example: s.example.trim() })
    }
    if (pairs.length) items.set(w, pairs)
  }
}
console.log(`files: ${files} · words-with-match: ${items.size} · rejected: ${rej.count}`, rej.reasons)
if (!COMMIT) {
  console.log('DRY-RUN. 샘플:'); let n = 0
  for (const [w, ps] of items) { if (n++ >= 8) break; console.log(' ', w, '→', ps.map((p) => `[${p.meaning}] "${p.example}"`).join(' | ').slice(0, 180)) }
  process.exit(0)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let updated = 0, skipped = 0, failed = 0
const entries = [...items.entries()], CONC = 10
const apply = async ([word, pairs]) => {
  for (let t = 0; t < 4; t++) {
    const { data: cur, error: se } = await db.from('shared_dictionary').select('meanings_ko').eq('word', word).limit(1)
    if (se) { await sleep(300 * (t + 1)); continue }
    if (!cur || !cur.length || !Array.isArray(cur[0].meanings_ko)) { skipped++; return }
    const mk = cur[0].meanings_ko.map((s) => ({ ...s }))
    let hit = 0
    for (const p of pairs) {
      let idx = mk.findIndex((s) => (s.meaning || '').trim() === p.meaning)
      if (idx < 0) continue
      if (!mk[idx].example) { mk[idx].example = p.example; hit++ }
    }
    if (!hit) { skipped++; return }
    const { error } = await db.from('shared_dictionary').update({ meanings_ko: mk }).eq('word', word)
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
