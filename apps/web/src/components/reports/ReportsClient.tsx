// apps/web/src/components/reports/ReportsClient.tsx
// 주간 Report Card 목록 + "이번 주 갱신"(server action). Calm UI · 격려 코멘트 Lora italic.

'use client'

import { ArrowRight, CalendarRange, Clock, RefreshCw, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { generateWeeklyReport, type WeeklyReport } from '@/lib/learner/weekly-report'

const MODULE_LABEL: Record<string, string> = {
  flashcard: 'Flashcard',
  spellforge: 'SpellForge',
  wordblitz: 'WordBlitz',
  pairflip: 'PairFlip',
  scriptquiz: 'ScriptQuiz',
  dictation: 'Dictation',
}

export function ReportsClient({ reports }: { reports: WeeklyReport[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function refresh() {
    setError(null)
    startTransition(async () => {
      const res = await generateWeeklyReport()
      if (res.ok) router.refresh()
      else setError(res.error ?? '갱신에 실패했어요.')
    })
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-10">
      <header className="flex items-center gap-2">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] bg-[var(--p-light)] text-[var(--on-p-tint)]"
          aria-hidden
        >
          <CalendarRange size={18} strokeWidth={1.75} />
        </span>
        <div className="flex-1">
          <h1 className="font-display text-[20px] font-[800] text-[var(--t1)]">주간 리포트</h1>
          <p className="font-body text-[12px] text-[var(--t2)]">주마다 학습을 차분히 돌아봐요</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={pending}
          // 44px 하한 — 실측 113x36 이었다(a11y 스윕 16회차).
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-2 font-display text-[12px] font-[700] text-[var(--t2)] transition-colors hover:border-[var(--p)] hover:text-[var(--p)] disabled:opacity-50"
        >
          <RefreshCw size={13} strokeWidth={2} className={pending ? 'animate-spin' : ''} aria-hidden />
          {pending ? '갱신 중…' : '이번 주 갱신'}
        </button>
      </header>

      {error && (
        <p role="alert" className="font-body text-[13px] text-[var(--error-ink)]">
          {error}
        </p>
      )}

      {reports.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-6 py-16 text-center">
          <span className="select-none text-4xl" aria-hidden>
            🗓️
          </span>
          <p className="font-display text-[15px] font-[700] text-[var(--t1)]">
            아직 리포트가 없어요
          </p>
          <p className="font-body text-[13px] leading-relaxed text-[var(--t2)]">
            학습을 시작하면 주마다 Report Card 가 쌓여요.
            <br />
            지금 한 주를 학습했다면 위 “이번 주 갱신”을 눌러보세요.
          </p>
          {/* "학습을 시작하면" 이라고 말해 놓고 시작할 길을 주지 않으면 그건 막다른 길이다.
              처방 정본은 하나(Today) — 여기서 고르게 하지 않고 그리로 보낸다. */}
          <Link
            href="/hub"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-4 py-2 font-display text-[13px] font-[700] text-white transition-transform hover:-translate-y-px motion-reduce:transition-none"
          >
            오늘 할 일 보러 가기
            <ArrowRight size={14} strokeWidth={2.2} aria-hidden />
          </Link>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {reports.map((r) => (
              <li key={r.week_start}>
                <ReportCard report={r} />
              </li>
            ))}
          </ul>
          {/* 돌아본 다음에 갈 곳. 차분하게 한 줄만 — 회고 화면에서 재촉하지 않는다. */}
          <Link
            href="/hub"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 self-center rounded-[var(--r-md)] px-4 py-2 font-display text-[13px] font-[700] text-[var(--t2)] transition-colors hover:text-[var(--p)]"
          >
            오늘 할 일 보러 가기
            <ArrowRight size={14} strokeWidth={2.2} aria-hidden />
          </Link>
        </>
      )}
    </div>
  )
}

function ReportCard({ report }: { report: WeeklyReport }) {
  const modules = Object.entries(report.by_module ?? {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])

  return (
    <article className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
      <header className="flex items-center gap-2">
        <span className="font-mono text-[12px] tabular-nums text-[var(--t2)]">
          {formatWeek(report.week_start)}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-[var(--t2)]">
          <Clock size={11} aria-hidden /> {report.total_minutes}분
        </span>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="단어" value={report.total_words} />
        <Stat label="복습" value={report.total_reviews} />
        <Stat label="모듈" value={modules.length} />
      </div>

      {modules.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {modules.map(([m, c]) => (
            <span
              key={m}
              className="rounded-[var(--r-sm)] bg-[var(--bg2)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--t2)]"
            >
              {MODULE_LABEL[m] ?? m} · {c}
            </span>
          ))}
        </div>
      )}

      {report.empathetic_note && (
        <p className="flex items-start gap-2 border-t border-[var(--bd)] pt-3 font-english text-[14px] italic leading-relaxed text-[var(--t1)]">
          <Sparkles size={14} className="mt-0.5 flex-shrink-0 text-[var(--p)]" aria-hidden />
          {report.empathetic_note}
        </p>
      )}
    </article>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3 text-center">
      <p className="font-display text-[20px] font-[800] tabular-nums leading-none text-[var(--t1)]">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
        {label}
      </p>
    </div>
  )
}

/** 'YYYY-MM-DD'(월) → 'M월 D일 주' */
function formatWeek(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일 주`
}
