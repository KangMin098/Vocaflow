// scripts/vocab/choice-benchmark.mts
//
// **선택 지수 — 학습자가 한 권을 고르는 데 쓰는 근거를 시중 단어장과 같은 자로 잰다.**
//
// ── 왜 내용 벤치마크로는 부족한가 (실측 2026-08-30) ───────────────────
// `scripts/vocab/market-benchmark.mjs` 는 **산 뒤에** 쓰는 것을 잰다(예문·파생어·유의어).
// 그 지수는 **1.60** 이다. 그런데 같은 날 `/library/vocab` 은 "브랜딩을 했는데 그대로" 였다.
// 두 사실이 모순이 아니다 — **고를 근거를 안 줬기 때문이다.** 학습자는 표제어 칸을 열기
// 전에 서가에서 한 번 고르고, 거기서 지는 것은 내용 지수에 잡히지 않는다.
//
// 그래서 시장 규격에 `shelfSignals` 를 실측해 넣고(`scripts/textbook-corpus/vocab-market-spec.mjs`),
// 여기서 우리 카탈로그를 **그 열한 신호로** 잰다.
//
//   선택 지수 = (우리 한 권당 평균 신호 수) / (시중 한 권당 평균 신호 수)
//
// ── 왜 보유율의 기하평균이 아니라 "신호 수" 인가 ───────────────────────
// 보유율 비는 **천장에 막힌다.** 시장이 100% 인 신호(판권면·목차·대상학년)에서 우리가
// 아무리 잘해도 비는 1.00 이 최대이고, 그러면 "120% 우위" 가 산술적으로 불가능한 목표가
// 된다. 한 권이 주는 **근거의 개수**는 천장이 없다 — 시장에 없는 신호(개인화된 학습 플랜,
// 낱말 실측 사다리)를 더하면 실제로 넘어설 수 있고, 그것이 학습자가 겪는 차이이기도 하다.
//
// ── 지어내지 않는다 ────────────────────────────────────────────────
// 우리 쪽 신호는 **화면이 실제로 그리는 조건**을 그대로 옮긴다. 컴포넌트가 `set.kind` 가
// 없으면 그 줄을 빼므로, 여기서도 blueprint 없는 세트는 `preface` 를 못 준 것으로 센다.
// "DB 에 값이 있다" 가 아니라 "학습자가 본다" 가 기준이다.
//
// 재실행 안전: 읽기만 한다.
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/choice-benchmark.mts [--json] [--out <경로>]

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { rungForSet } from '@/lib/library/vocab/rung'
import { setKindOf } from '@/lib/library/vocab/set-kind'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
  }
}

const SPEC_PATH = path.resolve('packages/library-pipeline/src/vocab/market-spec.json')
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'))
if (!spec.shelfSignals) {
  console.error(
    'market-spec.json 에 shelfSignals 가 없다 — 먼저 `node scripts/textbook-corpus/vocab-market-spec.mjs` 를 돌릴 것.',
  )
  process.exit(1)
}

const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 부재 (apps/web/.env.local)')
  process.exit(1)
}
const client = createClient(url, key, { auth: { persistSession: false } })

/** 학습자의 공용 서가에 뜨지 않는 칸 — `lib/library/vocab/queries.ts` 와 같아야 한다. */
const HIDDEN_CATEGORIES = ['library_book', 'library_article']

interface SetRow {
  id: string
  title: string
  slug: string | null
  category: string
  cefr_level: string | null
  ladder_step: number | null
  word_count: number | null
  cover_image_url: string | null
  brand_fingerprint: string | null
  curation_query: {
    blueprint?: string
    qa?: { checked: number; passed: number }
    level?: { median: number }
  } | null
}

const { data: rawSets, error: setErr } = await client
  .from('shared_word_sets')
  .select(
    'id, title, slug, category, cefr_level, ladder_step, word_count, cover_image_url, brand_fingerprint, curation_query',
  )
  .eq('is_published', true)
  .not('category', 'in', `(${HIDDEN_CATEGORIES.join(',')})`)
if (setErr) throw new Error(`shared_word_sets: ${setErr.message}`)
const sets = (rawSets ?? []) as SetRow[]

