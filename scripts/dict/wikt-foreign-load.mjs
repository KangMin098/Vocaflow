// scripts/dict/wikt-foreign-load.mjs
// foreign/out-*.jsonl (Claude 문맥검증 진짜 외국어 + ko + lang) → lexicon_clean.
// ko_source='foreign-claude' · gloss_source='wiktionary-membership'. ignore-duplicates (영어 보호).
import fs from 'node:fs'
const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function ins(b, n = 6) { for (let i = 0; i < n; i++) { try { const r = await fetch(URL + '/rest/v1/lexicon_clean', { method: 'POST', headers: H, body: JSON.stringify(b) }); if (r.ok || r.status === 409) return true } catch {} await sleep(500 * (i + 1)) } return false }

const OUTDIR = process.env.OUTDIR || 'scratchpad-foreign/wikt/foreign'
const OK_LANG = new Set(['la', 'it', 'fr', 'es', 'de', 'nl', 'pt', 'ca', 'el', 'ru', 'da', 'sv', 'no', 'fi', 'ga', 'cy', 'gd', 'ro', 'gl', 'eu', 'af', 'cs', 'pl', 'hu', 'is', 'enm', 'ang', 'sco'])
const files = fs.readdirSync(OUTDIR).filter(f => /^out-\d+\.jsonl$/.test(f)).sort()
const seen = new Set(), recs = []
const langCount = {}
for (const f of files) {
  for (const l of fs.readFileSync(`${OUTDIR}/${f}`, 'utf8').split('\n')) {
    if (!l.trim()) continue; let o; try { o = JSON.parse(l) } catch { continue }
    const w = (o.word || o.w || '').toLowerCase().trim(), ko = (o.meaning_ko || '').trim()
    let lang = (o.lang || 'xx').toLowerCase().trim()
    if (!w || !ko || seen.has(w) || !/^[a-z][a-z'-]*$/.test(w)) continue
    if (!OK_LANG.has(lang)) lang = 'xx'   // 미지원 언어코드 → generic
    seen.add(w)
    langCount[lang] = (langCount[lang] || 0) + 1
    recs.push({ word: w, lang, meaning_ko: ko.slice(0, 80), gloss_source: 'wiktionary-membership', ko_source: 'foreign-claude', is_valid_word: true })
  }
}
console.error('적재 대상:', recs.length, '· 언어:', JSON.stringify(langCount))
for (let i = 0; i < recs.length; i += 300) await ins(recs.slice(i, i + 300))
console.error('완료')
