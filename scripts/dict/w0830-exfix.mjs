// scripts/dict/w0830-exfix.mjs
// D0830-T6-3 — **예문 교체**. 문장이 아닌 예문·비문·뜻과 어긋난 예문을 바꾼다.
//   `example_en` 을 덮는 **유일한 배치**다. Claude Code 배치(3단).
//
// 무엇을 고치나 (앞 배치들이 낱말을 읽으며 짚은 것):
//   - 문장이 아닌 예문 — `a great deed` · `public library public park` · `straight, no chaser`
//     WordNet 용례를 그대로 들여온 자리다. 학습자에게 보여 줄 문장이 아니다.
//   - 비문·오타 — `I am visiting my mother any moment.` · `the sale of company`
//   - 뜻과 어긋난 예문 — 표제어의 등재된 뜻이 아닌 다른 뜻을 보여 준다
//
// ⚠️ 이 배치의 최대 위험은 **사본 어긋남**이다.
//   T5(exko)가 `example_en` 을 `meanings_ko[0].example` 로 복사하고 그 문장의 해석을
//   `example_ko` 에 달아 놨다. 여기서 `example_en` 만 바꾸면 **뜻 단위 사본은 옛 문장을 그대로 들고,
//   그 해석은 이제 존재하지 않는 문장을 옮긴 것이 된다.** 화면에는 둘 다 나온다.
//
//   그래서 apply 는 **같은 문자열이 있는 모든 자리를 함께 바꾼다.** 한 자리라도 해석 없이
//   남게 되면 그 낱말을 통째로 거부한다(`ko_missing`) — 반쪽만 바꾸느니 안 바꾸는 게 낫다.
//
// 되돌릴 수 있게 바꾼다 — 바꾸기 전 값을 `field_provenance.t6_example_before` 에 남긴다.
//
// 재실행 안전: chunk 는 `field_provenance.t6_example` 이 찍힌 낱말을 건너뛴다.
//   apply 는 게이트 위반을 넣지 않고 건너뛴 수를 출력한다.
//
// 실행: node scripts/dict/w0830-exfix.mjs chunk [--dir D] [--size 15]
//       node scripts/dict/w0830-exfix.mjs apply [--dir D] [--commit]
//       node scripts/dict/w0830-exfix.mjs status [--dir D]
import fs from 'node:fs'
import path from 'node:path'
import { db, writeChunks, readOuts } from './w0815-pubvocab.mjs'
import { irregularOf } from './_irregular.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0830-exfix')
const SIZE = parseInt(arg('--size', '15'), 10)
const COMMIT = process.argv.includes('--commit')
const CAND = arg('--cand', 'scripts/dict/w0830-review/T6-3-CANDIDATES.json')

const EXAM_TAGS = ['kice-csat-13y', 'ebs-voca-1306', 'kcurr2022_0', 'kcurr2022_1', 'kcurr2022_2',
  'csat-prep-core-2k', 'kice-csat-core-4y', 'csat-prep-ext-1.8k']
const STAMP = 't6_example'
const BEFORE = 't6_example_before'

const txt = (v) => (v ?? '').toString().trim()
const key = (s) => txt(s).toLowerCase().replace(/\s+/g, ' ')
const hasKo = (s) => /[가-힣]/.test(s)
const deaccent = (s) => s.normalize('NFD').replace(/\p{M}/gu, '')
const ASCII_OK = /^[ -~‘’“”]+$/

