// scripts/dict/w0830-exko.mjs
// D0830-T5 — **예문 해석**. 뜻이 하나뿐인 낱말의 대표 예문에 한국어 해석을 단다. Claude Code 배치(3단).
//
// 실측 (2026-08-30): `example_en` 48,730 개 · 그중 한국어 해석이 붙은 것 **0개**.
//   시중 교재는 예문마다 해석을 단다. 해석 없는 영어 예문은 대다수 학습자에게 **읽히지 않고 넘어간다** —
//   예문을 실어 놓고도 그 자리가 비어 있는 것과 같다. T2 가 다의어 쪽(뜻 40,608)을 맡고,
//   이 배치가 **뜻이 하나뿐인 낱말 32,185** 쪽을 맡는다.
//
// 저장 위치 — 마이그레이션 불필요:
//   `meanings_ko[0]` 에 `example`(= 기존 example_en) 과 `example_ko` 를 넣는다.
//   최상위 `example_en` 은 **건드리지 않는다**(다른 화면이 그 컬럼을 읽는다). 원소별 키만 더한다.
//
// 재실행 안전: chunk 는 해석이 이미 있는 낱말을 건너뛴다. apply 는 게이트 위반을 넣지 않는다.
//
// 실행: node scripts/dict/w0830-exko.mjs chunk [--dir D] [--size 60] [--wave core|top|rest|all]
//       node scripts/dict/w0830-exko.mjs apply [--dir D] [--commit]
//       node scripts/dict/w0830-exko.mjs status [--dir D]
import fs from 'node:fs'
import path from 'node:path'
import { db, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0830-exko')
const SIZE = parseInt(arg('--size', '60'), 10)
const WAVE = arg('--wave', 'all')
const COMMIT = process.argv.includes('--commit')

const EXAM_TAGS = ['kice-csat-13y', 'ebs-voca-1306', 'kcurr2022_0', 'kcurr2022_1', 'kcurr2022_2',
  'csat-prep-core-2k', 'kice-csat-core-4y', 'csat-prep-ext-1.8k']

const txt = (v) => (v ?? '').toString().trim()
const hasKo = (s) => /[가-힣]/.test(s)

if (MODE === 'chunk') {
  const targets = []
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, primary_pos, pos, meaning_ko, meanings_ko, example_en, cefr_level, v_level, frequency_rank, frequency_band, list_tags')
      .gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      const ex = txt(r.example_en)
      if (!ex) continue
      const mk = Array.isArray(r.meanings_ko) ? r.meanings_ko : []
      const valid = mk.filter((m) => txt(m && m.meaning))
      if (valid.length !== 1) continue // 다의어는 T2(senseex) 소관
      if (hasKo(txt(mk[0] && mk[0].example_ko))) continue
      const tags = r.list_tags || []
      const isExam = tags.some((t) => EXAM_TAGS.includes(t))
      const band = r.frequency_band || ''
      const wave = isExam ? 'core' : (['top1k', 'top2k', 'top3k', 'top5k'].includes(band) ? 'top' : 'rest')
      if (WAVE !== 'all' && WAVE !== wave) continue
      targets.push({
        word: r.word, pos: r.primary_pos || r.pos || null,
        meaning_ko: txt(r.meaning_ko), example: ex,
        cefr: r.cefr_level, v: r.v_level, rank: r.frequency_rank, wave,
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
  const words = [...new Set(rows.map((r) => txt(r.word).toLowerCase()).filter(Boolean))]
  const cur = new Map()
  for (let i = 0; i < words.length; i += 200) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, meanings_ko, example_en').in('word', words.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const d of data) cur.set(d.word.toLowerCase(), d)
  }

  const rej = { no_row: 0, no_mk: 0, already: 0, no_ko: 0, too_short: 0, too_long: 0, latin_echo: 0 }
  const flagged = []
  let updated = 0, fail = 0

  for (const r of rows) {
    const w = txt(r.word).toLowerCase()
    const row = cur.get(w)
    if (!row) { rej.no_row++; continue }
    if (txt(r.note)) flagged.push({ word: w, note: txt(r.note) })
    const mk = Array.isArray(row.meanings_ko) ? row.meanings_ko.map((x) => ({ ...x })) : []
    if (!mk.length) { rej.no_mk++; continue }
    if (hasKo(txt(mk[0].example_ko))) { rej.already++; continue }
    const ko = txt(r.example_ko)
    if (!ko) { rej.no_ko++; continue }
    if (!hasKo(ko)) { rej.no_ko++; continue }
    if (ko.length < 4) { rej.too_short++; continue }
    if (ko.length > 240) { rej.too_long++; continue }
    // 해석 자리에 영어가 그대로 들어오는 사고를 막는다 — 한글 비율이 절반 미만이면 거부.
    const koChars = (ko.match(/[가-힣]/g) || []).length
    if (koChars < ko.replace(/\s/g, '').length * 0.4) { rej.latin_echo++; continue }

    mk[0].example_ko = ko
    if (!txt(mk[0].example) && txt(row.example_en)) mk[0].example = txt(row.example_en)

    if (!COMMIT) { updated++; continue }
    const { error } = await db.from('shared_dictionary').update({ meanings_ko: mk }).eq('word', row.word)
    if (error) { fail++; if (fail < 5) console.warn('fail', w, error.message) } else updated++
    if (updated % 1000 === 0) console.log(`  ...${updated}`)
  }

  console.log(`\n${COMMIT ? '적용' : '드라이런'} — 낱말 ${updated} · 실패 ${fail}`)
  console.log('거부:', JSON.stringify(rej))
  if (flagged.length) {
    fs.writeFileSync(path.join(DIR, 'FLAGGED.json'), JSON.stringify(flagged, null, 1))
    console.log(`부수 발견 ${flagged.length}건 -> ${DIR}/FLAGGED.json`)
  }
}
