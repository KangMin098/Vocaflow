// apps/web/src/lib/articles/source-map.ts
//
// /library/scripts 소스 맵 — 글 선택 전 "오리엔테이션 층" (개인화 재계산).
// 14 ACP 소스를 7 학습 트랙으로 묶고, 각 트랙의 난이도 위치·적합도를 사용자 V레벨로 재계산.
//
// 본질(핸드오프 §0 · 하드코딩 금지): 위치·판정·순서·편수는 입력→계산/집계.
//   · 트랙 V밴드  = 소스 targetCefr(SOURCE_SPECS) → cefrToVLevel  (실 SSoT, 자작 매핑 금지)
//   · now 위치    = effectiveUserV (judgeArticleIPlusOne 과 동일 V5 fallback)
//   · 난이도 판정 = effectiveUserV vs [vMin,vMax]  → fit / easy / hard
//   · 트랙 글 수  = published 아티클 실집계 (별도 쿼리 없이 prop articles 에서 — page 가 이미 fetch)
//
// 카피(skills/why/method)는 추측이 아니라 SOURCE_SPECS(topicDomain·styleGuide·targetLevels)
// + CLAUDE.md 학습 과학 7원칙 근거. 수치(편수·범위)는 카피에 박지 않음(§1-B 집계).

import { SOURCE_SPECS } from '@vocaflow/library-pipeline/curation-spec'
import type { SourceKey } from '@vocaflow/library-pipeline/curation-spec'

import { cefrToVLevel } from '@/lib/library/book-cover'
import { judgeArticleIPlusOne } from '@/lib/library/i-plus-one'
import type { PublishedArticle } from './types'

export type TrackKey = 'listen' | 'easy' | 'topic' | 'news' | 'argue' | 'data' | 'reference'

/** 학습 트랙(= 소스 묶음) 오리엔테이션. mode 는 소스 정책(media·derivation) 파생. */
export interface SourceTrack {
  key: TrackKey
  sources: SourceKey[]
  icon: string
  title: string
  /** 지도 칩·좁은 공간용 짧은 라벨 */
  short: string
  /** 한 줄 소개 (학습자 언어) */
  oneLine: string
  /** 효과 칩 — 이 트랙이 길러주는 능력 */
  skills: string[]
  /** 학습 과학 한 줄 (왜 효과적인지) */
  why: string
  /** 학습 단계 */
  method: string[]
  /** media='audio'→listen · derivation='display_only'→read_nd · else read */
  mode: 'listen' | 'read' | 'read_nd'
  /** 소스 액센트색 (ArticleCard SOURCE_META 정합) */
  accent: string
  /** ND 등 특이사항 (학습자 노출) */
  note?: string
  /** SOURCE_SPECS 에서 계산된 V밴드 (하드코딩 아님) */
  vMin: number
  vMax: number
}

// ── V 축 (cefrToVLevel: A1=1 … C2=10 → 축 1..10) ────────────────────
export const V_AXIS_MIN = 1
export const V_AXIS_MAX = 10

/** V레벨 → 축상 위치 %(0~100). 축 밖은 clamp. */
export function vToPct(v: number): number {
  const c = Math.max(V_AXIS_MIN, Math.min(V_AXIS_MAX, v))
  return ((c - V_AXIS_MIN) / (V_AXIS_MAX - V_AXIS_MIN)) * 100
}

/** 미진단(0/음수)은 한국 학습자 기본 V5 (judgeArticleIPlusOne 과 동일 규칙). */
export function effectiveUserV(userV: number): number {
  return userV && userV > 0 ? userV : 5
}

/** 소스 묶음의 V밴드 = min(targetCefr.min) ~ max(targetCefr.max) 를 cefrToVLevel 변환. */
function trackVBand(sources: SourceKey[]): { vMin: number; vMax: number } {
  let lo = Infinity
  let hi = -Infinity
  for (const s of sources) {
    const spec = SOURCE_SPECS[s]
    lo = Math.min(lo, cefrToVLevel(spec.targetCefr.min))
    hi = Math.max(hi, cefrToVLevel(spec.targetCefr.max))
  }
  return { vMin: lo, vMax: hi }
}

