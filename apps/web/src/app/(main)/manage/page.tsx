// apps/web/src/app/(main)/manage/page.tsx
// 내 학습 관리 — 계획·실행·진단·리포트 통합 관리 화면 (리틀팍스 MY 학습 참고).
// P0~P3 데이터를 한 곳에. read-only overview + 각 상세로 CTA. Calm UI.

import {
  ArrowRight,
  CalendarRange,
  Compass,
  Flame,
  Sparkles,
  Target,
} from 'lucide-react'
import Link from 'next/link'

import { Screen } from '@/components/ui/ios'
import { fetchManageOverview } from '@/lib/learner/manage-overview'

export const metadata = {
  title: '내 학습 관리 · Vocaflow',
  description: '계획·실행·진단·리포트를 한 곳에서',
}

function fmtKDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`
}

export default async function ManagePage() {
  const o = await fetchManageOverview()

  if (!o) {
    return (
      <Screen width="content" background="bg2" padX="md">
        <div className="mx-auto max-w-md px-4 py-24 text-center font-body text-[14px] text-[var(--t3)]">
          로그인하면 학습 관리 화면을 볼 수 있어요.
        </div>
      </Screen>
    )
  }

  return (
    <Screen width="content" background="bg2" padX="md">
      <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-10">
        <header>
          <h1 className="font-display text-[22px] font-[800] text-[var(--t1)]">내 학습 관리</h1>
          <p className="mt-1 font-english text-[14px] italic text-[var(--t2)]">
            계획과 현황을 한눈에 — 차분히, 꾸준히.
          </p>
        </header>

        {/* 진단 (V-Level) */}
        <ManageCard
          icon={<Compass size={18} strokeWidth={1.75} />}
          title="진단"
          href="/diagnostic"
          cta={o.vLevel ? '재진단' : '진단 받기'}
        >
          {o.vLevel ? (
            <p className="font-body text-[14px] text-[var(--t2)]">
              현재 어휘 수준{' '}
              <span className="font-display text-[18px] font-[800] text-[var(--p)]">
                V{o.vLevel}
              </span>{' '}
              — 더 정확히 보려면 재진단해요
            </p>
          ) : (
            <p className="font-body text-[14px] text-[var(--t3)]">
              아직 수준 진단을 안 받았어요. 5분이면 나에게 맞는 단어가 추천돼요.
            </p>
          )}
        </ManageCard>

        {/* 계획 (자료×활동) */}
        <ManageCard
          icon={<Target size={18} strokeWidth={1.75} />}
          title="학습 계획"
          href="/plan"
          cta={o.plan ? '계획 수정' : '계획 세우기'}
        >
          {o.plan ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-body text-[13px] text-[var(--t2)]">
                <span>
                  자료 <strong className="font-display text-[var(--t1)]">{o.plan.itemCount}</strong>개
                </span>
                <span>
                  활동 <strong className="font-display text-[var(--p)]">{o.plan.activityCount}</strong>개
                </span>
              </div>
              {o.plan.topMaterials.length > 0 && (
                <p className="truncate font-body text-[12px] text-[var(--t3)]">
                  {o.plan.topMaterials.join(' · ')}
                </p>
              )}
            </div>
          ) : (
            <p className="font-body text-[14px] text-[var(--t3)]">
              도서·스크립트·단어장을 골라 무엇을 할지 정하면 나만의 학습 계획이 돼요.
            </p>
          )}
        </ManageCard>

        {/* 실행 (현황) */}
        <ManageCard
          icon={<Sparkles size={18} strokeWidth={1.75} />}
          title="학습 현황"
          href="/hub"
          cta="이어서 학습"
        >
          <div className="grid grid-cols-3 gap-3">
            <Stat label="아는 단어" value={o.knownWordCount.toLocaleString()} />
            <Stat label="오늘" value={o.todayWords.toLocaleString()} unit="단어" />
            <Stat
              label="연속"
              value={o.currentStreak.toLocaleString()}
              unit="일"
              icon={o.currentStreak > 0 ? <Flame size={11} className="text-[var(--warning)]" aria-hidden /> : undefined}
            />
          </div>
        </ManageCard>

        {/* 리포트 */}
        <ManageCard
          icon={<CalendarRange size={18} strokeWidth={1.75} />}
          title="주간 리포트"
          href="/reports"
          cta="전체 보기"
        >
          {o.latestReport ? (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[12px] text-[var(--t3)]">
                {fmtKDate(o.latestReport.week_start)} 주 · 단어 {o.latestReport.total_words}
              </span>
              {o.latestReport.empathetic_note && (
                <p className="font-english text-[13px] italic leading-relaxed text-[var(--t1)]">
                  {o.latestReport.empathetic_note}
                </p>
              )}
            </div>
          ) : (
            <p className="font-body text-[14px] text-[var(--t3)]">
              학습이 쌓이면 주마다 Report Card 가 생겨요.
            </p>
          )}
        </ManageCard>
      </div>
    </Screen>
  )
}

function ManageCard({
  icon,
  title,
  href,
  cta,
  children,
}: {
  icon: React.ReactNode
  title: string
  href: string
  cta: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
      <header className="flex items-center gap-2">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--p)]"
          aria-hidden
        >
          {icon}
        </span>
        <h2 className="font-display text-[15px] font-[800] text-[var(--t1)]">{title}</h2>
        <Link
          href={href}
          className="ml-auto inline-flex items-center gap-1 font-display text-[12px] font-[700] text-[var(--p)] no-underline transition-colors hover:text-[var(--p-hover)]"
        >
          {cta} <ArrowRight size={13} strokeWidth={2} aria-hidden />
        </Link>
      </header>
      {children}
    </section>
  )
}

function Stat({
  label,
  value,
  unit,
  icon,
}: {
  label: string
  value: string
  unit?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3 text-center">
      <p className="flex items-center justify-center gap-1 font-display text-[18px] font-[800] tabular-nums leading-none text-[var(--t1)]">
        {icon}
        {value}
        {unit && <span className="text-[10px] font-[600] text-[var(--t3)]">{unit}</span>}
      </p>
      <p className="mt-1 font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
        {label}
      </p>
    </div>
  )
}
