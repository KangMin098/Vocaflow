// scripts/vocab/market-benchmark.mjs
//
// **시중 단어장 대비 우위 지수 — 같은 자로 잰다.**
//
// ── 왜 필요한가 ────────────────────────────────────────────────────
// "상업 단어장과 경쟁 우위" 는 그 자체로는 목표가 아니다. 무엇을 얼마나 이겨야 하는지
// 숫자가 없으면 이겼는지 졌는지도 모른다. 그래서 기준선을 **실제 시중 어휘 교재에서 재서**
// `vocab/market-spec.json` 에 고정하고(`scripts/textbook-corpus/vocab-market-spec.mjs`),
// 여기서는 우리 카탈로그를 **그 자로** 잰다. 독해 쪽 `scripts/textbook/market-benchmark.mjs`
// 와 같은 방법이다.
//
// 우위지수 = 우리 값 / 시장 값. 1.20 이상이면 그 축에서 120% 우위다.
// 종합은 산술평균이 아니라 **기하평균**이다 — 비율의 평균은 기하평균이고,
// 한 축이 0 에 가까우면 종합도 끌어내려야 맞다(예문 번역이 없는 단어장은 다른 게 좋아도 진다).
//
// ── 무엇을 지수에 넣지 않는가 ───────────────────────────────────────
// **시장에 그 칸이 아예 없는 축은 지수에 넣지 않는다.** 연어·IPA·학습자 노트가 그렇다.
// 0 으로 나누면 무한대가 나오고, 큰 수를 넣으면 "이겼다" 가 공짜로 만들어진다.
// 그런 축은 `beyondMarket` 에 **따로** 적는다 — 우위는 우위이되 같은 자로 잰 값이 아니다.
//
// 모집단: **발행 카탈로그에 실제로 실린 표제어**(`/library/vocab` 이 보여주는 세트의 낱말).
//   사전 48,969 전체를 세면 학습자가 만나지 않는 낱말까지 섞여 지수가 실제와 달라진다.
//
// 재실행 안전: 읽기만 한다.
// 실행: node scripts/vocab/market-benchmark.mjs [--json] [--out <경로>]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')

const SPEC_PATH = path.resolve('packages/library-pipeline/src/vocab/market-spec.json')
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'))

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

/** 카탈로그에서 빼는 칸 — 소스 종속 자동생성이라 학습자의 공용 서가에 안 뜬다. */
const HIDDEN_CATEGORIES = ['library_book', 'library_article']

/**
 * 페이지를 넘겨 전부 읽는다.
 *
 * ⚠️ **정렬 없이 페이지를 넘기면 안 된다.** Postgres 는 ORDER BY 가 없으면 순서를 보장하지
 *    않으므로 페이지마다 같은 행이 또 나오고 그만큼 다른 행이 빠진다. 독해 쪽 벤치마크가
 *    재고 13만 행에서 이걸로 터졌고(희귀 유형이 표본에서 통째로 빠졌다), 이 저장소는
 *    IA 수집에서도 같은 버그를 겪었다(CLAUDE.md §PDCP `sort[]=identifier asc`).
 */
async function fetchAll(table, columns, tweak = (q) => q) {
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await tweak(
      supabase.from(table).select(columns).order('id').range(from, from + PAGE - 1),
    )
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

function ratio(ours, market) {
  if (!market) return null
  return Number((ours / market).toFixed(3))
}

const pct = (n, d) => (d === 0 ? 0 : n / d)

// ── 모집단 ────────────────────────────────────────────────────────
const sets = await fetchAll('shared_word_sets', 'id, category, curation_query', (q) =>
  q.eq('is_published', true).not('category', 'in', `(${HIDDEN_CATEGORIES.join(',')})`),
)
const setIds = new Set(sets.map((s) => s.id))

/**
 * 카탈로그 세트의 표제어를 **세트마다 따로** 읽는다.
 *
 * ⚠️ `shared_words` 는 8만 행이 넘는다(도서 챕터 세트 포함). 한 번에 훑으면
 *    `canceling statement due to statement timeout` 이 난다 — `.order('id')` 로 8만 행을
 *    정렬하는 비용 때문이다. 세트별로 부르면 `set_id` 인덱스를 타서 각 질의가 작아지고,
 *    **정렬은 세트 안에서만** 하면 되므로 페이지 넘김도 안전하다.
 */
async function fetchCatalogWords(ids) {
  const words = new Set()
  const PAGE = 1000
  for (const id of ids) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('shared_words')
        .select('word')
        .eq('set_id', id)
        .order('word')
        .range(from, from + PAGE - 1)
      if (error) throw new Error(`shared_words(${id}): ${error.message}`)
      for (const w of data) words.add(w.word.toLowerCase())
      if (data.length < PAGE) break
    }
  }
  return [...words]
}