// ── 정적 카피 (SOURCE_SPECS 근거 · 수치 제외) ───────────────────────
const RAW_TRACKS: Omit<SourceTrack, 'vMin' | 'vMax'>[] = [
  {
    key: 'listen',
    sources: ['voa'],
    icon: '🔊',
    title: '원어민 듣고 따라하기',
    short: '듣기',
    oneLine: '미국 원어민이 또박또박 읽어주는 짧은 글 — 듣고 따라 말하기 좋아요.',
    skills: ['듣기', '발음·억양', '청해'],
    why: '귀로 들은 소리를 입으로 재생하면 발화가 자동화돼요 (Dual Coding).',
    method: ['먼저 듣기', '문장 따라 말하기', '쉐도잉'],
    mode: 'listen',
    accent: '#2563EB',
  },
  {
    key: 'easy',
    sources: ['simple_wikipedia'],
    icon: '📖',
    title: '쉬운 글로 시작하기',
    short: '쉬운 글',
    oneLine: '통제된 기초 어휘(Simple English)로 쓰인 백과 글 — 부담 없이 읽기 시작.',
    skills: ['기초 독해', '어휘 친숙도', '읽기 자신감'],
    why: '아는 단어 비율이 높을수록 맥락에서 새 단어를 추론하기 쉬워요 (i+1).',
    method: ['훑어 읽기', '모르는 단어 클릭', '문단 요약'],
    mode: 'read',
    accent: '#0F766E',
  },
  {
    key: 'topic',
    sources: ['nasa', 'nih', 'elife', 'plos', 'usgs', 'noaa'],
    icon: '🔬',
    title: '관심 주제로 읽기',
    short: '관심 주제',
    oneLine: '우주(NASA)·건강(NIH)·생명과학(eLife/PLOS)·지구·기후(USGS/NOAA) — 흥미로운 과학 주제로 몰입 독해.',
    skills: ['주제 독해', '전문 어휘', '정보 파악'],
    why: '관심 있는 주제는 감정 부호화로 더 오래 기억돼요 (Emotional Encoding).',
    method: ['주제 고르기', '핵심 정보 찾기', '새 어휘 수집'],
    mode: 'read',
    accent: '#7C3AED',
  },
  {
    key: 'news',
    sources: ['wikinews'],
    icon: '📰',
    title: '시사로 감 잡기',
    short: '시사',
    oneLine: '중립적 시각으로 쓰인 짧은 시사 뉴스 — 세상 돌아가는 영어.',
    skills: ['시사 독해', '뉴스 어휘', '빠른 파악'],
    why: '같은 시사 어휘를 여러 글에서 다시 만나면 간격 반복 효과가 생겨요 (Spaced Repetition).',
    method: ['헤드라인 보기', '육하원칙 찾기', '후속 글 읽기'],
    mode: 'read',
    accent: '#B45309',
  },
  {
    key: 'argue',
    sources: ['the_conversation'],
    icon: '🗣',
    title: '논증문 정복하기',
    short: '논증문',
    oneLine: '학자가 쓴 분석·논증 글 — 수능 최고난도 지문과 가장 닮은 영어.',
    skills: ['논증 독해', '추상 어휘', '논리 구조'],
    why: '약간 어려운 분투(Desirable Difficulty)가 더 깊은 이해와 기억을 만들어요.',
    method: ['주장 찾기', '근거 따라가기', '반론 떠올리기'],
    mode: 'read_nd',
    accent: '#15803D',
    note: '원문 그대로 · 단어는 클릭으로 조회 (저작권 보호)',
  },
  {
    key: 'data',
    sources: ['owid', 'factbook'],
    icon: '📊',
    title: '데이터·사실로 읽기',
    short: '데이터',
    oneLine: '통계·지표(Our World in Data)와 국가 사실(Factbook) — 근거와 함께 읽기.',
    skills: ['정보 독해', '데이터 해석', '사실 확인'],
    why: '숫자·근거와 함께 읽으면 주장과 사실을 구분하는 힘이 길러져요 (Desirable Difficulty).',
    method: ['핵심 지표 찾기', '추세 읽기', '출처 확인'],
    mode: 'read',
    accent: '#0891B2',
  },
  {
    key: 'reference',
    sources: ['wikipedia', 'wikivoyage'],
    icon: '📚',
    title: '백과·여행으로 넓히기',
    short: '백과·여행',
    oneLine: '정규 백과(Wikipedia)와 여행 가이드(Wikivoyage) — 폭넓은 배경지식과 실용 영어.',
    skills: ['폭넓은 독해', '배경지식', '실용 어휘'],
    why: '다양한 주제를 넓게 읽으면 배경지식(스키마)이 쌓여 새 글 이해가 빨라져요 (Schema Theory).',
    method: ['관심 항목 찾기', '핵심 문단 읽기', '새 어휘 수집'],
    mode: 'read',
    accent: '#7C2D12',
  },
]

