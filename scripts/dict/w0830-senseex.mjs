// scripts/dict/w0830-senseex.mjs
// D0830-T2 — 다의어 **뜻마다 예문 + 한국어 해석**. Claude Code 배치(3단: chunk → 서브에이전트 → apply).
//
// 무엇이 비어 있었나 (2026-08-30 실측):
//   meanings_ko 가 2뜻 이상인 낱말 15,843 개 · 그 안의 뜻 40,608 개.
//   그중 예문이 붙은 뜻은 9,645 개(23.8%)뿐이고, **한국어 해석은 0개**다.
//   10,732 낱말은 어느 뜻에도 예문이 없다.
//
// 왜 이게 시중 교재 대비 결정적인가:
//   다의어 교재("한 단어 여러 뜻")의 본체는 뜻 목록이 아니라 **뜻을 갈라 주는 문장**이다.
//   will = 의지 / 유언장 을 나란히 적어 두면 외워지지 않는다. 그 뜻으로만 읽히는 문장이 붙어야
//   변별이 생긴다. 그리고 국내 교재는 예문마다 해석을 단다 — 우리는 예문 48,730 개 중
//   해석이 **한 건도 없다**. 학습자가 예문을 건너뛰는 이유가 그것이다.
//
// 저장 위치 — 마이그레이션 불필요:
//   meanings_ko 는 jsonb 배열이고 각 원소는 {pos, meaning, v_level, example?} 다.
//   여기에 example · example_ko 키를 더한다. **통째로 덮지 않고 원소별로 키만 더한다** —
//   덮으면 meaning·v_level 이 날아간다(CLAUDE.md 의 jsonb 규칙).
//
// 재실행 안전: chunk 는 **이미 채워진 뜻을 빼고** 굽는다. apply 는 빈 값·게이트 위반을 넣지 않고
//   건너뛴 수를 출력한다. 몇 번 돌려도 결과가 같다.
//
// 실행: node scripts/dict/w0830-senseex.mjs chunk [--dir D] [--size 25] [--wave core|top|rest|all]
//       node scripts/dict/w0830-senseex.mjs apply [--dir D] [--commit]
//       node scripts/dict/w0830-senseex.mjs status [--dir D]
import fs from 'node:fs'
import path from 'node:path'
import { db, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0830-senseex')
const SIZE = parseInt(arg('--size', '25'), 10)
const WAVE = arg('--wave', 'all')
const COMMIT = process.argv.includes('--commit')

const EXAM_TAGS = ['kice-csat-13y', 'ebs-voca-1306', 'kcurr2022_0', 'kcurr2022_1', 'kcurr2022_2',
  'csat-prep-core-2k', 'kice-csat-core-4y', 'csat-prep-ext-1.8k']

// 표제어 포함 판정 — w0817-colloc 의 매처와 같은 규칙.
const IRREGULAR = {
  be: ['was', 'were', 'been', 'is', 'are', 'am'], begin: ['began', 'begun'], break: ['broke', 'broken'],
  bring: ['brought'], buy: ['bought'], catch: ['caught'], come: ['came'], do: ['did', 'does', 'done'],
  draw: ['drew', 'drawn'], drive: ['drove', 'driven'], eat: ['ate', 'eaten'], fall: ['fell', 'fallen'],
  feel: ['felt'], fight: ['fought'], find: ['found'], fly: ['flew', 'flown'], get: ['got', 'gotten'],
  give: ['gave', 'given'], go: ['went', 'gone', 'goes'], grow: ['grew', 'grown'], hang: ['hung'],
  have: ['had', 'has'], hear: ['heard'], hold: ['held'], keep: ['kept'], know: ['knew', 'known'],
  lay: ['laid'], lead: ['led'], leave: ['left'], lose: ['lost'], make: ['made'], mean: ['meant'],
  meet: ['met'], pay: ['paid'], rise: ['rose', 'risen'], run: ['ran'], say: ['said', 'says'],
  see: ['saw', 'seen'], sell: ['sold'], send: ['sent'], sit: ['sat'], speak: ['spoke', 'spoken'],
  stand: ['stood'], take: ['took', 'taken'], teach: ['taught'], tell: ['told'], think: ['thought'],
  throw: ['threw', 'thrown'], win: ['won'], write: ['wrote', 'written'], child: ['children'],
  foot: ['feet'], man: ['men'], person: ['people'], tooth: ['teeth'], woman: ['women'], mouse: ['mice'],
  will: ['would'], can: ['could'], shall: ['should'], may: ['might'],
  // 아래 묶음은 w0817-colloc 의 원본 표에 없던 것들이다 — `choose` 의 과거형 `chose` 를 쓴 예문이
  // `no_headword` 로 **조용히 버려지고** 있었다(배치 도중 발견). 없는 불규칙은 오탐이 아니라 손실이다.
  choose: ['chose', 'chosen'], forget: ['forgot', 'forgotten'], sing: ['sang', 'sung'],
  ring: ['rang', 'rung'], wear: ['wore', 'worn'], sleep: ['slept'], spend: ['spent'],
  build: ['built'], understand: ['understood'], hide: ['hid', 'hidden'], shake: ['shook', 'shaken'],
  steal: ['stole', 'stolen'], swim: ['swam', 'swum'], tear: ['tore', 'torn'], wake: ['woke', 'woken'],
  bite: ['bit', 'bitten'], blow: ['blew', 'blown'], freeze: ['froze', 'frozen'], ride: ['rode', 'ridden'],
  shoot: ['shot'], sink: ['sank', 'sunk'], strike: ['struck'], stick: ['stuck'], lend: ['lent'],
  spread: ['spread'], deal: ['dealt'], dig: ['dug'], seek: ['sought'], shine: ['shone'],
  slide: ['slid'], swear: ['swore', 'sworn'], sweep: ['swept'], bend: ['bent'], bind: ['bound'],
  breed: ['bred'], burst: ['burst'], creep: ['crept'], flee: ['fled'], forgive: ['forgave', 'forgiven'],
  grind: ['ground'], kneel: ['knelt'], lie: ['lay', 'lain'], mistake: ['mistook', 'mistaken'],
  arise: ['arose', 'arisen'], awake: ['awoke', 'awoken'], beat: ['beaten'], become: ['became'],
  bleed: ['bled'], feed: ['fed'], hurt: ['hurt'], cost: ['cost'], quit: ['quit'], prove: ['proven'],
  light: ['lit'], lean: ['leant'], leap: ['leapt'], weep: ['wept'], split: ['split'], shrink: ['shrank', 'shrunk'],
  // 합성 동사 — 어간 truncation(5자 초과면 뒤 2자 절단)이 `undertake → undertak` 을 만들어
  // `undertook` 과 안 맞는다. 접두사가 붙은 불규칙은 따로 적어야 한다.
  undertake: ['undertook', 'undertaken'], overcome: ['overcame'], become: ['became'],
  understand: ['understood'], withdraw: ['withdrew', 'withdrawn'], overtake: ['overtook', 'overtaken'],
  forecast: ['forecast'], rebuild: ['rebuilt'], outgrow: ['outgrew', 'outgrown'],
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

const txt = (v) => (v ?? '').toString().trim()
const hasKo = (s) => /[가-힣]/.test(s)
const ASCII_OK = /^[ -~‘’“”]+$/

if (MODE === 'chunk') {
  const targets = []
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, pos, primary_pos, meaning_ko, meanings_ko, example_en, cefr_level, v_level, frequency_rank, frequency_band, list_tags, ipa')
      .gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      const mk = Array.isArray(r.meanings_ko) ? r.meanings_ko : []
      const valid = mk.map((m, i) => ({ m, i })).filter(({ m }) => txt(m && m.meaning))
      if (valid.length < 2) continue
      // 아직 예문 또는 해석이 없는 뜻만 낸다 — 채워진 것은 건너뛴다(재실행 안전).
      const need = valid
        .filter(({ m }) => !txt(m.example) || !hasKo(txt(m.example_ko)))
        .map(({ m, i }) => ({
          idx: i,
          pos: txt(m.pos) || null,
          meaning: txt(m.meaning),
          v_level: m.v_level == null ? null : m.v_level,
          has_example: txt(m.example) || null,
        }))
      if (!need.length) continue
      const tags = r.list_tags || []
      const isExam = tags.some((t) => EXAM_TAGS.includes(t))
      const band = r.frequency_band || ''
      const wave = isExam ? 'core' : (['top1k', 'top2k', 'top3k', 'top5k'].includes(band) ? 'top' : 'rest')
      if (WAVE !== 'all' && WAVE !== wave) continue
      targets.push({
        word: r.word, primary_pos: r.primary_pos || r.pos || null, ipa: r.ipa || null,
        headline_meaning: txt(r.meaning_ko), headline_example: txt(r.example_en) || null,
        cefr: r.cefr_level, v: r.v_level, rank: r.frequency_rank, band, wave,
        exam_tags: tags.filter((t) => EXAM_TAGS.includes(t)),
        senses: need,
      })
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
  const waveRank = { core: 0, top: 1, rest: 2 }
  targets.sort((a, b) =>
    (waveRank[a.wave] - waveRank[b.wave]) ||
    ((a.rank == null ? 1e9 : a.rank) - (b.rank == null ? 1e9 : b.rank)) ||
    a.word.localeCompare(b.word))
  const senses = targets.reduce((s, t) => s + t.senses.length, 0)
  const n = writeChunks(DIR, targets, SIZE)
  const byWave = {}
  for (const t of targets) byWave[t.wave] = (byWave[t.wave] || 0) + 1
  console.log(`대상 낱말 ${targets.length} · 채울 뜻 ${senses} · 청크 ${n} (size ${SIZE}) -> ${DIR}/chunk-NN.json`)
  console.log('웨이브별 낱말:', JSON.stringify(byWave))
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
      .select('word, meanings_ko').in('word', words.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const d of data) cur.set(d.word.toLowerCase(), d)
  }

  const rej = { no_row: 0, bad_idx: 0, no_headword: 0, too_short: 0, too_long: 0, non_ascii: 0, no_ko: 0, ko_leak: 0, dup: 0, empty: 0 }
  const flagged = []
  let wordsWritten = 0, sensesWritten = 0, fail = 0

  for (const r of rows) {
    const w = txt(r.word).toLowerCase()
    const row = cur.get(w)
    if (!row) { rej.no_row++; continue }
    const mk = Array.isArray(row.meanings_ko) ? row.meanings_ko.map((x) => ({ ...x })) : []
    if (!mk.length) { rej.no_row++; continue }
    if (txt(r.note)) flagged.push({ word: w, note: txt(r.note) })
    let touched = 0
    const seen = new Set()
    for (const m of mk) if (txt(m.example)) seen.add(txt(m.example).toLowerCase())
    for (const s of (Array.isArray(r.senses) ? r.senses : [])) {
      const i = Number(s && s.idx)
      if (!Number.isInteger(i) || i < 0 || i >= mk.length) { rej.bad_idx++; continue }
      // ⚠️ 예문이 게이트에 걸려도 **해석은 따로 살린다.** 예문과 해석은 서로 다른 칸이고,
      //   예문 하나가 중복이라는 이유로 그 뜻의 해석까지 버리면 재실행해도 영영 안 채워진다.
      let ex = txt(s.example)
      const ko = txt(s.example_ko)
      if (!ex && !ko) { rej.empty++; continue }
      if (ex) {
        const wc = ex.split(/\s+/).length
        if (!ASCII_OK.test(ex)) { rej.non_ascii++; ex = '' }
        else if (wc < 4) { rej.too_short++; ex = '' }
        else if (wc > 22) { rej.too_long++; ex = '' }
        else if (!containsWord(ex, w)) { rej.no_headword++; ex = '' }
        else if (hasKo(ex)) { rej.ko_leak++; ex = '' }
        else if (seen.has(ex.toLowerCase())) { rej.dup++; ex = '' }
        else seen.add(ex.toLowerCase())
      }
      if (!ex && !ko) continue
      if (ko && !hasKo(ko)) { rej.no_ko++; continue }
      const target = mk[i]
      let changed = false
      if (ex && !txt(target.example)) {
        target.example = ex.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
        changed = true
      }
      if (ko && !hasKo(txt(target.example_ko))) { target.example_ko = ko; changed = true }
      if (changed) { touched++; sensesWritten++ }
    }
    if (!touched) continue
    if (!COMMIT) { wordsWritten++; continue }
    const { error } = await db.from('shared_dictionary').update({ meanings_ko: mk }).eq('word', row.word)
    if (error) { fail++; if (fail < 5) console.warn('fail', w, error.message) } else wordsWritten++
    if (wordsWritten % 500 === 0) console.log(`  ...${wordsWritten}`)
  }

  console.log(`\n${COMMIT ? '적용' : '드라이런'} — 낱말 ${wordsWritten} · 뜻 ${sensesWritten} · 실패 ${fail}`)
  console.log('거부:', JSON.stringify(rej))
  if (flagged.length) {
    fs.writeFileSync(path.join(DIR, 'FLAGGED.json'), JSON.stringify(flagged, null, 1))
    console.log(`부수 발견 ${flagged.length}건 -> ${DIR}/FLAGGED.json`)
  }
}
