// apps/web/src/lib/articles/source-guide.ts
// ACP §18 — 소스 선택 결정 지원 (큐레이션 가이드).
//
// 관리자가 모든 소스를 몰라도 "학습자에게 무엇을 GET 해야 하는지" 판단하도록:
//   1) computeCoverageGaps — 지금 부족한 register × CEFR 빈칸(발행 0)
//   2) recommendSources    — 빈칸을 채우는 소스를, 선택한 학습자 레벨 적합도로 가중 랭킹
//   3) getSourceGuide      — 소스별 프로필(무엇을·누구에게·문체·정책)
//
// 데이터는 기존 SSoT(SOURCE_SPECS) + 소스→register(ingester 문서화된 기본값) 에서 파생.
// client-safe 서브패스(/curation-spec)만 import.

import { SOURCE_SPECS } from '@vocaflow/library-pipeline/curation-spec'
import type { SourceKey, LearnerLevel } from '@vocaflow/library-pipeline/curation-spec'

import type { CoverageCounts, SourceFeedHealth } from './types'

export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type Cefr = (typeof CEFR_ORDER)[number]

/** 코어 register (커버리지 매트릭스와 동일 5종). */
export const REGISTERS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'expository', label: '설명' },
  { key: 'argumentative', label: '논증' },
  { key: 'news', label: '시사' },
  { key: 'narrative', label: '내러티브' },
  { key: 'reference', label: '참고' },
]

export const REGISTER_LABEL: Record<string, string> = Object.fromEntries(
  REGISTERS.map((r) => [r.key, r.label]),
)

/**
 * 소스 → 다루는 register.
 * 근거(추측 아님 · ingester register 기본값 + feed 구성):
 *   · the_conversation = argumentative (the-conversation.ts)
 *   · wikinews = news (wikinews.ts)
 *   · simple_wikipedia = expository(+reference 재분류) (simple-wikipedia.ts)
 *   · nasa/nih = expository + news (뉴스릴리스 + 설명문)
 *   · voa = expository + narrative + news (P2 feed: american-stories=narrative, health=expository, news)
 */
export const SOURCE_REGISTERS: Record<SourceKey, ReadonlyArray<string>> = {
  voa: ['expository', 'narrative', 'news'],
  nasa: ['expository', 'news'],
  nih: ['expository', 'news'],
  wikinews: ['news'],
  // 그림책 서사 — 초·중 창에 narrative 가 **0편**이라 넣은 소스다. 다른 register 는 없다.
  storyweaver: ['narrative'],
  space_place: ['expository'],
  ocean_facts: ['expository'],
  frym: ['expository'],
  the_conversation: ['argumentative'],
  simple_wikipedia: ['expository', 'reference'],
  owid: ['argumentative'], // T-2 — 데이터 논증문 (CC-BY → 발행 가능 argumentative 보강)
  factbook: ['reference'], // 국가 개요 참고문 (PD → 발행 가능 reference 보강)
  elife: ['expository'], // 편집자 저작 과학 요약 (CC-BY → 발행 가능)
  wikipedia: ['expository', 'reference'], // 정규 백과 FA/GA (CC-BY-SA → 발행 가능)
  plos: ['expository'], // 오픈 학술 논문 (CC-BY → 발행 가능)
  europe_pmc: ['expository'], // 생명과학·의학 오픈액세스 (PLOS 와 같은 계열 — 논증문 공급선 2)
  // 확보 원문 4곳 (2026-09-23) — 넷 다 argumentative 다. 읽기 판정에서 확보 94편 중
  // 74편(79%)이 장문 창을 냈고, 판정자들이 「논증 대목이 있다」를 keep 의 주 근거로 썼다.
  // 설명 대목도 함께 있으므로 expository 를 같이 둔다.
  olh: ['argumentative', 'expository'],
  econstor: ['argumentative', 'expository'],
  scielo: ['argumentative', 'expository'],
  openalex: ['argumentative', 'expository'],
  // 소스GET 3차 (2026-09-25)
  global_voices: ['news', 'expository'],
  global_storybooks: ['narrative'],
  gdl: ['narrative'],
  wikivoyage: ['reference'], // 여행 목적지 가이드 (CC-BY-SA → 발행 가능 · reference 보강)
  usgs: ['expository'], // 지구과학·자연재해 과학 저널리즘 (PD US Gov → 발행 가능)
  noaa: ['expository'], // 기후과학 explainer (PD US Gov → 발행 가능)
  // 대학 컨소시엄 연구 기사 (CC BY 4.0 · fe252c99). 추측이 아니라 같은 커밋의 근거다 —
  // "연구 기사" 이고 논증 지면을 맡은 것은 PLOS 쪽이다. nasa·nih 와 같은 모양.
  futurity: ['expository', 'news'],
  // ACP §20 재저작 — register 는 발주(composed_spec)가 정한다. 시사가 기본이지만
  //   같은 사실 원장에서 설명문·내러티브 판을 뽑을 수 있어 셋을 모두 연다.
  original: ['news', 'expository', 'narrative'],
}

