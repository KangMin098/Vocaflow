// scripts/dict/r8-route.mjs — 601-800 캐스케이드 Stage ④ 라우팅
import fs from 'node:fs'
const EN_N = 3, FO_N = 3, AB_N = 12
const rows = []
for (const l of fs.readFileSync('scratchpad-foreign/r8/classified.jsonl', 'utf8').split('\n')) { if (!l) continue; try { rows.push(JSON.parse(l)) } catch {} }
const sent = JSON.parse(fs.readFileSync('scratchpad-foreign/r8/sent.json', 'utf8'))
const draft = new Map()
if (fs.existsSync('scratchpad-foreign/r8/google-draft.jsonl')) for (const l of fs.readFileSync('scratchpad-foreign/r8/google-draft.jsonl', 'utf8').split('\n')) { if (!l) continue; try { const o = JSON.parse(l); draft.set(o.w, o) } catch {} }
const en = rows.filter(r => r.cls === 'en'), foreign = rows.filter(r => r.cls === 'foreign'), absent = rows.filter(r => r.cls === 'absent')
console.error(`en=${en.length} foreign=${foreign.length} absent=${absent.length} · draft=${draft.size}`)
function split(list, n, dir, mapper) {
  fs.mkdirSync(dir, { recursive: true }); list.sort((a, b) => b.freq - a.freq)
  for (let i = 0; i < n; i++) fs.writeFileSync(`${dir}/chunk-${i}.jsonl`, list.filter((_, idx) => idx % n === i).map(x => JSON.stringify(mapper(x))).join('\n') + '\n')
  console.error(`${dir}: ${n} chunks ~${Math.ceil(list.length / n)}/chunk`)
}
split(en, EN_N, 'scratchpad-foreign/r8/en', x => { const d = draft.get(x.w); return { w: x.w, freq: x.freq, books: x.books, sent: sent[x.w] || '', webster: d?.webster_gloss || null, google_ko: d?.google_ko || null } })
split(foreign, FO_N, 'scratchpad-foreign/r8/foreign', x => { const d = draft.get(x.w); return { w: x.w, freq: x.freq, books: x.books, wlang: x.lang, sent: sent[x.w] || '', google_ko: d?.google_ko || null } })
split(absent, AB_N, 'scratchpad-foreign/r8/absent', x => ({ w: x.w, freq: x.freq, books: x.books, sent: sent[x.w] || '' }))
