// scripts/dict/csat-dict-drain.mjs
//
// **수능 기출 13개년 원문에 나왔는데 사전에 없는 낱말을 Claude Code 가 채우는 드레인.**
//
// 입력은 `csat-corpus-diff.mjs` 가 남긴 `diff.json` 의 `사전_결손_목록`.
// `drain-article-lemmas.mjs` 와 같은 형식·같은 규칙을 쓴다(청크 in/out · 개수 일치 검증).
//
// ── 왜 해소기를 한 번 더 통과시키나 ─────────────────────────────────
// 결손 목록은 "shared_dictionary 에 표제어가 없다" 까지만 본다. 그런데 학습자 경로는
// `resolve_dict_headword` 로 굴절·철자 변이를 푼다 — 그걸 안 거치면 이미 풀리는 낱말을
// 중복 등재해 사전 품질을 되레 깎는다. `unresolved_dict_words` RPC 가 그 게이트다.
//
// ── 빈도 반영까지가 한 세트 ─────────────────────────────────────────
// `lexicon_frequencies.lemma` 는 `shared_dictionary(word)` FK 라, 표제어가 생기기 전에는
// 기출 빈도를 넣을 수 없다. 그래서 넣은 뒤 `csat-corpus-apply.mjs --commit` 을 다시 돌려야
// 새 낱말이 `kice_csat` 빈도와 `kice-csat-*` 태그를 받는다.
//
// 재실행 안전: 내보내기는 읽기만 한다. 들여오기는 이미 있는 낱말을 건너뛴다.
//
// 실행:
//   pnpm dlx tsx scripts/dict/csat-dict-drain.mjs --export
//   pnpm dlx tsx scripts/dict/csat-dict-drain.mjs --export --source analyses   # 분석이 지목한 필수 어휘
//   … Claude Code 가 chunk-NN.json → chunk-NN.out.json …
//   pnpm dlx tsx scripts/dict/csat-dict-drain.mjs --import            # 검증만
//   pnpm dlx tsx scripts/dict/csat-dict-drain.mjs --import --commit   # 넣는다

import fs from 'node:fs'
import path from 'node:path'

import { IRREGULAR } from './_irregular.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
/**
 * 결손 목록을 어디서 가져오나.
 *
 *   `corpus`   — 기출 **원문 전체**에 나온 낱말 중 사전에 없는 것 (`csat-corpus-diff` 의 diff.json)
 *   `analyses` — 문항 분석이 **「이 문항을 풀려면 이 낱말을 알아야 한다」고 지목한** 낱말
 *                (`csat_item_analyses.required_vocab`) 중 사전에 없는 것
 *
 * 둘은 겹치지만 같지 않다. 원문 쪽은 「나왔다」이고 분석 쪽은 「알아야 푼다」라서, 교재의
 * 어휘 상자에 실을 것은 분석 쪽이다. 해소기 게이트·검증·적재는 두 소스가 그대로 공유한다 —
 * 사전에 넣는 규칙이 소스마다 갈리면 사전이 두 벌이 된다.
 */
const SOURCE = arg('source') ?? 'corpus'
if (!['corpus', 'analyses'].includes(SOURCE)) throw new Error(`--source 는 corpus | analyses (받은 값: ${SOURCE})`)
const OUT_DIR = path.resolve(
  arg('dir') ?? (SOURCE === 'analyses' ? 'scripts/dict/csat-analysis-gap' : 'scripts/dict/csat-dict-gap'),
)
const SRC_DIR = arg('src') ?? 'C:/Users/Administrator/Documents/수능영어기출/최종'
const CHUNK_SIZE = Number(arg('chunk') ?? 60)
const commit = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const POS = [
  'noun', 'adjective', 'verb', 'adverb', 'idiom', 'phrasal_verb', 'abbreviation',
  'interjection', 'preposition', 'determiner', 'pronoun', 'conjunction',
  'prefix', 'auxiliary', 'number', 'other',
]

