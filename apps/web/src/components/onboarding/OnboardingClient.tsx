// apps/web/src/components/onboarding/OnboardingClient.tsx
// 온보딩 폼 + Study Plan 실시간 미리보기 (LEARNER_MANAGEMENT P1).
// Calm UI · 격려형(완료일은 예측, 미달 압박 금지 §철학3). 입력 조정 시 computeStudyPlan 즉시 반영.

'use client'

import { CalendarDays, Sparkles, Target } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { saveLearningGoal, type OnboardingContext } from '@/lib/learner/goal-actions'
import { computeStudyPlan } from '@/lib/learner/study-plan'

const DAYS_OPTIONS = [3, 4, 5, 6, 7]
const MIN_OPTIONS = [60, 100, 150, 200]

export function OnboardingClient({ context }: { context: OnboardingContext }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const g = context.goal
  const [targetDate, setTargetDate] = useState<string>(g?.target_date ?? '')
  const [weeklyDays, setWeeklyDays] = useState<number>(g?.weekly_target_days ?? 5)
  const [weeklyMinutes, setWeeklyMinutes] = useState<number>(g?.weekly_target_minutes ?? 100)
  const targetWordCount = g?.target_word_count ?? 4000

  // 실시간 Study Plan 미리보기 (순수 computeStudyPlan)
  const plan = useMemo(() => {
    if (!targetDate) return null
    return computeStudyPlan({
      targetDate,
      targetWordCount,
      knownWordCount: context.knownWordCount,
      weeklyTargetDays: weeklyDays,
      recentWeeklyRate: context.recentWeeklyRate,
    })
  }, [targetDate, targetWordCount, context.knownWordCount, context.recentWeeklyRate, weeklyDays])

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await saveLearningGoal({
        targetDate,
        targetWordCount,
        weeklyTargetDays: weeklyDays,
        weeklyTargetMinutes: weeklyMinutes,
      })
      if (res.ok) {
        setSaved(true)
        router.refresh()
      } else {
        setError(res.error ?? '저장에 실패했어요. 잠시 후 다시 시도해 주세요.')
      }
    })
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 md:py-14">
      {/* Hero */}
      <header className="text-center">
        <span
          className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-[var(--r-lg)] bg-[var(--p-light)] text-[var(--p)]"
          aria-hidden
        >
          <Target size={20} strokeWidth={1.75} />
        </span>
        <h1 className="font-display text-[24px] font-[800] text-[var(--t1)]">
          수능까지, 나만의 학습 계획
        </h1>
        <p className="mt-2 font-english text-[15px] italic leading-relaxed text-[var(--t2)]">
          목표일과 주당 시간을 정하면, 매주 얼마나 나아가면 되는지 보여드릴게요.
        </p>
      </header>

      {/* 입력 카드 */}
      <section
        aria-label="목표 설정"
        className="flex flex-col gap-5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)] md:p-6"
      >
        <label className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 font-display text-[13px] font-[700] text-[var(--t1)]">
            <CalendarDays size={14} strokeWidth={1.75} aria-hidden /> 수능 D-day
          </span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="h-11 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 font-body text-[15px] text-[var(--t1)] transition-colors focus:border-[var(--p)] focus:outline-none"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-display text-[13px] font-[700] text-[var(--t1)]">
            주당 학습일
          </legend>
          <div className="flex flex-wrap gap-2">
            {DAYS_OPTIONS.map((d) => (
              <Chip key={d} active={weeklyDays === d} onClick={() => setWeeklyDays(d)}>
                {d}일
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-display text-[13px] font-[700] text-[var(--t1)]">
            주당 학습 시간
          </legend>
          <div className="flex flex-wrap gap-2">
            {MIN_OPTIONS.map((m) => (
              <Chip key={m} active={weeklyMinutes === m} onClick={() => setWeeklyMinutes(m)}>
                {m}분
              </Chip>
            ))}
          </div>
        </fieldset>
      </section>

      {/* Study Plan 미리보기 */}
      {plan && (
        <section
          aria-label="학습 계획"
          className="flex flex-col gap-4 rounded-[var(--r-lg)] border border-[rgba(59,130,246,0.2)] bg-gradient-to-br from-[var(--p-light)] to-[var(--bg2)] p-5 md:p-6"
        >
          <header className="flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--p)]" strokeWidth={1.75} aria-hidden />
            <h2 className="font-display text-[15px] font-[800] text-[var(--t1)]">나의 학습 계획</h2>
            <span className="ml-auto font-mono text-[12px] tabular-nums text-[var(--t3)]">
              D-{plan.daysLeft}
            </span>
          </header>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="아는 단어" value={context.knownWordCount.toLocaleString()} unit="개" />
            <Stat label="목표까지" value={plan.gapWords.toLocaleString()} unit="개" />
            <Stat label="주당 권장" value={plan.weeklyNeeded.toLocaleString()} unit="개" emphasis />
            <Stat label="하루" value={plan.dailyNeeded.toLocaleString()} unit="개" />
          </div>

          <p className="font-english text-[14px] italic leading-relaxed text-[var(--t1)]">
            {plan.achieved
              ? '이미 목표 어휘에 도달했어요. 다음 목표를 세워볼까요?'
              : plan.onTrack === true && plan.projectedDate
                ? `이 속도라면 ${formatKDate(plan.projectedDate)}에 목표에 닿아요 — 수능 전에 충분해요.`
                : plan.onTrack === false && plan.projectedDate
                  ? `지금 속도면 ${formatKDate(plan.projectedDate)} 예상이에요. 주당 ${plan.weeklyNeeded}개 페이스면 D-day에 맞춰요.`
                  : `매주 ${plan.weeklyNeeded}개씩 만나면 수능 전에 목표에 닿아요. 오늘 ${plan.dailyNeeded}개부터 시작해요.`}
          </p>
        </section>
      )}

      {error && (
        <p role="alert" className="font-body text-[13px] text-[var(--error)]">
          {error}
        </p>
      )}

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!targetDate || pending}
          className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] bg-[var(--p)] px-6 py-3 font-display text-[14px] font-[700] text-[var(--ti)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? '저장 중…' : saved ? '계획 저장됨 ✓' : g ? '계획 수정하기' : '학습 계획 만들기'}
        </button>
        {saved && (
          <a
            href="/hub"
            className="font-display text-[13px] font-[700] text-[var(--p)] no-underline hover:underline"
          >
            오늘 학습 시작 →
          </a>
        )}
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[40px] min-w-[56px] rounded-[var(--r-md)] border px-4 font-display text-[13px] font-[700] transition-all duration-[var(--dur-normal)] ${
        active
          ? 'border-[var(--p)] bg-[var(--p)] text-[var(--ti)]'
          : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
      }`}
    >
      {children}
    </button>
  )
}

function Stat({
  label,
  value,
  unit,
  emphasis,
}: {
  label: string
  value: string
  unit: string
  emphasis?: boolean
}) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 text-center">
      <p
        className={`font-display text-[20px] font-[800] tabular-nums leading-none ${
          emphasis ? 'text-[var(--p)]' : 'text-[var(--t1)]'
        }`}
      >
        {value}
        <span className="ml-0.5 text-[11px] font-[600] text-[var(--t3)]">{unit}</span>
      </p>
      <p className="mt-1 font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
        {label}
      </p>
    </div>
  )
}

/** 'YYYY-MM-DD' → 'N월 N일' */
function formatKDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`
}
