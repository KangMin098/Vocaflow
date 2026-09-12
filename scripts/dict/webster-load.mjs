// scripts/dict/webster-load.mjs
// webster.jsonl(잔여∩Webster1913 PD, 정의문 번역) → lexicon_clean lang='en'.
// ko_source='webster-mt' · gloss_source='webster'. ignore-duplicates 로 기존 영어 사전 보호.
import fs from 'node:fs'
const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function ins(b, n = 6) { for (let i = 0; i < n; i++) { try { const r = await fetch(URL + '/rest/v1/lexicon_clean', { method: 'POST', headers: H, body: JSON.stringify(b) }); if (r.ok || r.status === 409) return true } catch {} await sleep(500 * (i + 1)) } return false }

const recs = []
for (const l of fs.readFileSync('scratchpad-foreign/webster.jsonl', 'utf8').split('\n')) {
  if (!l) continue; let o; try { o = JSON.parse(l) } catch { continue }
  let ko = (o.meaning_ko || '').trim()
  if (!ko || ko.length < 2) continue
  // 지나치게 장황한 정의문 뜻은 첫 절만 (간결화)
  if (ko.length > 40) { const cut = ko.split(/[;\n]|--/)[0].trim(); if (cut.length >= 4) ko = cut }
  if (ko.length > 60) ko = ko.slice(0, 60).replace(/\s+\S*$/, '') + '…'
  recs.push({ word: o.word, lang: 'en', meaning_ko: ko, gloss_source: 'webster', ko_source: 'webster-mt', is_valid_word: true })
}
console.error('Webster 적재 대상:', recs.length)
for (let i = 0; i < recs.length; i += 300) await ins(recs.slice(i, i + 300))
console.error('완료')
