// scripts/dict/wikt-foreign-export.mjs
// classified.jsonl 의 foreign 항목 → 청크 (Claude 문맥 검증 배치용).
// wlang = Wiktionary 언어태그(추정). Claude 가 문맥으로 진짜 외국어 vs 우연일치 판정.
import fs from 'node:fs'
const N = parseInt(process.argv[2] || '6')
const rows = []
for (const l of fs.readFileSync('scratchpad-foreign/wikt/classified.jsonl', 'utf8').split('\n')) {
  if (!l) continue; let o; try { o = JSON.parse(l) } catch { continue }
  if (o.cls === 'foreign') rows.push({ w: o.w, freq: o.freq, books: o.books, wlang: o.lang, sent: o.sent })
}
rows.sort((a, b) => b.freq - a.freq)
const dir = 'scratchpad-foreign/wikt/foreign'
fs.mkdirSync(dir, { recursive: true })
for (let i = 0; i < N; i++) {
  const chunk = rows.filter((_, idx) => idx % N === i)
  fs.writeFileSync(`${dir}/chunk-${i}.jsonl`, chunk.map(x => JSON.stringify(x)).join('\n') + '\n')
}
console.error(`foreign ${rows.length} → ${N} chunks (~${Math.ceil(rows.length / N)}/chunk)`)