/** 트랙 정의 + 계산된 V밴드 (모듈 로드 시 1회). */
export const SOURCE_TRACKS: SourceTrack[] = RAW_TRACKS.map((t) => ({
  ...t,
  ...trackVBand(t.sources),
}))

// ── 난이도 판정 ─────────────────────────────────────────────────────
export type TrackFit = 'fit' | 'easy' | 'hard'

export const TRACK_FIT_META: Record<TrackFit, { label: string; color: string }> = {
  fit: { label: '딱 맞아요', color: 'var(--learn-known)' },
  easy: { label: '수월해요', color: 'var(--t3)' },
  hard: { label: '도전', color: 'var(--learn-review)' },
}

/** effectiveUserV 가 트랙 V밴드 [vMin,vMax] 의 아래=hard / 위=easy / 안=fit. */
export function judgeTrackFit(track: SourceTrack, userV: number): TrackFit {
  const eff = effectiveUserV(userV)
  if (eff < track.vMin) return 'hard'
  if (eff > track.vMax) return 'easy'
  return 'fit'
}

const FIT_ORDER: Record<TrackFit, number> = { fit: 0, easy: 1, hard: 2 }

/** 정렬: fit → easy → hard, 동급은 vMin 오름차순 (목업 약점 6 — i+1 적합 우선). */
export function sortTracksForUser(tracks: SourceTrack[], userV: number): SourceTrack[] {
  return [...tracks].sort((a, b) => {
    const d = FIT_ORDER[judgeTrackFit(a, userV)] - FIT_ORDER[judgeTrackFit(b, userV)]
    if (d !== 0) return d
    return a.vMin - b.vMin
  })
}

// ── 실집계 (목업 약점 7 — 편수 하드코딩 금지) ───────────────────────
const SOURCE_TO_TRACK: Map<string, TrackKey> = new Map(
  SOURCE_TRACKS.flatMap((t) => t.sources.map((s) => [s, t.key] as [string, TrackKey])),
)

/** published 아티클 → 트랙별 글 수 (별도 쿼리 없이 prop articles 집계). */
export function computeTrackCounts(articles: PublishedArticle[]): Record<TrackKey, number> {
  const counts: Record<TrackKey, number> = { listen: 0, easy: 0, topic: 0, news: 0, argue: 0, data: 0, reference: 0 }
  for (const a of articles) {
    const k = SOURCE_TO_TRACK.get(a.source)
    if (k) counts[k] += 1
  }
  return counts
}

/** mode → CTA 카피 (§4). */
export const MODE_CTA: Record<SourceTrack['mode'], string> = {
  listen: '🔊 듣기로 시작',
  read: '📖 둘러보기',
  read_nd: '🗣 둘러보기',
}

// ════════════════════════════════════════════════════════════════════
//  학습 지도 (Difficulty Map) — v06.221 재설계.
//  "어떤 소스/시리즈를 고를지" 를 다양한 레벨의 학습자가 한눈에 결정하도록
//  실데이터 기반 트랙 통계 + 레벨 밴드별 학습권장을 계산한다.
//  하드코딩 금지(핸드오프 §0): 편수·V범위·적합도·추천 트랙은 전부 입력 articles 집계.
// ════════════════════════════════════════════════════════════════════

/** 학습자 레벨 밴드 — 배너 카피·추천 로직 분기. */
export type LearnerBand = 'undiagnosed' | 'beginner' | 'intermediate' | 'advanced'

/** current_v_level → 밴드. 미진단(0/음수)=undiagnosed(내부 계산은 effectiveUserV=5). */
export function getLearnerBand(userV: number): LearnerBand {
  if (!userV || userV <= 0) return 'undiagnosed'
  if (userV <= 3) return 'beginner'
  if (userV <= 6) return 'intermediate'
  return 'advanced'
}