/**
 * 세트마다 **목차가 될 만한 묶음**이 몇 개인지 센다.
 *
 * ⚠️ 세트별로 따로 부른다. `shared_words` 는 8만 행이 넘어서 한 번에 훑으면
 *    statement timeout 이 난다 — `market-benchmark.mjs` 가 같은 이유로 이렇게 한다.
 *
 * ⚠️ **`chapter` 만 센다.** 미리보기 모달은 챕터로만 아코디언을 만든다 —
 *    `korean_learner_note` 는 챕터 안에서 균일할 때 붙는 **라벨**이지 묶음 축이 아니다
 *    (`VocabSetPreviewModal.tsx:255`). 라벨을 축으로 세면 화면에 없는 목차를 있다고
 *    세게 된다.
 */
async function groupCountOf(setId: string): Promise<{ groups: number; withPron: number; words: number }> {
  const groups = new Set<string>()
  let withPron = 0
  let words = 0
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from('shared_words')
      .select('chapter, pronunciation')
      .eq('set_id', setId)
      .order('word')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`shared_words(${setId}): ${error.message}`)
    const rows = (data ?? []) as { chapter: number | null; pronunciation: string | null }[]
    for (const r of rows) {
      words += 1
      if (r.pronunciation) withPron += 1
      if (r.chapter != null) groups.add(`c${r.chapter}`)
    }
    if (rows.length < PAGE) break
  }
  return { groups: groups.size, withPron, words }
}

/**
 * 열한 신호 — **시장 규격과 같은 키를 쓴다.** 키가 어긋나면 다른 것을 비교하게 된다.
 *
 * 값은 "학습자가 그 신호를 실제로 받는가" 다. 근거는 화면 컴포넌트의 렌더 조건이고,
 * 각 줄 주석에 그 자리를 적는다 — 화면이 바뀌면 여기도 바뀌어야 한다.
 */
const SIGNAL_KEYS = [
  'colophon', 'isbn', 'toc', 'studyPlan', 'preface',
  'dayPacing', 'reviewTest', 'seriesGuide', 'targetGrade', 'extras', 'proofread',
] as const
type SignalKey = (typeof SIGNAL_KEYS)[number]

/** 부가자료로 인정할 발음기호 보유율 — 절반도 없으면 학습자가 "있다" 고 느끼지 못한다. */
const PRON_RATE_FOR_EXTRAS = 0.5

const perSet: Array<{ id: string; title: string; signals: SignalKey[] }> = []
const hit: Record<SignalKey, number> = Object.fromEntries(
  SIGNAL_KEYS.map((k) => [k, 0]),
) as Record<SignalKey, number>

