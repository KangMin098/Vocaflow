// apps/web/src/components/home/TodayPlanCard.tsx
// Today(/hub) "오늘의 학습 계획" — study_plan_items 의 오늘 요일 항목을 홈에서 바로 시작.
// /plan 의 요일별 계획 → Today 진입면에 노출(계획→매일 실행 loop 완성). 오늘 항목 없으면 렌더 X(Calm).
// 서버 컴포넌트 — Link 만 (상태 없음). 색+아이콘 이중(색맹 대응).

import { ArrowRight, CalendarDays, ExternalLink, Play } from 'lucide-react'
import Link from 'next/link'

import { ActivityGlyph } from '@/components/plan/ActivityGlyph'
import { MATERIAL_ICON } from '@/lib/learner/activity-icons'
import {
  ACTIVITY_BY_ID,
  activityLaunchHref,
  isActivityScoped,
  MATERIAL_LABEL,
  PLAN_ACTIVITIES,
  weekdayLabel,
  type PlanActivity,
} from '@/lib/learner/plan-activities'
import type { PlanItem } from '@/lib/learner/plan-actions'

export function TodayPlanCard({ items, today }: { items: PlanItem[]; today: number }) {
  const todayItems = items.filter((i) => i.weekdays.includes(today))
  if (todayItems.length === 0) return null

  return (
    <section
      aria-label="오늘의 학습 계획"
      className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--p)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]"
    >
      <header className="flex items-center gap-2">
        <CalendarDays size={15} strokeWidth={1.75} className="text-[var(--p)]" aria-hidden />
        <h2 className="font-display text-[14px] font-[800] text-[var(--t1)]">오늘의 학습 계획</h2>
        <span className="font-mono text-[12px] text-[var(--p)]">{weekdayLabel(today)}요일</span>
        <Link
          href="/plan"
          className="ml-auto inline-flex items-center gap-1 font-display text-[12px] font-[700] text-[var(--p)] no-underline transition-colors hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          계획 전체 <ArrowRight size={12} strokeWidth={2} aria-hidden />
        </Link>
      </header>

      <div className="flex flex-col gap-3">
        {todayItems.map((item) => (
          <TodayPlanRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

function TodayPlanRow({ item }: { item: PlanItem }) {
  const TypeIcon = MATERIAL_ICON[item.materialType]
  const ref = { type: item.materialType, id: item.materialId, slug: item.slug }
  const acts = PLAN_ACTIVITIES.filter((a) => item.modules.includes(a.id))
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-2">
        {item.materialType === 'word_set' && item.coverEmoji ? (
          <span className="text-[15px] leading-none" aria-hidden>
            {item.coverEmoji}
          </span>
        ) : (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--on-p-tint)]" aria-hidden>
            <TypeIcon size={13} strokeWidth={1.75} />
          </span>
        )}
        <span className="truncate font-display text-[13px] font-[800] text-[var(--t1)]">{item.title}</span>
        <span className="shrink-0 rounded-[var(--r-sm)] bg-[var(--bg3)] px-2 py-0.5 font-display text-[10px] font-[700] text-[var(--t2)]">
          {MATERIAL_LABEL[item.materialType]}
        </span>
        {item.materialType === 'book' && item.chapterCount > 1 && (
          <span className="font-mono text-[11px] text-[var(--t2)]">
            {item.chapters.length === 0 ? '전체' : `Ch ${item.chapters.join('·')}`}
          </span>
        )}
      </span>
      {acts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {acts.map((a) => (
            <LaunchChip
              key={a.id}
              activity={a.id}
              href={activityLaunchHref(ref, a.id, '/')}
              scoped={isActivityScoped(item.materialType, a.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LaunchChip({ activity, href, scoped }: { activity: PlanActivity; href: string; scoped: boolean }) {
  const def = ACTIVITY_BY_ID[activity]
  return (
    <Link
      href={href}
      title={scoped ? `${def.label} — 이 자료로 바로 시작` : `${def.label} — 모듈에서 시작`}
      className="inline-flex min-h-[36px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-2 pr-3 font-display text-[12px] font-[700] text-[var(--t2)] no-underline transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:border-[var(--p)] hover:bg-[var(--p-light)] hover:text-[var(--on-p-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
    >
      <ActivityGlyph activity={activity} size="sm" />
      {def.label}
      {scoped ? (
        <Play size={11} strokeWidth={2} className="text-[var(--p)] opacity-80" aria-hidden />
      ) : (
        <ExternalLink size={11} strokeWidth={2} className="opacity-50" aria-hidden />
      )}
    </Link>
  )
}
