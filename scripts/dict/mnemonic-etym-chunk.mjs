// scripts/dict/mnemonic-etym-chunk.mjs
// M3 어원 니모닉 확대 — 미니모닉 노출-고난도 단어에 kaikki etymology_text 를 '근거'로 제공.
//   서브에이전트가 etymology_text(실제 어원)를 근거로 어근 다리 니모닉 authoring(경선식 절대 금지·근거 밖이면 skip).
//   근거가 단어별로 붙어 오므로 어근 인벤토리(181개) 한계 없음. 산출 {word, mnemonic_ko} → mnemonic-etym-apply.mjs(대조 게이트).
// 실행: node scripts/dict/mnemonic-etym-chunk.mjs --out scripts/dict/mnem-etym --min-v 7 --max-rank 12000 --chunk 120
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const OUT = arg('--out', 'scripts/dict/mnem-etym')
const MINV = parseInt(arg('--min-v', '7'), 10)
const MAXRANK = parseInt(arg('--max-rank', '12000'), 10)
const CHUNK = parseInt(arg('--chunk', '120'), 10)
const SRC = 'scripts/dict/data/kaikki-en-words.jsonl'
const EXC = new Set(['archaic_literary', 'period_cultural', 'phrase_unit', 'brand', 'abbreviation', 'proper_noun'])
// 근거 불투명 = 니모닉 근거 없음 → 제외
const OPAQUE = /unknown|uncertain|obscure|imitative|onomatopoe|origin unknown|of unknown/i
// 고전어 파생(어근 분해 가능) = 니모닉 유용
const CLASSIC = /Latin|Ancient Greek|\bGreek\b|Old French|French|Proto-Italic|Proto-Hellenic/i

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

// 1) 대상 = 미니모닉·노출·고난도 단어 (DB)
const gap = new Map() // word → {meaning, v, rank}
{
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, meaning_ko, v_level, frequency_rank, word_register, mnemonic_ko')
      .not('classified_by', 'is', null).is('mnemonic_ko', null).not('v_level', 'is', null)
      .gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      if (EXC.has(r.word_register || 'standard')) continue
      const w = r.word.toLowerCase()
      if (w.length < 4 || /[^a-z]/.test(w)) continue // 단자어·비알파 제외(어원 분해 무의미)
      if (r.v_level >= MINV && r.frequency_rank != null && r.frequency_rank <= MAXRANK) {
        gap.set(w, { meaning: r.meaning_ko || '', v: r.v_level, rank: r.frequency_rank })
      }
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
}
console.log(`gap(미니모닉·v>=${MINV}·rank<=${MAXRANK}): ${gap.size}`)

// 2) kaikki 스트림 → 대상 단어 etymology_text
const etym = new Map()
{
  const rl = readline.createInterface({ input: fs.createReadStream(SRC, { encoding: 'utf8' }), crlfDelay: Infinity })
  let lines = 0
  for await (const line of rl) {
    lines++; if (lines % 500000 === 0) process.stderr.write(`\r  scan ${lines}`)
    if (!line) continue
    let o; try { o = JSON.parse(line) } catch { continue }
    const w = (o.word || '').toLowerCase()
    if (!gap.has(w) || etym.has(w)) continue
    const et = (o.etymology_text || '').replace(/\s+/g, ' ').trim()
    if (et) etym.set(w, et)
  }
  rl.close(); process.stderr.write('\n')
}

// 3) 게이트: etymology_text 존재 · 불투명 아님 · 고전어(분해가능)
let targets = []
let skipNoEt = 0, skipOpaque = 0, skipNonClassic = 0
for (const [w, v] of gap) {
  const et = etym.get(w)
  if (!et) { skipNoEt++; continue }
  if (OPAQUE.test(et)) { skipOpaque++; continue }
  if (!CLASSIC.test(et)) { skipNonClassic++; continue }
  targets.push({ word: w, meaning_ko: v.meaning, v_level: v.v, rank: v.rank, etymology_text: et.slice(0, 420) })
}
targets.sort((a, b) => a.rank - b.rank)
console.log(`대상: ${targets.length} (skip: etym없음 ${skipNoEt}·불투명 ${skipOpaque}·비고전 ${skipNonClassic})`)

fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(OUT)) if (/^chunk-\d+\.json$/.test(f)) fs.rmSync(path.join(OUT, f))
let idx = 0
for (let i = 0; i < targets.length; i += CHUNK) {
  fs.writeFileSync(path.join(OUT, `chunk-${String(idx).padStart(2, '0')}.json`), JSON.stringify(targets.slice(i, i + CHUNK), null, 1))
  idx++
}
console.log(`chunks: ${idx} × ~${CHUNK} → ${OUT}`)
