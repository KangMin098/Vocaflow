// scripts/dict/sense-vlevel-chunk.mjs
// Phase B — 다의어(meanings_ko ≥2 sense) 중 일부 sense의 v_level 결측분을 청크로 분할.
//   서브에이전트가 청크를 읽어 각 sense 의 실제 난이도 v_level(1-11)을 부여 → .out.json 반환 →
//   sense-vlevel-apply.mjs 가 결측 v_level 만 주입(pos/meaning 불변·멱등).
// 대상 우선순위: multi-POS(형태별 sense 분기) → 빈도순. --all-pos 로 단일-POS 다의어까지 확장.
// 실행: node scripts/dict/sense-vlevel-chunk.mjs --out scripts/dict/svl-p1 --chunk 160
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const CHUNK = parseInt(arg('--chunk', '160'), 10)
const OUT = arg('--out', 'scripts/dict/svl-chunks')
const ALL_POS = process.argv.includes('--all-pos') // 기본=multi-POS 우선. 지정 시 단일-POS 다의어도 포함
const MAX_RANK = process.argv.indexOf('--max-rank') >= 0 ? parseInt(arg('--max-rank', '0'), 10) : null
const LIMIT = process.argv.indexOf('--limit') >= 0 ? parseInt(arg('--limit', '0'), 10) : null

// 명세(SENSE_COMPLETION_MULTISESSION.md §Phase B)의 register 제외
const EXCLUDE_REGISTER = new Set(['archaic_literary', 'period_cultural', 'phrase_unit', 'brand', 'abbreviation', 'proper_noun'])

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

// 분류 완료 + v_level 있는 행 전수 keyset pagination(word PK). 다의어·결측은 client-side 판정.
const rows = []
let cursor = ''
for (;;) {
  const { data, error } = await db.from('shared_dictionary')
    .select('word, v_level, cefr_level, frequency_rank, meanings_ko, word_register')
    .not('classified_by', 'is', null).not('v_level', 'is', null)
    .gt('word', cursor).order('word', { ascending: true }).limit(1000)
  if (error) { console.error(error.message); process.exit(1) }
  if (!data.length) break
  rows.push(...data); cursor = data[data.length - 1].word
  if (data.length < 1000) break
}

const targets = []
for (const r of rows) {
  if (EXCLUDE_REGISTER.has(r.word_register ?? 'standard')) continue
  const mk = r.meanings_ko
  if (!Array.isArray(mk) || mk.length < 2) continue
  const missing = mk.some((s) => s == null || s.v_level == null || !Number.isInteger(s.v_level))
  if (!missing) continue
  const posSet = new Set(mk.map((s) => s && s.pos).filter(Boolean))
  if (!ALL_POS && posSet.size < 2) continue // 기본=multi-POS 우선
  if (MAX_RANK != null && !(r.frequency_rank != null && r.frequency_rank <= MAX_RANK)) continue
  targets.push({
    word: r.word,
    flat_v: r.v_level,
    cefr: r.cefr_level ?? null,
    rank: r.frequency_rank ?? null,
    n_pos: posSet.size,
    senses: mk.map((s, i) => ({
      i,
      pos: s && s.pos != null ? s.pos : null,
      meaning: s && s.meaning != null ? s.meaning : '',
      v_level: s && Number.isInteger(s.v_level) ? s.v_level : null,
    })),
  })
}
// 실사용 우선: freq_rank 오름차순(NULL 뒤), multi-POS 먼저
targets.sort((a, b) =>
  (b.n_pos - a.n_pos) || ((a.rank ?? 1e9) - (b.rank ?? 1e9)) || a.word.localeCompare(b.word))

const sliced = LIMIT != null ? targets.slice(0, LIMIT) : targets

fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(OUT)) if (/^chunk-\d+\.json$/.test(f)) fs.rmSync(path.join(OUT, f))
let idx = 0
for (let i = 0; i < sliced.length; i += CHUNK) {
  const chunk = sliced.slice(i, i + CHUNK)
  fs.writeFileSync(path.join(OUT, `chunk-${String(idx).padStart(2, '0')}.json`), JSON.stringify(chunk, null, 1))
  idx++
}
console.log(`targets: ${sliced.length} multi-sense words missing per-sense v_level (${ALL_POS ? 'all-POS' : 'multi-POS only'}${MAX_RANK != null ? `, rank<=${MAX_RANK}` : ''}${LIMIT != null ? `, limit ${LIMIT}` : ''})`)
console.log(`chunks: ${idx} × ~${CHUNK} → ${OUT}/chunk-NN.json`)
if (!sliced.length) console.log('DONE for this slice (targets: 0)')
