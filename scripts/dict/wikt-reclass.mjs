// scripts/dict/wikt-reclass.mjs
// _cur4 중 classified.jsonl 에 en/foreign/absent 로 없는 것(=미분류 사각지대)만 Wiktionary 재분류.
// 출력: scratchpad-foreign/wikt/reclassified.jsonl  {w,freq,books,sent,cls,lang}
import fs from 'node:fs'
import https from 'node:https'
const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const get = u => new Promise((res, rej) => { https.get(u, { headers: { 'User-Agent': 'vocaflow-research (dict)' } }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d })) }).on('error', rej) })

// 이미 분류된 단어 (en/foreign/absent) 집합
const classified = new Set()
for (const l of fs.readFileSync('scratchpad-foreign/wikt/classified.jsonl', 'utf8').split('\n')) { if (!l) continue; try { const o = JSON.parse(l); if (o.cls !== 'error') classified.add(o.w) } catch {} }

// _cur4 로드 → 미분류만
const cur = []
for (let off = 0; ; off += 1000) { const r = await fetch(`${URL}/rest/v1/_cur4?select=w,freq,books,sent&limit=1000&offset=${off}`, { headers: H }); const d = await r.json(); if (!Array.isArray(d) || !d.length) break; cur.push(...d); if (d.length < 1000) break }
const todo = cur.filter(r => !classified.has(r.w))
console.error('_cur4:', cur.length, '· 미분류:', todo.length)

const byKey = new Map(todo.map(r => [r.w.toLowerCase(), r]))
const outPath = 'scratchpad-foreign/wikt/reclassified.jsonl'
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
    } catch (e) { await sleep(1200 * (i + 1)) }
  }
  return batch.map(r => ({ ...r, cls: 'error', lang: null }))
}

const pending = todo.filter(r => !done.has(r.w))
let n = 0, cnt = { en: 0, foreign: 0, absent: 0, error: 0 }
for (let i = 0; i < pending.length; i += 40) {
  const res = await classifyBatch(pending.slice(i, i + 40))
  for (const o of res) { ws.write(JSON.stringify(o) + '\n'); cnt[o.cls]++ }
  n += res.length
  if (n % 200 === 0) console.error(`  ${n}/${pending.length} ${JSON.stringify(cnt)}`)
  await sleep(300)
}
ws.end()
console.error('완료:', cnt)
