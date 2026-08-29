// scripts/dict/w0830-family.mjs
// D0830-T4 — 어족(word family). `base_word` · `derivation_suffix` 를 채운다. Claude Code 배치(3단).
//
// 왜 필요한가 — 컴포저가 직접 말해 준다:
//   B9 `word-family` 블루프린트는 `undersized_group` 하나로 **4,639 후보를 걸러**
//   299항목짜리 세트로 쪼그라들어 있다(docs/reports/vcb-compose-eval.md). 원인은 단순하다 —
//   `base_word` 가 48,962 중 3,414(7%) 뿐이라 `nation / national / nationality` 를 한 묶음으로
//   묶을 키가 없다. organize.ts 의 `buildFamilyKeys` 주석이 같은 사실을 이미 적어 두었다.
//   시중 "word family 보카" 가 통째로 파는 것이 이 묶음이다.
//
// 규칙으로 다 되지 않는다:
//   `happiness → happy`(y→i), `business → busy`, `depth → deep`, `strength → strong`,
//   `pronunciation → pronounce` 는 문자열 규칙으로 안 잡힌다. 반대로 `address` 는 `ad-` 가
//   접두사처럼 보여도 파생어가 아니다. 그래서 판단이 필요하고, 그 판단이 이 배치다.
//
// 게이트:
//   · `base_word` 는 **사전에 등재된 낱말**이어야 하고 표제어 자신이면 안 된다.
//     (없는 기본형을 넣으면 family 키가 아무 데도 닿지 않는 유령이 된다)
//   · `base_word` 는 표제어보다 길면 안 된다 — 파생은 붙이는 방향이다.
//     (같은 길이는 허용한다 — `anxious → anxiety` 처럼 접미사가 어간을 깎으며 붙는 경우가 있다)
//   · `derivation_suffix` 는 `-` 로 시작하는 소문자 접사이고, 표제어가 그 접사로 끝나야 한다.
//   · 파생어가 아니면 `"skip": true` — 억지 분해가 빈칸보다 나쁘다.
//
// 재실행 안전: chunk 는 이미 채워진 것을 건너뛴다. apply 는 게이트 위반을 넣지 않고 거부 수를 출력한다.
//
// 실행: node scripts/dict/w0830-family.mjs chunk [--dir D] [--size 40] [--wave core|top|all]
//       node scripts/dict/w0830-family.mjs apply [--dir D] [--commit]
//       node scripts/dict/w0830-family.mjs status [--dir D]
import fs from 'node:fs'
import path from 'node:path'
import { db, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0830-family')
const SIZE = parseInt(arg('--size', '40'), 10)
const WAVE = arg('--wave', 'all')
const COMMIT = process.argv.includes('--commit')

const EXAM_TAGS = ['kice-csat-13y', 'ebs-voca-1306', 'kcurr2022_0', 'kcurr2022_1', 'kcurr2022_2',
  'csat-prep-core-2k', 'kice-csat-core-4y', 'csat-prep-ext-1.8k']

// 파생 낌새가 있는 꼬리 — 여기 걸리지 않는 낱말은 애초에 물어볼 것이 없다(토큰 낭비 방지).
const SUFFIX_HINTS = [
  'tion', 'sion', 'ment', 'ness', 'ity', 'ety', 'ance', 'ence', 'ancy', 'ency', 'ship', 'hood',
  'dom', 'ism', 'ist', 'ian', 'ial', 'ical', 'ic', 'al', 'ous', 'ious', 'ful', 'less', 'able',
  'ible', 'ive', 'ary', 'ory', 'ish', 'like', 'ly', 'y', 'er', 'or', 'ee', 'ize', 'ise', 'ify',
  'en', 'ate', 'age', 'ure', 'th', 'ward', 'wise',
]

const txt = (v) => (v ?? '').toString().trim()

if (MODE === 'chunk') {
  const targets = []
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, primary_pos, pos, meaning_ko, base_word, derivation_suffix, derived_forms, cefr_level, v_level, frequency_rank, frequency_band, list_tags')
      .gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      if (txt(r.base_word) || txt(r.derivation_suffix)) continue
      const w = r.word.toLowerCase()
      if (w.includes(' ') || w.includes('-')) continue // 구·복합어는 다른 축이다
      if (w.length < 5) continue                       // 4자 이하는 파생형이 거의 없다
      if (!SUFFIX_HINTS.some((s) => w.endsWith(s))) continue
      const tags = r.list_tags || []
      const isExam = tags.some((t) => EXAM_TAGS.includes(t))
      const band = r.frequency_band || ''
      const wave = isExam ? 'core' : (['top1k', 'top2k', 'top3k', 'top5k', 'top10k'].includes(band) ? 'top' : 'rest')
      if (WAVE !== 'all' && WAVE !== wave) continue
      targets.push({
        word: r.word, pos: r.primary_pos || r.pos || null, meaning_ko: txt(r.meaning_ko),
        cefr: r.cefr_level, v: r.v_level, rank: r.frequency_rank, band, wave,
        known_derived: (r.derived_forms || []).slice(0, 6),
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

  // 선언된 기본형이 사전에 실재하는가 — 유령 키를 만들지 않기 위한 대조.
  // 동시에 **그 기본형이 다시 파생어인지**도 본다. DB 트리거 `enforce_base_word_depth1` 이
  // `leadership → leader` 를 거부한다(leader 자신이 lead 의 파생어라서). 미리 걸러 두지 않으면
  // apply 가 예외를 맞고 그 행만 조용히 빠진다 — 실측 18건이 그렇게 사라졌다.
  const bases = new Set()
  for (const r of rows) { const b = txt(r.base_word).toLowerCase(); if (b) bases.add(b) }
  const known = new Set()
  const derivedBase = new Set()
  const arr = [...bases]
  for (let i = 0; i < arr.length; i += 300) {
    const { data, error } = await db.from('shared_dictionary').select('word, base_word').in('word', arr.slice(i, i + 300))
    if (error) throw new Error(error.message)
    for (const d of data) {
      known.add(d.word.toLowerCase())
      if (txt(d.base_word)) derivedBase.add(d.word.toLowerCase())
    }
  }
  console.log(`선언된 기본형 ${bases.size} 중 사전 등재 ${known.size} · 그중 자신도 파생어 ${derivedBase.size}`)

  const words = [...new Set(rows.map((r) => txt(r.word).toLowerCase()).filter(Boolean))]
  const cur = new Map()
  for (let i = 0; i < words.length; i += 200) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, base_word, derivation_suffix').in('word', words.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const d of data) cur.set(d.word.toLowerCase(), d)
  }

  const rej = { no_row: 0, already: 0, skipped: 0, base_unknown: 0, base_self: 0, base_longer: 0, base_derived: 0, suffix_shape: 0, suffix_mismatch: 0, nothing: 0 }
  let updated = 0, fail = 0
  const flagged = []

  for (const r of rows) {
    const w = txt(r.word).toLowerCase()
    const row = cur.get(w)
    if (!row) { rej.no_row++; continue }
    if (txt(row.base_word) || txt(row.derivation_suffix)) { rej.already++; continue }
    if (txt(r.note)) flagged.push({ word: w, note: txt(r.note) })
    if (r.skip === true) { rej.skipped++; continue }

    const patch = {}
    const b = txt(r.base_word).toLowerCase()
    if (b) {
      if (b === w) rej.base_self++
      else if (b.length > w.length) rej.base_longer++
      else if (!known.has(b)) rej.base_unknown++
      else if (derivedBase.has(b)) rej.base_derived++
      else patch.base_word = b
      // 이번 실행에서 방금 파생어가 된 낱말도 곧바로 "쓸 수 없는 기본형" 이 된다.
      // (`ideology` 를 파생어로 만든 직후 `ideological → ideology` 를 쓰면 트리거가 막는다)
      if (patch.base_word) derivedBase.add(w)
    }
    const sfx = txt(r.derivation_suffix).toLowerCase()
    if (sfx) {
      // 접미사는 6자를 넘을 수 있다 — `-lessness`(8) · `-ification`(10) · `-ologist`(8) 처럼
      // 두 접미사가 겹쳐 붙은 형태가 실재한다. 6자로 잘라 두는 동안 그런 행이 조용히 버려졌다.
      if (!/^-[a-z]{1,10}$/.test(sfx)) rej.suffix_shape++
      else if (!w.endsWith(sfx.slice(1))) rej.suffix_mismatch++
      else patch.derivation_suffix = sfx
    }
    if (!Object.keys(patch).length) { rej.nothing++; continue }
    if (!COMMIT) { updated++; continue }
    const { error } = await db.from('shared_dictionary').update(patch).eq('word', row.word)
    if (error) { fail++; if (fail < 5) console.warn('fail', w, error.message) } else updated++
    if (updated % 500 === 0) console.log(`  ...${updated}`)
  }

  console.log(`\n${COMMIT ? '적용' : '드라이런'} — 낱말 ${updated} · 실패 ${fail}`)
  console.log('거부:', JSON.stringify(rej))
  if (flagged.length) {
    fs.writeFileSync(path.join(DIR, 'FLAGGED.json'), JSON.stringify(flagged, null, 1))
    console.log(`부수 발견 ${flagged.length}건 -> ${DIR}/FLAGGED.json`)
  }
}

// 역방향 채움 — base_word 로부터 `derived_forms` 를 되짚어 넣는다. LLM 불필요(순수 집계).
// family 그룹은 base 쪽에서도 보여야 `nation` 카드가 자기 계열을 안다.
if (MODE === 'backfill') {
  const byBase = new Map()
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, base_word, derived_forms').gt('word', cursor).order('word').limit(1000)
    if (error) throw new Error(error.message)
    if (!data.length) break
    for (const r of data) {
      const b = txt(r.base_word).toLowerCase()
      if (!b) continue
      const arr = byBase.get(b) || []
      arr.push(r.word.toLowerCase())
      byBase.set(b, arr)
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
  console.log(`기본형 ${byBase.size} 개가 파생형을 거느린다`)
  let updated = 0, skipped = 0
  for (const [base, kids] of byBase) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, derived_forms').eq('word', base).maybeSingle()
    if (error || !data) { skipped++; continue }
    const have = new Set((data.derived_forms || []).map((x) => String(x).toLowerCase()))
    const next = [...have]
    for (const k of kids) if (!have.has(k)) next.push(k)
    if (next.length === have.size) { skipped++; continue }
    if (!COMMIT) { updated++; continue }
    const { error: e2 } = await db.from('shared_dictionary').update({ derived_forms: next.sort() }).eq('word', data.word)
    if (e2) skipped++; else updated++
  }
  console.log(`${COMMIT ? '적용' : '드라이런'} — 기본형 ${updated} 갱신 · 변화 없음/실패 ${skipped}`)
}