for (const s of sets) {
  const { groups, withPron, words } = await groupCountOf(s.id)
  const { rung } = rungForSet({
    category: s.category,
    cefrLevel: s.cefr_level,
    ladderStep: s.ladder_step,
    // ⚠️ **실측 중앙값을 빼고 부르면 이 지수가 화면보다 후해진다.** 두 화면
    //   (`VocabColophon` · `VocabSetCard`)은 세트를 통째로 넘기므로 `level` 이 함께 간다.
    //   그 값이 사다리 위(V8+)면 화면은 계단을 비우는데(`basis: 'above-ladder'`),
    //   여기서만 빼면 CEFR 라벨로 내려가 **띠가 없는 권에 `seriesGuide` 를 준다.**
    //   기준은 "DB 에 값이 있는가" 가 아니라 **학습자가 보는가** 다.
    level: s.curation_query?.level ?? null,
  })
  const kind = setKindOf(s.curation_query?.blueprint)
  const wordCount = words || (s.word_count ?? 0)

  const got: SignalKey[] = []
  // 판권면 — `VocabColophon` 이 판차·발행일을 늘 그린다(created_at 은 항상 있다).
  got.push('colophon')
  // 판권 번호 — ISBN 자리. `queries.ts` 가 slug 없는 세트에는 만들지 않는다.
  if (s.slug) got.push('isbn')
  // 목차 — 미리보기 모달의 챕터/라벨 아코디언. 묶음이 둘 이상이어야 목차 노릇을 한다.
  if (groups >= 2) got.push('toc')
  // 학습 플랜 — 미리보기 모달의 `plan` 블록. 낱말이 있어야 계산된다.
  if (wordCount > 0) got.push('studyPlan')
  // 표제어 선정 근거 — `VocabColophon` 은 `set.kind.principle` 이 없으면 그 줄을 뺀다.
  if (kind?.principle) got.push('preface')
  // 하루치 — 미리보기 모달의 `computeStudyPlan` 이 **모든 세트에** "하루 22단어 · 약 D일" 을
  //   그린다(`VocabSetPreviewModal.tsx:78`). 낱말 수만 있으면 계산되고 계단은 필요 없다.
  //
  //   ⚠️ 이 줄은 한때 `rung.wordsPerDay` 에 묶여 있어 84.3% 로 나왔다 — **판권면만 보고
  //      모달을 안 봤다.** 기준은 "DB 에 값이 있는가" 도 "판권면이 적는가" 도 아니라
  //      **학습자가 보는가** 다.
  if (wordCount > 0) got.push('dayPacing')
  // 복습 안내 — 학습 플랜 블록 안의 FSRS 문구. 같은 조건에서 함께 뜬다.
  if (wordCount > 0) got.push('reviewTest')
  // 시리즈 안내 — 판권면의 사다리 띠. 계단이 있으면 그 칸을 대괄호로 세우고,
  //   **학령 밖이어도 띠는 그린다**(어느 칸도 안 세우고 '학령 밖' 을 적는다).
  //   띠를 통째로 빼면 그 권만 시리즈에서 떨어져 나온 것처럼 보인다 — 실측 2026-08-31
  //   에 55권 중 18권이 그 상태였다.
  if (rung || s.curation_query?.level) got.push('seriesGuide')
  // 대상 수준 — 계단이 있으면 판권면 '단계' 줄, 없으면 각인된 V-Level 중앙값('대상 수준' 줄).
  //   사다리 밖이라고 수준이 없는 것이 아니다.
  if (rung || s.curation_query?.level) got.push('targetGrade')
  // 부가자료 — 발음기호. 절반 넘게 있어야 "이 권은 발음을 준다" 가 성립한다.
  if (words > 0 && withPron / words >= PRON_RATE_FOR_EXTRAS) got.push('extras')
  // 감수 — 각인된 자동 검수 수치. 없으면 판권면이 그 줄을 뺀다(0/0 은 "검수 0 통과" 로 읽힌다).
  if ((s.curation_query?.qa?.checked ?? 0) > 0) got.push('proofread')

  for (const k of got) hit[k] += 1
  perSet.push({ id: s.id, title: s.title, signals: got })
}

/**
 * **시장에 칸이 없어 지수에 넣지 않은 선택 신호.**
 *
 * 위 열한 신호는 시중 교재에서 실측한 것이라 우리도 같은 자로 잴 수 있다. 그런데 지면이
 * **구조상 못 하는** 선택 근거가 따로 있고, 그것을 열한 개에 섞으면 지수가 공짜로 올라간다
 * (`market-benchmark.mjs` 의 `beyondMarket` 과 같은 규칙 — 우위는 우위이되 같은 자로 잰
 * 값이 아니다).
 *
 * 그래서 **지수에서 빼고 여기 따로 적는다.**
 */
const beyondMarket = [
  {
    id: 'C1',
    name: '진도 반영 학습 플랜',
    ours: sets.filter((s) => (s.word_count ?? 0) > 0).length / (sets.length || 1),
    why: '구독 뒤 미리보기가 "남은 N단어 · 약 D일 더" 로 다시 계산한다. 지면의 "30일 완성" 은 인쇄 시점에 고정돼 학습자가 어디까지 왔는지 모른다',
  },
  {
    id: 'C2',
    name: '표제어 난이도 실측 공개',
    ours: sets.filter((s) => !!s.curation_query?.level).length / (sets.length || 1),
    why: '판권면이 "대상 수준 V8 (V3~V11 · 500낱말 실측)" 처럼 **세어 본 값**을 싣는다. 지면은 대상 학년을 선언할 뿐 표제어를 세어 말하지 않는다',
  },
  {
    id: 'C3',
    name: '계단 근거 공개',
    ours:
      sets.filter((s) => s.ladder_step != null || !!s.curation_query?.level).length
      / (sets.length || 1),
    why: '"왜 이 권이 5단인가" 에 저작·실측·추정 중 무엇인지 판권면이 밝힌다. 근거를 밝히는 지면 단어장을 표본에서 보지 못했다',
  },
]

/**
 * 카탈로그 전체에 걸리는 것이라 **권별 비율로 잴 수 없는** 신호. 세지 않고 사실만 적는다.
 * 지면은 이 자리가 구조적으로 비어 있다 — 한 번 인쇄되면 독자를 알 수 없다.
 */