/**
 * 원문에서 그 낱말이 실제로 쓰인 문장 하나. 다의어의 어느 뜻인지는 문맥 없이 못 정한다.
 *
 * ⚠️ 여기 담기는 문장은 평가원 원문의 **짧은 인용**이고, 청크 파일에만 남는다(작업용).
 *    `shared_dictionary` 에는 들어가지 않는다 — 명세가 `example_en` 을 새로 쓰라고 못 박는 이유다.
 */
function sampleSentencesFrom(texts, words) {
  const wanted = new Set(words)
  const found = new Map()
  for (const raw of texts) {
    const text = String(raw ?? '').replace(/[\r\n]+/g, ' ')
    for (const sent of text.split(/(?<=[.!?])\s+/)) {
      const clean = sent.replace(/\s+/g, ' ').trim()
      if (clean.length < 20) continue
      const lower = clean.toLowerCase()
      for (const w of wanted) {
        if (found.has(w)) continue
        const esc = w.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
        // 굴절형까지 허용한다 — 원문에 원형이 없을 수 있다.
        if (new RegExp('\\b' + esc + '(s|es|ed|ing|d)?\\b').test(lower)) {
          found.set(w, clean.slice(0, 200))
        }
      }
    }
  }
  return found
}

/** 파일 코퍼스에서 읽는 옛 경로 — 그 폴더가 있는 기계에서만 쓴다 */
function sampleSentences(words) {
  if (!fs.existsSync(SRC_DIR)) {
    console.log(`  ⚠ 원문 폴더가 없다(${SRC_DIR}) — 문맥 문장 없이 진행한다`)
    return new Map()
  }
  const files = fs.readdirSync(SRC_DIR).filter((x) => /^\d{4}(_A)?\.txt$/.test(x)).sort()
  return sampleSentencesFrom(
    files.map((f) => fs.readFileSync(path.join(SRC_DIR, f), 'utf8')),
    words,
  )
}

/** 1000행 벽 — PostgREST 는 자르면서 오류를 내지 않는다. 넘을 수 있는 조회는 나눠 읽는다. */
async function allRows(build) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    out.push(...batch)
    if (batch.length < 1000) break
  }
  return out
}

const yearOf = (examId) => (examId.startsWith('M') ? 2000 + Number(examId.slice(1, 3)) : Number(examId.slice(0, 4)))

/**
 * 문항 분석이 지목한 필수 어휘를 `diff.json` 과 같은 모양으로 모은다.
 * 문항마다 **최신 버전만** 센다 — 분석은 버전을 올려 쌓이므로 그냥 세면 빈도가 부풀어 오른다.
 */
async function collectFromAnalyses() {
  const [items, analyses] = await Promise.all([
    allRows((f, t) => db.from('csat_items').select('id, exam_id, passage').eq('in_scope', true).range(f, t)),
    allRows((f, t) =>
      db.from('csat_item_analyses').select('item_id, version, required_vocab').eq('status', 'published').range(f, t),
    ),
  ])
  const latest = new Map()
  for (const a of analyses) {
    const cur = latest.get(a.item_id)
    if (!cur || a.version > cur.version) latest.set(a.item_id, a)
  }
  const itemById = new Map(items.map((i) => [i.id, i]))

  const acc = new Map()
  for (const [itemId, a] of latest) {
    const item = itemById.get(itemId)
    if (!item) continue
    const year = yearOf(item.exam_id)
    for (const raw of a.required_vocab ?? []) {
      const lemma = String(raw).trim().toLowerCase()
      if (!lemma) continue
      const e = acc.get(lemma) ?? { lemma, years: new Set(), total: 0 }
      e.years.add(year)
      e.total += 1
      acc.set(lemma, e)
    }
  }
  console.log(`분석 ${latest.size}문항이 지목한 낱말 ${acc.size}`)
  return {
    gaps: [...acc.values()].map((e) => ({
      lemma: e.lemma,
      years_appeared: [...e.years].sort(),
      years_n: e.years.size,
      total: e.total,
    })),
    passages: items.map((i) => i.passage).filter(Boolean),
  }
}

