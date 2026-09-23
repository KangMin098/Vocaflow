// apps/web/scripts/video-source.mts
//
// **영상 공장 1단계 — 원료를 뽑는다** (CLAUDE.md §🤖 드레인 3단 중 export).
//
//   1. `pnpm video:source`  ← 이 파일. 플랫폼 실측을 `source-bundle.json` 으로 뽑는다
//   2. Claude Code          ← 설계도의 나레이션·카피를 채운다 (LLM 작업 = 배치)
//   3. `pnpm video:render`  ← mp4 를 찍는다
//
// **재실행 안전**: 같은 DB 상태면 같은 파일이 나온다(정렬을 전부 고정했다). 몇 번 돌려도 같다.
//
// 왜 번들을 따로 두는가 — `packages/video-factory` 는 **패키지**고 `apps/web` 은 **앱**이다.
// 패키지가 앱을 import 하면 의존이 거꾸로 선다. 그래서 앱이 뽑아서 넘긴다.
// 대신 낡을 수 있으므로 회귀(`__tests__/video-source.test.ts`)가 번들과 소스의 개수를 대조한다.

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DIFFERENTIATORS } from '../src/lib/marketing/differentiators'
import { buildHeroDemo, HERO_PASSAGE } from '../src/lib/marketing/hero-demo'
import { TYPE_GUIDE } from '../src/lib/textbook/type-guide'
import { activities } from '../src/lib/framework/registry'
import { FACETS, FACET_ORDER, SPINE, STAGES, STAGE_ORDER } from '../src/lib/framework/axes'
import {
  ACCURACY_HOLD_BELOW,
  ACCURACY_TARGET,
  DAILY_BLOCKS,
  ENCOUNTERS_FLOOR,
  HITS_TO_PASS,
  NEW_FACETS_PER_SESSION,
} from '../src/lib/framework/flow'
import { SERIES_CATALOG } from '@vocaflow/library-pipeline/textbook-series-catalog'
import { SERIES_SPINE } from '@vocaflow/library-pipeline/textbook-series'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../..')
const OUT = path.join(REPO, 'packages/video-factory/work/source-bundle.json')

/* ── 접속 (저장소 관례: apps/web/.env.local 직독 — gen-db-stats.mjs 와 같은 방식) ── */
const envPath = path.join(REPO, 'apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2]!.replace(/^['"]|['"]$/g, '')
  }
}
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('apps/web/.env.local 에 NEXT_PUBLIC_SUPABASE_URL / KEY 가 없다')
}
const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

/* ── 실측 헬퍼 ────────────────────────────────────────────────── */

/** `head: true` 세기 질의 — 필터 콜백이 실제로 받는 타입. */
type CountQuery = ReturnType<ReturnType<typeof db.from>['select']>

/**
 * 행 수를 센다. **`count ?? 0` 을 쓰지 않는다** — 없는 테이블도 head 요청엔 204/count=null 로
 * 답하므로 0 과 구분이 안 된다(CHANGELOG v06.34 에 적힌 함정). 못 쟀으면 null 을 그대로 나른다.
 */
async function countOf(
  table: string,
  // ⚠️ 여기는 `(q: ReturnType<typeof db.from>) => unknown` 이었고, 호출부는 받은 값을
  //   `{ eq: … }` 로 **캐스팅**해서 썼다. 넘어오는 것은 `.from()` 이 아니라 `.select()` 의
  //   결과라 두 타입이 안 겹치는데, `.mts` 가 타입체크 밖이라 그 캐스팅이 통과하고 있었다
  //   (DD-78). 실제로 받는 것을 그대로 적으면 캐스팅이 필요 없다.
  filter?: (q: CountQuery) => CountQuery,
): Promise<number | null> {
  const base: CountQuery = db.from(table).select('*', { count: 'exact', head: true })
  const q = filter ? filter(base) : base
  const { count, error } = await q
  if (error) return null
  return typeof count === 'number' ? count : null
}

/* ── 문항 정규화 — 영상 한 컷에 들어갈 수 있는 크기로 ───────────── */

export interface NormalizedSample {
  prompt: string
  choices: string[]
  answer: number | string
  /** 문항을 줄여 보여줬는가 — 영상은 지문 전체를 담을 수 없다. 숨기지 않고 표시한다. */
  abridged: boolean
}

const MAX_PROMPT = 180
const MAX_CHOICE = 64

function clip(s: string, max: number): { text: string; clipped: boolean } {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length <= max
    ? { text: t, clipped: false }
    : { text: t.slice(0, max - 1) + '…', clipped: true }
}

