// scripts/dict/w0817-colloc.mjs
// T14 — `collocations` 채움. 연어(collocation)는 "이 낱말이 실제로 어떤 낱말과 붙어 다니는가" 다.
//   뜻과 예문을 알아도 `make a decision`(o) / `do a decision`(x) 를 구분하지 못하면 산출이 안 된다.
//   T9·T12 학습자 노트에서 가장 자주 나온 오류 갈래가 바로 연어 제약이었다.
//
// ⚠️ 순수 추가 배치 — `.is('collocations', null)` 조건을 걸어 **덮어쓰기 경로 자체를 없앤다.**
//   빈 배열(`{}`)로 저장된 것도 대상이라 apply 가 두 경우를 함께 본다.
//
// 게이트: 항목 2~5개 · 각 항목 2~5낱말 · **표제어(굴절형 포함)를 반드시 포함** ·
//   ASCII 영문/공백/하이픈/아포스트로피만 · 중복 없음 · 표제어와 동일한 항목 금지.
//
// 대상: `frequency_rank ≤ 12,000` 또는 `CEFR ≤ B2` — 학습자가 실제로 만나는 구간(실측 4,195).
// 실행: node scripts/dict/w0817-colloc.mjs chunk [--dir D] [--size 120]
//       node scripts/dict/w0817-colloc.mjs apply [--dir D] [--commit]
import fs from 'node:fs'
import path from 'node:path'
import { db, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0817-colloc')
const SIZE = parseInt(arg('--size', '120'), 10)
const COMMIT = process.argv.includes('--commit')

/** 표제어가 구에 등장하는가 — 굴절형 허용. w0816-exfill 의 매처와 같은 규칙. */
const IRREGULAR = {
  be: ['was', 'were', 'been', 'is', 'are'], begin: ['began', 'begun'], break: ['broke', 'broken'],
  bring: ['brought'], buy: ['bought'], catch: ['caught'], come: ['came'], do: ['did', 'done'],
  draw: ['drew'], drive: ['drove'], eat: ['ate'], fall: ['fell'], feel: ['felt'], fight: ['fought'],
  find: ['found'], fly: ['flew'], get: ['got'], give: ['gave'], go: ['went', 'gone'], grow: ['grew'],
  hang: ['hung'], have: ['had', 'has'], hear: ['heard'], hold: ['held'], keep: ['kept'], know: ['knew'],
  lay: ['laid'], lead: ['led'], leave: ['left'], lose: ['lost'], make: ['made'], mean: ['meant'],
  meet: ['met'], pay: ['paid'], rise: ['rose'], run: ['ran'], say: ['said'], see: ['saw', 'seen'],
  sell: ['sold'], send: ['sent'], sit: ['sat'], speak: ['spoke'], stand: ['stood'], take: ['took'],
  teach: ['taught'], tell: ['told'], think: ['thought'], throw: ['threw'], win: ['won'],
  write: ['wrote', 'written'], child: ['children'], foot: ['feet'], man: ['men'], person: ['people'],
  tooth: ['teeth'], woman: ['women'], mouse: ['mice'],
}

function containsWord(phrase, word) {
  const tokens = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ' ').split(/\s+/).filter((t) => t.length >= 2)
  if (!tokens.length) return true
  const forms = []
  for (const t of tokens) {
    forms.push(t.length > 5 ? t.slice(0, t.length - 2) : t, ...(IRREGULAR[t] ?? []))
    if (/y$/.test(t)) forms.push(t.slice(0, -1) + 'i')
    if (/fe?$/.test(t)) forms.push(t.replace(/fe?$/, 'v'))
    if (/e$/.test(t)) forms.push(t.slice(0, -1))
    if (/[^aeiou][aeiou][bdgklmnprt]$/.test(t)) forms.push(t + t.slice(-1))
  }
  return forms.some((f) => new RegExp(`(?<!\\p{L})${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu').test(phrase))
}

if (MODE === 'chunk') {
  const targets = []
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, pos, pos_set, meaning_ko, example_en, synonyms, cefr_level, v_level, frequency_rank, collocations')
      .gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      if (r.collocations && r.collocations.length) continue
      if (!r.meaning_ko) continue
      const hi = (r.frequency_rank != null && r.frequency_rank <= 12000) ||
        ['A1', 'A2', 'B1', 'B2'].includes(r.cefr_level)
      if (!hi) continue
      targets.push({
        word: r.word, pos: r.pos, pos_set: r.pos_set ?? [], meaning_ko: r.meaning_ko,
        example_en: r.example_en ?? null, synonyms: (r.synonyms ?? []).slice(0, 3),
        cefr: r.cefr_level, v: r.v_level, rank: r.frequency_rank,
      })
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
  targets.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9))
  const n = writeChunks(DIR, targets, SIZE)
  console.log(`colloc targets: ${targets.length} · chunks: ${n} → ${DIR}/chunk-NN.json`)
  process.exit(0)
}

if (MODE === 'apply') {
  const cur = new Map()
  for (const f of fs.readdirSync(DIR)) {
    if (!/^chunk-\d+\.json$/.test(f)) continue
    for (const e of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
      cur.set(e.word.toLowerCase(), { word: e.word, meaning: e.meaning_ko })
    }
  }

  const { files, rows } = readOuts(DIR)
  const fills = new Map()
  const flagged = []
  let bad = 0, skipped = 0
  const gate = { count: 0, len: 0, noword: 0, charset: 0, samesame: 0, dup: 0 }
  for (const e of rows) {
    if (!e || typeof e.word !== 'string') { bad++; continue }
    const w = e.word.toLowerCase().trim()
    const c = cur.get(w)
    if (!c) { bad++; continue }
    if (e.note && String(e.note).trim()) flagged.push({ word: w, meaning_ko: c.meaning, note: String(e.note).trim() })
    if (e.skip === true) { skipped++; continue }
    if (!Array.isArray(e.collocations)) { bad++; continue }

    const list = [...new Set(e.collocations.map((s) => String(s ?? '').trim().replace(/[‘’ʼ]/g, "'")).filter(Boolean))]
    if (list.length !== e.collocations.length) { gate.dup++; continue }
    if (list.length < 2 || list.length > 5) { gate.count++; continue }
    let ok = true
    for (const p of list) {
      const words = p.split(/\s+/)
      if (words.length < 2 || words.length > 5) { ok = false; gate.len++; break }
      if (!/^[A-Za-z][A-Za-z '-]*$/.test(p)) { ok = false; gate.charset++; break }   // ASCII 영문만
      if (p.toLowerCase() === w) { ok = false; gate.samesame++; break }              // 표제어 자체는 연어가 아니다
      if (!containsWord(p, w)) { ok = false; gate.noword++; break }                  // ⛔ 표제어 미포함
    }
    if (!ok) continue
    fills.set(w, list)
  }
  console.log(`files: ${files} · 채움 대상: ${fills.size} · agent-skip: ${skipped} · malformed: ${bad}`)
  console.log(`게이트 탈락 — 개수: ${gate.count} · 낱말수: ${gate.len} · 표제어 없음: ${gate.noword} · 문자셋: ${gate.charset} · 표제어와 동일: ${gate.samesame} · 중복: ${gate.dup}`)
  fs.writeFileSync(path.join(DIR, 'FLAGGED.json'), JSON.stringify(flagged, null, 1))
  console.log(`레코드 결함 보고: ${flagged.length} → ${DIR}/FLAGGED.json`)

  if (!COMMIT) {
    console.log('DRY-RUN (--commit 로 적용). 샘플:')
    let n = 0
    for (const [w, list] of fills) { if (n++ >= 10) break; console.log(` ${w} (${cur.get(w).meaning})\n   → ${list.join(' | ')}`) }
    process.exit(0)
  }

  // ⚠️ 비어 있을 때만 쓴다 — 다른 배치가 그 사이 채웠으면 건드리지 않는다(멱등).
  let done = 0, failed = 0, taken = 0
  for (const [w, list] of fills) {
    const { data, error } = await db.from('shared_dictionary')
      .update({ collocations: list }).eq('word', cur.get(w).word)
      .or('collocations.is.null,collocations.eq.{}').select('word')
    if (error) { failed++; if (failed < 5) console.warn(w, error.message); continue }
    if (!data || !data.length) { taken++; continue }
    done++
    if (done % 500 === 0) console.log(`  … ${done}`)
  }
  console.log(`filled: ${done} · 이미 채워져 있어 건너뜀: ${taken} · failed: ${failed}`)
  process.exit(0)
}

console.error('usage: node scripts/dict/w0817-colloc.mjs chunk|apply [--dir D] [--size N] [--commit]')
process.exit(1)
