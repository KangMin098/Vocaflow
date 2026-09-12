// scripts/dict/ctx-export.mjs
// _cur2(앵커없음 다중책+고빈도 hapax 잔여 + first_sentence 문맥) → N청크.
// Claude 서브에이전트가 앵커 힌트 없이(오픈형) 문맥 보고 표준어 정규화.
// 실행: node scripts/dict/ctx-export.mjs
import fs from 'node:fs'
const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC }
const OUTDIR = 'scratchpad-foreign/ctx'
const out = []
for (let off = 0; ; off += 1000) {
  const r = await fetch(`${URL}/rest/v1/_cur2?select=w,freq,books,sent&order=freq.desc&limit=1000&offset=${off}`, { headers: H })
  const d = await r.json()
  if (!Array.isArray(d) || !d.length) break
  out.push(...d); if (d.length < 1000) break
}
console.error('후보:', out.length)
const N = 6
fs.mkdirSync(OUTDIR, { recursive: true })
for (let i = 0; i < N; i++) {
  const chunk = out.filter((_, idx) => idx % N === i)
  fs.writeFileSync(`${OUTDIR}/chunk-${i}.jsonl`, chunk.map(x => JSON.stringify(x)).join('\n') + '\n')
  console.error(`chunk-${i}: ${chunk.length}`)
}
console.error('완료')
