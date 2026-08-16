// scripts/dict/w0816-exrepair.mjs
// T8 — 예문 자리에 예문이 아닌 것이 들어간 레코드를 고친다. T5/T5b 유의어 배치가 부수적으로 계통 결함 3종을 잡아냈다:
//   (a) WordNet 관계 메타데이터가 그대로 적재 — `Near-synonyms: lounge …` · `Holonyms: brain < …` (93건)
//   (b) 사전 뜻풀이(gloss)를 예문 자리에 넣음 — 소문자 시작 · 종결부호 없음 (197건)
//   (c) 레코드 밀림 — 예문이 **다른 표제어**의 것 (`heat up` 이 `screw up` 예문을 들고 있음) (397건)
//   진단: docs/AI_CONTEXT/diagnostics/dict_field_consistency_20260815.md
//
// ⚠️ 게이트 — T6(exmatch)와 달리 이 배치는 **원본이 예문이 아니므로 비교 대상이 없다**. 따라서 산출물 자체를 검증한다:
//   (1) 표제어(또는 굴절형)가 예문에 실제로 등장 — (c) 밀림을 다시 만들지 않기 위한 핵심 게이트
//   (2) 대문자 시작 + 종결부호(. ! ?) — (b) gloss 재유입 차단
//   (3) 관계 라벨(Near-synonyms/Holonyms/…) 로 시작하면 거부 — (a) 재유입 차단
//   (4) 20~160자 · 아포스트로피 회피(TTS·따옴표 처리) · 원본과 달라야 함
//   (5) `skip:true` — 표제어 자체가 학습자 카드에 부적절하면 예문을 쓰지 않고 건너뛴다(멸칭·비속어)
//
// 실행: node scripts/dict/w0816-exrepair.mjs chunk [--dir D] [--size 110]
//       node scripts/dict/w0816-exrepair.mjs apply [--dir D] [--commit]
import fs from 'node:fs'
import path from 'node:path'
import { db, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0816-exrepair')
const SIZE = parseInt(arg('--size', '110'), 10)
const COMMIT = process.argv.includes('--commit')

const META_RE = /^\s*(near-synonyms?|holonyms?|meronyms?|coordinate term|see thesaurus|synonyms?|antonyms?|hypernyms?|hyponyms?)\b/i

/** 표제어가 예문에 등장하는가 — 어간 앞 4자 이상으로 굴절형까지 허용(구동사는 첫 낱말 기준). */
function containsWord(ex, word) {
  const head = word.split(/[\s-]/)[0]
  const stem = head.length > 4 ? head.slice(0, Math.max(4, head.length - 2)) : head
  return new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(ex)
}

if (MODE === 'chunk') {
  const targets = []
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, pos, meaning_ko, meanings_ko, example_en, cefr_level, v_level, frequency_rank')
      .not('example_en', 'is', null).gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      const ex = String(r.example_en)
      let kind = null
      if (META_RE.test(ex)) kind = 'meta'                                    // (a)
      else if (/^[a-z]/.test(ex) && !/[.!?"]$/.test(ex)) kind = 'gloss'      // (b)
      else if (!containsWord(ex, r.word)) kind = 'shifted'                   // (c)
      if (!kind) continue
      targets.push({
        word: r.word, kind, pos: r.pos, meaning_ko: r.meaning_ko,
        all_meanings: Array.isArray(r.meanings_ko) ? r.meanings_ko.map((m) => `${m.pos}:${m.meaning}`) : [],
        example_en: ex, cefr: r.cefr_level, v: r.v_level, rank: r.frequency_rank,
      })
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
  targets.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9))
  const n = writeChunks(DIR, targets, SIZE)
  const by = targets.reduce((m, t) => ((m[t.kind] = (m[t.kind] ?? 0) + 1), m), {})
  console.log(`exrepair targets: ${targets.length} (${JSON.stringify(by)}) · chunks: ${n} → ${DIR}/chunk-NN.json`)
  process.exit(0)
}

if (MODE === 'apply') {
  const cur = new Map()
  for (const f of fs.readdirSync(DIR)) {
    if (!/^chunk-\d+\.json$/.test(f)) continue
    for (const e of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
      cur.set(e.word.toLowerCase(), { ex: e.example_en, meaning: e.meaning_ko, kind: e.kind })
    }
  }

  const { files, rows } = readOuts(DIR)
  const fixes = new Map()
  const flagged = []
  let bad = 0, skipped = 0
  const gate = { noword: 0, shape: 0, meta: 0, len: 0, same: 0, apos: 0 }
  for (const e of rows) {
    if (!e || typeof e.word !== 'string') { bad++; continue }
    const w = e.word.toLowerCase().trim()
    const c = cur.get(w)
    if (!c) { bad++; continue }
    if (e.note && String(e.note).trim()) flagged.push({ word: w, kind: c.kind, meaning_ko: c.meaning, note: String(e.note).trim() })
    if (e.skip === true) { skipped++; continue }
    if (typeof e.example_en !== 'string') { bad++; continue }
    const ex = e.example_en.trim()
    if (ex.length < 20 || ex.length > 160) { gate.len++; continue }          // (4)
    if (ex === c.ex) { gate.same++; continue }                               // (4)
    if (ex.includes("'")) { gate.apos++; continue }                          // (4)
    if (META_RE.test(ex)) { gate.meta++; continue }                          // (3)
    if (!/^[A-Z"]/.test(ex) || !/[.!?"]$/.test(ex)) { gate.shape++; continue } // (2)
    if (!containsWord(ex, w)) { gate.noword++; continue }                    // (1)
    fixes.set(w, ex)
  }
  console.log(`files: ${files} · 교체 대상: ${fixes.size} · agent-skip: ${skipped} · malformed: ${bad}`)
  console.log(`게이트 탈락 — 표제어 없음: ${gate.noword} · 문장꼴 아님: ${gate.shape} · 메타라벨: ${gate.meta} · 길이: ${gate.len} · 동일: ${gate.same} · 아포스트로피: ${gate.apos}`)
  fs.writeFileSync(path.join(DIR, 'FLAGGED.json'), JSON.stringify(flagged, null, 1))
  console.log(`레코드 결함 보고(자동수정 안 함): ${flagged.length} → ${DIR}/FLAGGED.json`)

  if (!COMMIT) {
    console.log('DRY-RUN (--commit 로 적용). 샘플:')
    let n = 0
    for (const [w, ex] of fixes) { if (n++ >= 10) break; console.log(` ${w} [${cur.get(w).kind}] (${cur.get(w).meaning})\n   before: ${cur.get(w).ex}\n   after : ${ex}`) }
    process.exit(0)
  }

  let done = 0, failed = 0
  for (const [w, ex] of fixes) {
    const { error } = await db.from('shared_dictionary').update({ example_en: ex }).eq('word', w)
    if (error) { failed++; if (failed < 5) console.warn(w, error.message) } else done++
    if (done % 200 === 0 && done) console.log(`  … ${done}`)
  }
  console.log(`updated: ${done} · failed: ${failed}`)
  process.exit(0)
}

console.error('usage: node scripts/dict/w0816-exrepair.mjs chunk|apply [--dir D] [--size N] [--commit]')
process.exit(1)
