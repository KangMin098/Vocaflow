// apps/web/src/lib/learner/plan-activities.ts
//
// 학습 계획 — 활동 정의 + 자료유형별 가용 매트릭스 + 라우트 빌더.
// 순수 모듈(client/server 공유). React/lucide 의존 없음 — 아이콘 매핑은 클라이언트가 담당.
// P1 재설계: 학습 계획 = 플랫폼 자료(도서/스크립트/공용단어장/내 스크립트) × 활동 (리틀팍스형).
//   book=library_books · article=library_articles(공개 스크립트) · word_set=shared_word_sets · script=texts(개인)

import { isFullScreenRoute } from '@/lib/layout/full-screen-routes'

export type MaterialType = 'book' | 'article' | 'word_set' | 'script'

export type PlanActivity =
  | 'listen'
  | 'read'
  | 'echo'
  | 'vocab'
  | 'flashcard'
  | 'wordblitz'
  | 'pairflip'
  | 'spellforge'
  | 'scriptquiz'
  | 'dictation'

export interface ActivityDef {
  id: PlanActivity
  label: string
  /** 인지 계층 표기 (Calm UI 보조 정보) */
  layer: string
  /** lucide 아이콘 이름 — 클라이언트가 컴포넌트로 매핑 */
  icon: string
}

/**
 * 10 활동 — 인지 깊이 순(입력 → 따라하기 → 어휘 → 인출 게임 → 정복 → 완성).
 * 아이콘은 활동당 유일(중복 금지) — 선택 칩·보드 칩·바로 시작이 같은 아이콘을 공유해
 * "아이콘=활동" 연상이 화면 어디서나 성립해야 한다.
 */
export const PLAN_ACTIVITIES: ActivityDef[] = [
  { id: 'listen', label: '듣기', layer: 'L0 입력', icon: 'Headphones' },
  { id: 'read', label: '읽기', layer: 'L1 독해', icon: 'BookOpen' },
  { id: 'echo', label: '따라하기', layer: 'L4c 청각생성', icon: 'Mic2' },
  { id: 'vocab', label: '단어', layer: 'L3 노출', icon: 'WholeWord' },
  { id: 'flashcard', label: 'Flashcard', layer: 'L4a 재인', icon: 'Layers' },
  { id: 'wordblitz', label: 'WordBlitz', layer: 'L4a 자동화', icon: 'Zap' },
  { id: 'pairflip', label: 'PairFlip', layer: 'L4a 공간기억', icon: 'Grid2x2' },
  { id: 'spellforge', label: 'SpellForge', layer: 'L4b 시각생성', icon: 'Hammer' },
  { id: 'scriptquiz', label: 'ScriptQuiz', layer: 'L5 정복', icon: 'HelpCircle' },
  { id: 'dictation', label: 'Dictation', layer: 'L6 완성', icon: 'PencilLine' },
]

export const ACTIVITY_BY_ID: Record<PlanActivity, ActivityDef> = PLAN_ACTIVITIES.reduce(
  (acc, a) => {
    acc[a.id] = a
    return acc
  },
  {} as Record<PlanActivity, ActivityDef>,
)

/** 본문(텍스트+오디오) 자료 = 10종 전부 (도서/개인 스크립트) */
const TEXT_ACTIVITIES: PlanActivity[] = PLAN_ACTIVITIES.map((a) => a.id)
/** 공개 스크립트(article) = 따라하기(echo) 제외 9종 (전용 echo 라우트 없음) */
const ARTICLE_ACTIVITIES: PlanActivity[] = TEXT_ACTIVITIES.filter((a) => a !== 'echo')
/** 공용단어장 = 어휘 기반 5종 (본문 없는 듣기/읽기/따라하기/ScriptQuiz/Dictation 제외) */
const WORDSET_ACTIVITIES: PlanActivity[] = ['vocab', 'flashcard', 'wordblitz', 'pairflip', 'spellforge']

/** 자료유형별 선택 가능한 활동 */
export function activitiesForType(type: MaterialType): PlanActivity[] {
  if (type === 'word_set') return WORDSET_ACTIVITIES
  if (type === 'article') return ARTICLE_ACTIVITIES
  return TEXT_ACTIVITIES
}

export function isActivityAllowed(type: MaterialType, activity: PlanActivity): boolean {
  return activitiesForType(type).includes(activity)
}

export const MATERIAL_LABEL: Record<MaterialType, string> = {
  book: '도서',
  article: '스크립트',
  word_set: '공용단어장',
  script: '내 스크립트',
}

export interface MaterialRef {
  type: MaterialType
  id: string
  slug?: string | null
}

/** 자료 열기 라우트 — 도서/스크립트/단어장 정합 */
export function materialHref(m: MaterialRef): string {
  switch (m.type) {
    case 'book':
      return `/library/books/${m.id}`
    case 'article':
      return `/library/scripts/${m.id}`
    case 'script':
      return `/text/${m.id}`
    case 'word_set':
      return m.slug ? `/library/vocab#set-${m.slug}` : '/library/vocab'
  }
}

/**
 * 활동 실행(launch) 라우트 — 가능하면 그 자료의 실제 단어로 진입.
 *   · 스크립트(texts.id): flashcard `?text=` · scriptquiz `?text=` (scoped-words 정합)
 *   · 공용단어장(shared_word_sets.id): flashcard `?set=` (shared_words 정합)
 *   · 도서(library_books.id): 본문 활동은 도서 페이지, 게임은 모듈 hub (직접 스코핑 미지원)
 * 스코핑 불가 활동(wordblitz/pairflip/spellforge/dictation)은 모듈 hub 로 honest fallback.
 */
