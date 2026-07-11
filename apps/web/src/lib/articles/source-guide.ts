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

import type { ArticleAdminRow, SourceFeedHealth } from './types'

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
  the_conversation: ['argumentative'],
  simple_wikipedia: ['expository', 'reference'],
  owid: ['argumentative'], // T-2 — 데이터 논증문 (CC-BY → 발행 가능 argumentative 보강)
  factbook: ['reference'], // 국가 개요 참고문 (PD → 발행 가능 reference 보강)
  elife: ['expository'], // 편집자 저작 과학 요약 (CC-BY → 발행 가능)
  wikipedia: ['expository', 'reference'], // 정규 백과 FA/GA (CC-BY-SA → 발행 가능)
  plos: ['expository'], // 오픈 학술 논문 (CC-BY → 발행 가능)
  wikivoyage: ['reference'], // 여행 목적지 가이드 (CC-BY-SA → 발행 가능 · reference 보강)
  usgs: ['expository'], // 지구과학·자연재해 과학 저널리즘 (PD US Gov → 발행 가능)
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
  'wikivoyage',
  'usgs',
]

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
  wikivoyage: 'Wikivoyage',
  usgs: 'USGS',
}

// ── 커버리지 빈칸 ────────────────────────────────

export interface CoverageGap {
  register: string
  cefr: string
}

/** 발행(published) 기준 register × CEFR 빈칸 — 발행 0 인 셀. */
export function computeCoverageGaps(articles: ArticleAdminRow[]): CoverageGap[] {
  const published = new Set<string>()
  for (const a of articles) {
    if (a.status === 'published' && a.register && a.cefr_level) {
      published.add(`${a.register}|${a.cefr_level}`)
    }
  }
  const gaps: CoverageGap[] = []
  for (const r of REGISTERS) {
    for (const c of CEFR_ORDER) {
      if (!published.has(`${r.key}|${c}`)) gaps.push({ register: r.key, cefr: c })
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
