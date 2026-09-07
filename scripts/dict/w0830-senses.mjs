// scripts/dict/w0830-senses.mjs
// D0830-T6-2 — **뜻 갈래 정리**. 한 항목에 묶인 여러 뜻을 가르고, 중복 갈래를 합치고,
//   빠진 대표 뜻을 넣는다. Claude Code 배치(3단: chunk → 서브에이전트 → apply).
//
// ⚠️ 이 배치가 이 회차에서 **가장 위험하다.**
//   T2(senseex)·T5(exko)가 `meanings_ko[].example`·`example_ko` 를 **72,266 뜻**에 채워 놨다.
//   갈래를 건드리면서 인덱스가 바뀌면 그 예문이 **엉뚱한 뜻에 붙는다** — 그리고 그건
//   빈칸보다 나쁘다. 학습자가 틀린 짝을 외운다.
//
//   그래서 산출물은 "새 배열" 이 아니라 **`from` 이 달린 새 배열**이다:
//     { "from": 2, "pos": "noun", "meaning": "..." }   ← 원본 2번의 예문을 그대로 데려온다
//     { "from": null, ... }                            ← 새로 가른 갈래. 예문 없이 시작한다
//   apply 가 `from` 을 따라 `example`·`example_ko` 를 옮긴다. 서브에이전트는 예문을 **보지도
//   쓰지도 않는다** — 옮기는 일은 코드가 한다.
//
// 잃지 않는다는 보증 (apply 가 거부하는 조건):
//   - **예문이 달린 원본 갈래는 반드시 어느 `from` 에든 참조돼야 한다.** 안 그러면 거부.
//     이 규칙 하나가 T2·T5 의 72,266 뜻을 통째로 지킨다.
//   - 같은 `from` 을 두 번 쓸 수 없다(예문이 복제되면 어느 뜻의 것인지 못 가린다).
//   - 원본 갈래는 참조되거나 `dropped` 에 사유와 함께 적혀야 한다. 조용한 소실 금지.
//   - 결과 배열이 비면 거부.
//
// 되돌릴 수 있게 바꾼다 — 원본 배열 전체를 `field_provenance.t6_senses_before` 에 남긴다.
//
// 대상 고르기 (모집단은 **실제로 읽고 짚은 것** + 사전이 스스로 어긋난 곳):
//   1. FLAGGED 노트에서 갈래 문제로 짚힌 낱말 (`scripts/dict/w0830-review/T6-2-CANDIDATES.json`)
//   2. `primary_pos` 와 `meanings_ko[0].pos` 가 다른 행
//   3. `pos_set` 에 있는 품사의 뜻이 `meanings_ko` 에 하나도 없는 행
//
// 재실행 안전: chunk 는 `field_provenance.t6_senses` 가 찍힌 낱말을 건너뛴다.
//
// 실행: node scripts/dict/w0830-senses.mjs chunk [--dir D] [--size 12]
//       node scripts/dict/w0830-senses.mjs apply [--dir D] [--commit]
//       node scripts/dict/w0830-senses.mjs status [--dir D]
import fs from 'node:fs'
import path from 'node:path'
import { db, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0830-senses')
const SIZE = parseInt(arg('--size', '12'), 10)
const COMMIT = process.argv.includes('--commit')
const CAND = arg('--cand', 'scripts/dict/w0830-review/T6-2-CANDIDATES.json')

const EXAM_TAGS = ['kice-csat-13y', 'ebs-voca-1306', 'kcurr2022_0', 'kcurr2022_1', 'kcurr2022_2',
  'csat-prep-core-2k', 'kice-csat-core-4y', 'csat-prep-ext-1.8k']
const STAMP = 't6_senses'
const BEFORE = 't6_senses_before'

const txt = (v) => (v ?? '').toString().trim()
const key = (s) => txt(s).toLowerCase()

// 품사 표기가 사전 안에서 통일돼 있지 않다 — `n`/`noun`, `adj`/`adjective`,
// `phrasal verb`/`phrasal_verb`, `exclamation`/`interjection` 이 섞여 있다.
// 정규화 없이 비교하면 **표기 차이를 품사 구멍으로 오인한다.**
// 실측: 정규화 전 667행 → 후 134행. 533행(80%)이 오탐이었다.
const POS_ALIAS = {
  n: 'noun', adj: 'adjective', v: 'verb', adv: 'adverb',
  interj: 'interjection', exclamation: 'interjection',
  'phrasal verb': 'phrasal_verb', 'auxiliary verb': 'auxiliary', prep: 'preposition',
}
const npos = (v) => { const k = key(v); return Object.hasOwn(POS_ALIAS, k) ? POS_ALIAS[k] : k }

if (MODE === 'chunk') {
  const flagged = new Set(JSON.parse(fs.readFileSync(CAND, 'utf8')).map(key))
  const targets = []
  const stats = { flagged: 0, pos_mismatch: 0, pos_gap: 0, stamped: 0, scanned: 0 }
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, primary_pos, pos, pos_set, meaning_ko, meanings_ko, example_en, cefr_level, v_level, frequency_rank, list_tags, field_provenance')
      .gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      stats.scanned++
      const prov = r.field_provenance || {}
      if (txt(prov[STAMP])) { stats.stamped++; continue }
      const mk = Array.isArray(r.meanings_ko) ? r.meanings_ko : []
      if (!mk.length) continue
      const sensePos = [...new Set(mk.map((m) => npos(m && m.pos)).filter(Boolean))]
      const reasons = []
      if (flagged.has(key(r.word))) { reasons.push('노트에서 갈래 문제로 짚힘'); stats.flagged++ }
      const p0 = npos(mk[0] && mk[0].pos)
      if (txt(r.primary_pos) && p0 && npos(r.primary_pos) !== p0) {
        reasons.push(`primary_pos(${r.primary_pos}) 와 첫 갈래 pos(${mk[0].pos}) 가 다르다`); stats.pos_mismatch++
      }
      const gap = (r.pos_set || []).map(npos).filter((p) => p && !sensePos.includes(p))
      if (gap.length && sensePos.length) {
        reasons.push(`pos_set 의 ${gap.join('·')} 뜻이 갈래에 하나도 없다`); stats.pos_gap++
      }
      if (!reasons.length) continue
      const tags = r.list_tags || []
      targets.push({
        word: r.word,
        primary_pos: r.primary_pos || r.pos || null,
        pos_set: r.pos_set || [],
        meaning_ko: txt(r.meaning_ko),
        example_en: txt(r.example_en) || null,
        cefr: r.cefr_level, v: r.v_level, rank: r.frequency_rank,
        exam: tags.some((t) => EXAM_TAGS.includes(t)),
        why: reasons,
        // 예문은 **보여 주지 않는다** — 옮기는 일은 apply 가 한다. 있는지 여부만 알려 준다.
        senses: mk.map((m, i) => ({
          idx: i,
          pos: txt(m && m.pos) || null,
          meaning: txt(m && m.meaning),
          v_level: (m && m.v_level) ?? null,
          has_example: !!txt(m && m.example),
        })),
      })
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
  targets.sort((a, b) => (Number(b.exam) - Number(a.exam)) ||
    ((a.rank == null ? 1e9 : a.rank) - (b.rank == null ? 1e9 : b.rank)) || a.word.localeCompare(b.word))
  const n = writeChunks(DIR, targets, SIZE)
  console.log(`대상 ${targets.length} 낱말 · 청크 ${n} (size ${SIZE}) -> ${DIR}/chunk-NN.json`)
  console.log('신호별(중복 포함):', JSON.stringify(stats))
  console.log(`시험 밴드 ${targets.filter((t) => t.exam).length}`)
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
      .select('word, meanings_ko, field_provenance').in('word', words.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const d of data) cur.set(d.word.toLowerCase(), d)
  }

  const rej = {
    no_row: 0, already: 0, no_senses: 0, bad_from: 0, dup_from: 0,
    example_lost: 0, orphan: 0, empty_meaning: 0, unchanged: 0,
  }
  const act = { split: 0, merged: 0, reordered: 0 }
  const flagged = []
  const inherited = { moved: 0, skipped: 0 }
  let updated = 0, fail = 0, exBefore = 0, exAfter = 0

  for (const r of rows) {
    const w = key(r.word)
    if (txt(r.note)) flagged.push({ word: w, note: txt(r.note) })
    const row = cur.get(w)
    if (!row) { rej.no_row++; continue }
    const prov = { ...(row.field_provenance || {}) }
    if (txt(prov[STAMP])) { rej.already++; continue }

    const orig = Array.isArray(row.meanings_ko) ? row.meanings_ko : []
    const out = Array.isArray(r.senses) ? r.senses : []
    if (!orig.length || !out.length) { rej.no_senses++; continue }

    // --- 게이트 ---
    const used = new Set()
    let bad = null
    for (const s of out) {
      if (!txt(s && s.meaning)) { bad = 'empty_meaning'; break }
      const f = s.from
      if (f === null || f === undefined) continue
      if (!Number.isInteger(f) || f < 0 || f >= orig.length) { bad = 'bad_from'; break }
      if (used.has(f)) { bad = 'dup_from'; break }
      used.add(f)
    }
    if (bad) { rej[bad]++; continue }

    const dropList = (Array.isArray(r.dropped) ? r.dropped : [])
      .filter((d) => d && Number.isInteger(d.idx) && txt(d.reason))
    const dropped = new Set(dropList.map((d) => d.idx))
    // 병합으로 버리는 것은 `merged_into` 로 어느 갈래에 합쳤는지 밝혀야 한다.
    const mergedAway = new Set(dropList.filter((d) => Number.isInteger(d.merged_into)).map((d) => d.idx))

    // 예문이 달린 원본 갈래는 **옮겨지거나, 병합처를 밝히고** 버려져야 한다.
    // 이 규칙이 T2·T5 가 채운 예문을 지킨다 — 사유 없는 소실은 거부한다.
    let lost = false
    for (let i = 0; i < orig.length; i++) {
      if (txt(orig[i] && orig[i].example) && !used.has(i) && !mergedAway.has(i)) { lost = true; break }
    }
    if (lost) { rej.example_lost++; continue }
    let orphan = false
    for (let i = 0; i < orig.length; i++) if (!used.has(i) && !dropped.has(i)) { orphan = true; break }
    if (orphan) { rej.orphan++; continue }

    // --- 새 배열 만들기: 예문은 코드가 옮긴다 ---
    const next = out.map((s) => {
      const src = (s.from === null || s.from === undefined) ? null : orig[s.from]
      const el = { ...(src || {}) }
      el.pos = txt(s.pos) || (src && src.pos) || null
      el.meaning = txt(s.meaning)
      if (s.v_level !== undefined && s.v_level !== null) el.v_level = s.v_level
      else if (src && src.v_level != null) el.v_level = src.v_level
      if (!src) { delete el.example; delete el.example_ko }
      return el
    })

    // 병합으로 버리는 갈래에 예문이 있는데 **합치는 쪽이 비어 있으면 물려받는다.**
    // 안 그러면 T2 가 쓴 예문이 그냥 사라진다 — 같은 뜻이라 합치는 것이니 예문도 그 뜻의 것이다.
    for (const d of dropList) {
      if (!Number.isInteger(d.merged_into)) continue
      const src = orig[d.idx]
      const dst = next[d.merged_into]
      if (!src || !dst) continue
      if (!txt(src.example)) continue
      if (txt(dst.example)) { inherited.skipped++; continue } // 받는 쪽에 이미 있으면 둔다
      dst.example = src.example
      if (txt(src.example_ko)) dst.example_ko = src.example_ko
      inherited.moved++
    }

    const before = JSON.stringify(orig.map((e) => [txt(e.pos), txt(e.meaning)]))
    const after = JSON.stringify(next.map((e) => [txt(e.pos), txt(e.meaning)]))
    if (before === after) {
      // 갈래를 안 바꿔도 **물어봤다는 도장은 찍는다.** 안 찍으면 다음 chunk 가 이 낱말을
      // 영원히 다시 물어 배치가 끝나지 않는다. meanings_ko 는 건드리지 않는다.
      rej.unchanged++
      if (COMMIT) {
        const { error } = await db.from('shared_dictionary')
          .update({ field_provenance: { ...prov, [STAMP]: 'unchanged:d0830-t6' } }).eq('word', row.word)
        if (error) fail++
      }
      continue
    }

    if (next.length > orig.length) act.split++
    else if (next.length < orig.length) act.merged++
    else act.reordered++

    exBefore += orig.filter((e) => txt(e.example)).length
    exAfter += next.filter((e) => txt(e.example)).length

    prov[STAMP] = 'restructured:d0830-t6'
    prov[BEFORE] = orig
    if (!COMMIT) { updated++; continue }
    const { error } = await db.from('shared_dictionary')
      .update({ meanings_ko: next, field_provenance: prov }).eq('word', row.word)
    if (error) { fail++; if (fail < 5) console.warn('fail', w, error.message) } else updated++
    if (updated % 200 === 0) console.log(`  ...${updated}`)
  }

  console.log(`\n${COMMIT ? '적용' : '드라이런'} — 낱말 ${updated} · 실패 ${fail}`)
  console.log(`갈래 변화: 쪼갬 ${act.split} · 합침 ${act.merged} · 순서·표현만 ${act.reordered}`)
  console.log(`예문 보존: 변경 전 ${exBefore} → 후 ${exAfter} ${exBefore === exAfter ? '(전부 보존)' : '— 차이는 중복 갈래 병합분'}`)
  console.log(`병합 시 예문 물려받음 ${inherited.moved} · 받는 쪽에 이미 있어 둠 ${inherited.skipped}`)
  console.log('거부:', JSON.stringify(rej))
  if (flagged.length) {
    fs.writeFileSync(path.join(DIR, 'FLAGGED.json'), JSON.stringify(flagged, null, 1))
    console.log(`부수 발견 ${flagged.length}건 -> ${DIR}/FLAGGED.json`)
  }
}
