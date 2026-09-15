// scripts/dict/w0816-exrepair.mjs
// T8 — 예문 자리에 예문이 아닌 것이 들어간 레코드를 고친다. T5/T5b 유의어 배치가 부수적으로 계통 결함 3종을 잡아냈다:
//   (a) WordNet 관계 메타데이터가 그대로 적재 — `Near-synonyms: lounge …` · `Holonyms: brain < …` (93건)
//   (b) 사전 뜻풀이(gloss)를 예문 자리에 넣음 — 소문자 시작 · 종결부호 없음 (197건)
//   (c) 레코드 밀림 — 예문이 **다른 표제어**의 것 (`heat up` 이 `screw up` 예문을 들고 있음) (397건)
//   진단: docs/AI_CONTEXT/diagnostics/dict_field_consistency_20260815.md
//
// ⚠️ 게이트 — T6(exmatch)와 달리 이 배치는 **원본이 예문이 아니므로 비교 대상이 없다**. 따라서 산출물 자체를 검증한다:
//   (1) 표제어(또는 굴절형)가 예문에 실제로 등장 — (c) 밀림을 다시 만들지 않기 위한 핵심 게이트
//   (2) 대문자 시작 + 종결부호(. ! ?) — (b) gloss 재유입 차단
//   (3) 관계 라벨(Near-synonyms/Holonyms/…) 로 시작하면 거부 — (a) 재유입 차단
//   (4) 20~160자 · 아포스트로피 회피(TTS·따옴표 처리) · 원본과 달라야 함
//   (5) `skip:true` — 표제어 자체가 학습자 카드에 부적절하면 예문을 쓰지 않고 건너뛴다(멸칭·비속어)
//
// 실행: node scripts/dict/w0816-exrepair.mjs chunk [--dir D] [--size 110]
//       node scripts/dict/w0816-exrepair.mjs apply [--dir D] [--commit]
import fs from 'node:fs'
import path from 'node:path'
import { db, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0816-exrepair')
const SIZE = parseInt(arg('--size', '110'), 10)
const COMMIT = process.argv.includes('--commit')

const META_RE = /^\s*(near-synonyms?|holonyms?|meronyms?|coordinate term|see thesaurus|synonyms?|antonyms?|hypernyms?|hyponyms?)\b/i

/** 표제어가 예문에 등장하는가 — 어간 앞 4자 이상으로 굴절형까지 허용(구동사는 첫 낱말 기준). */
function containsWord(ex, word) {
  const head = word.split(/[\s-]/)[0]
  const stem = head.length > 4 ? head.slice(0, Math.max(4, head.length - 2)) : head
  return new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(ex)
}

/**
 * 위 `containsWord` 의 **완화판** — chunk 단계 `shifted` 판정의 오탐을 apply 에서 되잡는 데 쓴다.
 * 세 에이전트가 독립적으로 같은 오탐을 지적했다:
 *   · `(every) now and again` — 첫 낱말이 `(every)` 라 `\b\(ever` 가 절대 매치되지 않음
 *   · `étude` · `dms™` — 비ASCII·기호 앞에서 `\b` 가 성립하지 않음
 *   · `have on` → "He had the radio on" — 불규칙 굴절을 어간 정규식이 놓침
 * 그래서 **기호를 걷어내고 가장 긴 실질 낱말**로 다시 본다. 여기서 매치되면 원본 예문이 멀쩡한 것이므로
 * 교체하지 않는다 — 멀쩡한 예문을 갈아치우는 게 이 배치의 유일한 손실 경로다.
 */
function looseContains(ex, word) {
  const tokens = word.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/[\s-]+/).filter((t) => t.length >= 3)
  if (!tokens.length) return false
  const main = tokens.reduce((a, b) => (b.length > a.length ? b : a))
  const forms = [main.length > 5 ? main.slice(0, main.length - 2) : main, ...(IRREGULAR[main] ?? [])]
  // 규칙 굴절이지만 어간이 바뀌는 것들 — `deny`→`denied` · `leaf`→`leaves` · `hop`→`hopped`.
  if (/y$/.test(main)) forms.push(main.slice(0, -1) + 'i')
  if (/fe?$/.test(main)) forms.push(main.replace(/fe?$/, 'v'))
  if (/e$/.test(main)) forms.push(main.slice(0, -1))
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(main)) forms.push(main + main.slice(-1))
  // 접두 합성 불규칙 — `overcome`→`overcame` · `rewind`→`rewound` · `withstand`→`withstood`.
  for (const [base, alts] of Object.entries(IRREGULAR)) {
    if (main.length > base.length && main.endsWith(base)) {
      const pre = main.slice(0, main.length - base.length)
      for (const a of alts) forms.push(pre + a)
    }
  }
  return forms.some((f) => new RegExp(`(?<!\\p{L})${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu').test(ex))
}

/** 어간 정규식으로는 절대 이어지지 않는 불규칙 굴절. `give`→`gave` 를 밀림으로 오판하지 않게 한다. */
const IRREGULAR = {
  be: ['was', 'were', 'been'], begin: ['began', 'begun'], bend: ['bent'], bind: ['bound'], bite: ['bit'],
  bleed: ['bled'], blow: ['blew', 'blown'], break: ['broke'], breed: ['bred'], bring: ['brought'],
  build: ['built'], buy: ['bought'], catch: ['caught'], choose: ['chose'], cling: ['clung'], come: ['came'],
  creep: ['crept'], deal: ['dealt'], dig: ['dug'], do: ['did', 'done'], draw: ['drew'], drink: ['drank', 'drunk'],
  drive: ['drove', 'driven'], eat: ['ate'], fall: ['fell'], feed: ['fed'], feel: ['felt'], fight: ['fought'],
  find: ['found'], flee: ['fled'], fling: ['flung'], fly: ['flew', 'flown'], forget: ['forgot'],
  forgive: ['forgave'], freeze: ['froze'], get: ['got'], give: ['gave'], go: ['went', 'gone'], grind: ['ground'],
  grow: ['grew'], hang: ['hung'], have: ['had'], hear: ['heard'], hide: ['hid'], hold: ['held'], keep: ['kept'],
  kneel: ['knelt'], know: ['knew'], lay: ['laid'], lead: ['led'], leave: ['left'], lend: ['lent'], lie: ['lay'],
  light: ['lit'], lose: ['lost'], make: ['made'], mean: ['meant'], meet: ['met'], pay: ['paid'], ride: ['rode'],
  ring: ['rang', 'rung'], rise: ['rose'], run: ['ran'], say: ['said'], see: ['saw', 'seen'], seek: ['sought'],
  sell: ['sold'], send: ['sent'], shake: ['shook'], shine: ['shone'], shoot: ['shot'], show: ['shown'],
  shrink: ['shrank'], sing: ['sang', 'sung'], sink: ['sank'], sit: ['sat'], sleep: ['slept'], slide: ['slid'],
  speak: ['spoke'], spend: ['spent'], spin: ['spun'], stand: ['stood'], steal: ['stole'], stick: ['stuck'],
  sting: ['stung'], stink: ['stank'], strike: ['struck'], swear: ['swore'], sweep: ['swept'], swim: ['swam'],
  swing: ['swung'], take: ['took'], teach: ['taught'], tear: ['tore'], tell: ['told'], think: ['thought'],
  throw: ['threw'], understand: ['understood'], wake: ['woke'], wear: ['wore'], weave: ['wove'], weep: ['wept'],
  win: ['won'], wind: ['wound'], wring: ['wrung'], write: ['wrote', 'written'],
  slay: ['slew', 'slain'], smite: ['smote'], bear: ['bore', 'borne'], beat: ['beaten'], behold: ['beheld'],
  bid: ['bade'], cleave: ['clove'], dive: ['dove'], dwell: ['dwelt'], forsake: ['forsook'], hew: ['hewn'],
  lean: ['leant'], leap: ['leapt'], learn: ['learnt'], seethe: ['sod'], sew: ['sewn'], shear: ['shorn'],
  shed: ['shed'], slink: ['slunk'], smell: ['smelt'], sow: ['sown'], spell: ['spelt'], spill: ['spilt'],
  spoil: ['spoilt'], spring: ['sprang', 'sprung'], stride: ['strode'], strive: ['strove'], swell: ['swollen'],
  thrive: ['throve'], tread: ['trod'], wet: ['wet'], abide: ['abode'], beget: ['begot'], befall: ['befell'],
  // 불규칙 복수
  child: ['children'], foot: ['feet'], goose: ['geese'], man: ['men'], mouse: ['mice'], person: ['people'],
  tooth: ['teeth'], woman: ['women'], ox: ['oxen'], louse: ['lice'],
}

if (MODE === 'chunk') {
  const targets = []
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, pos, meaning_ko, meanings_ko, example_en, cefr_level, v_level, frequency_rank')
      .not('example_en', 'is', null).gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      const ex = String(r.example_en)
      let kind = null
      if (META_RE.test(ex)) kind = 'meta'                                    // (a)
      else if (/^[a-z]/.test(ex) && !/[.!?"]$/.test(ex)) kind = 'gloss'      // (b)
      else if (!containsWord(ex, r.word)) kind = 'shifted'                   // (c)
      if (!kind) continue
      targets.push({
        word: r.word, kind, pos: r.pos, meaning_ko: r.meaning_ko,
        all_meanings: Array.isArray(r.meanings_ko) ? r.meanings_ko.map((m) => `${m.pos}:${m.meaning}`) : [],
        example_en: ex, cefr: r.cefr_level, v: r.v_level, rank: r.frequency_rank,
      })
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
  targets.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9))
  const n = writeChunks(DIR, targets, SIZE)
  const by = targets.reduce((m, t) => ((m[t.kind] = (m[t.kind] ?? 0) + 1), m), {})
  console.log(`exrepair targets: ${targets.length} (${JSON.stringify(by)}) · chunks: ${n} → ${DIR}/chunk-NN.json`)
  process.exit(0)
}

if (MODE === 'apply') {
  const cur = new Map()
  for (const f of fs.readdirSync(DIR)) {
    if (!/^chunk-\d+\.json$/.test(f)) continue
    for (const e of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
      cur.set(e.word.toLowerCase(), { ex: e.example_en, meaning: e.meaning_ko, kind: e.kind })
    }
  }

  // ⚠️ `shifted` 탐지는 어간 앞 4자 정규식이라 **불규칙 굴절을 놓친다** — `have on` 의 예문 "He had the radio on"
  //   은 `have` 로 매칭되지 않아 밀림으로 오분류된다(에이전트가 chunk-02 에서 7건 지적). 그런 항목은
  //   원본이 멀쩡하므로 교체하면 손해다. 에이전트 보고를 근거로 여기에 넣으면 apply 가 건너뛴다.
  const keepPath = path.join(DIR, 'KEEP_ORIGINAL.json')
  const keepOriginal = fs.existsSync(keepPath)
    ? new Set(JSON.parse(fs.readFileSync(keepPath, 'utf8')).map((s) => String(s).toLowerCase()))
    : new Set()

  const { files, rows } = readOuts(DIR)
  const fixes = new Map()
  const flagged = []
  let bad = 0, skipped = 0, kept = 0
  const gate = { noword: 0, shape: 0, meta: 0, len: 0, same: 0, apos: 0 }
  for (const e of rows) {
    if (!e || typeof e.word !== 'string') { bad++; continue }
    const w = e.word.toLowerCase().trim()
    const c = cur.get(w)
    if (!c) { bad++; continue }
    if (e.note && String(e.note).trim()) flagged.push({ word: w, kind: c.kind, meaning_ko: c.meaning, note: String(e.note).trim() })
    if (e.skip === true) { skipped++; continue }
    if (keepOriginal.has(w)) { kept++; continue }
    // `shifted` 오탐 되잡기 — 완화 매처로 원본에서 표제어가 실제로 보이면 원본이 옳다.
    //   `meta`·`gloss` 는 원본이 예문 자체가 아니므로 이 면제를 주지 않는다.
    if (c.kind === 'shifted' && looseContains(String(c.ex), w)) { kept++; continue }
    if (typeof e.example_en !== 'string') { bad++; continue }
    const ex = e.example_en.trim()
    if (ex.length < 20 || ex.length > 160) { gate.len++; continue }          // (4)
    if (ex === c.ex) { gate.same++; continue }                               // (4)
    // 곡선 아포스트로피(U+2019 등)가 ASCII 필터를 통과해 들어온 사례가 있다(에이전트 지적, chunk-03 `tear apart`).
    if (/['‘’ʼ]/.test(ex)) { gate.apos++; continue }           // (4)
    if (META_RE.test(ex)) { gate.meta++; continue }                          // (3)
    if (!/^[A-Z"]/.test(ex) || !/[.!?"]$/.test(ex)) { gate.shape++; continue } // (2)
    if (!containsWord(ex, w)) { gate.noword++; continue }                    // (1)
    fixes.set(w, ex)
  }
  console.log(`files: ${files} · 교체 대상: ${fixes.size} · agent-skip: ${skipped} · 원본 유지(오분류): ${kept} · malformed: ${bad}`)
  console.log(`게이트 탈락 — 표제어 없음: ${gate.noword} · 문장꼴 아님: ${gate.shape} · 메타라벨: ${gate.meta} · 길이: ${gate.len} · 동일: ${gate.same} · 아포스트로피: ${gate.apos}`)
  fs.writeFileSync(path.join(DIR, 'FLAGGED.json'), JSON.stringify(flagged, null, 1))
  console.log(`레코드 결함 보고(자동수정 안 함): ${flagged.length} → ${DIR}/FLAGGED.json`)

  if (!COMMIT) {
    console.log('DRY-RUN (--commit 로 적용). 샘플:')
    let n = 0
    for (const [w, ex] of fixes) { if (n++ >= 10) break; console.log(` ${w} [${cur.get(w).kind}] (${cur.get(w).meaning})\n   before: ${cur.get(w).ex}\n   after : ${ex}`) }
    process.exit(0)
  }

  let done = 0, failed = 0
  for (const [w, ex] of fixes) {
    const { error } = await db.from('shared_dictionary').update({ example_en: ex }).eq('word', w)
    if (error) { failed++; if (failed < 5) console.warn(w, error.message) } else done++
    if (done % 200 === 0 && done) console.log(`  … ${done}`)
  }
  console.log(`updated: ${done} · failed: ${failed}`)
  process.exit(0)
}

console.error('usage: node scripts/dict/w0816-exrepair.mjs chunk|apply [--dir D] [--size N] [--commit]')
process.exit(1)
