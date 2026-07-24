// scripts/dict/wikt-classify.mjs
// 잔여(_cur3) 전량을 Wiktionary(en.wiktionary.org)로 분류 — 50-title 배치 API.
// 각 단어: English 표제어(en) / 외국어(foreign+lang) / 부재(absent).
// 출력: scratchpad-foreign/wikt/classified.jsonl  {w, freq, books, cls, lang, sent}
// 라이선스: 멤버십·언어태그(사실)만 사용. 정의문 미사용.
// 실행: node scripts/dict/wikt-classify.mjs
import fs from 'node:fs'
import https from 'node:https'
const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const get = u => new Promise((res, rej) => { https.get(u, { headers: { 'User-Agent': 'vocaflow-research (dict coverage)' } }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d })) }).on('error', rej) })

// 잔여 로드
const rows = []
for (let off = 0; ; off += 1000) {
  const r = await fetch(`${URL}/rest/v1/_cur3?select=w,freq,books,sent&order=freq.desc&limit=1000&offset=${off}`, { headers: H })
  const d = await r.json(); if (!Array.isArray(d) || !d.length) break
  rows.push(...d); if (d.length < 1000) break
}
console.error('잔여 로드:', rows.length)

const outPath = 'scratchpad-foreign/wikt/classified.jsonl'
fs.mkdirSync('scratchpad-foreign/wikt', { recursive: true })
const done = new Set()
if (fs.existsSync(outPath)) for (const l of fs.readFileSync(outPath, 'utf8').split('\n')) { if (!l) continue; try { done.add(JSON.parse(l).w) } catch {} }
const ws = fs.createWriteStream(outPath, { flags: 'a' })
const byKey = new Map(rows.map(r => [r.w.toLowerCase(), r]))

// title 정규화: Wiktionary 표제어는 대소문자 구분. 소문자로 조회(대부분 소문자 표제어).
async function classifyBatch(batch) {
  const titles = batch.map(r => r.w).join('|')
  for (let i = 0; i < 4; i++) {
    try {
      const r = await get('https://en.wiktionary.org/w/api.php?action=query&format=json&formatversion=2&prop=revisions&rvprop=content&rvslots=main&titles=' + encodeURIComponent(titles))
      if (r.s !== 200) { await sleep(1000 * (i + 1)); continue }
      const j = JSON.parse(r.d)
      const norm = new Map()  // normalized title → original query
      for (const n of (j.query?.normalized || [])) norm.set(n.to, n.from)
      const out = []
      for (const p of (j.query?.pages || [])) {
        const orig = (norm.get(p.title) || p.title).toLowerCase()
        const row = byKey.get(orig) || byKey.get(p.title.toLowerCase())
        if (!row) continue
        if (p.missing) { out.push({ ...row, cls: 'absent', lang: null }); continue }
        const txt = (p.revisions && p.revisions[0]?.slots?.main?.content) || ''
        const langs = [...txt.matchAll(/^==\s*([A-Z][A-Za-z ]+?)\s*==\s*$/gm)].map(m => m[1])
        if (langs.includes('English')) out.push({ ...row, cls: 'en', lang: 'English' })
        else out.push({ ...row, cls: 'foreign', lang: langs[0] || '?' })
      }
      return out
    } catch (e) { await sleep(1000 * (i + 1)) }
  }
  return batch.map(r => ({ ...r, cls: 'error', lang: null }))
}

const todo = rows.filter(r => !done.has(r.w))
console.error('분류 대상:', todo.length)
let n = 0, cnt = { en: 0, foreign: 0, absent: 0, error: 0 }
for (let i = 0; i < todo.length; i += 40) {
  const res = await classifyBatch(todo.slice(i, i + 40))
  for (const o of res) { ws.write(JSON.stringify(o) + '\n'); cnt[o.cls]++ }
  n += res.length
  if (n % 400 === 0) console.error(`  ${n}/${todo.length}  en=${cnt.en} foreign=${cnt.foreign} absent=${cnt.absent} err=${cnt.error}`)
  await sleep(200)
}
ws.end()
console.error('완료:', cnt)