async function doExport() {
  let gaps
  let passages = null
  if (SOURCE === 'analyses') {
    const collected = await collectFromAnalyses()
    gaps = collected.gaps
    passages = collected.passages
  } else {
    const diff = JSON.parse(fs.readFileSync('scripts/dict/csat-corpus/diff.json', 'utf8'))
    gaps = diff['사전_결손_목록']
  }
  console.log(`결손 후보 ${gaps.length}`)

  // 해소기 게이트 — 이미 풀리는 낱말은 넣지 않는다.
  const unresolved = []
  for (let i = 0; i < gaps.length; i += 400) {
    const { data, error } = await db.rpc('unresolved_dict_words', {
      p_words: gaps.slice(i, i + 400).map((g) => g.lemma),
    })
    if (error) throw new Error('해소기 조회 실패: ' + error.message)
    for (const r of data ?? []) unresolved.push(typeof r === 'string' ? r : r.word)
  }
  const keep = new Set(unresolved)
  const missing = gaps.filter((g) => keep.has(g.lemma))
  console.log(`해소기가 푼 것 ${gaps.length - missing.length} (굴절·철자 변이)`)
  console.log(`진짜 빠진 낱말 ${missing.length}`)
  if (!missing.length) return console.log('채울 것이 없다.')

  const samples = passages
    ? sampleSentencesFrom(passages, missing.map((m) => m.lemma))
    : sampleSentences(missing.map((m) => m.lemma))
  console.log(`문맥 문장 확보 ${samples.size}/${missing.length}`)

  missing.sort((a, b) => b.years_n - a.years_n || b.total - a.total || a.lemma.localeCompare(b.lemma))

  fs.mkdirSync(OUT_DIR, { recursive: true })
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/^chunk-\d+\.(out\.)?json$/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f))
  }
  let n = 0
  for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
    const rows = missing.slice(i, i + CHUNK_SIZE).map((g) => ({
      word: g.lemma,
      seen_in: samples.get(g.lemma) ?? null,
      csat_years: g.years_appeared,
      csat_freq: g.total,
    }))
    const file = path.join(OUT_DIR, `chunk-${String(n).padStart(2, '0')}.json`)
    fs.writeFileSync(file, JSON.stringify(rows, null, 1) + '\n')
    n++
  }
  fs.writeFileSync(path.join(OUT_DIR, '_PROMPT.md'), PROMPT)
  console.log(`청크 ${n}개 → ${path.relative(process.cwd(), OUT_DIR)}`)
}

const PROMPT = [
  '# 수능 기출 결손 낱말 사전 드레인 — Claude Code 작업 지시',
  '',
  '`chunk-NN.json` 을 읽고 **같은 폴더에** `chunk-NN.out.json` 을 쓴다.',
  '',
  '## 입력 한 줄',
  '```json',
  '{ "word": "upcycling", "seen_in": "…원문 문장…", "csat_years": [2021, 2024], "csat_freq": 3 }',
  '```',
  '',
  '## 출력 한 줄 (입력과 **같은 개수·같은 순서**)',
  '```json',
  '{ "word": "upcycling", "meaning_ko": "업사이클링(폐품을 더 가치 있는 물건으로 재탄생시키기)",',
  '  "pos": "noun", "cefr_level": "C1",',
  '  "example_en": "Upcycling turns discarded bottles into furniture." }',
  '```',
  '',
  '## 규칙',
  '- `meaning_ko` — 한국 고등학생·수능 응시자 기준 뜻. **`seen_in` 문맥의 뜻을 먼저**, 다른 흔한 뜻은 쉼표로.',
  '- `pos` — ' + POS.join(' · ') + ' 중 하나(소문자). 새 값을 만들지 않는다.',
  '- `cefr_level` — A1·A2·B1·B2·C1·C2 중 하나. **그 낱말 자체의 난이도**이지 지문 난이도가 아니다.',
  '- `example_en` — 짧고 자연스러운 한 문장. **`seen_in` 을 그대로 옮기지 않는다**(기출 원문 복제 금지).',
  '- 고유명사(인명·지명·상표)·약어 파편·오탈자·영어가 아닌 것은 그 줄을 **빼지 말고** `"skip": true` 를 붙인다.',
  '  빼면 개수가 어긋나 들여오기가 통째로 거부한다.',
  '- `csat_years` 가 길수록 반복 출제어다 — 뜻을 더 신중히 고른다.',
  '',
  '## 되돌리기',
  "`delete from shared_dictionary where classified_by='claude_code_opus_5' and source='ai-generated' and created_at > '…'`",
  '',
].join('\n')

