// scripts/dict/webster-build.mjs
// Method C — Webster's 1913 Unabridged (Public Domain) 로 잔여 실고어/희귀어 해소.
// 핵심: 희귀 "표면형"을 번역하면 Google 오역률 높음 → 대신 Webster PD "정의문"을 번역(정밀도↑).
// 1) residual_now(잔여) 로드  2) Webster compact JSON 교차  3) 정의문 첫 절 추출  4) Google MT → ko
// 실행:  node scripts/dict/webster-build.mjs           (매칭 수만 리포트)
//        TRANSLATE=1 node scripts/dict/webster-build.mjs  (번역 + webster.jsonl 생성)
import fs from 'node:fs'
import https from 'node:https'

const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC }
const sleep = ms => new Promise(r => setTimeout(r, ms))

function get(u, headers = {}) {
  return new Promise((res, rej) => {
    https.get(u, { headers: { 'User-Agent': 'vocaflow', ...headers } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return get(r.headers.location, headers).then(res, rej) }
      let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d }))
    }).on('error', rej)
  })
}

// ── Webster 정의문 → 간결한 영어 gloss 추출 ──
function cleanDef(raw, webster, depth = 0) {
  if (!raw || depth > 2) return null
  let s = raw.trim()
  // 명시적 리다이렉트만 따라감 (탐욕적 "of X" 는 astrachan→"or" 같은 오매핑 유발 → 제외)
  let m = s.match(/^(?:Alt\. of|Alt\. spelling of|Same as|See|Var\. of|Variant of|imp\. (?:&|and) p\. p\. of|p\. p\. of|imp\. of)\s+([A-Za-z][A-Za-z' -]+?)[.,;\s]/i)
  if (m) {
    const tgt = m[1].trim().toLowerCase().replace(/[^a-z' -]/g, '')
    if (tgt && webster[tgt] && tgt !== raw.toLowerCase()) return cleanDef(webster[tgt], webster, depth + 1)
  }
  // Etym / 괄호 메타 / 품사표기 / Defn: 제거
  s = s.replace(/Etym:\s*\[[^\]]*\]/g, ' ').replace(/\[[^\]]*\]/g, ' ')
  s = s.replace(/^\([^)]*\)\s*/g, ' ')
  s = s.replace(/\bDefn:\s*/g, ' ')
  s = s.replace(/^\s*\d+\.\s*/, ' ')                 // 앞 "1." 제거
  s = s.replace(/^(?:[A-Z][a-z]?\.\s*){1,3}/, '')     // 앞 품사 약어 (n. v. t. 등)
  s = s.replace(/\s+/g, ' ').trim()
  // 첫 절만 (첫 마침표/세미콜론까지, 너무 짧으면 다음 절까지)
  let first = s.split(/(?<=[.;])\s/)[0] || s
  if (first.replace(/[^a-z]/gi, '').length < 4) first = s.slice(0, 120)
  first = first.replace(/[.;,\s]+$/, '').trim()
  if (!first || first.length < 3) return null
  // 불량 gloss 거부 (메타/파편/순환참조)
  if (/^\(/.test(first)) return null
  if (/^(from|see|of|imp|p\. p|obs|pref|suff|a form|a variant|one of|plural of|marks an alternative|a particle)\b/i.test(first)) return null
  if (/^A particle that marks/i.test(first)) return null
  if (first.length > 160) first = first.slice(0, 160).replace(/\s+\S*$/, '')
  return first
}

// 잔여 후보에서 파생 base 후보 (Webster 교차 recall↑)
function bases(w) {
  const b = new Set([w])
  if (w.endsWith('s') && w.length > 3) b.add(w.slice(0, -1))
  if (w.endsWith('es') && w.length > 4) b.add(w.slice(0, -2))
  if (w.endsWith('ed') && w.length > 4) { b.add(w.slice(0, -2)); b.add(w.slice(0, -1)) }
  if (w.endsWith('ing') && w.length > 5) { b.add(w.slice(0, -3)); b.add(w.slice(0, -3) + 'e') }
  if (w.endsWith('eth') && w.length > 4) { b.add(w.slice(0, -3)); b.add(w.slice(0, -3) + 'e') }
  if (w.endsWith('est') && w.length > 4) b.add(w.slice(0, -3))
  return [...b]
}

async function loadResidual() {
  const out = []
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${URL}/rest/v1/residual_now?select=w,freq,books&order=freq.desc&limit=1000&offset=${off}`, { headers: H })
    const d = await r.json()
    if (!Array.isArray(d) || !d.length) break
    out.push(...d)
    if (d.length < 1000) break
  }
  return out
}

async function gtranslate(text) {
  const u = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=' + encodeURIComponent(text)
  for (let i = 0; i < 5; i++) {
    try {
      const r = await get(u)
      if (r.status === 200) {
        const j = JSON.parse(r.body)
        return (j[0] || []).map(x => x[0]).join('').trim()
      }
      if (r.status === 429) await sleep(2000 * (i + 1))
    } catch { await sleep(800 * (i + 1)) }
  }
  return null
}

// ── main ──
console.error('잔여 로드 중…')
const residual = await loadResidual()
console.error('잔여:', residual.length)

console.error('Webster 1913 다운로드 중…')
const wr = await get('https://raw.githubusercontent.com/matthewreagan/WebstersEnglishDictionary/master/dictionary_compact.json')
const webster = JSON.parse(wr.body)
console.error('Webster 표제어:', Object.keys(webster).length)

// 교차 매칭
const matched = []
for (const row of residual) {
  const w = row.w
  let hitKey = null
  for (const b of bases(w)) { if (webster[b]) { hitKey = b; break } }
  if (!hitKey) continue
  const gloss = cleanDef(webster[hitKey], webster)
  if (!gloss) continue
  matched.push({ word: w, freq: row.freq, books: row.books, key: hitKey, gloss })
}
const occ = matched.reduce((a, m) => a + m.freq, 0)
console.error(`\n=== Webster 교차 매칭: ${matched.length} lemma / ${occ} occ ===`)
console.error('상위 30 샘플:')
for (const m of matched.slice(0, 30)) console.error(`  ${m.word}(${m.freq}) ← [${m.key}] "${m.gloss}"`)

if (process.env.TRANSLATE !== '1') {
  console.error('\n(리포트 모드 — 번역하려면 TRANSLATE=1)')
  process.exit(0)
}

// 번역
console.error('\n정의문 번역 시작 (Google, 정의문→ko)…')
const outPath = 'scratchpad-foreign/webster.jsonl'
fs.mkdirSync('scratchpad-foreign', { recursive: true })
const done = new Set()
if (fs.existsSync(outPath)) for (const l of fs.readFileSync(outPath, 'utf8').split('\n')) { if (!l) continue; try { done.add(JSON.parse(l).word) } catch {} }
const ws = fs.createWriteStream(outPath, { flags: 'a' })
let n = 0
for (const m of matched) {
  if (done.has(m.word)) continue
  const ko = await gtranslate(m.gloss)
  if (ko && ko.length >= 1) {
    ws.write(JSON.stringify({ word: m.word, freq: m.freq, books: m.books, key: m.key, gloss_en: m.gloss, meaning_ko: ko }) + '\n')
  }
  if (++n % 50 === 0) console.error(`  ${n}/${matched.length} — ${m.word} → ${ko}`)
  await sleep(120)
}
ws.end()
console.error('완료:', n, '→', outPath)
