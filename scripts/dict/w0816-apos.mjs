// scripts/dict/w0816-apos.mjs
// T11 — 아포스트로피 표제어의 예문 되쓰기. T10(exfill)이 예문에 아포스트로피를 일괄 금지했는데,
//   **표제어 자체가 아포스트로피를 품고 있으면 빼는 순간 틀린 철자를 가르친다** —
//   `hobson's choice` 의 예문이 `"Hobsons choice"` 로 들어갔고, `o'clock`(A1/v1)은 아예 못 썼다.
//   에이전트가 chunk-34·44 에서 이 모순을 지적해 게이트를 고쳤고, 이 배치가 이미 들어간 값을 되쓴다.
//
// ⚠️ w0816-exfill.mjs 와 달리 **기존 값을 덮어쓴다.** 그래서 게이트가 더 엄하다:
//   표제어의 아포스트로피 토큰이 예문에 **그대로** 있어야 하고, 없으면 거부한다
//   (되쓰는 목적 자체가 그 철자를 살리는 것이므로, 못 살렸으면 원본을 두는 편이 낫다).
//
// 청크 생성은 w0816-exfill 의 chunk 와 달리 일회성이라 스크립트에 넣지 않았다
// (`scripts/dict/w0816-apos/chunk-00.json` 은 별도 질의로 만들었다).
// 실행: node scripts/dict/w0816-apos.mjs apply [--dir D] [--commit]
import fs from 'node:fs'
import path from 'node:path'
import { db, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const DIR = arg('--dir', 'scripts/dict/w0816-apos')
const COMMIT = process.argv.includes('--commit')

/** 표제어에서 아포스트로피를 품은 토큰들 — 예문이 이걸 그대로 담아야 한다. */
function aposTokens(word) {
  return word.replace(/[‘’ʼ]/g, "'").split(/[\s/]+/).filter((t) => t.includes("'"))
    .map((t) => t.replace(/^[^\p{L}']+|[^\p{L}']+$/gu, '')).filter((t) => t.length > 1)
}

const cur = new Map()
for (const e of JSON.parse(fs.readFileSync(path.join(DIR, 'chunk-00.json'), 'utf8'))) {
  cur.set(e.word.toLowerCase(), { word: e.word, meaning: e.meaning_ko, old: e.example_en })
}

const { files, rows } = readOuts(DIR)
const fixes = new Map()
const flagged = []
let bad = 0, skipped = 0
const gate = { noapos: 0, shape: 0, len: 0, same: 0 }
for (const e of rows) {
  if (!e || typeof e.word !== 'string') { bad++; continue }
  const w = e.word.toLowerCase().trim()
  const c = cur.get(w)
  if (!c) { bad++; continue }
  if (e.note && String(e.note).trim()) flagged.push({ word: w, meaning_ko: c.meaning, note: String(e.note).trim() })
  if (e.skip === true) { skipped++; continue }
  if (typeof e.example_en !== 'string') { bad++; continue }
  const ex = e.example_en.trim().replace(/[‘’ʼ]/g, "'")
  if (ex.length < 20 || ex.length > 160) { gate.len++; continue }
  if (!/^[A-Z"]/.test(ex) || !/[.!?"]$/.test(ex)) { gate.shape++; continue }
  if (ex === c.old) { gate.same++; continue }
  // ⛔ 핵심 게이트 — 표제어의 아포스트로피 토큰이 예문에 그대로 있어야 한다.
  //   단 `somebody's`·`one's` 같은 **자리표시자 소유격은 실명사로 치환되는 게 정상**이므로
  //   (`on somebody's coat-tails` → `on his mentor's coat-tails`) 아무 `X's` 든 소유격이 있으면 통과시킨다.
  const PLACEHOLDER = /^(somebody|something|sb|sth|one|your|his|her|their|its)'s?$/i
  const toks = aposTokens(c.word)
  const real = toks.filter((t) => !PLACEHOLDER.test(t))
  const ok = real.length
    ? real.some((t) => ex.toLowerCase().includes(t.toLowerCase()))
    : !toks.length || /\w'(s|d|ll|re|ve|t)?\b/i.test(ex)
  if (!ok) { gate.noapos++; continue }
  fixes.set(w, ex)
}
console.log(`files: ${files} · 되쓰기 대상: ${fixes.size} · agent-skip: ${skipped} · malformed: ${bad}`)
console.log(`게이트 탈락 — 아포스트로피 미복원: ${gate.noapos} · 문장꼴: ${gate.shape} · 길이: ${gate.len} · 원본과 동일: ${gate.same}`)
fs.writeFileSync(path.join(DIR, 'FLAGGED.json'), JSON.stringify(flagged, null, 1))

if (!COMMIT) {
  console.log('DRY-RUN (--commit 로 적용). 샘플:')
  let n = 0
  for (const [w, ex] of fixes) {
    if (n++ >= 10) break
    console.log(` ${w} (${cur.get(w).meaning})\n   before: ${cur.get(w).old}\n   after : ${ex}`)
  }
  process.exit(0)
}

let done = 0, failed = 0
for (const [w, ex] of fixes) {
  const { error } = await db.from('shared_dictionary').update({ example_en: ex }).eq('word', cur.get(w).word)
  if (error) { failed++; if (failed < 5) console.warn(w, error.message) } else done++
}
console.log(`updated: ${done} · failed: ${failed}`)
process.exit(0)
