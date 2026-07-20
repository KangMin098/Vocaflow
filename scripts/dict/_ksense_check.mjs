// 읽기 전용 점검: 세션별 authored/applied/pending + 세션 간 단어 중복(격리 검증) + 무효 엔트리
import fs from 'node:fs'
import path from 'node:path'
const ROOT = '.'
const envPath = path.join(ROOT, 'apps/web/.env.local')
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })
const POS_OK = new Set(['noun', 'verb', 'adjective', 'adverb', 'interjection', 'preposition', 'conjunction', 'pronoun', 'determiner'])

const owner = new Map() // word → session (중복 탐지)
const dup = []
const sessions = []
for (let s = 1; s <= 6; s++) {
  const dir = path.join(ROOT, 'scripts/dict/ksense-s' + s)
  const outs = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.out\.json$/.test(f)).sort() : []
  const chunks = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^chunk-\d+\.json$/.test(f)).length : 0
  const words = new Map() // word → target sense count
  let invalid = 0
  for (const f of outs) {
    let arr; try { arr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) } catch { invalid++; continue }
    if (!Array.isArray(arr)) { invalid++; continue }
    for (const e of arr) {
      if (!e || typeof e.word !== 'string' || !Array.isArray(e.meanings_ko) || e.meanings_ko.length < 2) { invalid++; continue }
      let ok = true
      for (const m of e.meanings_ko) if (!m || !POS_OK.has(m.pos) || typeof m.meaning !== 'string' || !m.meaning.trim() || !Number.isInteger(m.v_level) || m.v_level < 1 || m.v_level > 11) { ok = false; break }
      if (!ok) { invalid++; continue }
      const w = e.word.toLowerCase()
      if (owner.has(w) && owner.get(w) !== s) dup.push({ word: w, a: owner.get(w), b: s })
      owner.set(w, s)
      words.set(w, e.meanings_ko.length)
    }
  }
  sessions.push({ s, chunks, outs: outs.length, words, invalid })
}

// DB 대조 — authored 단어의 현 sense 수
const allWords = [...owner.keys()]
const dbLen = new Map()
for (let i = 0; i < allWords.length; i += 300) {
  const slice = allWords.slice(i, i + 300)
  const { data, error } = await db.from('shared_dictionary').select('word, meanings_ko').in('word', slice)
  if (error) { console.error(error.message); process.exit(1) }
  for (const r of data) dbLen.set(r.word.toLowerCase(), Array.isArray(r.meanings_ko) ? r.meanings_ko.length : 0)
}

const rows = []
let tA = 0, tApp = 0, tPend = 0
for (const { s, chunks, outs, words, invalid } of sessions) {
  let applied = 0, pending = 0, missing = 0
  for (const [w, n] of words) {
    if (!dbLen.has(w)) { missing++; continue }
    if (dbLen.get(w) >= n) applied++; else pending++
  }
  tA += words.size; tApp += applied; tPend += pending
  rows.push({ 세션: 'S' + s, 청크: `${outs}/${chunks}`, authored: words.size, 'DB적용': applied, '미적용': pending, 'DB없음': missing, 무효: invalid })
}
console.table(rows)
console.log(`합계: authored ${tA} · DB적용 ${tApp} · 미적용(apply 대기) ${tPend}`)
console.log(`세션 간 단어 중복: ${dup.length}` + (dup.length ? ' ⚠️ ' + JSON.stringify(dup.slice(0, 5)) : ' ✅ 격리 정상'))