const catalogLevelBeyond = [
  '개인 맞춤 추천 — 진단 V-Level·트랙 기반으로 권을 골라 **이유와 함께** 보여 준다'
  + ' (`recommend_word_sets_for_user`). 권별 비율이 아니라 화면 전체의 성질이라 지수에 넣지 않는다.',
]

const n = sets.length
const ourRates = Object.fromEntries(
  SIGNAL_KEYS.map((k) => [k, n === 0 ? 0 : Number((hit[k] / n).toFixed(3))]),
) as Record<SignalKey, number>
const ourMean = n === 0 ? 0 : perSet.reduce((a, b) => a + b.signals.length, 0) / n
const marketMean: number = spec.shelfSignals.meanSignalsPerBook
const index = Number((ourMean / marketMean).toFixed(3))

const report = {
  $schema: 'vocab-choice-benchmark/1',
  generatedAt: new Date().toISOString(),
  catalog: { sets: n, words: sets.reduce((a, s) => a + (s.word_count ?? 0), 0) },
  market: {
    booksMeasured: spec.shelfSignals.booksMeasured,
    meanSignalsPerBook: marketMean,
    rates: spec.shelfSignals.rates,
  },
  ours: { meanSignalsPerSet: Number(ourMean.toFixed(3)), rates: ourRates },
  /** 지수에 **넣지 않은** 우위 — 시장에 그 칸이 아예 없어 같은 자로 못 잰다. */
  beyondMarket,
  catalogLevelBeyond,
  beyondMarket,
  catalogLevelBeyond,
  choiceIndex: index,
  /** 신호별 비 — 어디서 지고 있는지. 시장이 0 인 신호는 나누지 않는다(무한대가 된다). */
  perSignalRatio: Object.fromEntries(
    SIGNAL_KEYS.map((k) => {
      const m = spec.shelfSignals.rates[k]
      return [k, m ? Number((ourRates[k] / m).toFixed(3)) : null]
    }),
  ),
  weakest: [...SIGNAL_KEYS]
    .filter((k) => spec.shelfSignals.rates[k] > 0)
    .sort((a, b) => ourRates[a] / spec.shelfSignals.rates[a] - ourRates[b] / spec.shelfSignals.rates[b])
    .slice(0, 5),
}

const outArg = process.argv.indexOf('--out')
const outPath = outArg >= 0 ? process.argv[outArg + 1]! : 'docs/reports/vocab-choice-benchmark.json'
fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true })
fs.writeFileSync(path.resolve(outPath), `${JSON.stringify(report, null, 2)}\n`)

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.info(`선택 지수 — 발행 ${n}권 vs 시중 ${spec.shelfSignals.booksMeasured}종`)
  console.info('')
  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length))
  for (const k of SIGNAL_KEYS) {
    const m = spec.shelfSignals.rates[k] as number
    const r = report.perSignalRatio[k]
    const mark = r == null ? '  —' : r >= 1.2 ? ' ▲' : r >= 1 ? ' =' : ' ▼'
    console.info(
      `  ${pad(k, 12)} 우리 ${pad((ourRates[k] * 100).toFixed(1) + '%', 7)}`
      + ` 시장 ${pad((m * 100).toFixed(1) + '%', 7)}${mark} ${r == null ? '' : r.toFixed(2)}`,
    )
  }
  console.info('')
  console.info(`  한 권당 선택 근거   우리 ${ourMean.toFixed(2)}개  ·  시중 ${marketMean.toFixed(2)}개`)
  console.info(`  **선택 지수 = ${index.toFixed(2)}**  (목표 1.20 → 한 권당 ${(marketMean * 1.2).toFixed(2)}개)`)
  console.info('')
  console.info(`  가장 약한 신호: ${report.weakest.join(' · ')}`)
  console.info('')
  console.info('  시장에 칸이 없어 **지수에 넣지 않은** 선택 신호:')
  for (const b of beyondMarket) {
    console.info(`    ${b.id} ${pad(b.name, 24)} 우리 ${(b.ours * 100).toFixed(1)}%`)
  }
  for (const line of catalogLevelBeyond) {
    console.info(`    (카탈로그 전체) ${line.split(' —')[0]}`)
  }
  console.info(`리포트 → ${outPath}`)
}
