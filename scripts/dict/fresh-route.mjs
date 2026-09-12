// scripts/dict/fresh-route.mjs
// Stage ④ 라우팅 — classified.jsonl + google-draft.jsonl → en/foreign/absent 청크 (Google draft 병합).
// 실행: node scripts/dict/fresh-route.mjs
import fs from 'node:fs'
const EN_N = 9, FO_N = 5, AB_N = 14
const rows = []
for (const l of fs.readFileSync('scratchpad-foreign/fresh/classified.jsonl', 'utf8').split('\n')) { if (!l) continue; try { rows.push(JSON.parse(l)) } catch {} }
const draft = new Map()
if (fs.existsSync('scratchpad-foreign/fresh/google-draft.jsonl')) for (const l of fs.readFileSync('scratchpad-foreign/fresh/google-draft.jsonl', 'utf8').split('\n')) { if (!l) continue; try { const o = JSON.parse(l); draft.set(o.w, o) } catch {} }

const en = rows.filter(r => r.cls === 'en')
const foreign = rows.filter(r => r.cls === 'foreign')
const absent = rows.filter(r => r.cls === 'absent')
console.error(`en=${en.length} foreign=${foreign.length} absent=${absent.length} · google draft=${draft.size}`)

function split(list, n, dir, mapper) {
  fs.mkdirSync(dir, { recursive: true })
  list.sort((a, b) => b.freq - a.freq)
  for (let i = 0; i < n; i++) {
    const chunk = list.filter((_, idx) => idx % n === i)
    fs.writeFileSync(`${dir}/chunk-${i}.jsonl`, chunk.map(x => JSON.stringify(mapper(x))).join('\n') + '\n')
  }
  console.error(`${dir}: ${n} chunks (~${Math.ceil(list.length / n)}/chunk)`)
}
split(en, EN_N, 'scratchpad-foreign/fresh/en', x => { const d = draft.get(x.w); return { w: x.w, freq: x.freq, books: x.books, sent: x.sent, webster: d?.webster_gloss || null, google_ko: d?.google_ko || null } })
split(foreign, FO_N, 'scratchpad-foreign/fresh/foreign', x => { const d = draft.get(x.w); return { w: x.w, freq: x.freq, books: x.books, wlang: x.lang, sent: x.sent, google_ko: d?.google_ko || null } })
split(absent, AB_N, 'scratchpad-foreign/fresh/absent', x => ({ w: x.w, freq: x.freq, books: x.books, sent: x.sent }))
