// scripts/dict/example-match-chunk.mjs
// per-sense 예문 매칭 — 다의어(meanings_ko ≥2)의 각 한국어 sense에 kaikki 실용 예문을 매칭(판단 필요=LLM).
//   근거 = kaikki-extra.jsonl 의 clean 예문 풀(무환각: 제공 예문만 사용). 서브에이전트가 "어떤 뜻을 보여주는 예문인가" 판단.
//   출력 청크 {word, senses:[{pos,meaning}], examples:[영어 실용문 풀]}.
// 실행: node scripts/dict/example-match-chunk.mjs --out scripts/dict/exmatch --min-ex 2 --chunk 120
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const OUT = arg('--out', 'scripts/dict/exmatch')
const MINEX = parseInt(arg('--min-ex', '2'), 10)
const CHUNK = parseInt(arg('--chunk', '120'), 10)
const EXC = new Set(['archaic_literary', 'period_cultural', 'phrase_unit', 'brand', 'abbreviation', 'proper_noun'])

// 1) 예문 풀 로드(kaikki-extra.jsonl)
const pool = Object.create(null)
for (const line of fs.readFileSync('scripts/dict/data/kaikki-extra.jsonl', 'utf8').split('\n')) {
  if (!line) continue
  let o; try { o = JSON.parse(line) } catch { continue }
  const exs = [...new Set((o.senses || []).flatMap((s) => s.examples || []))]
  if (exs.length) pool[o.w] = exs
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

// 2) 다의어(≥2 sense) + 예문 풀 ≥ MINEX
const targets = []
{
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, meanings_ko, frequency_rank, word_register')
      .not('classified_by', 'is', null).gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      if (EXC.has(r.word_register || 'standard')) continue
      const w = r.word.toLowerCase()
      const mk = Array.isArray(r.meanings_ko) ? r.meanings_ko : []
      if (mk.length < 2) continue
      const exs = pool[w]
      if (!exs || exs.length < MINEX) continue
      targets.push({
        word: w, rank: r.frequency_rank ?? 999999,
        senses: mk.map((s) => ({ pos: s.pos, meaning: s.meaning })),
        examples: exs.slice(0, 10),
      })
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
}
targets.sort((a, b) => a.rank - b.rank)
console.log(`대상(다의어 ≥2 sense · 예문 ≥${MINEX}): ${targets.length}`)

fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(OUT)) if (/^chunk-\d+\.json$/.test(f)) fs.rmSync(path.join(OUT, f))
let idx = 0
for (let i = 0; i < targets.length; i += CHUNK) {
  fs.writeFileSync(path.join(OUT, `chunk-${String(idx).padStart(2, '0')}.json`), JSON.stringify(targets.slice(i, i + CHUNK), null, 1))
  idx++
}
console.log(`chunks: ${idx} × ~${CHUNK} → ${OUT}`)