const catalogWords = await fetchCatalogWords([...setIds])

/**
 * 사전에서 카탈로그 표제어만 가져온다.
 *
 * ⚠️ 사전은 48,969 행이라 전부 받으면 역시 timeout 이다. 그렇다고 `in` 에 11,000 낱말을
 *    한 번에 넣으면 URL 이 터진다. 그래서 **쪼개서** 부른다.
 */
async function fetchDictFor(words, chunk = 400) {
  // `shared_dictionary` 의 키는 `word` 다 — `id` 컬럼이 없다.
  const cols =
    'word, example_en, example_ko, meanings_ko, senses, synonyms, antonyms, derived_forms, collocations,'
    + ' ipa, ipa_us, pos, primary_pos, korean_learner_note'
  const out = []
  for (let i = 0; i < words.length; i += chunk) {
    const { data, error } = await supabase
      .from('shared_dictionary')
      .select(cols)
      .in('word', words.slice(i, i + chunk))
    if (error) throw new Error(`shared_dictionary: ${error.message}`)
    out.push(...data)
  }
  return out
}

const dict = await fetchDictFor(catalogWords)
// 사전 표제어의 대소문자가 카탈로그와 다를 수 있어 소문자로 맞춰 중복을 접는다.
const seen = new Set()
const entries = dict.filter((d) => {
  const k = d.word.toLowerCase()
  if (seen.has(k)) return false
  seen.add(k)
  return true
})
const total = entries.length
if (total === 0) throw new Error('카탈로그 표제어가 0 이다 — 모집단을 잘못 잡았다')

// ── 표제어 한 칸의 필드 ───────────────────────────────────────────
const senseList = (d) => (Array.isArray(d.senses) ? d.senses : [])
const hasExampleEn = (d) =>
  (d.example_en && d.example_en.trim().length > 0)
  || senseList(d).some((s) => Array.isArray(s.examples) && s.examples.length > 0)

/**
 * 예문 한국어역 — 뜻풀이(`sense_ko`)가 아니라 **예문의 번역**을 찾는다.
 *
 * ⚠️ 둘을 섞으면 안 된다. `sense_ko` 는 100% 있지만 그건 낱말 뜻이지 예문 번역이 아니다.
 *    시중 단어장이 예문마다 다는 한 줄은 문장 번역이고, 그게 없으면 학습자는 예문을
 *    읽지 못한 채 넘어간다.
 *
 * ⚠️⚠️ **이 축을 세 번 틀렸다. 자리가 셋이고, 그중 화면이 읽는 것은 하나뿐이다.**
 *
 *   ① `meanings_ko[].example_ko` — **정본이자 화면이 읽는 자리.**
 *      `lib/flashcard/dict-extras.ts` 가 여기서 읽어 `CardBack`·`WordLookupPopover` 가 그린다
 *   ② `example_ko` 컬럼          — 마이그 `20260830170000`. 지금은 화면이 읽지 않는다
 *   ③ `senses[].examples_ko`     — 뜻별 예문의 짝. 지금은 화면이 읽지 않는다
 *
 * ①을 빠뜨린 채 재는 바람에 **V2 가 0.0% 로 보였다.** 실제로는 11,166/11,183 = 99.8% 가
 * 이미 채워져 있었고 학습자도 보고 있었다. 그 오측정 위에서 마이그레이션 하나와 번역
 * 3,450 문장이 만들어졌다 — 이미 있던 것을 다른 칸에 다시 쓴 셈이다.
 *
 * **교훈은 이 저장소가 이미 적어 둔 것이다**: "데이터가 있다는 것과 학습자가 본다는 것은
 * 다른 사실" (`VocabSetCard.test.tsx` 머리말). 여기서는 그 반대 방향으로 틀렸다 —
 * **학습자는 보고 있는데 내가 못 찾고 있었다.** 지표를 만들 때 *화면이 어디서 읽는지*를
 * 먼저 확인했어야 했다.
 */