/**
 * 연결이 끊겨도 드레인이 죽지 않게 한다.
 *
 * 이 저장소의 Supabase 연결은 간헐적으로 `fetch failed`(UND_ERR_CONNECT_TIMEOUT)를 낸다 —
 * 실측 2026-09-05: 같은 조회가 한 번은 49초 만에 실패하고 다음 시도에 41초 만에 성공했다.
 * 재시도가 없으면 **283낱말을 다 채워 놓고 한 번의 깜빡임에 처음부터** 다시 해야 한다.
 *
 * 쓰기까지 재시도해도 안전한 이유는 적재를 `upsert(onConflict: word)` 로 바꿨기 때문이다 —
 * 절반 들어간 배치를 다시 던져도 같은 표제어가 두 번 생기지 않는다(`word` 가 PK다).
 */
async function withRetry(label, fn, tries = 4) {
  let last
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fn()
      if (!res?.error) return res
      last = res.error
    } catch (e) {
      last = e
    }
    if (i < tries) console.log(`  ↻ ${label} 재시도 ${i}/${tries - 1} — ${last?.message ?? last}`)
  }
  throw new Error(`${label} 실패: ${last?.message ?? last}`)
}

/** 불규칙 굴절 역인덱스 — `came → come`. 표가 없으면 조용히 놓친다(`_irregular.mjs` 주석 참조). */
const IRREGULAR_BACK = new Map()
for (const [base, forms] of Object.entries(IRREGULAR)) for (const f of forms) IRREGULAR_BACK.set(f, base)

/** 한 토큰의 있음직한 기본형들 (자기 자신은 뺀다) */
function baseForms(tok) {
  const out = new Set()
  const add = (s) => { if (s.length >= 2 && s !== tok) out.add(s) }
  if (IRREGULAR_BACK.has(tok)) add(IRREGULAR_BACK.get(tok))
  if (tok.endsWith('ing')) {
    const st = tok.slice(0, -3)
    add(st); add(st + 'e')
    if (st.length > 2 && st.at(-1) === st.at(-2)) add(st.slice(0, -1))
  }
  if (tok.endsWith('ed')) {
    const st = tok.slice(0, -2)
    add(st); add(st + 'e')
    if (st.length > 2 && st.at(-1) === st.at(-2)) add(st.slice(0, -1))
  }
  if (tok.endsWith('ies')) add(tok.slice(0, -3) + 'y')
  else if (tok.endsWith('es')) { add(tok.slice(0, -2)); add(tok.slice(0, -1)) }
  else if (tok.endsWith('s') && !tok.endsWith('ss')) add(tok.slice(0, -1))
  return [...out]
}

/** 그 표면형의 기본형 후보 구 — 첫 토큰과 마지막 토큰을 각각 되돌려 본다 */
function phraseBaseCandidates(word) {
  const toks = word.split(' ')
  const out = new Set()
  for (const b of baseForms(toks[0])) out.add([b, ...toks.slice(1)].join(' '))
  if (toks.length > 1) for (const b of baseForms(toks.at(-1))) out.add([...toks.slice(0, -1), b].join(' '))
  return [...out]
}

