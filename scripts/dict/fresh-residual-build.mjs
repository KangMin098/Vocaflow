// scripts/dict/fresh-residual-build.mjs
// Stage ① 플랫폼 해소 판정 — 새 코퍼스(extraction_test_vocab) 전 lemma를 실 RPC(lookup_word_meaning)로
// 조회해 미해소(not_found/suggestion)만 잔여로 추출. 문맥 문장 포함.
// 출력: scratchpad-foreign/fresh/residual.jsonl  {w,freq,books,sent}
import fs from 'node:fs'
const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC }
const HJ = { ...H, 'Content-Type': 'application/json' }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const ABBR = new Set(['acct','dept','depts','yrs','wks','wk','cts','rms','mgr','mdse','recd','shipt','yd','yds','yr','hr','hrs','mos','pts','doz','rm'])

// 1) extraction_test_vocab 집계 (lemma → freq, books, best sentence)
console.error('코퍼스 집계 중…')
const agg = new Map()
const PAGE = 1000
for (let off = 0; ; off += PAGE) {
  let d = null
  for (let t = 0; t < 6; t++) {   // 비배열/에러 응답은 재시도 (조용한 break 금지)
    try { const r = await fetch(`${URL}/rest/v1/extraction_test_vocab?select=lemma,freq,book_gid,first_sentence&order=lemma.asc,book_gid.asc&limit=${PAGE}&offset=${off}`, { headers: H }); const j = await r.json(); if (Array.isArray(j)) { d = j; break } } catch {}
    await sleep(500 * (t + 1))
  }
  if (d === null) { console.error('  ! 페이지 실패 off=' + off + ' 재시도 소진 — 중단'); break }
  if (!d.length) break
  for (const row of d) {
    const w = row.lemma; if (ABBR.has(w)) continue
    let e = agg.get(w); if (!e) { e = { w, freq: 0, books: new Set(), sent: '', sf: 0 }; agg.set(w, e) }
    e.freq += row.freq; e.books.add(row.book_gid)
    if (row.freq > e.sf) { e.sf = row.freq; e.sent = (row.first_sentence || '').slice(0, 200) }
  }
  if (off % 40000 === 0) console.error('  ', off, 'rows · distinct', agg.size)
}
const lemmas = [...agg.values()]
console.error('distinct lemmas:', lemmas.length)

// 2) 실 RPC 로 해소 판정 (동시성 제한)
async function resolved(w) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`${URL}/rest/v1/rpc/lookup_word_meaning`, { method: 'POST', headers: HJ, body: JSON.stringify({ p_surface: w }) })
      if (r.ok) { const j = await r.json(); const row = Array.isArray(j) ? j[0] : j; return row ? row.match_via : 'not_found' }
    } catch {}
    await sleep(300 * (i + 1))
  }
  return 'ERR'
}

fs.mkdirSync('scratchpad-foreign/fresh', { recursive: true })
const ws = fs.createWriteStream('scratchpad-foreign/fresh/residual.jsonl', { flags: 'w' })
let done = 0, resid = 0
const CONC = 20
for (let i = 0; i < lemmas.length; i += CONC) {
  const batch = lemmas.slice(i, i + CONC)
  const vias = await Promise.all(batch.map(e => resolved(e.w)))
  for (let k = 0; k < batch.length; k++) {
    const via = vias[k]
    if (via === 'not_found' || via === 'suggestion' || via === 'ERR') {
      const e = batch[k]
      ws.write(JSON.stringify({ w: e.w, freq: e.freq, books: e.books.size, sent: e.sent, via }) + '\n'); resid++
    }
  }
  done += batch.length
  if (done % 4000 === 0) console.error(`  ${done}/${lemmas.length} · 잔여 ${resid}`)
}
ws.end()
console.error('완료 · 잔여:', resid)