const hasExampleKo = (d) => {
  // ① 정본 — 화면이 읽는 자리부터 본다.
  const mk = Array.isArray(d.meanings_ko) ? d.meanings_ko : []
  if (mk.some((m) => typeof m?.example_ko === 'string' && m.example_ko.trim().length > 0)) {
    return true
  }
  if (typeof d.example_ko === 'string' && d.example_ko.trim().length > 0) return true
  return senseList(d).some((s) => {
    const ko = s.examples_ko ?? s.example_ko ?? null
    return Array.isArray(ko)
      ? ko.some((x) => typeof x === 'string' && x.trim().length > 0)
      : typeof ko === 'string' && ko.trim().length > 0
  })
}

const arr = (v) => (Array.isArray(v) ? v : [])
const hasDerived = (d) => arr(d.derived_forms).length > 0
const hasSynAnt = (d) => arr(d.synonyms).length > 0 || arr(d.antonyms).length > 0
const hasPolysemy = (d) => senseList(d).length > 1
const hasPos = (d) => !!(d.primary_pos || d.pos)
const hasColloc = (d) => arr(d.collocations).length > 0
const hasIpa = (d) => !!(d.ipa || d.ipa_us)
const hasNote = (d) => !!d.korean_learner_note

const r = spec.entryFields.rates

const V1 = { ours: pct(entries.filter(hasExampleEn).length, total), market: r.exampleEn }
const V2 = { ours: pct(entries.filter(hasExampleKo).length, total), market: r.exampleKo }
const V3 = { ours: pct(entries.filter(hasDerived).length, total), market: r.derived }
const V4 = { ours: pct(entries.filter(hasSynAnt).length, total), market: r.synAnt }
const V5 = { ours: pct(entries.filter(hasPolysemy).length, total), market: r.polysemy }
const V6 = { ours: pct(entries.filter(hasPos).length, total), market: r.pos }

// ── V7 묶음 원리 다양성 ───────────────────────────────────────────
//
// 시장은 PART 로 묶음 원리를 드러낸다(실측 라벨 → 우리 청사진). 아래 표는 **측정된 라벨**을
// 우리 id 로 옮긴 것이지 새로 지은 분류가 아니다.
//
// 독해 쪽과 같은 규칙을 쓴다: **관문을 못 넘으면 폭을 인정하지 않는다.** 시장 표준 축을
// 다 갖추지 못한 채 잡다한 축이 많은 것을 우위로 적으면 안 되기 때문이다.
const MARKET_AXIS_TO_BLUEPRINT = {
  '고등 핵심 어휘': 'freq-tier',
  '최중요 어휘': 'freq-tier',
  '어원별 어휘': 'root-etymology',
  '어원으로 익히는 어휘': 'root-etymology',
  '접두사': 'root-etymology',
  '어근': 'root-etymology',
  '접미사': 'root-etymology',
  '주제별 어휘': 'topic-field',
  '주제별로 외우는 어휘': 'topic-field',
  '여러 가지 뜻을 가진 어휘': 'polysemy',
  '반의어 / 혼동어 / 다의어': 'antonym-pair',
  '반의어 혼동어': 'confusable',
  '함께 외우면 좋은 어휘': 'collocation',
  '원리를 알면 쉬운 숙어': 'phrasal-idiom',
}
const marketAxes = new Set(
  spec.partAxes.map((p) => MARKET_AXIS_TO_BLUEPRINT[p.label]).filter(Boolean),
)
const ourAxes = new Set(
  sets.map((s) => s.curation_query?.blueprint).filter(Boolean),
)
const coveredAxes = [...marketAxes].filter((a) => ourAxes.has(a))
const beyondAxes = [...ourAxes].filter((a) => !marketAxes.has(a))
const gate = marketAxes.size ? coveredAxes.length / marketAxes.size : 0
const V7 = {
  ours: gate >= 1 ? ourAxes.size : coveredAxes.length,
  market: marketAxes.size,
  gate: Number(gate.toFixed(3)),
}

const AXES = [
  { id: 'V1', name: '예문 보유율', ...V1, unit: '%', why: '예문이 없으면 뜻만 외우게 된다 — 맥락 없는 어휘는 인출되지 않는다' },
  { id: 'V2', name: '예문 한국어역 보유율', ...V2, unit: '%', why: '번역이 없으면 예문을 읽지 못한 채 넘어간다 — 시중이 전 표제어에 다는 칸' },
  { id: 'V3', name: '파생어 보유율', ...V3, unit: '%', why: '한 어근에서 갈라진 말을 함께 줘야 낱말당 회수가 늘어난다' },
  { id: 'V4', name: '유의어·반의어 보유율', ...V4, unit: '%', why: '뜻이 겹치고 갈리는 자리를 보여야 변별이 생긴다' },
  { id: 'V5', name: '다의어 뜻 분리율', ...V5, unit: '%', why: '뜻이 여럿인 낱말을 한 덩어리로 주면 어느 뜻도 남지 않는다' },
  { id: 'V6', name: '품사 표시율', ...V6, unit: '%', why: '품사를 모르면 문장에 넣지 못한다' },
  { id: 'V7', name: '묶음 원리 다양성 (시장 PART 축 대비)', ...V7, unit: '종', why: '시장 표준 축을 다 갖춘 뒤의 폭이 기능 우위다 — 관문을 못 넘으면 폭을 인정하지 않는다' },
].map((a) => ({ ...a, index: ratio(a.ours, a.market) }))