/**
 * payload 다섯 계열을 한 모양으로 만든다.
 *
 * 계열은 실측으로 갈랐다(2026-09-12 · `csat_dcp_items` 25유형 payload 키 집계):
 *   A `stem`           — blank_word · grammar_fix
 *   B `choices`        — unit_vocab · unit_grammar · 수능형 14종
 *   C `underlines`     — vocab_choice · grammar_choice
 *   D `presented`      — order
 *   E `insert_sentence`— insert · `bank` — word_order
 * 어디에도 안 맞으면 **지어내지 않고 null** 을 돌려준다.
 */
function normalize(payload: unknown, answerKey: unknown): NormalizedSample | null {
  const p = (payload ?? {}) as Record<string, unknown>
  const a = (answerKey ?? {}) as Record<string, unknown>
  let abridged = false
  const take = (s: unknown, max: number): string => {
    const r = clip(String(s ?? ''), max)
    if (r.clipped) abridged = true
    return r.text
  }

  // A — 빈칸에 쓰기 / 고쳐쓰기
  if (typeof p.stem === 'string') {
    return {
      prompt: take(p.prompt_ko ? `${String(p.prompt_ko)} — ${p.stem}` : p.stem, MAX_PROMPT),
      choices: [],
      answer: take(a.text ?? '', MAX_CHOICE),
      abridged,
    }
  }

  // B — 보기가 있는 객관식
  if (Array.isArray(p.choices) && p.choices.length > 0) {
    const sentences = Array.isArray(p.sentences) ? (p.sentences as unknown[]) : []
    const stem = p.stem_ko ?? p.prompt_ko ?? sentences[0] ?? p.passage ?? ''
    return {
      prompt: take(stem, MAX_PROMPT),
      choices: (p.choices as unknown[]).slice(0, 5).map((c) => take(c, MAX_CHOICE)),
      answer: typeof a.answer === 'number' ? a.answer : take(a.answer ?? '', MAX_CHOICE),
      abridged,
    }
  }

  // C — 밑줄 다섯 중 고르기
  if (Array.isArray(p.underlines) && p.underlines.length > 0) {
    const sentences = Array.isArray(p.sentences) ? (p.sentences as unknown[]) : []
    return {
      prompt: take(sentences[0] ?? '', MAX_PROMPT),
      choices: (p.underlines as Record<string, unknown>[]).map((u) =>
        take(`${String(u.label ?? '')} ${String(u.word ?? '')}`, MAX_CHOICE),
      ),
      answer: typeof a.position === 'number' ? a.position : take(a.original ?? '', MAX_CHOICE),
      abridged,
    }
  }

  // C2 — 흐름 무관 (intro + sentences · 밑줄도 보기도 없다)
  if (typeof p.intro === 'string' && Array.isArray(p.sentences) && p.sentences.length > 0) {
    return {
      prompt: take(p.intro, MAX_PROMPT),
      choices: (p.sentences as unknown[]).slice(0, 5).map((s, i) => take(`${i + 1} ${String(s)}`, MAX_CHOICE)),
      answer: typeof a.position === 'number' ? a.position : '',
      abridged,
    }
  }

  // D — 글 순서
  if (Array.isArray(p.presented) && p.presented.length > 0) {
    return {
      prompt: '흩어진 문장을 원래 순서로',
      choices: (p.presented as unknown[]).slice(0, 4).map((s) => take(s, MAX_CHOICE)),
      answer: Array.isArray(a.source_order) ? (a.source_order as number[]).join('-') : '',
      abridged,
    }
  }

  // E1 — 문장 삽입
  if (typeof p.insert_sentence === 'string') {
    const gaps = Math.min(5, Number(p.gap_count) || 0)
    return {
      prompt: take(p.insert_sentence, MAX_PROMPT),
      choices: Array.from({ length: gaps }, (_, i) => `${i + 1}번 자리`),
      answer: typeof a.position === 'number' ? a.position : '',
      abridged,
    }
  }

  // E2 — 영작 배열
  if (Array.isArray(p.bank) && p.bank.length > 0) {
    return {
      prompt: take((p.bank as unknown[]).join(' / '), MAX_PROMPT),
      choices: [],
      answer: take(a.sentence ?? '', MAX_CHOICE),
      abridged,
    }
  }

  return null
}

