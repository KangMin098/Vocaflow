// apps/web/src/components/wordvault/hub/FlowStripe.tsx
//
// WordVault Zone 4 (v06.35) — 학습 흐름.
// 28일 sparkline + 평균 + 마지막 학습 시점.
// daily_activity 테이블에서 직접 fetch (0이면 차분한 안내).

'use client'

import { useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

interface Day {
  date: string // YYYY-MM-DD
  words: number
  minutes: number
}

type State =
  | { kind: 'loading' }
  | { kind: 'unauth' }
  | { kind: 'ready'; days: Day[]; lastActivity: { date: string; modules: string[] } | null }
  | { kind: 'error'; message: string }

const NF = new Intl.NumberFormat('en-US')

export function FlowStripe() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setState({ kind: 'unauth' })
        return
      }

      // 최근 28일 (오늘 기준)
      const today = new Date()
      const cutoff = new Date(today)
      cutoff.setDate(today.getDate() - 27)
      const cutoffStr = cutoff.toISOString().slice(0, 10)

      const { data, error } = await supabase
        .from('daily_activity')
        .select('date, total_words, total_minutes, by_module')
        .eq('user_id', user.id)
        .gte('date', cutoffStr)
        .order('date', { ascending: true })

      if (cancelled) return
      if (error) {
        setState({ kind: 'error', message: error.message })
        return
      }

      const map = new Map<string, { words: number; minutes: number; byModule: Record<string, number> }>()
      for (const r of (data ?? []) as Array<{
        date: string
        total_words: number | null
        total_minutes: number | null
        by_module: Record<string, number> | null
      }>) {
        map.set(r.date, {
          words: r.total_words ?? 0,
          minutes: r.total_minutes ?? 0,
          byModule: r.by_module ?? {},
        })
      }

      // 28일 채우기 (없는 날은 0)
      const days: Day[] = []
      for (let i = 0; i < 28; i++) {
        const d = new Date(cutoff)
        d.setDate(cutoff.getDate() + i)
        const key = d.toISOString().slice(0, 10)
        const entry = map.get(key)
        days.push({
          date: key,
          words: entry?.words ?? 0,
          minutes: entry?.minutes ?? 0,
        })
      }

      // 마지막 학습 활동
      let lastActivity: { date: string; modules: string[] } | null = null
      const lastWithActivity = [...(data ?? [])]
        .filter(
          (r): r is { date: string; total_words: number | null; total_minutes: number | null; by_module: Record<string, number> | null } =>
            (r.total_words ?? 0) > 0 || (r.total_minutes ?? 0) > 0,
        )
        .pop()
      if (lastWithActivity) {
        const modules = Object.keys(lastWithActivity.by_module ?? {}).slice(0, 3)
        lastActivity = { date: lastWithActivity.date, modules }
      }

      setState({ kind: 'ready', days, lastActivity })
    })().catch((e: unknown) => {
      if (cancelled) return
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind === 'loading' || state.kind === 'unauth' || state.kind === 'error') {
    return (
      <Frame title="지난 28일">
        <p className="font-body text-[13px] text-[var(--t3)]">
          학습 기록이 누적되면 추세가 보여요.
        </p>
      </Frame>
    )
  }

  const { days, lastActivity } = state
  const total = days.reduce((s, d) => s + d.words, 0)
  const activeDays = days.filter((d) => d.words > 0).length
  const avg = activeDays > 0 ? Math.round(total / activeDays) : 0

  return (
    <Frame title="지난 28일">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Sparkline */}
        <div className="flex-1">
          <Sparkline days={days} />
        </div>

        {/* Stats */}
        <div className="flex shrink-0 items-baseline gap-5 font-mono text-[11px] text-[var(--t3)] sm:flex-col sm:items-end sm:gap-2">
          <span>
            평균{' '}
            <strong className="ml-1 font-display tabular-nums text-[var(--t1)]">
              {NF.format(avg)}
            </strong>
            <span className="ml-0.5">개/일</span>
          </span>
          <span>
            활동
            <strong className="ml-1 font-display tabular-nums text-[var(--t1)]">
              {NF.format(activeDays)}
            </strong>
            <span className="ml-0.5">일</span>
          </span>
          <span>
            총
            <strong className="ml-1 font-display tabular-nums text-[var(--t1)]">
              {NF.format(total)}
            </strong>
            <span className="ml-0.5">개</span>
          </span>
        </div>
      </div>

      {/* Last activity */}
      {lastActivity && (
        <div className="mt-4 border-t border-[var(--bd)] pt-3 font-body text-[12px] text-[var(--t2)]">
          마지막 학습 ·{' '}
          <strong className="font-display text-[var(--t1)]">
            {relativeDay(lastActivity.date)}
          </strong>
          {lastActivity.modules.length > 0 && (
            <>
              {' · '}
              <span className="text-[var(--t3)]">
                {lastActivity.modules.map(prettyModule).join(' · ')}
              </span>
            </>
          )}
        </div>
      )}
    </Frame>
  )
}

function Sparkline({ days }: { days: Day[] }) {
  const max = useMemo(() => Math.max(1, ...days.map((d) => d.words)), [days])
  return (
    <div
      role="img"
      aria-label={`최근 28일 학습량 추세`}
      className="flex h-12 items-end gap-[3px]"
    >
      {days.map((d, i) => {
        const h = (d.words / max) * 100
        const isToday = i === days.length - 1
        return (
          <div
            key={d.date}
            className="flex-1 rounded-t-[2px] transition-colors duration-[var(--dur-fast)]"
            style={{
              height: `${Math.max(2, h)}%`,
              backgroundColor:
                d.words === 0
                  ? 'var(--bg3)'
                  : isToday
                    ? 'var(--p)'
                    : 'var(--t3)',
              opacity: d.words === 0 ? 0.5 : 1,
            }}
            title={`${d.date} · ${d.words} 단어`}
          />
        )
      })}
    </div>
  )
}

function relativeDay(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dd = new Date(d)
  dd.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - dd.getTime()) / 86_400_000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  if (diff < 7) return `${diff}일 전`
  if (diff < 14) return '1주일 전'
  return `${Math.floor(diff / 7)}주 전`
}

function prettyModule(id: string): string {
  const map: Record<string, string> = {
    flashcard: 'Flashcard',
    spellforge: 'SpellForge',
    wordblitz: 'WordBlitz',
    pairflip: 'PairFlip',
    scriptquiz: 'ScriptQuiz',
    dictation: 'Dictation',
    wordvault: 'WordVault',
    workspace: 'Workspace',
    textviewer: 'TextViewer',
  }
  return map[id] ?? id
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      aria-label={title}
      className="rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 md:p-7"
    >
      <header className="mb-4">
        <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
          {title}
        </span>
      </header>
      {children}
    </section>
  )
}
