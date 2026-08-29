// scripts/dict/w0830-corefill.mjs
// D0830-T3 — **수능·EBS·교육과정 밴드**의 빈 칸을 한 번에 채운다. Claude Code 배치(3단).
//
// 대상 정의가 이 배치의 전부다:
//   `list_tags` 에 시험/교육과정 목록이 붙은 6,932 낱말. 이게 시중 어휘 교재가 다루는 바로 그 집합이고,
//   학습자가 돈을 내는 이유다. 전수 48,962 를 고르게 채우는 것보다 이 6,932 를 **끝까지** 채우는 것이
//   교재 대비 우위를 만든다 — 교재는 이 범위를 100% 채우고 나오기 때문이다.
//
// 실측 결손 (2026-08-30):
//   유의어 없음 2,719 · 반의어 없음 2,876 · 연어 없음 357 · 학습자 노트 없음 379.
//
// 게이트 (apply 가 거부하는 것):
//   · 유의어·반의어는 **shared_dictionary 에 등재된 낱말만** — 없는 낱말을 넣으면 학습자가 눌러도
//     아무것도 안 뜬다(w0815-synant 이 같은 이유로 같은 규칙을 쓴다).
//   · 표제어 자신·중복·대문자 시작(고유명사)·구두점 금지. 유의어는 1~2낱말.
//   · 연어는 2~5낱말이고 표제어(굴절형 허용)를 포함해야 한다.
//   · 노트는 20~200자 한국어이고 표제어의 영문 철자를 담아야 한다(일반론 방지).
//
// 재실행 안전: chunk 는 이미 채워진 필드를 빼고 굽는다. apply 는 빈 값을 쓰지 않고 건너뛴 수를 출력한다.
//
// 실행: node scripts/dict/w0830-corefill.mjs chunk [--dir D] [--size 30]
//       node scripts/dict/w0830-corefill.mjs apply [--dir D] [--commit]
//       node scripts/dict/w0830-corefill.mjs status [--dir D]
import fs from 'node:fs'
import path from 'node:path'
import { db, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0830-corefill')
const SIZE = parseInt(arg('--size', '30'), 10)
const COMMIT = process.argv.includes('--commit')

const EXAM_TAGS = ['kice-csat-13y', 'ebs-voca-1306', 'kcurr2022_0', 'kcurr2022_1', 'kcurr2022_2',
  'csat-prep-core-2k', 'kice-csat-core-4y', 'csat-prep-ext-1.8k']

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
    forms.push(t.length > 5 ? t.slice(0, t.length - 2) : t, ...(IRREGULAR[t] || []))
    if (/y$/.test(t)) forms.push(t.slice(0, -1) + 'i')
    if (/fe?$/.test(t)) forms.push(t.replace(/fe?$/, 'v'))
    if (/e$/.test(t)) forms.push(t.slice(0, -1))
    if (/[^aeiou][aeiou][bdgklmnprt]$/.test(t)) forms.push(t + t.slice(-1))
  }
  return forms.some((f) => new RegExp(`(?<!\\p{L})${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu').test(phrase))
}

const txt = (v) => (v ?? '').toString().trim()
const hasKo = (s) => /[가-힣]/.test(s)
const empty = (a) => !Array.isArray(a) || a.length === 0

if (MODE === 'chunk') {
  const targets = []
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, pos, primary_pos, pos_set, meaning_ko, meanings_ko, example_en, synonyms, antonyms, collocations, korean_learner_note, cefr_level, v_level, frequency_rank, list_tags, register, word_register')
      .gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      const tags = r.list_tags || []
      if (!tags.some((t) => EXAM_TAGS.includes(t))) continue
      const need = []
      if (empty(r.synonyms)) need.push('synonyms')
      if (empty(r.antonyms)) need.push('antonyms')
      if (empty(r.collocations)) need.push('collocations')
      if (!txt(r.korean_learner_note)) need.push('korean_learner_note')
      if (!need.length) continue
      const mk = Array.isArray(r.meanings_ko) ? r.meanings_ko : []
      targets.push({
        word: r.word, pos: r.primary_pos || r.pos || null, pos_set: r.pos_set || [],
        meaning_ko: txt(r.meaning_ko),
        senses: mk.map((m) => txt(m && m.meaning)).filter(Boolean).slice(0, 6),
        example_en: txt(r.example_en) || null,
        cefr: r.cefr_level, v: r.v_level, rank: r.frequency_rank,
        register: r.word_register || r.register || null,
        exam_tags: tags.filter((t) => EXAM_TAGS.includes(t)),
        have: {
          synonyms: r.synonyms || [], antonyms: r.antonyms || [],
          collocations: r.collocations || [], note: txt(r.korean_learner_note) || null,
        },
        need,
      })
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
  targets.sort((a, b) => ((a.rank == null ? 1e9 : a.rank) - (b.rank == null ? 1e9 : b.rank)) || a.word.localeCompare(b.word))
  const byNeed = {}
  for (const t of targets) for (const n of t.need) byNeed[n] = (byNeed[n] || 0) + 1
  const n = writeChunks(DIR, targets, SIZE)
  console.log(`대상 ${targets.length} 낱말 · 청크 ${n} (size ${SIZE}) -> ${DIR}/chunk-NN.json`)
  console.log('필드별 결손:', JSON.stringify(byNeed))
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

  // 유의어·반의어 후보가 사전에 등재돼 있는지 — 한 번에 조회한다.
  const cand = new Set()
  for (const r of rows) for (const k of ['synonyms', 'antonyms']) {
    for (const x of (Array.isArray(r[k]) ? r[k] : [])) { const s = txt(x).toLowerCase(); if (s) cand.add(s) }
  }
  const known = new Set()
  const candArr = [...cand]
  for (let i = 0; i < candArr.length; i += 300) {
    const { data, error } = await db.from('shared_dictionary').select('word').in('word', candArr.slice(i, i + 300))
    if (error) throw new Error(error.message)
    for (const d of data) known.add(d.word.toLowerCase())
  }
  console.log(`유의·반의 후보 ${cand.size} 중 사전 등재 ${known.size}`)

  const words = [...new Set(rows.map((r) => txt(r.word).toLowerCase()).filter(Boolean))]
  const cur = new Map()
  for (let i = 0; i < words.length; i += 200) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, synonyms, antonyms, collocations, korean_learner_note').in('word', words.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const d of data) cur.set(d.word.toLowerCase(), d)
  }

  const rej = { no_row: 0, unknown_word: 0, self: 0, dup: 0, bad_shape: 0, too_long: 0, no_headword: 0, note_short: 0, note_no_ko: 0, note_no_word: 0 }
  const wrote = { synonyms: 0, antonyms: 0, collocations: 0, korean_learner_note: 0 }
  const flagged = []
  let updated = 0, fail = 0

  const cleanRel = (arr, w) => {
    const out = []
    for (const x of (Array.isArray(arr) ? arr : [])) {
      const s = txt(x).toLowerCase()
      if (!s) continue
      if (!/^[a-z][a-z' -]*$/.test(s)) { rej.bad_shape++; continue }
      if (s.split(/\s+/).length > 2) { rej.too_long++; continue }
      if (s === w) { rej.self++; continue }
      if (out.includes(s)) { rej.dup++; continue }
      if (!known.has(s)) { rej.unknown_word++; continue }
      out.push(s)
    }
    return out.slice(0, 5)
  }

  for (const r of rows) {
    const w = txt(r.word).toLowerCase()
    const row = cur.get(w)
    if (!row) { rej.no_row++; continue }
    if (txt(r.note)) flagged.push({ word: w, note: txt(r.note) })
    const patch = {}

    if (empty(row.synonyms)) { const v = cleanRel(r.synonyms, w); if (v.length) patch.synonyms = v }
    if (empty(row.antonyms)) { const v = cleanRel(r.antonyms, w); if (v.length) patch.antonyms = v }
    if (empty(row.collocations)) {
      const out = []
      for (const x of (Array.isArray(r.collocations) ? r.collocations : [])) {
        const s = txt(x).toLowerCase().replace(/[‘’]/g, "'")
        if (!s) continue
        if (!/^[a-z][a-z' -]*$/.test(s)) { rej.bad_shape++; continue }
        const n = s.split(/\s+/).length
        if (n < 2 || n > 5) { rej.too_long++; continue }
        if (!containsWord(s, w)) { rej.no_headword++; continue }
        if (out.includes(s)) { rej.dup++; continue }
        out.push(s)
      }
      if (out.length) patch.collocations = out.slice(0, 5)
    }
    if (!txt(row.korean_learner_note)) {
      const nt = txt(r.korean_learner_note)
      if (nt) {
        if (nt.length < 20) rej.note_short++
        else if (nt.length > 220) rej.too_long++
        else if (!hasKo(nt)) rej.note_no_ko++
        else if (!nt.toLowerCase().includes(w.split(/\s+/)[0])) rej.note_no_word++
        else patch.korean_learner_note = nt
      }
    }

    if (!Object.keys(patch).length) continue
    for (const k of Object.keys(patch)) wrote[k]++
    if (!COMMIT) { updated++; continue }
    const { error } = await db.from('shared_dictionary').update(patch).eq('word', row.word)
    if (error) { fail++; if (fail < 5) console.warn('fail', w, error.message) } else updated++
    if (updated % 500 === 0) console.log(`  ...${updated}`)
  }

  console.log(`\n${COMMIT ? '적용' : '드라이런'} — 낱말 ${updated} · 실패 ${fail}`)
  console.log('필드별 기록:', JSON.stringify(wrote))
  console.log('거부:', JSON.stringify(rej))
  if (flagged.length) {
    fs.writeFileSync(path.join(DIR, 'FLAGGED.json'), JSON.stringify(flagged, null, 1))
    console.log(`부수 발견 ${flagged.length}건 -> ${DIR}/FLAGGED.json`)
  }
}