/* ── 본체 ────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const measuredAt = new Date().toISOString()
  const codes = Object.keys(TYPE_GUIDE).sort()

  // 1) 재고 — **(유형 × V레벨) 정본 RPC** 를 쓴다.
  //
  //    왜 직접 세지 않는가: 유형만으로 세면 한 시리즈의 **모든 단이 같은 수**를 보고한다
  //    (실측 2026-09-12 — 어휘 6단이 전부 412,571 로 나왔다). 단은 V레벨로 갈리므로
  //    재고도 V레벨로 갈라야 하고, 그 표는 이미 `textbook_shelf_inventory()` 가 갖고 있다.
  //    카탈로그 화면과 영상이 다른 수를 말하면 둘 중 하나는 반드시 거짓말이 된다.
  const { data: invRows, error: invErr } = await db.rpc('textbook_shelf_inventory')
  if (invErr || !invRows) {
    throw new Error(`textbook_shelf_inventory() 를 못 읽었다: ${invErr?.message ?? '빈 응답'}`)
  }
  type InvRow = { item_type: string; v_level: number; item_count: number; explained_count: number }
  const inventory = invRows as InvRow[]

  /** 유형 하나의 전체 재고. V레벨을 주면 그 레벨들로만 좁힌다. */
  const stockOf = (type: string, vLevels?: readonly number[]): number =>
    inventory
      .filter((r) => r.item_type === type && (!vLevels || vLevels.includes(r.v_level)))
      .reduce((sum, r) => sum + r.item_count, 0)

  const explainedOf = (type: string, vLevels?: readonly number[]): number =>
    inventory
      .filter((r) => r.item_type === type && (!vLevels || vLevels.includes(r.v_level)))
      .reduce((sum, r) => sum + r.explained_count, 0)

  const typeCounts: Record<string, number> = {}
  for (const code of codes) typeCounts[code] = stockOf(code)

  // 2) 유형별 실제 문항 하나 — **가장 짧은 것**을 고른다(영상 한 컷에 들어가야 한다).
  //    같은 DB 상태면 같은 문항이 나오도록 id 오름차순 40건 안에서만 고른다.
  const samples: Record<string, NormalizedSample> = {}
  const sampleSkipped: string[] = []
  for (const code of codes) {
    const { data } = await db
      .from('csat_dcp_items')
      .select('id,payload,answer_key')
      .eq('type', code)
      .order('id', { ascending: true })
      .limit(40)
    if (!data || data.length === 0) {
      sampleSkipped.push(code)
      continue
    }
    const shortest = [...data].sort(
      (x, y) => JSON.stringify(x.payload).length - JSON.stringify(y.payload).length,
    )[0]!
    const norm = normalize(shortest.payload, shortest.answer_key)
    if (norm) samples[code] = norm
    else sampleSkipped.push(code)
  }

  // 3) 플랫폼 수치 — 광고에 쓸 수 있는 것만, 출처와 함께
  const platform = {
    dictionary: await countOf('shared_dictionary'),
    booksPublished: await countOf('library_books', (q) => q.eq('status', 'published')),
    articles: await countOf('library_articles'),
    items: await countOf('csat_dcp_items'),
    chapterQuiz: await countOf('library_chapter_quiz'),
  }

  // 4) 시리즈별 단 재고 — 각 단이 쓰는 유형의 합. 하나라도 못 쟀으면 합도 null 이다.
  //
  // ⚠️ **「나갔는가」는 조판 기록에서 읽는다** (고침 2026-09-23 · DD-76).
  //    여기는 `SeriesDef.status` 상수를 복사하고 있었다. 그 상수는 시리즈를 정의한 날의
  //    값이라 찍은 뒤에도 안 바뀌고, 그래서 이 번들은 2026-09-06 에 조판된 어휘 6권 ·
  //    구문 6권을 **`published` 가 아니라 `ready`** 로 실어 광고에 내보내고 있었다.
  //    이 스크립트는 나머지 수치를 전부 DB 에서 센다 — 이 칸만 예외일 이유가 없다.
  const { data: renderRows, error: renderErr } = await db
    .from('textbook_volume_renders')
    .select('series')
  if (renderErr) {
    // 못 읽었으면 **모르는 것**이다. 여기서 'draft' 로 떨어뜨리면 나간 책을 안 나간 것으로
    // 광고하게 되고, 그것이 방금 고친 바로 그 거짓이다.
    throw new Error(`조판 기록을 못 읽었다 — 시리즈 출고 여부를 모른 채 번들을 굽지 않는다: ${renderErr.message}`)
  }
  const shippedSeries = new Set<string>(
    (renderRows ?? []).map((r) => (r as { series: string | null }).series ?? 'reading'),
  )
  const series = SERIES_CATALOG.map((s) => ({
    id: s.id,
    brand: s.brand,
    question: s.question,
    status: (shippedSeries.has(s.id) ? 'shipping' : 'draft') as 'shipping' | 'draft',
    marketSeries: s.marketSeries,
    marketExamples: [...s.marketExamples],
    rungs: s.rungs.map((r) => ({
      step: r.step,
      schoolBand: r.schoolBand,
      volumeTitle: r.volumeTitle,
      types: [...r.types],
      /** 그 단의 V레벨로 좁힌 재고. 전 단이 같은 수를 말하면 그건 재고가 아니라 버그다. */
      items: r.types.reduce((sum, t) => sum + stockOf(t, r.vLevels), 0),
      explained: r.types.reduce((sum, t) => sum + explainedOf(t, r.vLevels), 0),
    })),
  }))

  // 5) 커버리지 증명 — **랜딩 히어로와 같은 계산, 같은 지문**.
  //
  //    영상이 따로 계산하면 광고에서 본 숫자와 사이트에서 본 숫자가 달라진다.
  //    실패하면 `null` 을 넣는다 — 0% 를 채우면 "아무도 못 읽는 글" 이라는 거짓이 된다
  //    (`hero-demo.ts` 가 같은 이유로 같은 선택을 했다).
  const hero = await buildHeroDemo()
  if (!hero) {
    console.warn('⚠ 커버리지 증명을 못 만들었다 — 소개 영상에서 그 컷이 빠진다')
  }

  const bundle = {
    measuredAt,
    platform,
    hero: hero
      ? {
          passage: HERO_PASSAGE,
          tokens: hero.tokens,
          readings: hero.readings,
          fitLevel: hero.fitLevel,
          totalTokens: hero.totalTokens,
        }
      : null,
    differentiators: DIFFERENTIATORS.map((d) => ({ ...d })),
    typeGuide: Object.fromEntries(
      codes.map((code) => [
        code,
        { ...TYPE_GUIDE[code]!, items: typeCounts[code]!, explained: explainedOf(code) },
      ]),
    ),
    samples,
    sampleSkipped: sampleSkipped.sort(),
    series,
    spine: SERIES_SPINE.map((r) => ({
      step: r.step,
      schoolBand: r.schoolBand,
      vLevels: [...r.vLevels],
      volumeTitle: r.volumeTitle,
      types: [...r.types],
      items: r.types.reduce((sum, t) => sum + stockOf(t, r.vLevels), 0),
    })),
    // 면(facet)의 **학습자용 이름과 한 줄** — 영상에 `recognize` 같은 코드를 그대로 내보내지
    // 않기 위해서다(이 저장소가 유형 코드에서 이미 겪은 사고).
    facetLabels: Object.fromEntries(
      Object.entries(FACETS)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, f]) => [
          id,
          // `kind`·`retrieval` 도 함께 넘긴다 — 「학습방법」 영상이 **무엇으로 통과를 재는지**를
          // 말해야 하는데, 그것 없이는 "면" 이 그냥 이름 여섯 개로 보인다.
          { name: f.name, says: f.says, kind: f.kind, retrieval: f.retrieval },
        ]),
    ),
    // ── 학습방법·권장안 영상의 원료 ──────────────────────────────────
    //
    // 이 둘은 사용자가 이름을 댄 구성요소인데 영상이 **한 편도 없었다**(실측 2026-09-13).
    // 없던 이유는 규칙이 아니라 **원료**였다 — 공장은 번들에 있는 것만 만들 수 있고,
    // 번들에 단계·임계값이 없었다.
    //
    // 여기 나가는 수는 전부 `lib/framework/` 의 상수 그대로다. 영상용으로 고쳐 적지 않는다 —
    // 고쳐 적는 순간 화면과 영상이 다른 말을 하고, 그걸 알아챌 방법이 없다.
    stages: STAGE_ORDER.map((id) => ({
      id,
      code: STAGES[id].code,
      name: STAGES[id].name,
      says: STAGES[id].says,
      by: STAGES[id].by,
    })),
    facetOrder: [...FACET_ORDER],
    // ⚠️ `spine` 이라 부르지 않는다 — 번들에는 이미 **교재 계단**(`spine: BundleSpineRung[]`)이 있다.
    //   같은 이름을 쓰면 한쪽이 다른 쪽을 덮고, 덮인 쪽은 타입이 맞아서 조용히 사라진다.
    spineFacets: [...SPINE],
    flow: {
      accuracyTarget: ACCURACY_TARGET,
      accuracyHoldBelow: ACCURACY_HOLD_BELOW,
      hitsToPass: HITS_TO_PASS,
      encountersFloor: ENCOUNTERS_FLOOR,
      newFacetsPerSession: NEW_FACETS_PER_SESSION,
      dailyBlocks: { ...DAILY_BLOCKS },
    },
    activities: activities().map((a) => ({
      id: a.id,
      name: a.name,
      says: a.says,
      facets: [...a.facets],
      contentNeed: a.contentNeed,
      route: a.route?.path ?? null,
    })),
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(bundle, null, 2) + '\n', 'utf8')

  console.log(`OK ${path.relative(REPO, OUT)}`)
  console.log(
    `   유형 ${codes.length} · 표본 ${Object.keys(samples).length}` +
      (sampleSkipped.length ? ` · 표본 못 만든 유형 ${sampleSkipped.length}: ${sampleSkipped.join(', ')}` : ''),
  )
  console.log(
    `   시리즈 ${series.length} · 계단 ${bundle.spine.length} · 활동 ${bundle.activities.length}`,
  )
  console.log(`   플랫폼 ${JSON.stringify(platform)}`)
}

await main()