const ALL_SOURCES: ReadonlyArray<SourceKey> = [
  'voa',
  'nasa',
  'nih',
  'simple_wikipedia',
  'the_conversation',
  'wikinews',
  'owid',
  'factbook',
  'elife',
  'wikipedia',
  'plos',
  'europe_pmc',
  'wikivoyage',
  'usgs',
  'noaa',
  // 빈 칸 추천의 대상 — GET 탭이 생긴 소스는 여기에도 있어야 「이 칸을 채울 소스」로 뽑힌다.
  'futurity',
]

/**
 * **`library_articles.source` 가 가질 수 있는 모든 값의 이름.**
 *
 * ⚠️ **「GET 탭이 있는 소스」와 같은 목록이 아니다.** 예전에는 같았고, 그래서 관리 화면이
 * 재고의 절반을 **부를 이름이 없어 숨겼다** — 검수·발행의 소스 드롭다운이 이 맵의 키로만
 * 만들어지기 때문이다. 실측 2026-09-13: 재고 108,953편 중 **47,165편(43.3%)** 이 여기
 * 이름이 없는 소스였고(`gutenberg` 40,519 · `futurity` 2,885 · `frontiers` 1,961 ·
 * `original` 1,429 · `frym` 153 · `storyweaver` 136 · `space_place` 59 · `nist` 23),
 * 그중 최대 소스인 `gutenberg` 는 **관리 화면 어디에서도 고를 수 없었다.**
 *
 * 수집 경로가 없는 소스(`gutenberg` 는 도서에서 잘라 온 것, `original` 은 자체 재저작)도
 * 적재된 뒤에는 검수·발행·삭제를 똑같이 받는다. **들어올 수 있으면 이름이 있어야 한다.**
 *
 * 정본은 DB 의 `library_articles_source_check` 다 — 거기 없는 값은 애초에 안 들어온다.
 * 회귀 `apps/web/src/lib/articles/__tests__/source-key-parity.test.ts` 가 둘을 맞춘다.
 */
