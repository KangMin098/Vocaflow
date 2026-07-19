// scripts/dict/kaikki-extra-extract.mjs
// #4·#5 1회 스트림 추출 — kaikki 원본에서 homophones·rhyme_key·derived·related·per-sense(example·synonyms) 동시 추출.
//   45k 표제어 교차. 외부 사실만(무환각). 출력 → data/kaikki-extra.json.
// 실행: node scripts/dict/kaikki-extra-extract.mjs
import fs from 'node:fs'
import readline from 'node:readline'
const enrich = JSON.parse(fs.readFileSync('scripts/dict/data/kaikki-enrich.json', 'utf8'))
const targets = new Set(Object.keys(enrich))
const SRC = 'scripts/dict/data/kaikki-en-words.jsonl'
const OUT = 'scripts/dict/data/kaikki-extra.jsonl'
const cleanEx = (t) => { if (typeof t !== 'string') return null; const s = t.replace(/\s+/g, ' ').trim(); const wc = s.split(' ').length; if (wc < 3 || wc > 22) return null; if (/ISBN|→|published|→|\d{4},/.test(s)) return null; return s }
const uniq = (a, n) => [...new Set(a.filter(Boolean))].slice(0, n)

const map = Object.create(null) // 프로토타입 오염 방지("constructor"·"toString" 등 실제 영단어)
const rl = readline.createInterface({ input: fs.createReadStream(SRC, { encoding: 'utf8' }), crlfDelay: Infinity })
let lines = 0
try {
for await (const line of rl) {
  lines++; if (lines % 500000 === 0) console.log(`  scan ${lines}`)
  if (!line) continue
  let o; try { o = JSON.parse(line) } catch { continue }
  const w = (o.word || '').toLowerCase()
  if (!targets.has(w)) continue
  // 단어당 여러 POS 레코드 병합
  const rec = map[w] || { homophones: [], rhyme_key: null, derived: [], related: [], senses: [] }
  for (const s of (o.sounds || [])) {
    if (s.homophone && rec.homophones.length < 12) rec.homophones.push((s.homophone || '').toLowerCase())
    if (s.rhymes && !rec.rhyme_key) rec.rhyme_key = s.rhymes
  }
  if (rec.derived.length < 30) for (const d of (o.derived || [])) { const x = (d.word || d); if (typeof x === 'string' && /^[a-zA-Z][a-zA-Z '-]+$/.test(x) && x.toLowerCase() !== w) rec.derived.push(x) }
  if (rec.related.length < 30) for (const r of (o.related || [])) { const x = (r.word || r); if (typeof x === 'string' && /^[a-zA-Z][a-zA-Z '-]+$/.test(x) && x.toLowerCase() !== w) rec.related.push(x) }
  if (rec.senses.length < 12) for (const s of (o.senses || [])) {
    if (rec.senses.length >= 12) break
    const gloss = (Array.isArray(s.glosses) && s.glosses.length) ? s.glosses[s.glosses.length - 1] : null
    if (!gloss || typeof gloss !== 'string') continue
    const exs = uniq((s.examples || []).filter((e) => e.type !== 'quotation' && !e.ref).map((e) => cleanEx(e.text)), 2)
    const syns = uniq((s.synonyms || []).map((x) => (x.word || '')).filter((x) => /^[a-zA-Z][a-zA-Z '-]+$/.test(x)), 6)
    if (exs.length || syns.length) rec.senses.push({ examples: exs, synonyms: syns })
  }
  map[w] = rec
}
rl.close()
} catch (err) { console.error('SCAN ERROR at line', lines, ':', err.message, '\n', err.stack); process.exit(1) }

// 정리·캡 + JSONL 스트림 기록(단일 문자열 512MB 한계 회피)
let cH = 0, cR = 0, cD = 0, cRel = 0, cSenseEx = 0
const ws = fs.createWriteStream(OUT, { encoding: 'utf8' })
for (const w of Object.keys(map)) {
  const r = map[w]
  r.homophones = uniq(r.homophones.filter((h) => h !== w), 6)
  r.derived = uniq(r.derived, 12)
  r.related = uniq(r.related, 10)
  if (r.homophones.length) cH++
  if (r.rhyme_key) cR++
  if (r.derived.length) cD++
  if (r.related.length) cRel++
  if (r.senses.some((s) => s.examples.length)) cSenseEx++
  ws.write(JSON.stringify({ w, ...r }) + '\n')
}
await new Promise((res) => ws.end(res))
console.log(`추출 완료 → ${OUT}`)
console.log(`  homophones ${cH} · rhyme_key ${cR} · derived ${cD} · related ${cRel} · sense예문보유 ${cSenseEx}`)
