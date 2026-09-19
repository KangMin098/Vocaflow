// scripts/dict/w0830-repcolloc.mjs
// D0830-T6-1b — **대표 뜻 연어 보강**. 연어가 전부 부차적 뜻에만 붙어 있고 대표 뜻에는
//   하나도 없는 낱말에, 대표 뜻 연어를 **더한다**(기존 값은 지우지 않는다).
//
// 어디서 나왔나:
//   T6-1(동음이의어 오염 판정)이 6,456 낱말을 읽는 동안, 서로 다른 서브에이전트가 구간마다
//   독립적으로 같은 것을 짚었다 — **값은 전부 맞는데 전부 부차적 뜻에만 붙어 있다.**
//     `pen`   대표 뜻 '펜'   ← 연어 `sheep pen` · `pig pen` · `playpen` (전부 '우리')
//     `pin`   대표 뜻 '핀'   ← 연어 `enter pin` · `pin number` (전부 두문자어 PIN)
//     `swallow` 대표 뜻 '삼키다' ← 연어 전부 '제비'
//     `train` 대표 뜻 '기차' ← 연어 전부 동사 '훈련하다'
//   T6-1 은 **지울 것이 없어** 손대지 못했다(그 뜻들이 senses 에 정식으로 등재돼 있다).
//   그래서 `COREFILL-QUEUE.json` 으로 넘겼고, 이 배치가 그것을 받는다.
//
// 왜 학습자에게 닿나:
//   컴포저의 `collocation` 블루프린트가 이 배열을 **그대로 목차로 쓴다.** `pen` 카드를 열면
//   연어 자리에 양 우리가 나온다. 틀린 값은 아니지만 그 낱말을 배우러 온 학습자에게는
//   **아무 쓸모가 없다.**
//
// 기존 `w0830-corefill` 과 겹치지 않는다:
//   corefill 은 배열이 **비어 있을 때만** 채운다(`empty(r.collocations)`). 이 건들은 값이 차 있어
//   corefill 의 그물에 안 걸린다. 반대로 T6-1 이 통째로 비운 낱말(`electric` 등)은 corefill 소관이라
//   이 배치가 건너뛴다 — 같은 낱말을 두 배치가 건드리면 무엇이 누구 값인지 못 가린다.
//
// 더하기만 한다: 기존 항목을 지우지 않는다. 새 연어를 **앞에 놓는다** — 대표 뜻이 먼저 읽혀야
//   목차가 제 구실을 한다. 무엇을 더했는지 `field_provenance.t6_repcolloc_added` 에 남긴다.
//
// 재실행 안전: chunk 는 `field_provenance.t6_repcolloc` 이 찍힌 낱말을 건너뛴다.
//   apply 는 표제어가 안 들어간 값·이미 있는 값·길이 위반을 넣지 않고 건너뛴 수를 출력한다.
//
// 실행: node scripts/dict/w0830-repcolloc.mjs chunk [--dir D] [--size 20]
//       node scripts/dict/w0830-repcolloc.mjs apply [--dir D] [--commit]
//       node scripts/dict/w0830-repcolloc.mjs status [--dir D]
import fs from 'node:fs'
import path from 'node:path'
import { db, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0830-repcolloc')
const SIZE = parseInt(arg('--size', '20'), 10)
const COMMIT = process.argv.includes('--commit')
const QUEUE = arg('--queue', 'scripts/dict/w0830-homonym/COREFILL-QUEUE.json')

const STAMP = 't6_repcolloc'
const ADDED = 't6_repcolloc_added'
const MAX_COLLOC = 8

const txt = (v) => (v ?? '').toString().trim()
const arr = (v) => (Array.isArray(v) ? v.map(txt).filter(Boolean) : [])
const key = (s) => txt(s).toLowerCase().replace(/\s+/g, ' ')
const deaccent = (s) => s.normalize('NFD').replace(/\p{M}/gu, '')
const ASCII_OK = /^[ -~‘’“”]+$/

// 표제어가 연어 안에 있어야 한다 — 굴절형은 허용한다(`swallow` → `swallowed`).
// w0830-senseex 의 매처와 같은 규칙(어간 절단 + 분음부호 제거)을 쓴다.
function containsWord(phrase, word) {
  const p = deaccent(phrase)
  const tokens = deaccent(word).toLowerCase().replace(/[^\p{L}\p{N}]/gu, ' ').split(/\s+/).filter((t) => t.length >= 2)
  if (!tokens.length) return true
  const forms = []
  for (const t of tokens) {
    forms.push(t.length > 5 ? t.slice(0, t.length - 2) : t)
    if (/y$/.test(t)) forms.push(t.slice(0, -1) + 'i')
    if (/e$/.test(t)) forms.push(t.slice(0, -1))
  }
  return forms.some((f) => new RegExp(`(?<!\\p{L})${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu').test(p))
}

if (MODE === 'chunk') {
  const queue = JSON.parse(fs.readFileSync(QUEUE, 'utf8'))
  const noteOf = new Map(queue.map((q) => [key(q.word), txt(q.note)]))
  const words = [...noteOf.keys()]
  const targets = []
  const skip = { stamped: 0, no_row: 0, colloc_empty: 0 }
  for (let i = 0; i < words.length; i += 200) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, primary_pos, pos, pos_set, meaning_ko, meanings_ko, example_en, collocations, synonyms, cefr_level, v_level, frequency_rank, field_provenance')
      .in('word', words.slice(i, i + 200))
    if (error) { console.error(error.message); process.exit(1) }
    for (const r of data) {
      const prov = r.field_provenance || {}
      if (txt(prov[STAMP])) { skip.stamped++; continue }
      // T6-1 이 통째로 비운 낱말은 `corefill` 소관이다 — 두 배치가 같은 칸을 건드리면 안 된다.
      if (!arr(r.collocations).length) { skip.colloc_empty++; continue }
      const mk = Array.isArray(r.meanings_ko) ? r.meanings_ko : []
      targets.push({
        word: r.word,
        primary_pos: r.primary_pos || r.pos || null,
        pos_set: r.pos_set || [],
        meaning_ko: txt(r.meaning_ko),
        senses: mk.map((m) => ({ pos: txt(m && m.pos) || null, meaning: txt(m && m.meaning) }))
          .filter((m) => m.meaning).slice(0, 8),
        example_en: txt(r.example_en) || null,
        cefr: r.cefr_level, v: r.v_level, rank: r.frequency_rank,
        collocations: arr(r.collocations),
        synonyms: arr(r.synonyms),
        why: noteOf.get(key(r.word)) || null,
      })
    }
  }
  const found = new Set(targets.map((t) => key(t.word)))
  skip.no_row = words.filter((w) => !found.has(w)).length - skip.stamped - skip.colloc_empty
  targets.sort((a, b) => ((a.rank == null ? 1e9 : a.rank) - (b.rank == null ? 1e9 : b.rank)) || a.word.localeCompare(b.word))
  const n = writeChunks(DIR, targets, SIZE)
  console.log(`큐 ${words.length} → 대상 ${targets.length} 낱말 · 청크 ${n} (size ${SIZE}) -> ${DIR}/chunk-NN.json`)
  console.log('건너뜀:', JSON.stringify(skip), '(colloc_empty 는 corefill 소관)')
}

if (MODE === 'status') {
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR) : []
  const inn = files.filter((f) => /^chunk-\d+\.json$/.test(f))
  const out = files.filter((f) => /^chunk-\d+\.out\.json$/.test(f))
  console.log(`청크 ${inn.length} · 완료 ${out.length} · 남음 ${inn.length - out.length}`)
  const missing = []
  for (const f of inn.sort()) if (!files.includes(f.replace('.json', '.out.json'))) missing.push(f.match(/\d+/)[0])
  if (missing.length) console.log('미완료:', missing.join(','))
}

if (MODE === 'apply') {
  const { files, rows } = readOuts(DIR)
  console.log(`out 파일 ${files} · 낱말 ${rows.length}`)
  const words = [...new Set(rows.map((r) => key(r.word)).filter(Boolean))]
  const cur = new Map()
  for (let i = 0; i < words.length; i += 200) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, collocations, field_provenance').in('word', words.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const d of data) cur.set(d.word.toLowerCase(), d)
  }

  const rej = { no_row: 0, already: 0, dup: 0, no_headword: 0, non_ascii: 0, too_short: 0, too_long: 0, capped: 0, nothing: 0 }
  const flagged = []
  let updated = 0, fail = 0, added = 0

  for (const r of rows) {
    const w = key(r.word)
    const row = cur.get(w)
    // 부수 발견은 적재 여부와 무관하게 먼저 모은다 — 재실행 시 빈 채로 덮이지 않게.
    if (txt(r.note)) flagged.push({ word: w, note: txt(r.note) })
    if (!row) { rej.no_row++; continue }
    const prov = { ...(row.field_provenance || {}) }
    if (txt(prov[STAMP])) { rej.already++; continue }

    const have = arr(row.collocations)
    const haveKeys = new Set(have.map(key))
    const keep = []
    for (const raw of arr((r.add || {}).collocations)) {
      const v = txt(raw)
      if (haveKeys.has(key(v))) { rej.dup++; continue }
      if (keep.some((k) => key(k) === key(v))) { rej.dup++; continue }
      if (!ASCII_OK.test(deaccent(v))) { rej.non_ascii++; continue }
      const n = v.split(/\s+/).length
      if (n < 2) { rej.too_short++; continue }
      if (n > 5) { rej.too_long++; continue }
      if (!containsWord(v, row.word)) { rej.no_headword++; continue }
      keep.push(v)
    }
    if (!keep.length) { rej.nothing++; continue }

    // 대표 뜻 연어를 **앞에** 놓는다 — 목차는 대표 뜻부터 읽혀야 한다.
    let next = [...keep, ...have]
    if (next.length > MAX_COLLOC) { rej.capped += next.length - MAX_COLLOC; next = next.slice(0, MAX_COLLOC) }

    prov[STAMP] = 'added:d0830-t6'
    prov[ADDED] = keep
    if (!COMMIT) { updated++; added += keep.length; continue }
    const { error } = await db.from('shared_dictionary')
      .update({ collocations: next, field_provenance: prov }).eq('word', row.word)
    if (error) { fail++; if (fail < 5) console.warn('fail', w, error.message) } else { updated++; added += keep.length }
  }

  console.log(`\n${COMMIT ? '적용' : '드라이런'} — 낱말 ${updated} · 더한 연어 ${added} · 실패 ${fail}`)
  console.log('거부:', JSON.stringify(rej))
  if (flagged.length) {
    fs.writeFileSync(path.join(DIR, 'FLAGGED.json'), JSON.stringify(flagged, null, 1))
    console.log(`부수 발견 ${flagged.length}건 -> ${DIR}/FLAGGED.json`)
  }
}
