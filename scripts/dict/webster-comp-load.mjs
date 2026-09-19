// scripts/dict/webster-comp-load.mjs
// webster-comp.jsonl(포괄 Webster PD 사전) → lexicon_clean lang='en'.
// ko_source='webster-comprehensive' · gloss_source='webster'. ignore-duplicates (기존 사전 보호).
import fs from 'node:fs'
const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\r/g, '') }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function ins(b, n = 6) { for (let i = 0; i < n; i++) { try { const r = await fetch(URL + '/rest/v1/lexicon_clean', { method: 'POST', headers: H, body: JSON.stringify(b) }); if (r.ok || r.status === 409) return true } catch {} await sleep(500 * (i + 1)) } return false }

const seen = new Set(), recs = []
for (const l of fs.readFileSync('scratchpad-foreign/webster-comp.jsonl', 'utf8').split('\n')) {
  if (!l.trim()) continue; let o; try { o = JSON.parse(l) } catch { continue }
  const w = (o.word || '').toLowerCase().trim(); let ko = (o.meaning_ko || '').trim()
  if (!w || !ko || seen.has(w) || !/^[a-z]{2,}$/.test(w)) continue
  // 간결화: 첫 절, 길이 캡
  if (ko.length > 45) { const cut = ko.split(/[;\n]|--|,\s/)[0].trim(); if (cut.length >= 3) ko = cut }
  if (ko.length > 60) ko = ko.slice(0, 60).replace(/\s+\S*$/, '') + '…'
  if (/[a-zA-Z]{4,}/.test(ko) && !/[가-힣]/.test(ko)) continue   // 번역 실패(영어만) 제외
  seen.add(w)
  recs.push({ word: w, lang: 'en', meaning_ko: ko, gloss_source: 'webster', ko_source: 'webster-comprehensive', is_valid_word: true })
}
console.error('적재 대상:', recs.length)
for (let i = 0; i < recs.length; i += 500) { await ins(recs.slice(i, i + 500)); if (i % 10000 === 0) console.error('  ', i) }
console.error('완료')