// 종합은 기하평균 — 한 축이 0 이면 종합도 0 이어야 맞다.
const idx = AXES.map((a) => a.index)
const overall = idx.every((x) => x != null)
  ? (idx.some((x) => x === 0)
    ? 0
    : Number(Math.exp(idx.reduce((s, x) => s + Math.log(x), 0) / idx.length).toFixed(3)))
  : null

/**
 * 시장에 칸이 없는 축 — **지수에 넣지 않는다.**
 * 0 으로 나눌 수 없고, 큰 수를 넣으면 우위가 공짜로 만들어진다.
 */
const beyondMarket = [
  { id: 'B1', name: '연어 보유율', ours: pct(entries.filter(hasColloc).length, total), why: '시중 표제어 칸에 연어 자리가 없다 — 덩어리로 외우는 축을 통째로 더한다' },
  { id: 'B2', name: '발음기호 보유율', ours: pct(entries.filter(hasIpa).length, total), why: '시중도 싣지만 추출로는 셀 수 없어(대괄호가 깨진다) 같은 자로 못 잰다' },
  { id: 'B3', name: '한국어 학습자 노트 보유율', ours: pct(entries.filter(hasNote).length, total), why: "시중의 '문해력 UP' 류는 산발적이라 보유율 기준선이 없다" },
]

const report = {
  generatedAt: new Date().toISOString(),
  specGeneratedAt: spec.generatedAt,
  population: {
    publishedSets: sets.length,
    catalogHeadwords: total,
    note: '발행 카탈로그에 실제로 실린 표제어만 센다 — 사전 전체를 세면 학습자가 만나지 않는 낱말이 섞인다.',
  },
  marketSample: {
    documents: spec.provenance.documentsMeasured,
    entries: spec.provenance.entriesMeasured,
    limitation: spec.provenance.limitation,
  },
  axes: AXES,
  overall,
  beyondMarket,
  axisDetail: { v7Covered: coveredAxes.sort(), v7Missing: [...marketAxes].filter((a) => !ourAxes.has(a)).sort(), v7Beyond: beyondAxes.sort() },
}

const outFlag = process.argv.indexOf('--out')
const outPath = outFlag > -1 ? process.argv[outFlag + 1] : 'docs/reports/vocab-market-benchmark.json'

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true })
  fs.writeFileSync(path.resolve(outPath), `${JSON.stringify(report, null, 2)}\n`)
  console.log(`시중 단어장 대비 우위지수 — 발행 ${sets.length}권 · 표제어 ${total.toLocaleString()}`)
  console.log(`시장 표본: ${spec.provenance.documentsMeasured}종 · ${spec.provenance.entriesMeasured}칸 (하한값)\n`)
  const bar = (i) => (i == null ? '   —  ' : i >= 1 ? `▲ ${i.toFixed(2)}` : `▼ ${i.toFixed(2)}`)
  for (const a of AXES) {
    const o = a.unit === '%' ? `${(a.ours * 100).toFixed(1)}%` : `${a.ours}종`
    const m = a.unit === '%' ? `${(a.market * 100).toFixed(1)}%` : `${a.market}종`
    console.log(`  ${a.id} ${a.name.padEnd(34)} 우리 ${o.padStart(7)}  시장 ${m.padStart(7)}  ${bar(a.index)}`)
  }
  console.log(`\n  종합 우위지수 (기하평균) = ${overall ?? '측정 불가'}`)
  if (V7.gate < 1) console.log(`  ⚠️ V7 관문 미통과 (${(V7.gate * 100).toFixed(0)}%) — 폭을 인정하지 않고 관문 값으로 눌렀다`)
  console.log('\n  시장에 칸이 없어 지수에 넣지 않은 축:')
  for (const b of beyondMarket) console.log(`  ${b.id} ${b.name.padEnd(34)} 우리 ${(b.ours * 100).toFixed(1).padStart(6)}%`)
  console.log(`\n리포트 → ${outPath}`)
}
