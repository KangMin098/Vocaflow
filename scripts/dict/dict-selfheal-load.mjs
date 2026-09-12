// scripts/dict/dict-selfheal-load.mjs
// 3R-Ⓒ 게이트 통과 후보(selfheal-candidates.jsonl) → lexicon_clean 적재.
// 뜻: Wiktionary 정의(gloss_en) + Google 번역(meaning_ko). LLM 생성 0.
// ko_source='wikt-selfheal' · gloss_source='wiktionary' · ignore-duplicates(기존 사전 보호).
// 기본: 순수 전문·희귀어만. DIALECT=1 이면 방언·구어(register 태그)도 포함.
// 실행: node scripts/dict/dict-selfheal-load.mjs   (검수 후)
import fs from 'node:fs'
import { koQualityOk } from './dict-selfheal-core.mjs'
const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\r/g, '') }
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const INCLUDE_DIALECT = process.env.DIALECT === '1'

async function ins(b, n = 6) { for (let i = 0; i < n; i++) { try { const r = await fetch(SB + '/rest/v1/lexicon_clean', { method: 'POST', headers: H, body: JSON.stringify(b) }); if (r.ok || r.status === 409) return true; if (i === 0) console.error('  HTTP', r.status, (await r.text()).slice(0, 200)) } catch (e) { if (i === 0) console.error('  ERR', e.message) } await sleep(500 * (i + 1)) } return false }

const rows = fs.readFileSync('scratchpad-foreign/selfheal-candidates.jsonl', 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
const recs = []
const seen = new Set()
for (const r of rows) {
  if (r.dialect && !INCLUDE_DIALECT) continue
  const w = (r.w || '').toLowerCase().trim()
  const ko = (r.ko || '').trim()
  if (!w || !ko || seen.has(w) || !/^[a-z]{3,}$/.test(w)) continue
  if (!koQualityOk(ko)) continue // 번역 실패/미번역 라틴어 방어
  seen.add(w)
  recs.push({ word: w, lang: 'en', meaning_ko: ko, gloss_en: r.en, gloss_source: 'wiktionary', ko_source: 'wikt-selfheal', is_valid_word: true })
}
console.error(`적재 대상: ${recs.length} (방언 포함=${INCLUDE_DIALECT})`)
let ok = 0
for (let i = 0; i < recs.length; i += 200) { if (await ins(recs.slice(i, i + 200))) ok += recs.slice(i, i + 200).length }
console.error(`적재 완료: ${ok}/${recs.length}`)
console.error('예시:', recs.slice(0, 8).map(r => r.word + '→' + r.meaning_ko.slice(0, 20)).join(' · '))
