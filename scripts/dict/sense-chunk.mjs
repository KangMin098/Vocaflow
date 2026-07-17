// scripts/dict/sense-chunk.mjs
// 다의어 sense 완성 — 단일-sense content 단어를 빈도순으로 청크 파일 분할.
//   서브에이전트가 청크를 읽어 누락 POS sense authoring → .out.json 반환 → apply 스크립트가 일괄 적용.
// 실행: node scripts/dict/sense-chunk.mjs --min-rank 1700 --max-rank 6000 --chunk 160
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MIN_RANK = parseInt(arg('--min-rank', '0'), 10)
const MAX_RANK = parseInt(arg('--max-rank', '6000'), 10)
const V_LEVEL = process.argv.indexOf('--v-level') >= 0 ? parseInt(arg('--v-level', '0'), 10) : null // 지정 시 빈도 무관 해당 V-Level 전수(NULL rank 포함)
const CHUNK = parseInt(arg('--chunk', '160'), 10)
const OUT = arg('--out', 'scripts/dict/sense-chunks')
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

const rows = []
if (V_LEVEL !== null) {
  // V-Level 모드: 빈도 무관 전수(NULL rank 포함), word(PK) keyset pagination
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, pos, meaning_ko, meanings_ko, v_level, cefr_level, frequency_rank')
      .eq('v_level', V_LEVEL).not('classified_by', 'is', null).in('pos', ['noun', 'verb', 'adjective'])
      .gt('word', cursor).order('word', { ascending: true }).limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    rows.push(...data); cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
} else {
  let cursor = MIN_RANK
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, pos, meaning_ko, meanings_ko, v_level, cefr_level, frequency_rank')
      .not('frequency_rank', 'is', null).gt('frequency_rank', cursor).lte('frequency_rank', MAX_RANK)
      .in('pos', ['noun', 'verb', 'adjective'])
      .order('frequency_rank', { ascending: true }).limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    rows.push(...data); cursor = data[data.length - 1].frequency_rank
    if (data.length < 1000) break
  }
}
// client-side: 단일-sense, content pos, 알파벳, -ing 제외
const targets = rows.filter((r) =>
  ['noun', 'verb', 'adjective'].includes(r.pos) &&
  Array.isArray(r.meanings_ko) && r.meanings_ko.length === 1 &&
  /^[a-z]+$/.test(r.word) && !/ing$/.test(r.word))
  .sort((a, b) => (a.frequency_rank ?? 1e9) - (b.frequency_rank ?? 1e9))
  .map((r) => ({ word: r.word, pos: r.pos, meaning_ko: r.meaning_ko, v_level: r.v_level, cefr_level: r.cefr_level, rank: r.frequency_rank }))

fs.mkdirSync(OUT, { recursive: true })
// 기존 청크 정리
for (const f of fs.readdirSync(OUT)) if (/^chunk-\d+\.json$/.test(f)) fs.rmSync(path.join(OUT, f))
let idx = 0
for (let i = 0; i < targets.length; i += CHUNK) {
  const chunk = targets.slice(i, i + CHUNK)
  fs.writeFileSync(path.join(OUT, `chunk-${String(idx).padStart(2, '0')}.json`), JSON.stringify(chunk, null, 1))
  idx++
}
console.log(`targets: ${targets.length} single-sense content words (rank ${MIN_RANK}-${MAX_RANK})`)
console.log(`chunks: ${idx} × ~${CHUNK} → ${OUT}/chunk-NN.json`)
