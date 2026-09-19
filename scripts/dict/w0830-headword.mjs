// scripts/dict/w0830-headword.mjs
// D0830-T7 — **표제어 판정**. 예문·갈래·연어로는 못 고치는 자리를 가린다.
//   ⚠️ **이 배치는 아무것도 지우지 않는다.** 판정만 하고 `field_provenance.t7_headword` 에 남긴다.
//
// 왜 판정만 하나:
//   표제어를 지우면 `field_provenance` 에 남길 자리조차 없어진다 — **되돌릴 근거가 사라진다.**
//   그리고 이 낱말들은 이미 **발행 단어장에 실려 있어서**(실측 160개 / 발행 세트 1,331개),
//   지우는 순간 학습자 화면의 단어장에 구멍이 난다. 그건 사람이 정할 일이다.
//   이 배치는 **무엇이 진짜 결함인지**만 확정한다.
//
// 무엇을 가리나 (앞 배치들이 "예문으로는 못 고친다" 며 넘긴 것):
//   - 오철자 표제어 — `epicopal`(episcopal) · `clich`(cliché) · `beseige` · `miniscule` · `nickle`
//   - 관용구·합성어 조각 — `nilly`(willy-nilly) · `pocus`(hocus-pocus) · `topsy`/`turvy` · `bona`(bona fide)
//   - 라틴·프랑스어 조각 — `casus` · `mutandis` · `infinitum` · `laissez` · `qui` · `vous`
//   - 굴절형이 표제어 — `marched` · `slagged` · `smelted` · `beefed`
//   - OCR 오독 — `eduldamer` · `peles`
//   - **중립 예문이 존재할 수 없는 것** — `klux` (인종차별 단체명 조각)
//
// 모집단: FLAGGED 노트에서 **`표제어` 가 결함 서술과 같은 절 안에 있을 때만** 뽑았다.
//   느슨한 패턴으로 뽑았더니 `acclaim`·`agency`·`apply` 같은 멀쩡한 낱말이 섞였다 —
//   자유 서술 마이닝은 이 회차에서 두 번 실패했다. 그래서 **오탐 판정을 산출물에 넣게 했다.**
//
// 재실행 안전: chunk 는 `field_provenance.t7_headword` 가 찍힌 낱말을 건너뛴다.
//
// 실행: node scripts/dict/w0830-headword.mjs chunk [--dir D] [--size 20]
//       node scripts/dict/w0830-headword.mjs apply [--dir D] [--commit]
//       node scripts/dict/w0830-headword.mjs status [--dir D]
//       node scripts/dict/w0830-headword.mjs report [--dir D]   ← 제거 제안서(승인용)
import fs from 'node:fs'
import path from 'node:path'
import { db, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0830-headword')
const SIZE = parseInt(arg('--size', '20'), 10)
const COMMIT = process.argv.includes('--commit')
const CAND = arg('--cand', 'scripts/dict/w0830-review/T7-CANDIDATES.json')

const STAMP = 't7_headword'
const VERDICTS = ['ok', 'misspelling', 'fragment', 'foreign', 'inflection', 'ocr', 'unusable']

const txt = (v) => (v ?? '').toString().trim()
const key = (s) => txt(s).toLowerCase()

if (MODE === 'chunk') {
  const cand = JSON.parse(fs.readFileSync(CAND, 'utf8'))
  const noteOf = new Map(cand.map((c) => [key(c.word), c.notes || []]))
  const words = [...noteOf.keys()]
  const targets = []
  const skip = { stamped: 0, no_row: 0 }
  for (let i = 0; i < words.length; i += 200) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, primary_pos, pos, pos_set, meaning_ko, meanings_ko, example_en, word_register, cefr_level, v_level, frequency_rank, list_tags, field_provenance')
      .in('word', words.slice(i, i + 200))
    if (error) { console.error(error.message); process.exit(1) }
    for (const r of data) {
      if (txt((r.field_provenance || {})[STAMP])) { skip.stamped++; continue }
      const mk = Array.isArray(r.meanings_ko) ? r.meanings_ko : []
      targets.push({
        word: r.word,
        pos: r.primary_pos || r.pos || null,
        meaning_ko: txt(r.meaning_ko),
        register: r.word_register || 'standard',
        cefr: r.cefr_level, v: r.v_level, rank: r.frequency_rank,
        example_en: txt(r.example_en) || null,
        senses: mk.map((m) => ({ pos: txt(m && m.pos) || null, meaning: txt(m && m.meaning) })).filter((m) => m.meaning).slice(0, 6),
        why: noteOf.get(key(r.word)) || [],
      })
    }
  }
  skip.no_row = words.length - targets.length - skip.stamped
  targets.sort((a, b) => a.word.localeCompare(b.word))
  const n = writeChunks(DIR, targets, SIZE)
  console.log(`후보 ${words.length} → 대상 ${targets.length} 낱말 · 청크 ${n} (size ${SIZE}) -> ${DIR}/chunk-NN.json`)
  console.log('건너뜀:', JSON.stringify(skip))
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
      .select('word, field_provenance').in('word', words.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const d of data) cur.set(d.word.toLowerCase(), d)
  }

  const rej = { no_row: 0, already: 0, bad_verdict: 0, no_reason: 0 }
  const tally = {}
  let updated = 0, fail = 0

  for (const r of rows) {
    const w = key(r.word)
    const row = cur.get(w)
    if (!row) { rej.no_row++; continue }
    const prov = { ...(row.field_provenance || {}) }
    if (txt(prov[STAMP])) { rej.already++; continue }
    const v = key(r.verdict)
    if (!VERDICTS.includes(v)) { rej.bad_verdict++; continue }
    // 'ok' 가 아니면 사유가 있어야 한다 — 사유 없는 결함 판정은 근거가 없다.
    if (v !== 'ok' && !txt(r.reason)) { rej.no_reason++; continue }
    tally[v] = (tally[v] || 0) + 1

    // 판정만 남긴다. 이 배치는 아무 값도 지우거나 바꾸지 않는다.
    prov[STAMP] = v
    if (txt(r.reason)) prov[STAMP + '_reason'] = txt(r.reason)
    if (txt(r.correct)) prov[STAMP + '_correct'] = txt(r.correct)

    if (!COMMIT) { updated++; continue }
    const { error } = await db.from('shared_dictionary')
      .update({ field_provenance: prov }).eq('word', row.word)
    if (error) { fail++; if (fail < 5) console.warn('fail', w, error.message) } else updated++
  }

  console.log(`\n${COMMIT ? '적용' : '드라이런'} — 낱말 ${updated} · 실패 ${fail} (값은 아무것도 안 바꿨다. 판정만 기록)`)
  console.log('판정:', JSON.stringify(tally))
  console.log('거부:', JSON.stringify(rej))
}

