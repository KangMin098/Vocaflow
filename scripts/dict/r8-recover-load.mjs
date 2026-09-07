// scripts/dict/fresh-recover-load.mjs
// Stage ⑤ recovery 적재 — recover/out-*.jsonl:
//   type=norm  → spelling_norm(variant→standard, source='curated-dialect')
//   type=gloss → lexicon_clean(word, lang, meaning_ko, ko_source='claude-recover')
import fs from 'node:fs'
const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\r/g, '') }
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function ins(path, body, n = 6) { const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }; for (let i = 0; i < n; i++) { try { const r = await fetch(U + path, { method: 'POST', headers: H, body: JSON.stringify(body) }); if (r.ok || r.status === 409) return true } catch {} await sleep(500 * (i + 1)) } return false }

const OK_LANG = new Set(['la', 'it', 'fr', 'es', 'de', 'nl', 'pt', 'ca', 'el', 'ru', 'da', 'sv', 'no', 'fi', 'ga', 'cy', 'gd', 'ro', 'gl', 'eu', 'af', 'cs', 'pl', 'hu', 'is', 'enm', 'ang', 'sco', 'tr', 'id', 'ms', 'eo', 'en'])
const dir = 'scratchpad-foreign/r8/recover'
const files = fs.readdirSync(dir).filter(f => /^out-\d+\.jsonl$/.test(f))
const normSeen = new Set(), glossSeen = new Set(), norms = [], gloss = []
let conflictVar = new Map()
for (const f of files) for (const l of fs.readFileSync(`${dir}/${f}`, 'utf8').split('\n')) {
  if (!l.trim()) continue; let o; try { o = JSON.parse(l) } catch { continue }
  if (o.type === 'norm') {
    const v = (o.variant || '').toLowerCase().trim(), s = (o.standard || '').toLowerCase().trim()
    if (!v || !s || v === s || !/^[a-z][a-z'-]*$/.test(v) || !/^[a-z][a-z'’ -]+$/.test(s)) continue
    if (!conflictVar.has(v)) conflictVar.set(v, new Set()); conflictVar.get(v).add(s)
  } else if (o.type === 'gloss') {
    const w = (o.word || '').toLowerCase().trim(), ko = (o.meaning_ko || '').trim(); let lang = (o.lang || 'en').toLowerCase().trim()
    if (!w || !ko || glossSeen.has(w) || !/^[a-z][a-z'-]*$/.test(w)) continue
    if (!OK_LANG.has(lang)) lang = 'xx'
    glossSeen.add(w); gloss.push({ word: w, lang, meaning_ko: ko.slice(0, 80), gloss_source: 'claude-recover', ko_source: 'claude-recover', is_valid_word: true })
  }
}
for (const [v, set] of conflictVar) { if (set.size === 1 && !normSeen.has(v)) { normSeen.add(v); norms.push({ variant: v, standard: [...set][0], source: 'curated-dialect' }) } }
console.error(`norm ${norms.length} · gloss ${gloss.length}`)
for (let i = 0; i < norms.length; i += 300) await ins('/rest/v1/spelling_norm', norms.slice(i, i + 300))
for (let i = 0; i < gloss.length; i += 300) await ins('/rest/v1/lexicon_clean', gloss.slice(i, i + 300))
console.error('완료')
