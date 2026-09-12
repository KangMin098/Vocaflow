// scripts/dict/wiktionary-dialect-extract.mjs
// Wiktionary(kaikki Wiktextract) 영어 방언 variant→standard '사실 쌍'만 스트림 추출.
// gloss/정의문 미추출 — form_of/alt_of 링크 + 방언/철자 태그만. 출처 CC BY-SA (BY 표기 유지).
// 출력: scratchpad-foreign/wik-dialect.jsonl {variant, standard, tag}
import zlib from 'node:zlib'
import readline from 'node:readline'
import fs from 'node:fs'
import { Readable } from 'node:stream'

const SRC = 'https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz' // 2.6GB, 전 언어
const OUT = 'scratchpad-foreign/wik-dialect.jsonl'
// 방언/철자 변이 태그 (굴절 제외)
const KEEP = new Set(['pronunciation-spelling','eye-dialect','dialectal','nonstandard','informal','colloquial','archaic','obsolete','alternative','contraction'])
const INFLECT = new Set(['plural','singular','past','present','participle','gerund','comparative','superlative','third-person','first-person','second-person','future','subjunctive','imperative','vocative','genitive','dative','accusative'])

const res = await fetch(SRC, { headers: { 'User-Agent': 'Vocaflow-dict-build' } })
if (!res.ok) { console.error('HTTP', res.status); process.exit(1) }
const out = fs.createWriteStream(OUT)
const rl = readline.createInterface({ input: Readable.fromWeb(res.body).pipe(zlib.createGunzip()), crlfDelay: Infinity })
let lines = 0, kept = 0
const seen = new Set()
for await (const line of rl) {
  lines++
  if (lines % 500000 === 0) console.error('  lines', lines, 'kept', kept)
  if (!line || line[0] !== '{') continue
  let e; try { e = JSON.parse(line) } catch { continue }
  if (e.lang_code !== 'en' || !e.word || !e.senses) continue
  const variant = e.word.toLowerCase()
  if (!/^[a-z][a-z'-]{1,29}$/.test(variant)) continue
  for (const s of e.senses) {
    const tags = s.tags || []
    if (tags.some(t => INFLECT.has(t))) continue
    if (!tags.some(t => KEEP.has(t))) continue
    const fo = (s.form_of && s.form_of[0]) || (s.alt_of && s.alt_of[0])
    if (!fo || !fo.word) continue
    const standard = String(fo.word).toLowerCase().replace(/[^a-z'-].*$/, '')
    if (!/^[a-z][a-z'-]{1,29}$/.test(standard) || standard === variant) continue
    const key = variant + '\t' + standard
    if (seen.has(key)) continue
    seen.add(key); kept++
    out.write(JSON.stringify({ variant, standard, tag: tags.find(t => KEEP.has(t)) }) + '\n')
    break
  }
}
out.end()
console.error('완료 — lines', lines, 'kept', kept)
