// scripts/dict/wikt-route-export.mjs
// classified.jsonl → 2갈래 청크 분할:
//   en (실영어 표제어)   → scratchpad-foreign/wikt/en/chunk-*.jsonl   (Claude ko 생성 → gap-fill)
//   absent (사전 부재)    → scratchpad-foreign/wikt/absent/chunk-*.jsonl (Claude 방언정규화 → spelling_norm)
// foreign 는 라벨용 집계만 리포트.
// 실행: node scripts/dict/wikt-route-export.mjs [EN_CHUNKS] [ABSENT_CHUNKS]
import fs from 'node:fs'
const EN_N = parseInt(process.argv[2] || '8'), AB_N = parseInt(process.argv[3] || '8')
const rows = []
for (const l of fs.readFileSync('scratchpad-foreign/wikt/classified.jsonl', 'utf8').split('\n')) { if (!l) continue; try { rows.push(JSON.parse(l)) } catch {} }
const en = rows.filter(r => r.cls === 'en')
const absent = rows.filter(r => r.cls === 'absent')
const foreign = rows.filter(r => r.cls === 'foreign')
console.error(`en=${en.length}(${en.reduce((a, r) => a + r.freq, 0)}occ) absent=${absent.length}(${absent.reduce((a, r) => a + r.freq, 0)}occ) foreign=${foreign.length}`)

function split(list, n, dir) {
  fs.mkdirSync(dir, { recursive: true })
  list.sort((a, b) => b.freq - a.freq)
  for (let i = 0; i < n; i++) {
    const chunk = list.filter((_, idx) => idx % n === i)
    fs.writeFileSync(`${dir}/chunk-${i}.jsonl`, chunk.map(x => JSON.stringify({ w: x.w, freq: x.freq, books: x.books, sent: x.sent })).join('\n') + '\n')
  }
  console.error(`${dir}: ${n} chunks, ~${Math.ceil(list.length / n)}/chunk`)
}
split(en, EN_N, 'scratchpad-foreign/wikt/en')
split(absent, AB_N, 'scratchpad-foreign/wikt/absent')
// 외국어 라벨 집계 저장
const byLang = {}
for (const r of foreign) (byLang[r.lang] = byLang[r.lang] || []).push(r.w)
fs.writeFileSync('scratchpad-foreign/wikt/foreign-by-lang.json', JSON.stringify(byLang, null, 1))
console.error('foreign-by-lang.json 저장')