if (MODE === 'report') {
  // 승인용 제거 제안서 — **아무것도 실행하지 않는다.** 무엇을 지우게 되는지 세어 보여 준다.
  const { data, error } = await db.from('shared_dictionary')
    .select('word, field_provenance, word_register, v_level')
    .not('field_provenance->>t7_headword', 'is', null)
  if (error) throw new Error(error.message)
  const bad = data.filter((r) => (r.field_provenance || {})[STAMP] !== 'ok')
  const byVerdict = {}
  for (const r of bad) {
    const v = (r.field_provenance || {})[STAMP]
    ;(byVerdict[v] = byVerdict[v] || []).push(r.word)
  }
  console.log(`판정된 낱말 ${data.length} · 결함 ${bad.length} · 오탐(ok) ${data.length - bad.length}`)
  for (const [v, ws] of Object.entries(byVerdict).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n[${v}] ${ws.length}`)
    console.log('  ' + ws.slice(0, 40).join(' '))
  }

  // 학습자에게 실제로 닿는 경로를 센다 — 발행 단어장.
  const words = bad.map((r) => r.word)
  const setIds = new Map()
  for (let i = 0; i < words.length; i += 100) {
    const { data: sw } = await db.from('shared_words').select('word, set_id').in('word', words.slice(i, i + 100))
    for (const r of sw || []) {
      if (!setIds.has(r.set_id)) setIds.set(r.set_id, new Set())
      setIds.get(r.set_id).add(r.word)
    }
  }
  const ids = [...setIds.keys()]
  let pubSets = 0
  const pubWords = new Set()
  for (let i = 0; i < ids.length; i += 200) {
    const { data: st } = await db.from('shared_word_sets').select('id, is_published').in('id', ids.slice(i, i + 200))
    for (const r of st || []) if (r.is_published) { pubSets++; for (const w of setIds.get(r.id)) pubWords.add(w) }
  }
  console.log(`\n=== 학습자 노출 ===`)
  console.log(`결함 표제어가 실린 발행 단어장 ${pubSets}개 · 그 안의 결함 낱말 ${pubWords.size}개`)
  console.log(`\n⚠️ 제거는 이 배치가 하지 않는다. 단어장에서 빼는 것은 학습자 화면의 내용을 지우는 일이라 사람이 정한다.`)
  fs.writeFileSync(path.join(DIR, 'REMOVAL-PROPOSAL.json'),
    JSON.stringify({ generated: new Date().toISOString(), byVerdict, published_sets: pubSets, published_words: [...pubWords].sort() }, null, 1))
  console.log(`제안서 -> ${DIR}/REMOVAL-PROPOSAL.json`)
}
