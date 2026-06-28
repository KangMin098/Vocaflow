// apps/web/src/lib/learner/plan-activities.ts
//
// 학습 계획 — 활동 정의 + 자료유형별 가용 매트릭스 + 라우트 빌더.
// 순수 모듈(client/server 공유). React/lucide 의존 없음 — 아이콘 매핑은 클라이언트가 담당.
// P1 재설계: 학습 계획 = 플랫폼 자료(도서/스크립트/공용단어장) × 활동 (리틀팍스형).

export type MaterialType = 'book' | 'script' | 'word_set'

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

/** 10 활동 — 인지 깊이 순(입력 → 따라하기 → 어휘 → 인출 게임 → 정복 → 완성) */
export const PLAN_ACTIVITIES: ActivityDef[] = [
  { id: 'listen', label: '듣기', layer: 'L0 입력', icon: 'Headphones' },
  { id: 'read', label: '읽기', layer: 'L1 독해', icon: 'BookOpen' },
  { id: 'echo', label: '따라하기', layer: 'L4c 청각생성', icon: 'Mic2' },
  { id: 'vocab', label: '단어', layer: 'L3 노출', icon: 'Layers' },
  { id: 'flashcard', label: 'Flashcard', layer: 'L4a 재인', icon: 'Layers' },
  { id: 'wordblitz', label: 'WordBlitz', layer: 'L4a 자동화', icon: 'Zap' },
  { id: 'pairflip', label: 'PairFlip', layer: 'L4a 공간기억', icon: 'Shuffle' },
  { id: 'spellforge', label: 'SpellForge', layer: 'L4b 시각생성', icon: 'Pencil' },
  { id: 'scriptquiz', label: 'ScriptQuiz', layer: 'L5 정복', icon: 'ScrollText' },
  { id: 'dictation', label: 'Dictation', layer: 'L6 완성', icon: 'PencilLine' },
]

export const ACTIVITY_BY_ID: Record<PlanActivity, ActivityDef> = PLAN_ACTIVITIES.reduce(
  (acc, a) => {
    acc[a.id] = a
    return acc
  },
  {} as Record<PlanActivity, ActivityDef>,
)

/** 본문(텍스트+오디오) 자료 = 10종 전부 */
const TEXT_ACTIVITIES: PlanActivity[] = PLAN_ACTIVITIES.map((a) => a.id)
/** 공용단어장 = 어휘 기반 5종 (본문 없는 듣기/읽기/따라하기/ScriptQuiz/Dictation 제외) */
const WORDSET_ACTIVITIES: PlanActivity[] = ['vocab', 'flashcard', 'wordblitz', 'pairflip', 'spellforge']

/** 자료유형별 선택 가능한 활동 */
export function activitiesForType(type: MaterialType): PlanActivity[] {
  return type === 'word_set' ? WORDSET_ACTIVITIES : TEXT_ACTIVITIES
}

export function isActivityAllowed(type: MaterialType, activity: PlanActivity): boolean {
  return activitiesForType(type).includes(activity)
}

export const MATERIAL_LABEL: Record<MaterialType, string> = {
  book: '도서',
  script: '스크립트',
  word_set: '공용단어장',
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
    case 'script':
      return `/text/${m.id}`
    case 'word_set':
      return m.slug ? `/library/vocab#set-${m.slug}` : '/library/vocab'
  }
}