export const SOURCE_LABEL: Record<string, string> = {
  voa: 'VOA',
  nasa: 'NASA',
  nih: 'NIH',
  simple_wikipedia: 'Simple Wikipedia',
  the_conversation: 'The Conversation',
  wikinews: 'Wikinews',
  owid: 'Our World in Data',
  factbook: 'CIA World Factbook',
  elife: 'eLife',
  wikipedia: 'Wikipedia',
  plos: 'PLOS',
  europe_pmc: 'Europe PMC',
  wikivoyage: 'Wikivoyage',
  usgs: 'USGS',
  noaa: 'NOAA Climate.gov',
  // ── GET 탭이 없는 소스 — 그래도 재고에 있고 관리 대상이다 ──
  futurity: 'Futurity',
  frontiers: 'Frontiers',
  frym: 'Frontiers for Young Minds',
  nist: 'NIST',
  storyweaver: 'StoryWeaver',
  global_voices: 'Global Voices',
  global_storybooks: 'Global Storybooks',
  gdl: 'Global Digital Library',
  space_place: 'NASA Space Place',
  ocean_facts: 'NOAA Ocean Facts',
  worldbank: 'World Bank',
  original: '자체 재저작',
  // ── 아직 DB CHECK 가 안 받는 것 — 타입에 있으면 이름도 있어야 한다 ──
  openstax: 'OpenStax',
  // ── 초기 ACP 수집기 — 지금 재고 0 이지만 CHECK 가 여전히 받는다 ──
  cdc: 'CDC',
  medlineplus: 'MedlinePlus',
  manual: '수동 등록',
}

/**
 * **소스 GET 탭이 있는 소스 — 이 배열 하나가 정본이다.**
 *
 * 조건은 하나: 라이브 피드 라우트 `/api/admin/articles/<key>-feed` 가 있을 것.
 * `gutenberg`·`frontiers`·`nist` 처럼 별도 수확기가 넣는 소스는 여기 없다 — 검수·발행에서만 다룬다.
 *
 * ⚠️ **예전에는 이 목록이 세 군데 있었다** — `CurationConsole` 의 지역 `SourceKey`,
 * `RssFeedTab` 의 prop 타입, 그리고 `SOURCE_OPTIONS`. 그래서 2026-08-21 에 피드 라우트와
 * `SOURCE_SPECS` 까지 갖춘 `futurity` 가 **셋 중 어디에도 안 들어가** 재고 2,885편이 쌓이는
 * 동안 화면에서 부를 수 없었고, 한 곳에만 더하면 tsc 가 나머지 둘로 막았다(2026-09-14).
 * 지금은 여기 한 줄이면 탭·아이콘·피드 폼이 함께 열린다.
 */
export const GET_TAB_SOURCES = [
  'voa',
  'nasa',
  'nih',
  'simple_wikipedia',
  'the_conversation',
  'wikinews',
  'owid',
  'factbook',
  'elife',
  'wikipedia',
  'plos',
  'wikivoyage',
  'usgs',
  'noaa',
  'futurity',
] as const satisfies ReadonlyArray<SourceKey>

/** GET 탭이 있는 소스 — 탭·아이콘·피드 폼이 전부 이 타입을 쓴다. */
export type GetTabSource = (typeof GET_TAB_SOURCES)[number]

// ── 커버리지 빈칸 ────────────────────────────────

export interface CoverageGap {
  register: string
  cefr: string
}

/** 커버리지 셀 키 — 서버 카운트(admin-queries)와 매트릭스가 같은 문자열을 써야 한다. */
export function coverageKey(register: string, cefr: string): string {
  return `${register}|${cefr}`
}

/**
 * 발행(published) 기준 register × CEFR 빈칸 — 발행 0 인 셀.
 *
 * 인자가 글 목록이 아니라 **서버 카운트**인 이유: 목록은 1,000행에서 잘리고, 잘린 목록에는
 * 발행분이 한 건도 안 들어와 30칸이 전부 빈칸이 된다. 그러면 이 함수를 근거로 도는
 * 소스 추천이 "전 영역이 비었다" 고 말한다 — 실제로는 293건이 발행돼 있었다.
 */
export function computeCoverageGaps(coverage: CoverageCounts): CoverageGap[] {
  const gaps: CoverageGap[] = []
  for (const r of REGISTERS) {
    for (const c of CEFR_ORDER) {
      if ((coverage.cells[coverageKey(r.key, c)] ?? 0) === 0) {
        gaps.push({ register: r.key, cefr: c })
      }
    }
  }
  return gaps
}

// ── 학습자 레벨 적합도 ───────────────────────────

