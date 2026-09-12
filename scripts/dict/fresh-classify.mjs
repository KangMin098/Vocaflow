// scripts/dict/fresh-classify.mjs
// Stage ② 외부소스 — 잔여를 Wiktionary(en.wiktionary) 로 en/foreign/absent 분류. (50-title 배치)
// 입력: scratchpad-foreign/fresh/residual.jsonl → 출력: scratchpad-foreign/fresh/classified.jsonl {w,freq,books,sent,cls,lang}
import fs from 'node:fs'
import https from 'node:https'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const get = u => new Promise((res, rej) => { https.get(u, { headers: { 'User-Agent': 'vocaflow-research (dict)' } }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d })) }).on('error', rej) })

const rows = []
for (const l of fs.readFileSync('scratchpad-foreign/fresh/residual.jsonl', 'utf8').split('\n')) { if (!l) continue; try { rows.push(JSON.parse(l)) } catch {} }
console.error('잔여:', rows.length)
const byKey = new Map(rows.map(r => [r.w.toLowerCase(), r]))
const outPath = 'scratchpad-foreign/fresh/classified.jsonl'
const done = new Set()
if (fs.existsSync(outPath)) for (const l of fs.readFileSync(outPath, 'utf8').split('\n')) { if (!l) continue; try { done.add(JSON.parse(l).w) } catch {} }
const ws = fs.createWriteStream(outPath, { flags: 'a' })

async function classifyBatch(batch) {
  const titles = batch.map(r => r.w).join('|')
  for (let i = 0; i < 5; i++) {
    try {
      const r = await get('https://en.wiktionary.org/w/api.php?action=query&format=json&formatversion=2&prop=revisions&rvprop=content&rvslots=main&titles=' + encodeURIComponent(titles))
      if (r.s !== 200) { await sleep(1200 * (i + 1)); continue }
      const j = JSON.parse(r.d)
      const norm = new Map(); for (const n of (j.query?.normalized || [])) norm.set(n.to, n.from)
      const out = []
      for (const p of (j.query?.pages || [])) {
        const orig = (norm.get(p.title) || p.title).toLowerCase()
        const row = byKey.get(orig) || byKey.get(p.title.toLowerCase()); if (!row) continue
        if (p.missing) { out.push({ ...row, cls: 'absent', lang: null }); continue }
        const txt = (p.revisions && p.revisions[0]?.slots?.main?.content) || ''
        const langs = [...txt.matchAll(/^==\s*([A-Z][A-Za-z ]+?)\s*==\s*$/gm)].map(m => m[1])
        out.push(langs.includes('English') ? { ...row, cls: 'en', lang: 'English' } : { ...row, cls: 'foreign', lang: langs[0] || '?' })
      }
      return out
    } catch { await sleep(1200 * (i + 1)) }
  }
  return batch.map(r => ({ ...r, cls: 'error', lang: null }))
}

const pending = rows.filter(r => !done.has(r.w))
let n = 0, cnt = { en: 0, foreign: 0, absent: 0, error: 0 }
for (let i = 0; i < pending.length; i += 40) {
  const res = await classifyBatch(pending.slice(i, i + 40))
  for (const o of res) { ws.write(JSON.stringify(o) + '\n'); cnt[o.cls]++ }
  n += res.length
  if (n % 400 === 0) console.error(`  ${n}/${pending.length} ${JSON.stringify(cnt)}`)
  await sleep(200)
}
ws.end()
console.error('완료:', cnt)