/** V레벨 → CEFR 라벨 (cefrToVLevel 역, 표시용 근사). */
export function vToCefrLabel(v: number): 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' {
  if (v <= 1) return 'A1'
  if (v <= 2) return 'A2'
  if (v <= 4) return 'B1'
  if (v <= 6) return 'B2'
  if (v <= 8) return 'C1'
  return 'C2'
}

/** V범위 → CEFR 라벨 (동일 밴드면 단일, 다르면 범위). */
export function cefrRangeLabel(vMin: number, vMax: number): string {
  const lo = vToCefrLabel(vMin)
  const hi = vToCefrLabel(vMax)
  return lo === hi ? lo : `${lo}–${hi}`
}

/**
 * 글(article) i+1 적합 우선 랭크 (낮을수록 우선):
 *   i+1(0) → 동급(1) → 약한 도전(2) → 쉬움(3~5) → 어려움(6+) → 미상(99).
 * (기존 ScriptsBrowser fitRank 를 승격 — 지도·평면뷰 공용.)
 */
export function articleFitRank(article: PublishedArticle, userVLevel: number): number {
  const fit = judgeArticleIPlusOne(article.article_v_level, userVLevel)
  if (!fit) return 99
  const g = fit.gap
  if (g === 1) return 0
  if (g === 0) return 1
  if (g === 2) return 2
  if (g < 0) return 3 + Math.min(2, -g - 1)
  return 6 + (g - 3)
}

/** 추천순 비교자 — i+1 적합 우선, 동급은 짧은 글 먼저(부담 최소). */
export function byRecommendedArticle(userV: number) {
  return (a: PublishedArticle, b: PublishedArticle) => {
    const r = articleFitRank(a, userV) - articleFitRank(b, userV)
    if (r !== 0) return r
    return (a.word_count ?? Infinity) - (b.word_count ?? Infinity)
  }
}

/** 트랙 V범위 vs 학습자 effectiveV → 실데이터 기반 적합 판정. */
function trackFitFromRange(vMin: number, vMax: number, effV: number): TrackFit {
  if (effV < vMin) return 'hard'
  if (effV > vMax) return 'easy'
  return 'fit'
}

/** 트랙(시리즈) 1개의 학습자-맞춤 통계 — 카드·지도 표시원. */
export interface TrackStat {
  track: SourceTrack
  /** 추천순 정렬된 글 목록 */
  items: PublishedArticle[]
  count: number
  /** 실제 글에서 집계한 V범위 */
  vMin: number
  vMax: number
  /** V범위 → CEFR 라벨 (예: "B1–B2") */
  cefrLabel: string
  hasAudio: boolean
  /** i+1 또는 동급(fitRank ≤ 1) 글 수 — 추천 랭킹 근거 */
  idealCount: number
  /** 실데이터 기반 적합 (딱 맞아요/수월/도전) */
  fit: TrackFit
}

/** /library/scripts 학습 지도 — 배너·지도·카드가 공유하는 단일 계산 결과. */
export interface ScriptsMap {
  band: LearnerBand
  /** 판정에 쓰인 학습자 V (미진단이면 5) */
  effectiveV: number
  /** 원본 current_v_level (0=미진단) */
  userV: number
  /** 이 학습자에게 먼저 권하는 트랙 (없으면 null) */
  recommendedTrackKey: TrackKey | null
  /** 편수>0 트랙만, fit → idealCount → count 순 정렬 */
  tracks: TrackStat[]
}

/** 추천 트랙 선정: ideal 글 최다 → (없으면) 밴드별 폴백(고급=최고심도 / 그외=최저난도). */
function pickRecommendedTrack(stats: TrackStat[], band: LearnerBand): TrackKey | null {
  if (stats.length === 0) return null
  const withIdeal = stats.filter((s) => s.idealCount > 0)
  if (withIdeal.length > 0) {
    const best = [...withIdeal].sort((a, b) => b.idealCount - a.idealCount || b.count - a.count)[0]
    return best.track.key
  }
  // i+1 적합 글이 어디에도 없음 → 밴드로 폴백
  if (band === 'advanced') {
    // 깊이 유도: 가장 심도 높은 시리즈
    const deepest = [...stats].sort((a, b) => b.vMax - a.vMax || b.count - a.count)[0]
    return deepest.track.key
  }
  // 초급 등: 가장 접근 쉬운 시리즈
  const easiest = [...stats].sort((a, b) => a.vMin - b.vMin || b.count - a.count)[0]
  return easiest.track.key
}

