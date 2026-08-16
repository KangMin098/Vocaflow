// scripts/dict/w0816-exfill.mjs
// T10 — `example_en` 이 아예 없는 표제어에 예문을 쓴다. 실측 9,037건(발행 도서 어휘 안쪽만 1,044).
//   T8(exrepair)는 **잘못된 예문**을 고쳤고, 이건 **없는 예문**을 채운다. 카드 뒷면이 뜻 한 줄뿐인 상태다.
//
// ⚠️ 이 배치는 **순수 추가**다 — NULL 인 자리에만 쓴다. 기존 예문을 덮어쓸 경로가 없다(apply 가 NULL 조건을 건다).
//   게이트는 T8 과 동일: 표제어 등장 + 문장꼴 + 관계 라벨 거부 + 20~160자 + 아포스트로피 금지.
//   `skip:true` — 표제어 자체가 학습자 카드에 부적절하면 비워 둔다(멸칭·비속어·마약 은어).
//
// 정렬: 발행 도서 등장 어휘 먼저(실제 노출), 그 안에서 등장 도서수 → 빈도.
// 실행: node scripts/dict/w0816-exfill.mjs chunk [--dir D] [--size 120]
//       node scripts/dict/w0816-exfill.mjs apply [--dir D] [--commit]
import fs from 'node:fs'
import path from 'node:path'
import { db, publishedVocab, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0816-exfill')
const SIZE = parseInt(arg('--size', '120'), 10)
const COMMIT = process.argv.includes('--commit')

const META_RE = /^\s*(near-synonyms?|holonyms?|meronyms?|coordinate term|see thesaurus|synonyms?|antonyms?|hypernyms?|hyponyms?)\b/i

/**
 * 표제어가 예문에 등장하는가.
 *
 * ⚠️ 첫 토큰만 보는 순진한 구현은 **통과가 구조적으로 불가능한 표제어**를 만든다(에이전트가 chunk-16 에서 발견):
 *   · `carry/win the day` — 첫 토큰이 `carry/win` → 어간 `carryw`. 어떤 영어 문장도 포함할 수 없다.
 *   · `can't be bad` — 어간 `cant` 인데 아포스트로피 금지 규칙이 `can't` 를 막는다(규칙 1 과 4 가 배타).
 * 그래서 **슬래시·아포스트로피까지 쪼개고, 토큰 중 하나라도 맞으면 통과**시킨다.
 * 굴절 처리는 w0816-exrepair.mjs 의 `looseContains` 와 같은 규칙(y→i · f→v · e탈락 · 자음중복 + 불규칙표).
 */
const IRREGULAR = {
  be: ['was', 'were', 'been'], begin: ['began', 'begun'], break: ['broke'], bring: ['brought'], buy: ['bought'],
  catch: ['caught'], come: ['came'], do: ['did', 'done'], draw: ['drew'], drive: ['drove'], eat: ['ate'],
  fall: ['fell'], feel: ['felt'], fight: ['fought'], find: ['found'], fly: ['flew'], get: ['got'], give: ['gave'],
  go: ['went', 'gone'], grow: ['grew'], hang: ['hung'], have: ['had'], hear: ['heard'], hold: ['held'],
  keep: ['kept'], know: ['knew'], lay: ['laid'], lead: ['led'], leave: ['left'], lose: ['lost'], make: ['made'],
  mean: ['meant'], meet: ['met'], pay: ['paid'], rise: ['rose'], run: ['ran'], say: ['said'], see: ['saw'],
  seek: ['sought'], sell: ['sold'], send: ['sent'], sit: ['sat'], speak: ['spoke'], stand: ['stood'],
  take: ['took'], teach: ['taught'], tell: ['told'], think: ['thought'], throw: ['threw'], win: ['won'],
  write: ['wrote'], child: ['children'], foot: ['feet'], man: ['men'], person: ['people'], tooth: ['teeth'],
  woman: ['women'], mouse: ['mice'],
}

function containsWord(ex, word) {
  const tokens = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ' ').split(/\s+/).filter((t) => t.length >= 3)
  if (!tokens.length) return true                        // 기호·2자 이하뿐인 표제어는 이 게이트를 적용할 수 없다
  const forms = []
  for (const t of tokens) {
    forms.push(t.length > 5 ? t.slice(0, t.length - 2) : t, ...(IRREGULAR[t] ?? []))
    if (/y$/.test(t)) forms.push(t.slice(0, -1) + 'i')
    if (/fe?$/.test(t)) forms.push(t.replace(/fe?$/, 'v'))
    if (/e$/.test(t)) forms.push(t.slice(0, -1))
    if (/[^aeiou][aeiou][bdgklmnprt]$/.test(t)) forms.push(t + t.slice(-1))
  }
  return forms.some((f) => new RegExp(`(?<!\\p{L})${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu').test(ex))
}

if (MODE === 'chunk') {
  const agg = await publishedVocab()
  const targets = []
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, pos, meaning_ko, meanings_ko, synonyms, cefr_level, v_level, frequency_rank')
      .is('example_en', null).gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      if (!r.meaning_ko) continue
      const e = agg.get(r.word.toLowerCase())
      targets.push({
        word: r.word, pos: r.pos, meaning_ko: r.meaning_ko,
        all_meanings: Array.isArray(r.meanings_ko) ? r.meanings_ko.map((m) => `${m.pos}:${m.meaning}`) : [],
        synonyms: (r.synonyms ?? []).slice(0, 4),
        cefr: r.cefr_level, v: r.v_level, rank: r.frequency_rank,
        books: e ? [...e.books].length : 0, freq: e ? e.freq : 0,
      })
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
  // 발행 도서에 실제로 등장하는 것 먼저 — 학습자가 오늘 마주치는 카드다
  targets.sort((a, b) => b.books - a.books || b.freq - a.freq || (a.rank ?? 1e9) - (b.rank ?? 1e9))
  const n = writeChunks(DIR, targets, SIZE)
  const inBooks = targets.filter((t) => t.books > 0).length
  console.log(`exfill targets: ${targets.length} (발행 도서 등장 ${inBooks}) · chunks: ${n} → ${DIR}/chunk-NN.json`)
  process.exit(0)
}

if (MODE === 'apply') {
  const cur = new Map()
  for (const f of fs.readdirSync(DIR)) {
    if (!/^chunk-\d+\.json$/.test(f)) continue
    for (const e of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) cur.set(e.word.toLowerCase(), e.meaning_ko)
  }

  const { files, rows } = readOuts(DIR)
  const fills = new Map()
  const flagged = []
  let bad = 0, skipped = 0
  const gate = { noword: 0, shape: 0, meta: 0, len: 0, apos: 0 }
  for (const e of rows) {
    if (!e || typeof e.word !== 'string') { bad++; continue }
    const w = e.word.toLowerCase().trim()
    if (!cur.has(w)) { bad++; continue }
    if (e.note && String(e.note).trim()) flagged.push({ word: w, meaning_ko: cur.get(w), note: String(e.note).trim() })
    if (e.skip === true) { skipped++; continue }
    if (typeof e.example_en !== 'string') { bad++; continue }
    const ex = e.example_en.trim()
    if (ex.length < 20 || ex.length > 160) { gate.len++; continue }
    if (/['‘’ʼ]/.test(ex)) { gate.apos++; continue }
    if (META_RE.test(ex)) { gate.meta++; continue }
    if (!/^[A-Z"]/.test(ex) || !/[.!?"]$/.test(ex)) { gate.shape++; continue }
    if (!containsWord(ex, w)) { gate.noword++; continue }
    fills.set(w, ex)
  }
  console.log(`files: ${files} · 채움 대상: ${fills.size} · agent-skip: ${skipped} · malformed: ${bad}`)
  console.log(`게이트 탈락 — 표제어 없음: ${gate.noword} · 문장꼴 아님: ${gate.shape} · 메타라벨: ${gate.meta} · 길이: ${gate.len} · 아포스트로피: ${gate.apos}`)
  fs.writeFileSync(path.join(DIR, 'FLAGGED.json'), JSON.stringify(flagged, null, 1))
  console.log(`레코드 결함 보고: ${flagged.length} → ${DIR}/FLAGGED.json`)

  if (!COMMIT) {
    console.log('DRY-RUN (--commit 로 적용). 샘플:')
    let n = 0
    for (const [w, ex] of fills) { if (n++ >= 10) break; console.log(` ${w} (${cur.get(w)})\n   → ${ex}`) }
    process.exit(0)
  }

  // ⚠️ `.is('example_en', null)` 로 **비어 있을 때만** 쓴다 — 다른 배치가 그 사이 채웠으면 건드리지 않는다(멱등).
  let done = 0, failed = 0, taken = 0
  for (const [w, ex] of fills) {
    const { data, error } = await db.from('shared_dictionary')
      .update({ example_en: ex }).eq('word', w).is('example_en', null).select('word')
    if (error) { failed++; if (failed < 5) console.warn(w, error.message); continue }
    if (!data || !data.length) { taken++; continue }
    done++
    if (done % 500 === 0) console.log(`  … ${done}`)
  }
  console.log(`filled: ${done} · 이미 채워져 있어 건너뜀: ${taken} · failed: ${failed}`)
  process.exit(0)
}

console.error('usage: node scripts/dict/w0816-exfill.mjs chunk|apply [--dir D] [--size N] [--commit]')
process.exit(1)
