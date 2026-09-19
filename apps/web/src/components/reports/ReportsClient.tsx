// apps/web/src/components/reports/ReportsClient.tsx
// 주간 Report Card — **주마다 한 겹**(2026-09-19 화면 재설계 DD-29 · docs/design/compare/retrospect.md).
//
// `/dashboard` 「기억의 지층」과 같은 문법: 최신 주가 위, 겹 두께 = 그 주의 복습 수.
// 걷은 것 — 팔레트 밖 3D 달력 이모지 · 가운데 정렬 빈 상태 카드 · 3열 숫자 상자 · 카드 그림자 ·
//   머리의 「N분」(60초 미만 세션이 0 으로 반올림되는 칸이라 `/dashboard` 는 분을 쓰지 않는다 — 두 회고의 기준을 맞춘다).
// 조회 실패(`failed`)는 빈 상태와 다르게 말한다 — 이전에는 실패가 "아직 리포트가 없어요" 로 보였다.

'use client'

import { ArrowRight, RefreshCw, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Gwonjeom } from '@/components/ui/press/Gwonjeom'
import { generateWeeklyReport, type WeeklyReport } from '@/lib/learner/weekly-report'

const MODULE_LABEL: Record<string, string> = {
  flashcard: 'Flashcard',
  spellforge: 'SpellForge',
  wordblitz: 'WordBlitz',
  pairflip: 'PairFlip',
  scriptquiz: 'ScriptQuiz',
  dictation: 'Dictation',
}

/** 겹 바탕 = `--p` 를 최대 이만큼(%) — 복습이 가장 많은 주가 가장 진하다. 글자 대비를 지키는 상한 */
const TINT_MAX = 14

/** 겹 두께(px) — 복습 수의 제곱근. 한 주가 화면을 먹지 않게 상한 */
function layerPad(reviews: number): number {
  return Math.round(10 + Math.min(22, Math.sqrt(Math.max(0, reviews)) * 1.4))
}

export function ReportsClient({ reports, failed = false }: { reports: WeeklyReport[]; failed?: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [retrying, startRetry] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function refresh() {
    setError(null)
    startTransition(async () => {
      const res = await generateWeeklyReport()
      if (res.ok) router.refresh()
      else setError(res.error ?? '갱신에 실패했어요.')
    })
  }

  const maxReviews = Math.max(1, ...reports.map((r) => r.total_reviews ?? 0))

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8 md:py-10">
      <header className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b-2 border-[var(--t1)] pb-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-editorial text-[26px] font-[500] leading-[1.1] tracking-[-0.012em] text-[var(--t1)] [word-break:keep-all] md:text-[30px]">
            주마다 한 겹
          </h1>
          <p className="mt-1 font-body text-[13px] text-[var(--t2)] [word-break:keep-all]">
            복습이 많았던 주일수록 겹이 두꺼워요. 위가 가장 최근이에요.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={pending || failed}
          // 44px 하한 — 실측 113x36 이었다(a11y 스윕 16회차).
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-2 font-display text-[12px] font-[700] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] hover:text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={13} strokeWidth={2} className={pending ? 'animate-spin' : ''} aria-hidden />
          {pending ? '갱신 중…' : '이번 주 겹 쌓기'}
        </button>
      </header>

      {error && (
        <p role="alert" className="font-body text-[13px] text-[var(--error-ink)]">
          {error}
        </p>
      )}

      {failed ? (
        // 조회 실패 — "없다" 가 아니라 "못 읽었다". 쌓아 온 주들이 사라진 것처럼 보이면 안 된다.
        <section
          role="alert"
          className="flex flex-col gap-3 border-l-2 border-[var(--error)] py-2 pl-4 sm:flex-row sm:items-center"
        >
          <p className="flex-1 font-body text-[14px] leading-relaxed text-[var(--error-ink)] [word-break:keep-all]">
            지금은 지난 주들을 불러오지 못했어요. 연결이 끊겼거나 잠시 응답이 없었어요 — 기록은 그대로 있어요.
          </p>
          <button
            type="button"
            onClick={() => startRetry(() => router.refresh())}
            disabled={retrying}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[12px] font-[700] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw size={13} className={retrying ? 'animate-spin' : undefined} aria-hidden />
            다시 시도
          </button>
        </section>
      ) : reports.length === 0 ? (
        // 빈 상태 — 가운데 정렬 카드 대신 첫 겹이 놓일 자리(점선 한 줄) + 다음 한 걸음(D4)
        <section className="flex flex-col gap-4">
          <div aria-hidden className="h-10 border-y border-dashed border-[var(--bd)]" />
          <p className="max-w-[46ch] font-editorial text-[19px] leading-[1.5] text-[var(--t1)] [word-break:keep-all]">
            아직 쌓인 겹이 없어요. 한 주를 학습했다면 「이번 주 겹 쌓기」로 첫 겹을 놓을 수 있어요.
          </p>
          <Link
            href="/hub"
            className="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-[var(--r-md)] bg-[var(--ju)] px-4 py-2 font-display text-[13px] font-[700] text-[var(--on-ju)] no-underline transition-colors duration-[var(--dur-normal)] hover:bg-[var(--ju-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px"
          >
            오늘 할 일 보러 가기
            <ArrowRight size={14} strokeWidth={2.2} aria-hidden />
          </Link>
        </section>
      ) : (
        <>
          <ol className="flex flex-col" aria-label="주간 겹 — 최근 주가 위">
            {reports.map((r) => (
              <li key={r.week_start}>
                <WeekLayer report={r} maxReviews={maxReviews} />
              </li>
            ))}
          </ol>
          {/* 돌아본 다음에 갈 곳. 차분하게 한 줄만 — 회고 화면에서 재촉하지 않는다. */}
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] w-fit items-center gap-2 font-display text-[13px] font-[700] text-[var(--t2)] no-underline transition-colors duration-[var(--dur-normal)] hover:text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
          >
            기억의 지층 보기
            <ArrowRight size={14} strokeWidth={2.2} aria-hidden />
          </Link>
        </>
      )}
    </div>
  )
}

