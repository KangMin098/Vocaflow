// scripts/vocab/example-ko-drain-export.mjs
//
// **예문 번역 드레인 ①/③ — Claude Code 가 쓸 몫을 청크로 뽑는다.**
//
// ── 왜 이 일인가 (실측 2026-08-30) ──────────────────────────────────
// 시중 단어장 대비 우위지수(`scripts/vocab/market-benchmark.mjs`)에서 **여섯 축을 이기고도
// 종합이 0** 이다. 기하평균이라 한 축이 0 이면 종합도 0 인데, 그 축이 여기다:
//
//   V2 예문 한국어역 — 우리 **0.0%** / 시장 **92.1%**
//
// 시중 단어장은 예문마다 번역을 단다. 없으면 학습자는 예문을 **읽지 못한 채 넘어간다** —
// 예문이 있으나 마나가 되고, 맥락 학습(§학습원칙5 Context-Dependent)이 성립하지 않는다.
// 번역은 문장을 읽어야 나오므로 결정론으로 못 만든다. **그게 Claude Code 가 할 일이다.**
//
// ── 저장 자리 ────────────────────────────────────────────────────────
// `shared_dictionary.senses` 는 jsonb 다. 번역은 각 뜻의 `examples_ko` 에 넣는다 —
// **마이그레이션이 필요 없다**(CLAUDE.md §🤖). `examples` 와 **같은 길이의 배열**이라
// 인덱스로 짝이 맞는다.
//
// ⚠️ 이 드레인이 다루는 것은 **뜻마다 붙은 예문**뿐이다. 표제어 11,183 중 2,696 만
//   그런 예문을 갖고 있고, 나머지 8,487 은 `example_en` 컬럼에만 예문이 있는데
//   그 자리에 짝이 되는 `example_ko` 컬럼이 **없다**. 그건 마이그레이션이 필요해
//   이 스크립트 밖의 결정이다 — 여기서 조용히 다른 자리에 넣지 않는다.
//
// ── 재실행 안전 ──────────────────────────────────────────────────────
// **이미 채워진 뜻은 뽑지 않는다.** `examples_ko` 가 `examples` 와 같은 길이로 이미 있으면
// 건너뛴다. 몇 번을 돌려도 남은 몫만 나오고, 다 채우면 0 건이 나온다.
// DB 는 읽기만 한다. 청크 파일은 덮어쓴다.
//
// 실행:
//   node scripts/vocab/example-ko-drain-export.mjs [--size 120] [--max 5]
//   → scripts/vocab/example-ko-drain/chunk-NN.json

import fs from 'node:fs'
import path from 'node:path'

import { exampleTexts } from './_example-shape.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}
/** 한 청크에 담을 **문장** 수. 낱말이 아니라 문장으로 세야 작업량이 고르다. */
const SIZE = Number(arg('size', 120))
/** 이번에 만들 청크 수 상한. 없으면 남은 몫 전부. */
const MAX = arg('max') ? Number(arg('max')) : Infinity

const OUT_DIR = path.resolve('scripts/vocab/example-ko-drain')
const HIDDEN = ['library_book', 'library_article']

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

/** 발행 카탈로그의 표제어 — 학습자가 실제로 만나는 낱말만 채운다. */
async function catalogWords() {
  const { data: sets, error } = await supabase
    .from('shared_word_sets')
    .select('id')
    .eq('is_published', true)
    .not('category', 'in', `(${HIDDEN.join(',')})`)
  if (error) throw new Error(`shared_word_sets: ${error.message}`)

  const words = new Set()
  const PAGE = 1000
  // ⚠️ 세트별로 나눠 부른다 — `shared_words` 8만 행을 한 번에 훑으면 statement timeout.
  //    (`market-benchmark.mjs` 가 같은 함정을 밟았다.)
  for (const s of sets) {
    for (let from = 0; ; from += PAGE) {
      const { data, error: e } = await supabase
        .from('shared_words')
        .select('word')
        .eq('set_id', s.id)
        .order('word')
        .range(from, from + PAGE - 1)
      if (e) throw new Error(`shared_words(${s.id}): ${e.message}`)
      for (const w of data) words.add(w.word.toLowerCase())
      if (data.length < PAGE) break
    }
  }
  return [...words]
}

async function fetchSenses(words, chunk = 400) {
  const out = []
  for (let i = 0; i < words.length; i += chunk) {
    const { data, error } = await supabase
      .from('shared_dictionary')
      .select('word, senses, example_en, example_ko')
      .in('word', words.slice(i, i + chunk))
    if (error) throw new Error(`shared_dictionary: ${error.message}`)
    out.push(...data)
  }
  return out
}

