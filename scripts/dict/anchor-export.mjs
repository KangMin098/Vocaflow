// scripts/dict/anchor-export.mjs
// _anchor(잔여 lev1 방언/오철자 후보 + dmetaphone 앵커) → N개 청크 JSONL 로 분할.
// Claude 서브에이전트가 각 청크를 읽고 variant→standard 확정 매핑 생성.
// 실행: node scripts/dict/anchor-export.mjs
import fs from 'node:fs'
const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC }

const TABLE = process.env.TABLE || '_anchor'
const OUTDIR = process.env.OUTDIR || 'scratchpad-foreign/anchor'
const out = []
for (let off = 0; ; off += 1000) {
  const r = await fetch(`${URL}/rest/v1/${TABLE}?select=w,freq,books,anchor,meaning_ko,lev&order=freq.desc&limit=1000&offset=${off}`, { headers: H })
  const d = await r.json()
  if (!Array.isArray(d) || !d.length) break
  out.push(...d); if (d.length < 1000) break
}
console.error('앵커 후보:', out.length)

const N = 8
fs.mkdirSync(OUTDIR, { recursive: true })
for (let i = 0; i < N; i++) {
  const chunk = out.filter((_, idx) => idx % N === i)
  fs.writeFileSync(`${OUTDIR}/chunk-${i}.jsonl`, chunk.map(x => JSON.stringify(x)).join('\n') + '\n')
  console.error(`chunk-${i}: ${chunk.length}`)
}
console.error('완료')
