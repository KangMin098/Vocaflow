// scripts/dict/anchor-load.mjs
// out-*.jsonl (Claude 확정 방언/오철자 variant→standard) 집계 → spelling_norm source='curated-dialect'.
// 안전: variant≠standard, 소문자 알파벳, 충돌 variant(서로 다른 standard 2개↑) 제거. ignore-duplicates.
import fs from 'node:fs'
const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function ins(b, n = 6) { for (let i = 0; i < n; i++) { try { const r = await fetch(URL + '/rest/v1/spelling_norm', { method: 'POST', headers: H, body: JSON.stringify(b) }); if (r.ok || r.status === 409) return true } catch {} await sleep(500 * (i + 1)) } return false }

const byVar = new Map()   // variant → Set(standard)
for (let i = 0; i < 8; i++) {
  const p = `scratchpad-foreign/anchor/out-${i}.jsonl`
  if (!fs.existsSync(p)) { console.error('MISSING', p); continue }
  for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    if (!l.trim()) continue; let o; try { o = JSON.parse(l) } catch { continue }
    const v = (o.variant || '').toLowerCase().trim(), s = (o.standard || '').toLowerCase().trim()
    if (!v || !s || v === s) continue
    if (!/^[a-z][a-z'-]*$/.test(v) || !/^[a-z][a-z'-]* ?[a-z'-]*$/.test(s)) continue
    if (s.length < 2) continue
    if (!byVar.has(v)) byVar.set(v, new Set())
    byVar.get(v).add(s)
  }
}
const recs = []
let conflict = 0
for (const [v, set] of byVar) {
  if (set.size > 1) { conflict++; continue }         // 서로 다른 standard 충돌 → 안전상 제거
  recs.push({ variant: v, standard: [...set][0], source: 'curated-dialect' })
}
console.error(`집계 variant: ${byVar.size} · 충돌제거: ${conflict} · 적재대상: ${recs.length}`)
for (let i = 0; i < recs.length; i += 300) await ins(recs.slice(i, i + 300))
console.error('완료')