/** 이 뜻이 아직 번역이 필요한가. **같은 길이로 이미 있으면 건너뛴다.** */
function needsKo(sense) {
  const ex = exampleTexts(sense?.examples)
  if (ex.length === 0) return false
  const ko = Array.isArray(sense?.examples_ko) ? sense.examples_ko : []
  return ko.filter((s) => typeof s === 'string' && s.trim().length > 0).length < ex.length
}

const words = await catalogWords()
const rows = await fetchSenses(words)

/** 할 몫 — 문장 단위로 편다. 낱말 하나가 여러 뜻·여러 문장을 가질 수 있다. */
const todo = []
for (const r of rows) {
  const senses = Array.isArray(r.senses) ? r.senses : []
  senses.forEach((se, idx) => {
    if (!needsKo(se)) return
    todo.push({
      // 어디에 넣을 번역인가. **import 가 이 값으로 쓰는 자리를 가른다.**
      target: 'sense',
      word: r.word,
      sense_idx: typeof se.sense_idx === 'number' ? se.sense_idx : idx,
      pos: se.pos ?? null,
      sense_ko: se.sense_ko ?? null,
      // **문장 텍스트로 펴서** 내보낸다 — 객체 모양은 여기서 흡수했다.
      examples: exampleTexts(se.examples),
      // 채울 자리 — Claude Code 가 `examples` 와 **같은 길이**로 채운다.
      examples_ko: [],
    })
  })

  // 대표 예문(`example_en` 컬럼)의 번역 — 마이그레이션 `20260830170000` 로 열린 자리.
  //
  // ⚠️ **뜻마다 붙은 예문과 섞지 않는다.** 이 예문이 몇 번 뜻의 것인지 알 수 없어서
  //   `senses[0]` 에 밀어 넣으면 짝이 어긋난다. `example_ko` 는 오직 `example_en` 과 짝이다.
  const topEn = typeof r.example_en === 'string' ? r.example_en.trim() : ''
  const topKo = typeof r.example_ko === 'string' ? r.example_ko.trim() : ''
  if (topEn.length > 0 && topKo.length === 0) {
    todo.push({
      target: 'top',
      word: r.word,
      sense_idx: null,
      pos: null,
      // 대표 예문에는 뜻 번호가 없다. 첫 뜻의 뜻풀이를 참고로 실어 준다(번역할 때 도움이 된다).
      sense_ko: senses[0]?.sense_ko ?? null,
      examples: [topEn],
      examples_ko: [],
    })
  }
}

// 낱말 순으로 고정한다 — 재실행해도 같은 청크가 나와야 이어 작업할 수 있다.
// 같은 낱말 안에서는 뜻별 예문을 먼저, 대표 예문(sense_idx 가 null)을 뒤에 둔다.
todo.sort(
  (a, b) =>
    a.word.localeCompare(b.word)
    || (a.sense_idx ?? Number.MAX_SAFE_INTEGER) - (b.sense_idx ?? Number.MAX_SAFE_INTEGER),
)

const sentences = todo.reduce((s, t) => s + t.examples.length, 0)
console.log(`카탈로그 표제어 ${words.length.toLocaleString()} · 번역 필요 뜻 ${todo.length.toLocaleString()} · 문장 ${sentences.toLocaleString()}`)

if (todo.length === 0) {
  console.log('남은 몫이 없다 — 다 채워졌다.')
  process.exit(0)
}

fs.mkdirSync(OUT_DIR, { recursive: true })

// 문장 수로 자른다(뜻 수가 아니라) — 뜻마다 문장 수가 달라 뜻으로 자르면 청크가 들쭉날쭉하다.
const chunks = []
let cur = []
let curSentences = 0
for (const t of todo) {
  if (curSentences > 0 && curSentences + t.examples.length > SIZE) {
    chunks.push(cur)
    cur = []
    curSentences = 0
  }
  cur.push(t)
  curSentences += t.examples.length
}
if (cur.length) chunks.push(cur)

const made = chunks.slice(0, MAX === Infinity ? chunks.length : MAX)
for (const [i, items] of made.entries()) {
  const file = path.join(OUT_DIR, `chunk-${String(i).padStart(2, '0')}.json`)
  fs.writeFileSync(
    file,
    `${JSON.stringify(
      {
        chunk: i,
        generatedAt: new Date().toISOString(),
        instruction:
          'examples_ko 를 examples 와 **같은 길이**로 채운다. 한 문장에 한 줄. '
          + '직역이 아니라 학습자가 읽을 자연스러운 한국어로 쓰되, 표제어의 그 뜻(sense_ko)이 '
          + '문장에서 어떻게 쓰였는지 드러나게 옮긴다. 빈 문자열을 넣지 않는다 — '
          + '넣으면 import 가 건너뛰고 그 자리는 영영 구멍으로 남는다.',
        items,
      },
      null,
      2,
    )}\n`,
  )
}

console.log(`청크 ${made.length}개 → ${OUT_DIR}/chunk-NN.json (남은 청크 ${chunks.length - made.length})`)