// 표제어(굴절형 허용)가 예문 안에 있어야 한다.
// ⚠️ 불규칙표를 빼먹으면 `wring` 의 `wrung` · `befall` 의 `befell` 이 "표제어 없음" 으로
//    **조용히 버려진다.** 처음 이 매처를 베껴 올 때 표를 안 가져와 실제로 그렇게 됐고,
//    서브에이전트 셋이 각자 그 함정을 만나 문장을 다시 썼다. 이제 `_irregular.mjs` 를 공유한다.
function containsWord(phrase, word) {
  const p = deaccent(phrase)
  const tokens = deaccent(word).toLowerCase().replace(/[^\p{L}\p{N}]/gu, ' ').split(/\s+/).filter((t) => t.length >= 2)
  if (!tokens.length) return true
  const forms = []
  for (const t of tokens) {
    forms.push(t.length > 5 ? t.slice(0, t.length - 2) : t, ...irregularOf(t))
    if (/y$/.test(t)) forms.push(t.slice(0, -1) + 'i')
    if (/e$/.test(t)) forms.push(t.slice(0, -1))
  }
  return forms.some((f) => new RegExp(`(?<!\\p{L})${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu').test(p))
}

// 기계적으로도 셀 수 있는 결함 — 끝맺음 없음 · 소문자 시작 · 너무 짧음.
const mechDefect = (ex) => {
  const e = txt(ex)
  if (!e) return null
  if (!/[.!?]["')\]]?$/.test(e)) return '끝맺음 부호가 없다'
  if (/^[a-z]/.test(e)) return '소문자로 시작한다 (문장이 아닐 수 있다)'
  if (e.split(/\s+/).length < 4) return '4낱말 미만이라 문장이 아니다'
  return null
}

if (MODE === 'chunk') {
  const flagged = new Set(JSON.parse(fs.readFileSync(CAND, 'utf8')).map(key))
  const targets = []
  const stats = { flagged: 0, mech: 0, stamped: 0 }
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, primary_pos, pos, meaning_ko, meanings_ko, example_en, cefr_level, v_level, frequency_rank, list_tags, field_provenance')
      .gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      const prov = r.field_provenance || {}
      if (txt(prov[STAMP])) { stats.stamped++; continue }
      const mk = Array.isArray(r.meanings_ko) ? r.meanings_ko : []
      const why = []
      if (flagged.has(key(r.word))) { why.push('노트에서 예문 문제로 짚힘'); stats.flagged++ }
      const m = mechDefect(r.example_en)
      if (m) { why.push(`example_en: ${m}`); stats.mech++ }
      for (let i = 0; i < mk.length; i++) {
        const mm = mechDefect(mk[i] && mk[i].example)
        if (mm) why.push(`뜻 ${i}: ${mm}`)
      }
      if (!why.length) continue
      const tags = r.list_tags || []
      targets.push({
        word: r.word,
        pos: r.primary_pos || r.pos || null,
        meaning_ko: txt(r.meaning_ko),
        cefr: r.cefr_level, v: r.v_level, rank: r.frequency_rank,
        exam: tags.some((t) => EXAM_TAGS.includes(t)),
        why,
        example_en: txt(r.example_en) || null,
        senses: mk.map((m2, i) => ({
          idx: i,
          pos: txt(m2 && m2.pos) || null,
          meaning: txt(m2 && m2.meaning),
          v_level: (m2 && m2.v_level) ?? null,
          example: txt(m2 && m2.example) || null,
          example_ko: txt(m2 && m2.example_ko) || null,
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
  console.log('신호별(중복 포함):', JSON.stringify(stats), `· 시험 밴드 ${targets.filter((t) => t.exam).length}`)
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

// 예문 게이트 — senseex 와 같은 규칙.
function gateExample(ex, word, rej) {
  const e = txt(ex)
  if (!e) return null
  if (!ASCII_OK.test(deaccent(e))) { rej.non_ascii++; return null }
  const n = e.split(/\s+/).length
  if (n < 4) { rej.too_short++; return null }
  if (n > 22) { rej.too_long++; return null }
  if (!/[.!?]["')\]]?$/.test(e)) { rej.no_end++; return null }
  if (!containsWord(e, word)) { rej.no_headword++; return null }
  return e
}

if (MODE === 'apply') {
  const { files, rows } = readOuts(DIR)
  console.log(`out 파일 ${files} · 낱말 ${rows.length}`)
  const words = [...new Set(rows.map((r) => key(r.word)).filter(Boolean))]
  const cur = new Map()
  for (let i = 0; i < words.length; i += 200) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, meanings_ko, example_en, field_provenance').in('word', words.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const d of data) cur.set(d.word.toLowerCase(), d)
  }

  const rej = {
    no_row: 0, already: 0, non_ascii: 0, too_short: 0, too_long: 0, no_end: 0,
    no_headword: 0, no_ko: 0, same: 0, bad_idx: 0, ko_missing: 0, nothing: 0,
  }
  const flagged = []
  let updated = 0, fail = 0, exFixed = 0, senseFixed = 0, mirrored = 0

  for (const r of rows) {
    const w = key(r.word)
    if (txt(r.note)) flagged.push({ word: w, note: txt(r.note) })
    const row = cur.get(w)
    if (!row) { rej.no_row++; continue }
    const prov = { ...(row.field_provenance || {}) }
    if (txt(prov[STAMP])) { rej.already++; continue }

    const mk = Array.isArray(row.meanings_ko) ? row.meanings_ko.map((x) => ({ ...x })) : []
    const oldTop = txt(row.example_en)
    const before = { example_en: oldTop || null, senses: {} }
    // 바꾼 문자열 → 새 값. 같은 문자열이 있는 다른 자리도 이걸로 함께 바꾼다.
    const replaced = new Map()
    let changed = false

    // 1) 뜻 단위 교체
    for (const s of (Array.isArray(r.senses) ? r.senses : [])) {
      if (!Number.isInteger(s.idx) || s.idx < 0 || s.idx >= mk.length) { rej.bad_idx++; continue }
      const ne = gateExample(s.example, row.word, rej)
      if (!ne) continue
      const nk = txt(s.example_ko)
      if (!hasKo(nk)) { rej.no_ko++; continue }
      const old = txt(mk[s.idx].example)
      if (key(ne) === key(old)) { rej.same++; continue }
      before.senses[s.idx] = { example: old || null, example_ko: txt(mk[s.idx].example_ko) || null }
      if (old) replaced.set(key(old), { example: ne, example_ko: nk })
      mk[s.idx].example = ne
      mk[s.idx].example_ko = nk
      senseFixed++; changed = true
    }

    // 2) 최상위 example_en 교체
    let newTop = null
    if (txt(r.example_en)) {
      const ne = gateExample(r.example_en, row.word, rej)
      if (ne && key(ne) !== key(oldTop)) {
        newTop = ne
        if (oldTop) replaced.set(key(oldTop), { example: ne, example_ko: txt(r.example_en_ko) || null })
        exFixed++; changed = true
      } else if (ne) rej.same++
    }

    if (!changed) {
      // "멀쩡하니 두라" 는 판정이다 — 도장을 찍어야 다음 chunk 가 다시 묻지 않는다.
      // ⚠️ 다만 **제안을 냈는데 게이트가 전부 버린 경우**는 판정이 아니다. 그건 결함이
      //    그대로 남은 것이므로 도장을 찍지 않고 다음 회차가 다시 묻게 둔다.
      const proposed = (Array.isArray(r.senses) && r.senses.some((x) => txt(x && x.example))) || txt(r.example_en)
      rej.nothing++
      if (!proposed && COMMIT) {
        const { error } = await db.from('shared_dictionary')
          .update({ field_provenance: { ...prov, [STAMP]: 'kept:d0830-t6' } }).eq('word', row.word)
        if (error) fail++
      }
      continue
    }

    // 3) ⚠️ 사본 동기화 — 같은 문자열을 들고 있는 **모든 자리**를 함께 바꾼다.
    //    한 자리라도 해석 없이 남으면 낱말을 통째로 거부한다. 반쪽만 바꾸느니 안 바꾸는 게 낫다.
    let koMissing = false
    for (let i = 0; i < mk.length; i++) {
      const cu = txt(mk[i].example)
      if (!cu) continue
      const rep = replaced.get(key(cu))
      if (!rep) continue
      if (!hasKo(txt(rep.example_ko))) { koMissing = true; break }
      before.senses[i] = before.senses[i] || { example: cu, example_ko: txt(mk[i].example_ko) || null }
      mk[i].example = rep.example
      mk[i].example_ko = rep.example_ko
      mirrored++
    }
    if (koMissing) { rej.ko_missing++; continue }

    // 최상위가 옛 문장을 그대로 들고 있으면 함께 바꾼다(뜻 단위만 고친 경우).
    if (!newTop && oldTop && replaced.has(key(oldTop))) newTop = replaced.get(key(oldTop)).example

    const patch = { meanings_ko: mk }
    if (newTop) patch.example_en = newTop
    prov[STAMP] = 'replaced:d0830-t6'
    prov[BEFORE] = before
    patch.field_provenance = prov

    if (!COMMIT) { updated++; continue }
    const { error } = await db.from('shared_dictionary').update(patch).eq('word', row.word)
    if (error) { fail++; if (fail < 5) console.warn('fail', w, error.message) } else updated++
  }

  console.log(`\n${COMMIT ? '적용' : '드라이런'} — 낱말 ${updated} · 실패 ${fail}`)
  console.log(`example_en 교체 ${exFixed} · 뜻 단위 교체 ${senseFixed} · 사본 동기화 ${mirrored}`)
  console.log('거부:', JSON.stringify(rej))
  if (flagged.length) {
    fs.writeFileSync(path.join(DIR, 'FLAGGED.json'), JSON.stringify(flagged, null, 1))
    console.log(`부수 발견 ${flagged.length}건 -> ${DIR}/FLAGGED.json`)
  }
}