/**
 * **굴절형을 새 표제어로 넣지 않는다.**
 *
 * `unresolved_dict_words` 는 낱말 하나의 굴절은 풀지만 **여러 낱말로 된 구의 굴절은 못 푼다.**
 * 그래서 `warm up` 이 사전에 있는데도 `warming up` 이 「빠진 낱말」로 나온다. 그대로 넣으면
 * 같은 뜻이 표제어 두 벌이 되고, 다음에 누가 세면 또 어긋난다(실측 2026-09-05: 286 중 **8건** —
 * pulled over · warming up · bouncing back · going for · laid off · sold out · spoke out · warmed up).
 *
 * 옳은 처리는 새 표제어가 아니라 **기본형 표제어의 `inflected_forms` 에 그 표면형을 더하는 것**이다.
 * 그래야 학습자가 `warming up` 을 찾아도 `warm up` 으로 풀린다. 여기서는 그 둘을 갈라 돌려준다.
 */
async function splitInflected(rows) {
  const cand = new Map()
  for (const r of rows) {
    const alts = phraseBaseCandidates(r.word)
    if (alts.length) cand.set(r.word, alts)
  }
  const all = [...new Set([...cand.values()].flat())]
  const have = new Set()
  for (let i = 0; i < all.length; i += 300) {
    const { data } = await withRetry('기본형 확인', () =>
      db.from('shared_dictionary').select('word').in('word', all.slice(i, i + 300)).neq('archived', true),
    )
    for (const r of data ?? []) have.add(r.word)
  }
  const fresh = []
  const inflected = []
  for (const r of rows) {
    const base = (cand.get(r.word) ?? []).find((a) => have.has(a))
    if (base) inflected.push({ surface: r.word, base })
    else fresh.push(r)
  }
  return { fresh, inflected }
}