/** 실데이터에서 학습 지도 전체를 계산 (추가 fetch 0 — page 가 이미 articles 를 fetch). */
export function buildScriptsMap(articles: PublishedArticle[], userV: number): ScriptsMap {
  const eff = effectiveUserV(userV)
  const cmp = byRecommendedArticle(userV)

  const stats: TrackStat[] = []
  for (const track of SOURCE_TRACKS) {
    const items = articles.filter((a) => SOURCE_TO_TRACK.get(a.source) === track.key)
    if (items.length === 0) continue
    const vs = items
      .map((a) => a.article_v_level)
      .filter((v): v is number => typeof v === 'number')
    const vMin = vs.length ? Math.min(...vs) : track.vMin
    const vMax = vs.length ? Math.max(...vs) : track.vMax
    stats.push({
      track,
      items: [...items].sort(cmp),
      count: items.length,
      vMin,
      vMax,
      cefrLabel: cefrRangeLabel(vMin, vMax),
      hasAudio: items.some((a) => !!(a.audio_url && a.audio_url.trim())),
      idealCount: items.filter((a) => articleFitRank(a, userV) <= 1).length,
      fit: trackFitFromRange(vMin, vMax, eff),
    })
  }

  stats.sort((a, b) => {
    const d = FIT_ORDER[a.fit] - FIT_ORDER[b.fit]
    if (d !== 0) return d
    if (b.idealCount !== a.idealCount) return b.idealCount - a.idealCount
    return b.count - a.count
  })

  const band = getLearnerBand(userV)
  return { band, effectiveV: eff, userV, recommendedTrackKey: pickRecommendedTrack(stats, band), tracks: stats }
}

// ── 레벨 밴드별 학습권장 배너 카피 ───────────────────────────────────
export interface BandGuidance {
  eyebrow: string
  title: string
  sub: string
  /** CTA — 미진단은 진단, 그 외는 추천 트랙으로 스크롤 */
  cta: { label: string; kind: 'diagnostic' | 'track' }
}

/** 밴드 + 추천 트랙 → 배너 카피. 고급은 솔직한 안내 + 깊이 유도. */
export function bandGuidance(map: ScriptsMap): BandGuidance {
  const rec = map.recommendedTrackKey
    ? SOURCE_TRACKS.find((t) => t.key === map.recommendedTrackKey)
    : null
  const recTitle = rec?.title ?? '추천 시리즈'
  switch (map.band) {
    case 'undiagnosed':
      return {
        eyebrow: '레벨 진단',
        title: '내 레벨을 알면 딱 맞는 글을 골라드려요',
        sub: '지금은 중급(B1) 기준으로 보여드리고 있어요. 3분 진단이면 당신 수준에 정확히 맞춘 추천을 받아요.',
        cta: { label: '레벨 진단하기', kind: 'diagnostic' },
      }
    case 'beginner':
      return {
        eyebrow: '초급 추천',
        title: '듣기와 쉬운 글부터 시작해요',
        sub: `${recTitle}이 지금 딱 맞아요. 또박또박 읽어주는 소리와 통제된 어휘로 읽기 자신감을 먼저 쌓아요.`,
        cta: { label: `${recTitle} 보기`, kind: 'track' },
      }
    case 'intermediate':
      return {
        eyebrow: '중급 추천',
        title: '당신 수준에 맞는 글이 가장 많아요',
        sub: `${recTitle}부터 시작해, 조금씩 어려운 글(i+1)로 어휘를 넓혀가요.`,
        cta: { label: `${recTitle} 보기`, kind: 'track' },
      }
    case 'advanced':
      return {
        eyebrow: '고급 안내',
        title: '대부분 수월하게 읽혀요',
        sub: '지금 라이브러리는 중급 어휘 중심이라 편하게 읽혀요. 논증·데이터 시리즈와 원문(External)으로 깊이를 더하고, 속도·유창성 읽기에 활용해요.',
        cta: { label: `${recTitle} 보기`, kind: 'track' },
      }
  }
}