function WeekLayer({ report, maxReviews }: { report: WeeklyReport; maxReviews: number }) {
  const reviews = report.total_reviews ?? 0
  const modules = Object.entries(report.by_module ?? {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
  const tint = Math.round((reviews / maxReviews) * TINT_MAX)
  const pad = layerPad(reviews)
  const ago = weeksAgo(report.week_start)

  return (
    <article
      data-week-layer=""
      className="border-b border-[var(--bd)] px-1"
      style={{
        background: `color-mix(in srgb, var(--p) ${tint}%, var(--bg))`,
        paddingTop: pad,
        paddingBottom: pad,
      }}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">{formatWeek(report.week_start)}</h2>
        <span className="font-mono text-[11px] text-[var(--t2)]">{ago === 0 ? '이번 주' : `${ago}주 전`}</span>
        {/* 아무것도 없던 주는 0 두 개가 아니라 한 마디로(Implicit Progress — 2026-09-19 수정 1회차) */}
        <span className="ml-auto font-body text-[13px] text-[var(--t1)] [word-break:keep-all]">
          {reviews === 0 && (report.total_words ?? 0) === 0 ? (
            <span className="text-[var(--t2)]">쉬어 간 주</span>
          ) : (
            <>
              복습 <strong className="font-display font-[700] tabular-nums">{reviews.toLocaleString()}</strong>번 · 단어{' '}
              <strong className="font-display font-[700] tabular-nums">{(report.total_words ?? 0).toLocaleString()}</strong>개
            </>
          )}
        </span>
      </header>

      {modules.length > 0 && (
        <p className="mt-1 font-mono text-[11px] text-[var(--t2)]">
          {modules.map(([m, c]) => `${MODULE_LABEL[m] ?? m} ${c}`).join(' · ')}
        </p>
      )}

      {report.empathetic_note && (
        <p className="mt-2 flex items-start gap-2 font-editorial text-[15px] leading-relaxed text-[var(--t1)] [word-break:keep-all]">
          <Gwonjeom size={14} className="mt-0.5 flex-shrink-0 text-[var(--p)]" aria-hidden />
          {report.empathetic_note}
        </p>
      )}
    </article>
  )
}

/** 그 주가 몇 주 전인가 — 0 이면 이번 주. 날짜만 적으면 낡은 겹을 최신으로 읽는다(ManageSection 과 같은 규칙). */
function weeksAgo(weekStartIso: string): number {
  const start = new Date(`${weekStartIso}T00:00:00Z`).getTime()
  if (Number.isNaN(start)) return 0
  return Math.max(0, Math.floor((Date.now() - start) / (7 * 86_400_000)))
}

/** 'YYYY-MM-DD'(월) → 'M월 D일 주' */
function formatWeek(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일 주`
}