async function doImport() {
  const chunks = fs.readdirSync(OUT_DIR).filter((f) => /^chunk-\d+\.json$/.test(f)).sort()
  if (!chunks.length) { console.error('청크가 없다. 먼저 --export.'); process.exit(2) }

  const rows = []
  const problems = []
  let pending = 0
  let skipped = 0

  for (const c of chunks) {
    const outFile = path.join(OUT_DIR, c.replace(/\.json$/, '.out.json'))
    if (!fs.existsSync(outFile)) { pending++; continue }
    const input = JSON.parse(fs.readFileSync(path.join(OUT_DIR, c), 'utf8'))
    let output
    try { output = JSON.parse(fs.readFileSync(outFile, 'utf8')) }
    catch (e) { problems.push(`${c}: 출력이 JSON 이 아니다 — ${e.message}`); continue }
    if (!Array.isArray(output) || output.length !== input.length) {
      problems.push(`${c}: 개수 불일치 (입력 ${input.length} · 출력 ${output?.length ?? '배열 아님'})`)
      continue
    }
    for (let i = 0; i < output.length; i++) {
      const o = output[i]
      const want = input[i].word
      if (o?.skip === true) { skipped++; continue }
      if (!o || String(o.word ?? '').toLowerCase() !== want) {
        problems.push(`${c}[${i}]: 낱말이 어긋난다 (기대 "${want}" · 실제 "${o?.word}")`); continue
      }
      if (!o.meaning_ko || !String(o.meaning_ko).trim()) {
        problems.push(`${c}[${i}] ${want}: meaning_ko 가 비었다`); continue
      }
      if (o.cefr_level && !CEFR.includes(o.cefr_level)) {
        problems.push(`${c}[${i}] ${want}: cefr_level "${o.cefr_level}" 은 제약 밖`); continue
      }
      if (o.pos && !POS.includes(String(o.pos).toLowerCase())) {
        problems.push(`${c}[${i}] ${want}: pos "${o.pos}" 는 목록 밖`); continue
      }
      rows.push({
        word: want,
        meaning_ko: String(o.meaning_ko).trim(),
        cefr_level: o.cefr_level ?? null,
        pos: o.pos ? String(o.pos).toLowerCase() : 'other',
        example_en: o.example_en ? String(o.example_en).trim() : null,
        // RPC 가 쓰는 'lcp_llm' 은 제약이 막는다 — 허용값을 쓰고 출처는 classified_by 로 남긴다.
        source: 'ai-generated',
        classified_by: 'claude_code_opus_5',
        verified: false,
        list_tags: [SOURCE === 'analyses' ? 'kice-csat-required' : 'kice-csat-13y'],
      })
    }
  }

  console.log(`청크 ${chunks.length} · 채워진 것 ${chunks.length - pending} · 남은 것 ${pending}`)
  console.log(`건너뜀(skip) ${skipped} · 넣을 수 있는 낱말 ${rows.length}`)
  if (problems.length) {
    console.log(`\n문제 ${problems.length}건:`)
    for (const p of problems.slice(0, 20)) console.log('  ' + p)
    if (problems.length > 20) console.log(`  … 외 ${problems.length - 20}건`)
  }
  if (!commit) return console.log('\n검증만 했다. 넣으려면 --commit')
  if (!rows.length) return console.log('넣을 것이 없다.')

  // 이미 있는 낱말은 건너뛴다 — 다른 출처가 채운 것을 덮지 않는다.
  const words = rows.map((r) => r.word)
  const have = new Set()
  for (let i = 0; i < words.length; i += 400) {
    const { data } = await withRetry('중복 확인', () =>
      db.from('shared_dictionary').select('word').in('word', words.slice(i, i + 400)),
    )
    for (const r of data ?? []) have.add(r.word)
  }
  const notYet = rows.filter((r) => !have.has(r.word))

  // 굴절형은 새 표제어로 넣지 않고 기본형의 inflected_forms 로 보낸다 (splitInflected 주석 참조)
  const { fresh, inflected } = await splitInflected(notYet)
  console.log(`이미 있음 ${rows.length - notYet.length} · 굴절형(기본형에 합침) ${inflected.length} · 새로 넣을 것 ${fresh.length}`)
  for (const x of inflected) console.log(`    ~ ${x.surface} → ${x.base}`)

  for (const x of inflected) {
    let data
    try {
      ;({ data } = await withRetry(`${x.base} 조회`, () =>
        db.from('shared_dictionary').select('inflected_forms').eq('word', x.base).maybeSingle(),
      ))
    } catch (e) { console.log(`    ✗ ${e.message}`); continue }
    const cur = data?.inflected_forms ?? []
    if (cur.includes(x.surface)) continue
    try {
      await withRetry(`${x.base} 갱신`, () =>
        db.from('shared_dictionary').update({ inflected_forms: [...cur, x.surface] }).eq('word', x.base),
      )
    } catch (e) { console.log(`    ✗ ${e.message}`) }
  }

  let done = 0
  for (let i = 0; i < fresh.length; i += 100) {
    const chunk = fresh.slice(i, i + 100)
    // upsert + ignoreDuplicates — 절반 들어간 배치를 재시도해도 표제어가 두 번 생기지 않는다
    await withRetry(`적재(${i})`, () =>
      db.from('shared_dictionary').upsert(chunk, { onConflict: 'word', ignoreDuplicates: true }),
    )
    done += chunk.length
    process.stdout.write(`\r적재 ${done}/${fresh.length}`)
  }
  console.log(`\n완료. 이제 \`csat-corpus-apply.mjs --commit\` 을 다시 돌려 기출 빈도·태그를 붙인다.`)
}

if (process.argv.includes('--import')) await doImport()
else await doExport()
