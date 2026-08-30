// scripts/dict/w0830-homonym.mjs
// D0830-T6-1 — **동음이의어 오염 판정**. WordNet 유래 `collocations`·`synonyms`·`antonyms` 중
//   표제어의 뜻과 어긋나는 항목만 **비운다**. Claude Code 배치(3단: chunk → 서브에이전트 → apply).
//
// 무엇이 문제인가 (2026-08-30 실측):
//   WordNet 은 표제어를 **동음이의어별로 나누지 않고** 한 문자열 아래 모든 synset 을 매단다.
//   그것을 낱말 단위로 평탄화해 들여왔더니 이렇게 됐다:
//     `saw`  meaning_ko 'see 의 과거형'  ← 연어 `hand saw` · `chain saw` · `old saw` (톱)
//     `over` meaning_ko '넘어서; 끝나서'  ← 연어 `bowl an over` · `maiden over` (크리켓 명사)
//     `march` meaning_ko '행진하다'       ← 연어 `in March` · `early March` (3월)
//
// 왜 빈칸보다 나쁜가:
//   빈칸은 학습자가 아무것도 안 배우지만 **틀린 연어는 외운다.** 그리고 컴포저의
//   `collocation`·`synonym-cluster` 블루프린트가 이 값을 그대로 목차로 쓴다.
//
// 이 배치가 **하지 않는** 것 — 섞으면 무엇이 지워지고 무엇이 채워졌는지 못 가린다:
//   - 대체값을 만들지 않는다. 비우기만 한다. 채우는 것은 `w0830-corefill` 소관이다.
//   - `example_en` 을 건드리지 않는다. 뜻이 어긋난 예문은 `EXAMPLE-QUEUE.json` 에 모아
//     T6-3(예문 교체)에 넘긴다. 그 배치만이 `example_en` 을 덮는다.
//   - `meanings_ko` 의 갈래 순서를 건드리지 않는다. 인덱스가 바뀌면 T2 가 채운
//     `example`·`example_ko` 가 엉뚱한 뜻에 붙는다.
//
// 되돌릴 수 있게 지운다 — 지운 값을 `field_provenance.t6_removed` 에 남긴다.
//   ⚠️ 이게 없으면 **출처를 모르고 지운 것**이 되어 복구가 불가능하다.
//
// 재실행 안전: chunk 는 `field_provenance.t6_homonym` 이 찍힌 낱말을 건너뛴다.
//   apply 는 **보여 준 적 없는 항목**과 **현재 배열에 없는 항목**을 지우지 않고 건너뛴 수를 출력한다.
//   몇 번 돌려도 결과가 같다.
//
// 실행: node scripts/dict/w0830-homonym.mjs chunk [--dir D] [--size 20] [--wave core|top|rest|all]
//       node scripts/dict/w0830-homonym.mjs apply [--dir D] [--commit]
//       node scripts/dict/w0830-homonym.mjs status [--dir D]
import fs from 'node:fs'
import path from 'node:path'
import { db, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0830-homonym')
const SIZE = parseInt(arg('--size', '20'), 10)
const WAVE = arg('--wave', 'all')
const COMMIT = process.argv.includes('--commit')

const EXAM_TAGS = ['kice-csat-13y', 'ebs-voca-1306', 'kcurr2022_0', 'kcurr2022_1', 'kcurr2022_2',
  'csat-prep-core-2k', 'kice-csat-core-4y', 'csat-prep-ext-1.8k']

const FIELDS = ['collocations', 'synonyms', 'antonyms']
const STAMP = 't6_homonym'
const REMOVED = 't6_removed'

const txt = (v) => (v ?? '').toString().trim()
const arr = (v) => (Array.isArray(v) ? v.map(txt).filter(Boolean) : [])
const key = (s) => txt(s).toLowerCase().replace(/\s+/g, ' ')

if (MODE === 'chunk') {
  const targets = []
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, primary_pos, pos, pos_set, meaning_ko, meanings_ko, example_en, collocations, synonyms, antonyms, cefr_level, v_level, frequency_rank, frequency_band, list_tags, field_provenance')
      .gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      const prov = r.field_provenance || {}
      if (txt(prov[STAMP])) continue // 이미 판정한 낱말 — 다시 묻지 않는다
      // WordNet 이 손댄 적 없는 행은 이 오염의 대상이 아니다.
      if (!JSON.stringify(prov).includes('wordnet')) continue
      const fields = {}
      let n = 0
      for (const f of FIELDS) { fields[f] = arr(r[f]); n += fields[f].length }
      if (!n) continue
      const tags = r.list_tags || []
      const isExam = tags.some((t) => EXAM_TAGS.includes(t))
      const band = r.frequency_band || ''
      const rank = r.frequency_rank
      const wave = isExam ? 'core'
        : ((rank != null && rank <= 10000) || ['top1k', 'top2k', 'top3k', 'top5k'].includes(band) ? 'top' : 'rest')
      if (WAVE !== 'all' && WAVE !== wave) continue
      const mk = Array.isArray(r.meanings_ko) ? r.meanings_ko : []
      targets.push({
        word: r.word,
        primary_pos: r.primary_pos || r.pos || null,
        pos_set: r.pos_set || [],
        meaning_ko: txt(r.meaning_ko),
        senses: mk.map((m) => ({ pos: txt(m && m.pos) || null, meaning: txt(m && m.meaning) }))
          .filter((m) => m.meaning).slice(0, 8),
        example_en: txt(r.example_en) || null,
        cefr: r.cefr_level, v: r.v_level, rank, wave,
        ...fields,
      })
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
  const waveRank = { core: 0, top: 1, rest: 2 }
  targets.sort((a, b) => (waveRank[a.wave] - waveRank[b.wave]) ||
    ((a.rank == null ? 1e9 : a.rank) - (b.rank == null ? 1e9 : b.rank)) || a.word.localeCompare(b.word))
  const byWave = {}
  for (const t of targets) byWave[t.wave] = (byWave[t.wave] || 0) + 1
  const n = writeChunks(DIR, targets, SIZE)
  console.log(`대상 ${targets.length} 낱말 · 청크 ${n} (size ${SIZE}) -> ${DIR}/chunk-NN.json`)
  console.log('웨이브별:', JSON.stringify(byWave))
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

  // 청크에 실제로 **보여 준** 항목만 지울 수 있다. 보여 준 적 없는 문자열이 drop 에 들어오면
  // 그건 판정이 아니라 지어낸 것이다 — 지우지 않고 센다.
  const shown = new Map()
  for (const f of fs.readdirSync(DIR)) {
    if (!/^chunk-\d+\.json$/.test(f)) continue
    for (const t of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
      const m = shown.get(key(t.word)) || {}
      for (const fld of FIELDS) {
        m[fld] = m[fld] || new Set()
        for (const v of arr(t[fld])) m[fld].add(key(v))
      }
      shown.set(key(t.word), m)
    }
  }

  const words = [...new Set(rows.map((r) => key(r.word)).filter(Boolean))]
  const cur = new Map()
  for (let i = 0; i < words.length; i += 200) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, collocations, synonyms, antonyms, field_provenance').in('word', words.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const d of data) cur.set(d.word.toLowerCase(), d)
  }

  const rej = { no_row: 0, already: 0, not_shown: 0, not_present: 0, nothing: 0 }
  const dropped = { collocations: 0, synonyms: 0, antonyms: 0 }
  const emptied = { collocations: 0, synonyms: 0, antonyms: 0 }
  const flagged = []
  const exampleQueue = []
  // 배치 중 가장 자주 나온 신호는 '오염' 이 아니라 **커버리지 구멍** 이었다 —
  // 연어·유의어가 전부 부차적 뜻에만 쏠려 대표 뜻에는 하나도 없는 낱말.
  // 지울 것이 없으니 이 배치는 손댈 수 없다. 자유 서술로 흘리지 말고 큐로 뽑아 corefill 에 넘긴다.
  const COREFILL_RE = /대표 뜻 연어 0개|대표 뜻[^.]{0,20}연어[^.]{0,20}(0개|없)|senses 대표 뜻 누락|corefill/
  const corefillQueue = []
  let updated = 0, fail = 0, clean = 0

  for (const r of rows) {
    const w = key(r.word)
    const row = cur.get(w)
    // ⚠️ 부수 발견 수집은 `already` 판정보다 **먼저** 한다.
    //   이미 적재된 행을 건너뛰고 나서 모으면, 배치가 끝난 뒤 재실행할 때 모든 행이 `already` 라
    //   FLAGGED/큐 파일이 **빈 채로 덮인다**. 큐는 이번에 쓴 행이 아니라 배치 전체의 보고서다.
    if (txt(r.note)) {
      flagged.push({ word: w, note: txt(r.note) })
      if (COREFILL_RE.test(txt(r.note))) corefillQueue.push({ word: w, note: txt(r.note) })
    }
    if (r.example_mismatch === true) {
      exampleQueue.push({ word: w, meaning_ko: txt(r.meaning_ko) || null, note: txt(r.note) || null })
    }
    if (!row) { rej.no_row++; continue }
    const prov = { ...(row.field_provenance || {}) }
    if (txt(prov[STAMP])) { rej.already++; continue }

    const patch = {}
    const removedNow = {}
    const seen = shown.get(w) || {}
    for (const f of FIELDS) {
      const want = arr((r.drop || {})[f])
      if (!want.length) continue
      const have = arr(row[f])
      const haveKeys = new Set(have.map(key))
      const kill = new Set()
      for (const v of want) {
        const k = key(v)
        if (!(seen[f] && seen[f].has(k))) { rej.not_shown++; continue }
        if (!haveKeys.has(k)) { rej.not_present++; continue }
        kill.add(k)
      }
      if (!kill.size) continue
      const kept = have.filter((v) => !kill.has(key(v)))
      removedNow[f] = have.filter((v) => kill.has(key(v)))
      dropped[f] += kill.size
      if (!kept.length) emptied[f]++
      patch[f] = kept.length ? kept : null
    }

    // 판정 도장은 지운 것이 없어도 찍는다 — "물어봤고 깨끗했다" 와 "아직 안 물어봤다" 는 다르다.
    prov[STAMP] = 'audited:d0830-t6'
    if (Object.keys(removedNow).length) {
      prov[REMOVED] = { ...(row.field_provenance || {})[REMOVED], ...removedNow }
    } else clean++
    patch.field_provenance = prov

    if (!COMMIT) { updated++; continue }
    const { error } = await db.from('shared_dictionary').update(patch).eq('word', row.word)
    if (error) { fail++; if (fail < 5) console.warn('fail', w, error.message) } else updated++
    if (updated % 500 === 0) console.log(`  ...${updated}`)
  }

  console.log(`\n${COMMIT ? '적용' : '드라이런'} — 낱말 ${updated} (오염 없음 ${clean}) · 실패 ${fail}`)
  console.log('지운 항목:', JSON.stringify(dropped))
  console.log('통째로 빈 필드:', JSON.stringify(emptied))
  console.log('거부:', JSON.stringify(rej))
  if (flagged.length) {
    fs.writeFileSync(path.join(DIR, 'FLAGGED.json'), JSON.stringify(flagged, null, 1))
    console.log(`부수 발견 ${flagged.length}건 -> ${DIR}/FLAGGED.json`)
  }
  if (corefillQueue.length) {
    fs.writeFileSync(path.join(DIR, 'COREFILL-QUEUE.json'), JSON.stringify(corefillQueue, null, 1))
    console.log(`대표 뜻 연어 0개 ${corefillQueue.length}건 -> ${DIR}/COREFILL-QUEUE.json (지울 것이 없어 여기서는 못 고침)`)
  }
  if (exampleQueue.length) {
    fs.writeFileSync(path.join(DIR, 'EXAMPLE-QUEUE.json'), JSON.stringify(exampleQueue, null, 1))
    console.log(`뜻 어긋난 예문 ${exampleQueue.length}건 -> ${DIR}/EXAMPLE-QUEUE.json (T6-3 대상, 여기서는 안 고침)`)
  }
}
