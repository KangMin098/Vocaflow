// apps/web/src/lib/articles/source-map.ts
//
// /library/scripts 소스 맵 — 글 선택 전 "오리엔테이션 층" (개인화 재계산).
// 9 ACP 소스를 6 학습 트랙으로 묶고, 각 트랙의 난이도 위치·적합도를 사용자 V레벨로 재계산.
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
import type { PublishedArticle } from './types'

export type TrackKey = 'listen' | 'easy' | 'topic' | 'news' | 'argue' | 'data'

/** 학습 트랙(= 소스 묶음) 오리엔테이션. mode 는 소스 정책(media·derivation) 파생. */
export interface SourceTrack {
  key: TrackKey
  sources: SourceKey[]
  icon: string
  title: string
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
    oneLine: '통제된 기초 어휘(Simple English)로 쓰인 백과 글 — 부담 없이 읽기 시작.',
    skills: ['기초 독해', '어휘 친숙도', '읽기 자신감'],
    why: '아는 단어 비율이 높을수록 맥락에서 새 단어를 추론하기 쉬워요 (i+1).',
    method: ['훑어 읽기', '모르는 단어 클릭', '문단 요약'],
    mode: 'read',
    accent: '#0F766E',
  },
  {
    key: 'topic',
    sources: ['nasa', 'nih', 'elife'],
    icon: '🔬',
    title: '관심 주제로 읽기',
    oneLine: '우주·과학(NASA)·건강(NIH)·생명과학(eLife) — 흥미로운 주제로 몰입 독해.',
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
    oneLine: '통계·지표(Our World in Data)와 국가 사실(Factbook) — 근거와 함께 읽기.',
    skills: ['정보 독해', '데이터 해석', '사실 확인'],
    why: '숫자·근거와 함께 읽으면 주장과 사실을 구분하는 힘이 길러져요 (Desirable Difficulty).',
    method: ['핵심 지표 찾기', '추세 읽기', '출처 확인'],
    mode: 'read',
    accent: '#0891B2',
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
  const counts: Record<TrackKey, number> = { listen: 0, easy: 0, topic: 0, news: 0, argue: 0, data: 0 }
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
