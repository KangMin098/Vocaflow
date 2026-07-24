// scripts/dict/wikt-en-load.mjs
// wikt/en/out-*.jsonl (Claude가 실영어 표제어에 생성한 ko) → lexicon_clean lang='en'.
// ko_source='wikt-claude' · gloss_source='wiktionary-membership'. ignore-duplicates.
// Wiktionary 는 멤버십(사실)만 사용 — 뜻은 Claude 자체 생성(정의문 미배포).
import fs from 'node:fs'
const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function ins(b, n = 6) { for (let i = 0; i < n; i++) { try { const r = await fetch(URL + '/rest/v1/lexicon_clean', { method: 'POST', headers: H, body: JSON.stringify(b) }); if (r.ok || r.status === 409) return true } catch {} await sleep(500 * (i + 1)) } return false }

const seen = new Set(), recs = []
for (let i = 0; i < 8; i++) {
  const p = `scratchpad-foreign/wikt/en/out-${i}.jsonl`
  if (!fs.existsSync(p)) continue
  for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    if (!l.trim()) continue; let o; try { o = JSON.parse(l) } catch { continue }
    const w = (o.word || o.w || '').toLowerCase().trim(), ko = (o.meaning_ko || '').trim()
    if (!w || !ko || ko.length < 1 || seen.has(w)) continue
    if (!/^[a-z][a-z'-]*$/.test(w)) continue
    seen.add(w)
    recs.push({ word: w, lang: 'en', meaning_ko: ko.slice(0, 80), gloss_source: 'wiktionary-membership', ko_source: 'wikt-claude', is_valid_word: true })
  }
}
console.error('적재 대상:', recs.length)
for (let i = 0; i < recs.length; i += 300) await ins(recs.slice(i, i + 300))
console.error('완료')
