// scripts/dict/fresh-dump-resid.mjs — _fresh_r(잔여) → residual.jsonl
import fs from 'node:fs'
const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\r/g, '') }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const ws = fs.createWriteStream('scratchpad-foreign/fresh/residual.jsonl')
let tot = 0
for (let off = 0; ; off += 1000) {
  let d = null
  for (let t = 0; t < 8; t++) { try { const r = await fetch(`${URL}/rest/v1/_fresh_r?select=w,freq,books,sent&order=w.asc&limit=1000&offset=${off}`, { headers: H }); const j = await r.json(); if (Array.isArray(j)) { d = j; break } } catch {} await sleep(600 * (t + 1)) }
  if (d === null) { console.error('FAIL off', off); break }
  if (!d.length) break
  for (const o of d) ws.write(JSON.stringify(o) + '\n')
  tot += d.length
  if (d.length < 1000) break
}
ws.end()
console.error('dumped', tot)
