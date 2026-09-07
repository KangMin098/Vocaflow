// scripts/dict/fresh-google.mjs
// Stage ③ Google(무료) — classified.jsonl 잔여에 draft 한국어 생성.
//   en    : Webster1913(PD) 정의문 → Google 번역(정의문은 신뢰도 높음). 없으면 draft 없음(→Claude 생성).
//   foreign: wiktLang → Google 소스언어코드 → Google 직역(올바른 언어라 신뢰).
//   absent : Google 무용(실단어 아님) → skip.
// 출력: scratchpad-foreign/fresh/google-draft.jsonl  {w,cls,lang,gcode,webster_gloss,google_ko}
import fs from 'node:fs'
import https from 'node:https'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const get = (u, h = {}) => new Promise((res, rej) => { https.get(u, { headers: { 'User-Agent': 'vocaflow', ...h } }, r => { if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return get(r.headers.location, h).then(res, rej) } let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d })) }).on('error', rej) })

// Wiktionary 언어명 → Google 소스코드
const LANG2G = { Latin: 'la', Italian: 'it', French: 'fr', Spanish: 'es', German: 'de', Dutch: 'nl', Portuguese: 'pt', Catalan: 'ca', Greek: 'el', 'Ancient Greek': 'el', Russian: 'ru', Danish: 'da', Swedish: 'sv', Norwegian: 'no', 'Norwegian Bokmål': 'no', Finnish: 'fi', Irish: 'ga', Welsh: 'cy', Romanian: 'ro', Galician: 'gl', Basque: 'eu', Afrikaans: 'af', Czech: 'cs', Polish: 'pl', Hungarian: 'hu', Icelandic: 'is', Turkish: 'tr', Indonesian: 'id', Malay: 'ms', Esperanto: 'eo', Slovak: 'sk', Slovene: 'sl', Croatian: 'hr', Lithuanian: 'lt', Latvian: 'lv', Estonian: 'et', Maltese: 'mt', Maori: 'mi', Samoan: 'sm', Hawaiian: 'haw', Swahili: 'sw', Yiddish: 'yi', Albanian: 'sq' }

function cleanDef(raw, webster, depth = 0) {
  if (!raw || depth > 2) return null
  let s = raw.trim()
  const m = s.match(/^(?:Alt\. of|Alt\. spelling of|Same as|See|Var\. of|Variant of|imp\. (?:&|and) p\. p\. of|p\. p\. of|imp\. of)\s+([A-Za-z][A-Za-z' -]+?)[.,;\s]/i)
  if (m) { const t = m[1].trim().toLowerCase().replace(/[^a-z' -]/g, ''); if (t && webster[t] && t !== raw.toLowerCase()) return cleanDef(webster[t], webster, depth + 1) }
  s = s.replace(/Etym:\s*\[[^\]]*\]/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/^\([^)]*\)\s*/g, ' ').replace(/\bDefn:\s*/g, ' ').replace(/^\s*\d+\.\s*/, '').replace(/^(?:[A-Z][a-z]?\.\s*){1,3}/, '').replace(/\s+/g, ' ').trim()
  let first = s.split(/(?<=[.;])\s/)[0] || s
  if (first.replace(/[^a-z]/gi, '').length < 4) first = s.slice(0, 120)
  first = first.replace(/[.;,\s]+$/, '').trim()
  if (!first || first.length < 3 || /^\(/.test(first)) return null
  if (/^(from|see|of|imp|p\. p|obs|pref|suff|a form|a variant|one of|plural of)\b/i.test(first)) return null
  return first.length > 160 ? first.slice(0, 160).replace(/\s+\S*$/, '') : first
}
function bases(w) { const b = new Set([w]); if (w.endsWith('s') && w.length > 3) b.add(w.slice(0, -1)); if (w.endsWith('es') && w.length > 4) b.add(w.slice(0, -2)); if (w.endsWith('ed') && w.length > 4) { b.add(w.slice(0, -2)); b.add(w.slice(0, -1)) } if (w.endsWith('ing') && w.length > 5) { b.add(w.slice(0, -3)); b.add(w.slice(0, -3) + 'e') } return [...b] }
async function gtx(text, sl) {
  const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=ko&dt=t&q=` + encodeURIComponent(text)
  for (let i = 0; i < 5; i++) { try { const r = await get(u); if (r.s === 200) { const j = JSON.parse(r.d); return (j[0] || []).map(x => x[0]).join('').trim() } if (r.s === 429) await sleep(2000 * (i + 1)) } catch { await sleep(800 * (i + 1)) } }
  return null
}

const rows = []
for (const l of fs.readFileSync('scratchpad-foreign/fresh/classified.jsonl', 'utf8').split('\n')) { if (!l) continue; try { rows.push(JSON.parse(l)) } catch {} }
console.error('classified:', rows.length)
console.error('Webster 다운로드…')
const webster = JSON.parse((await get('https://raw.githubusercontent.com/matthewreagan/WebstersEnglishDictionary/master/dictionary_compact.json')).d)

const outPath = 'scratchpad-foreign/fresh/google-draft.jsonl'
const done = new Set(); if (fs.existsSync(outPath)) for (const l of fs.readFileSync(outPath, 'utf8').split('\n')) { if (!l) continue; try { done.add(JSON.parse(l).w) } catch {} }
const ws = fs.createWriteStream(outPath, { flags: 'a' })
let n = 0, gen = 0
for (const r of rows) {
  if (done.has(r.w)) continue
  let rec = null
  if (r.cls === 'en') {
    let key = bases(r.w).find(b => webster[b]); const gloss = key ? cleanDef(webster[key], webster) : null
    if (gloss) { const ko = await gtx(gloss, 'en'); if (ko) rec = { w: r.w, cls: 'en', lang: 'en', gcode: 'en', webster_gloss: gloss, google_ko: ko } }
  } else if (r.cls === 'foreign') {
    const g = LANG2G[r.lang]; if (g) { const ko = await gtx(r.w, g); if (ko && ko.toLowerCase() !== r.w.toLowerCase()) rec = { w: r.w, cls: 'foreign', lang: r.lang, gcode: g, webster_gloss: null, google_ko: ko } }
  }
  if (rec) { ws.write(JSON.stringify(rec) + '\n'); gen++ }
  if (++n % 200 === 0) { console.error(`  ${n}/${rows.length} · draft ${gen}`); }
  await sleep(80)
}
ws.end()
console.error('완료 · draft:', gen)
