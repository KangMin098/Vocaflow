// scripts/dict/coverage-translate-chunk.mjs
// coverage_lexicon 한국어 번역 청크 — 전체 미번역(meaning_ko NULL)을 빈도순(외부 코퍼스)으로 정렬해 청크.
//   빈도 상위부터 = 어떤 콘텐츠에도 잘 나오는 단어 먼저 → 티어2→3 연속. 최소 context(word+gloss_en).
// 실행: node --max-old-space-size=4096 scripts/dict/coverage-translate-chunk.mjs --out scripts/dict/covtr --chunk 800 [--max-rank N]
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const OUT = arg('--out', 'scripts/dict/covtr')
const CHUNK = parseInt(arg('--chunk', '800'), 10)
const MAXRANK = process.argv.indexOf('--max-rank') >= 0 ? parseInt(arg('--max-rank', '0'), 10) : null // 랭크 상한(이하만)
const INCLUDE_UNRANKED = process.argv.includes('--include-unranked')

// 빈도 랭크 맵(en_full.txt = count desc 정렬 → 줄번호=랭크)
const rank = Object.create(null)
{ let r = 0
  for (const line of fs.readFileSync('data/freq-corpus/en_full.txt', 'utf8').split('\n')) {
    const sp = line.indexOf(' '); if (sp < 0) continue
    const w = line.slice(0, sp).toLowerCase(); r++
    if (!(w in rank)) rank[w] = r
  }
}
console.log('빈도 랭크 맵:', Object.keys(rank).length)

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })
const rows = []
{ let cur = ''
  for (;;) {
    const { data, error } = await db.from('coverage_lexicon').select('word, pos, gloss_en')
      .is('meaning_ko', null).eq('source', 'kaikki').gt('word', cur).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) if (r.gloss_en) rows.push({ word: r.word, pos: r.pos, gloss_en: r.gloss_en.slice(0, 220), fr: rank[r.word] ?? null })
    cur = data[data.length - 1].word
    if (data.length < 1000) break
  }
}
const ranked = rows.filter((r) => r.fr != null && (MAXRANK == null || r.fr <= MAXRANK)).sort((a, b) => a.fr - b.fr)
const unranked = rows.filter((r) => r.fr == null)
console.log(`미번역 총 ${rows.length} · 빈도있음 ${rows.filter(r => r.fr != null).length} · 미랭크 ${unranked.length}`)
let targets = ranked
if (INCLUDE_UNRANKED) targets = targets.concat(unranked)
console.log(`청크 대상: ${targets.length}${MAXRANK ? ` (rank<=${MAXRANK})` : ''}`)

fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(OUT)) if (/^chunk-\d+\.json$/.test(f)) fs.rmSync(path.join(OUT, f))
let idx = 0
for (let i = 0; i < targets.length; i += CHUNK) {
  fs.writeFileSync(path.join(OUT, `chunk-${String(idx).padStart(3, '0')}.json`), JSON.stringify(targets.slice(i, i + CHUNK).map(({ word, pos, gloss_en }) => ({ word, pos, gloss_en })), null, 0))
  idx++
}
console.log(`chunks: ${idx} × ~${CHUNK} → ${OUT}`)
