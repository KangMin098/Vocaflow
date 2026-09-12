// scripts/dict/webster-comprehensive.mjs
// R1 근본 해법 — Webster 1913(PD) 전 표제어(102k)를 포괄 사전화.
// 각 표제어의 PD 정의문 → 첫 절 추출 → Google 번역(정의문 번역은 신뢰) → ko.
// 출력: scratchpad-foreign/webster-comp.jsonl {word, gloss_en, meaning_ko}  (resumable)
// 라이선스: Webster 1913 = Public Domain (정의문 번역 = 자체 파생 OK).
import fs from 'node:fs'
import https from 'node:https'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const get = (u, h = {}) => new Promise((res, rej) => { https.get(u, { headers: { 'User-Agent': 'vocaflow', ...h } }, r => { if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return get(r.headers.location, h).then(res, rej) } let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d })) }).on('error', rej) })

const webster = JSON.parse(fs.readFileSync('scratchpad-foreign/webster_full.json', 'utf8'))
function cleanDef(raw, depth = 0) {
  if (!raw || depth > 2) return null
  let s = raw.trim()
  const m = s.match(/^(?:Alt\. of|Alt\. spelling of|Same as|See|Var\. of|Variant of|imp\. (?:&|and) p\. p\. of|p\. p\. of|imp\. of)\s+([A-Za-z][A-Za-z' -]+?)[.,;\s]/i)
  if (m) { const t = m[1].trim().toLowerCase().replace(/[^a-z' -]/g, ''); if (t && webster[t] && t !== raw.toLowerCase()) return cleanDef(webster[t], depth + 1) }
  s = s.replace(/Etym:\s*\[[^\]]*\]/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/^\([^)]*\)\s*/g, ' ').replace(/\bDefn:\s*/g, ' ').replace(/^\s*\d+\.\s*/, '').replace(/^(?:[A-Z][a-z]?\.\s*){1,3}/, '').replace(/\s+/g, ' ').trim()
  let first = s.split(/(?<=[.;])\s/)[0] || s
  if (first.replace(/[^a-z]/gi, '').length < 4) first = s.slice(0, 120)
  first = first.replace(/[.;,\s]+$/, '').trim()
  if (!first || first.length < 3 || /^\(/.test(first)) return null
  if (/^(from|see|of|imp|p\. p|obs|pref|suff|a form|a variant|one of|plural of|marks an alternative|a particle)\b/i.test(first)) return null
  return first.length > 150 ? first.slice(0, 150).replace(/\s+\S*$/, '') : first
}
async function gtx(text) {
  const u = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=' + encodeURIComponent(text)
  for (let i = 0; i < 6; i++) { try { const r = await get(u); if (r.s === 200) { const j = JSON.parse(r.d); return (j[0] || []).map(x => x[0]).join('').trim() } if (r.s === 429) await sleep(3000 * (i + 1)) } catch { await sleep(1000 * (i + 1)) } }
  return null
}

const outPath = 'scratchpad-foreign/webster-comp.jsonl'
const done = new Set()
if (fs.existsSync(outPath)) for (const l of fs.readFileSync(outPath, 'utf8').split('\n')) { if (!l) continue; try { done.add(JSON.parse(l).word) } catch {} }
const ws = fs.createWriteStream(outPath, { flags: 'a' })

// 표제어: 소문자 단일어만 (구/대문자 제외), 정의 추출 성공한 것
const items = []
for (const [w, def] of Object.entries(webster)) {
  const lw = w.toLowerCase()
  if (!/^[a-z]{2,}$/.test(lw) || done.has(lw)) continue
  const g = cleanDef(def); if (g) items.push({ w: lw, g })
}
console.error('대상:', items.length, '(이미', done.size, ')')

const CONC = 8
let n = 0, ok = 0
for (let i = 0; i < items.length; i += CONC) {
  const batch = items.slice(i, i + CONC)
  const kos = await Promise.all(batch.map(it => gtx(it.g)))
  for (let k = 0; k < batch.length; k++) {
    const ko = kos[k]
    if (ko && ko.length >= 1 && ko !== batch[k].g) { ws.write(JSON.stringify({ word: batch[k].w, gloss_en: batch[k].g, meaning_ko: ko }) + '\n'); ok++ }
  }
  n += batch.length
  if (n % 2000 === 0) console.error(`  ${n}/${items.length} · ok ${ok}`)
  await sleep(60)
}
ws.end()
console.error('완료:', ok)
