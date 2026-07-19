// scripts/dict/coverage-residual-harvest.mjs
// 추출 누락 실단어 수확 — select_extraction_residual() → 청크(word+context+freq) 로 covres/.
//   도서·기사 토큰 중 core·coverage 어디에도 없는 실단어(고유명사·해소가능 제외). 문맥 first_sentence 동봉.
//   서브에이전트가 word+context → 한국어 뜻 생성(외국어·OCR·불명확 skip). apply 가 coverage_lexicon INSERT.
// 실행: node scripts/dict/coverage-residual-harvest.mjs --out scripts/dict/covres --chunk 730
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const OUT = arg('--out', 'scripts/dict/covres')
const CHUNK = parseInt(arg('--chunk', '730'), 10)

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

// PostgREST max-rows(기본 1000) 우회 — range 페이지네이션으로 전량 수확
const rows = []
const PAGE = 1000
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db.rpc('select_extraction_residual').range(from, from + PAGE - 1)
  if (error) { console.error(error.message); process.exit(1) }
  const page = data ?? []
  for (const r of page) if (r.word && r.context) {
    rows.push({ word: r.word, context: (r.context || '').replace(/\s+/g, ' ').trim().slice(0, 240), freq: r.freq ?? 0 })
  }
  if (page.length < PAGE) break
}
console.log(`residual 후보: ${rows.length}`)

fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(OUT)) if (/^chunk-\d+\.json$/.test(f)) fs.rmSync(path.join(OUT, f))
let idx = 0
for (let i = 0; i < rows.length; i += CHUNK) {
  fs.writeFileSync(path.join(OUT, `chunk-${String(idx).padStart(3, '0')}.json`), JSON.stringify(rows.slice(i, i + CHUNK), null, 0))
  idx++
}
console.log(`chunks: ${idx} × ~${CHUNK} → ${OUT}`)