export type LevelFit = 'fit' | 'easy' | 'hard'
const LEVEL_ORDER: ReadonlyArray<LearnerLevel> = ['beginner', 'intermediate', 'advanced']

export const FIT_LABEL: Record<LevelFit, string> = {
  fit: '이 수준에 적합',
  easy: '이 수준엔 쉬움',
  hard: '이 수준엔 어려움',
}

/** 소스 targetLevels 기준 — 학습자 레벨이 범위 밖이면 쉬움/어려움. */
export function fitForLevel(source: SourceKey, level: LearnerLevel): LevelFit {
  const tl = SOURCE_SPECS[source].targetLevels
  if (tl.includes(level)) return 'fit'
  const li = LEVEL_ORDER.indexOf(level)
  const minT = Math.min(...tl.map((t) => LEVEL_ORDER.indexOf(t)))
  return li < minT ? 'hard' : 'easy'
}

function cefrInRange(cefr: string, min: string, max: string): boolean {
  const i = CEFR_ORDER.indexOf(cefr as Cefr)
  const lo = CEFR_ORDER.indexOf(min as Cefr)
  const hi = CEFR_ORDER.indexOf(max as Cefr)
  return i >= 0 && lo >= 0 && hi >= 0 && i >= lo && i <= hi
}

// ── 추천 ─────────────────────────────────────────

export interface SourceRecommendation {
  source: SourceKey
  fit: LevelFit
  /** 이 소스가 채울 수 있는 빈칸 (register × CEFR) */
  filledGaps: CoverageGap[]
  /** 가용 후보 수 (feedHealth pending 합) */
  pending: number
  score: number
}

const FIT_WEIGHT: Record<LevelFit, number> = { fit: 1, easy: 0.5, hard: 0.3 }

/**
 * 빈칸 × 학습자 레벨 결합 추천.
 * 각 소스가 채우는 빈칸 수 × 레벨 적합 가중 + 가용 후보 보너스 → 내림차순.
 * 빈칸을 하나도 못 채우는 소스는 제외.
 */
export function recommendSources(
  gaps: CoverageGap[],
  level: LearnerLevel,
  feedHealth: SourceFeedHealth[],
): SourceRecommendation[] {
  const pendingBySource = new Map<string, number>()
  for (const f of feedHealth) {
    pendingBySource.set(f.source, (pendingBySource.get(f.source) ?? 0) + f.pending)
  }

  const recs: SourceRecommendation[] = ALL_SOURCES.map((source) => {
    const spec = SOURCE_SPECS[source]
    const regs = SOURCE_REGISTERS[source]
    const filledGaps = gaps.filter(
      (g) => regs.includes(g.register) && cefrInRange(g.cefr, spec.targetCefr.min, spec.targetCefr.max),
    )
    const fit = fitForLevel(source, level)
    const pending = pendingBySource.get(source) ?? 0
    const score = filledGaps.length * FIT_WEIGHT[fit] + (pending > 0 ? 0.5 : 0)
    return { source, fit, filledGaps, pending, score }
  })

  return recs.filter((r) => r.filledGaps.length > 0).sort((a, b) => b.score - a.score)
}

// ── 소스 프로필 ──────────────────────────────────

export interface SourceGuide {
  source: SourceKey
  topics: ReadonlyArray<string>
  registers: ReadonlyArray<string>
  cefr: { min: string; max: string }
  levels: ReadonlyArray<LearnerLevel>
  style: string
  license: string
  attributionRequired: boolean
}

export function getSourceGuide(source: SourceKey): SourceGuide {
  const s = SOURCE_SPECS[source]
  return {
    source,
    topics: s.topicDomain,
    registers: SOURCE_REGISTERS[source],
    cefr: s.targetCefr,
    levels: s.targetLevels,
    style: s.styleGuide,
    license: s.license,
    attributionRequired: s.attributionRequired,
  }
}
