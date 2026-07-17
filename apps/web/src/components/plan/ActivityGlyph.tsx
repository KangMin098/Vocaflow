// apps/web/src/components/plan/ActivityGlyph.tsx
//
// 활동 아이콘 타일 — /plan(보드 행·활동 선택·바로 시작)과 /hub(오늘의 학습 계획)가
// 같은 표현을 공유하는 단일 컴포넌트. "아이콘=활동" 연상이 화면 어디서나 동일해야 한다.
// 상태 없음 — RSC/클라이언트 양쪽에서 사용 가능. 색+형태 이중(타일 배경) · 색상 단독 전달 금지.

import { Layers } from 'lucide-react'

import { ACTIVITY_ICON } from '@/lib/learner/activity-icons'
import { ACTIVITY_BY_ID, type PlanActivity } from '@/lib/learner/plan-activities'

const SIZE = {
  /** 보드 행·인라인 나열용 */
  sm: { box: 'h-5 w-5 rounded-[5px]', icon: 12 },
  /** 선택 칩·바로 시작용 */
  md: { box: 'h-6 w-6 rounded-[var(--r-sm)]', icon: 14 },
} as const

export function ActivityGlyph({
  activity,
  size = 'md',
  /** onDark = 채워진(프라이머리) 배경 위 — 반투명 흰 타일 */
  tone = 'default',
  title,
}: {
  activity: PlanActivity
  size?: keyof typeof SIZE
  tone?: 'default' | 'onDark'
  /** 지정 시 타일 자체에 툴팁 (기본: 활동 라벨) */
  title?: string
}) {
  const def = ACTIVITY_BY_ID[activity]
  const Icon = ACTIVITY_ICON[def.icon] ?? Layers
  const s = SIZE[size]
  return (
    <span
      title={title ?? def.label}
      className={`inline-flex shrink-0 items-center justify-center ${s.box} ${
        tone === 'onDark' ? 'bg-white/15 text-[var(--ti)]' : 'bg-[var(--bg3)] text-[var(--t2)]'
      }`}
      aria-hidden
    >
      <Icon size={s.icon} strokeWidth={2} />
    </span>
  )
}