function baseActivityLaunchHref(m: MaterialRef, activity: PlanActivity): string {
  switch (activity) {
    case 'listen':
    case 'read':
    case 'vocab':
      return materialHref(m)
    case 'echo':
      return m.type === 'script' ? `/text/${m.id}/echo` : materialHref(m)
    case 'flashcard':
      if (m.type === 'script') return `/flashcard/play?text=${m.id}`
      if (m.type === 'word_set') return `/flashcard/play?set=${m.id}`
      return '/flashcard'
    case 'scriptquiz':
      return m.type === 'script' ? `/scriptquiz/play?text=${m.id}` : '/scriptquiz'
    case 'spellforge':
      if (m.type === 'script') return `/spellforge/play?text=${m.id}`
      if (m.type === 'word_set') return `/spellforge/play?set=${m.id}`
      return '/spellforge'
    case 'wordblitz':
      if (m.type === 'script') return `/play/wordblitz?text=${m.id}`
      if (m.type === 'word_set') return `/play/wordblitz?set=${m.id}`
      return '/wordblitz'
    case 'pairflip':
      if (m.type === 'script') return `/pairflip/play?text=${m.id}`
      if (m.type === 'word_set') return `/pairflip/play?set=${m.id}`
      return '/pairflip'
    case 'dictation':
      // 받아쓰기=문장 전사 → 스크립트(본문)만 스코핑. 도서/단어장은 hub.
      return m.type === 'script' ? `/dictate/setup?text=${m.id}` : '/dictate'
  }
}

/**
 * 활동 실행 라우트 + 닫기 시 원점 복귀용 ?from 부착.
 *   풀스크린 세션(/…/play, /play/…)에만 from 을 붙인다 — SessionFrame 이 닫기/Esc 시
 *   그 경로로 복귀(제자리). hub·워크스페이스·setup 등 비-세션 라우트엔 붙이지 않는다.
 *
 * @param origin 진입 화면 경로 (예: '/plan', '/'). SessionFrame 이 검증(내부경로).
 */
export function activityLaunchHref(
  m: MaterialRef,
  activity: PlanActivity,
  origin?: string,
): string {
  const href = baseActivityLaunchHref(m, activity)
  if (!origin) return href
  const path = href.split('?')[0] ?? href
  if (!isFullScreenRoute(path)) return href
  const sep = href.includes('?') ? '&' : '?'
  return `${href}${sep}from=${encodeURIComponent(origin)}`
}

/** 활동이 그 자료의 실제 단어로 스코핑되어 열리는지 (UI 배지/구분용) */
export function isActivityScoped(type: MaterialType, activity: PlanActivity): boolean {
  if (activity === 'listen' || activity === 'read' || activity === 'vocab') return true
  if (activity === 'echo') return type === 'script'
  if (activity === 'flashcard') return type === 'script' || type === 'word_set'
  if (activity === 'spellforge') return type === 'script' || type === 'word_set'
  if (activity === 'wordblitz') return type === 'script' || type === 'word_set'
  if (activity === 'pairflip') return type === 'script' || type === 'word_set'
  if (activity === 'scriptquiz') return type === 'script'
  if (activity === 'dictation') return type === 'script' // 받아쓰기=문장 전사, 스크립트 본문만
  return false
}

// ── 학습 리듬(일정) — study_plan_schedule ──

/** 요일 — ISO 1=월 .. 7=일 */
export const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 7, label: '일' },
]

/** 요일 단축 라벨 (월·화·…) — value 1=월..7=일 */
export function weekdayLabel(value: number): string {
  return WEEKDAYS.find((d) => d.value === value)?.label ?? String(value)
}

/** library_articles.source → 표시 라벨 (스크립트 소스 필터/배지) */
export const ARTICLE_SOURCE_LABEL: Record<string, string> = {
  voa: 'VOA',
  nasa: 'NASA',
  nih: 'NIH',
  simple_wikipedia: 'Simple Wikipedia',
  wikinews: 'Wikinews',
  the_conversation: 'The Conversation',
}

export function articleSourceLabel(source: string | null | undefined): string {
  if (!source) return '스크립트'
  return ARTICLE_SOURCE_LABEL[source] ?? source.replace(/_/g, ' ')
}

/** CEFR → 대표 V-Level (V밴드 폴백 — 단어장 등 v_level 컬럼 부재 시). */
export function cefrToVLevel(cefr: string | null | undefined): number | null {
  if (!cefr) return null
  const c = cefr.trim().toUpperCase()
  const map: Record<string, number> = { A1: 1, A2: 3, B1: 5, B2: 7, C1: 9, C2: 10 }
  return map[c] ?? null
}

/** 공용단어장 category → 표시 라벨 (주제 필터/그룹). */
export const WORDSET_CATEGORY_LABEL: Record<string, string> = {
  csat: '수능',
  eng_test: '공인시험',
  elementary: '초등',
  middle: '중등',
  high: '고등',
  themed: '주제별',
  library_book: '도서 챕터',
  library_article: '스크립트 어휘',
}

export function wordsetCategoryLabel(cat: string | null | undefined): string {
  if (!cat) return '기타'
  return WORDSET_CATEGORY_LABEL[cat] ?? cat
}
