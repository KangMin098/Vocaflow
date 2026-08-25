// apps/web/src/components/wordvault/hub/FlowStripe.tsx
//
// WordVault Section 6 (v06.35 iOS) — 학습 흐름 28일.
//
// iOS Fitness / Stocks "흐름" 감성:
//   · 두꺼운 캡슐 막대 (rounded-full), 그라디언트 색상
//   · 활동일 = brand --p, 오늘 = solid, 비활동 = bg3
//   · Stats 행 = 3개 통계 캡슐 (iOS Health Categories)

'use client'

import { useEffect, useMemo, useState } from 'react'

import { Frame, StatPill } from '@/components/ui/ios'
import { createClient } from '@/lib/supabase/client'

interface Day {
  date: string
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
        <p className="font-body text-[13px] text-[var(--t2)]">
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
      {/* Stats — iOS Health 캡슐 row */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatPill label="평균" value={NF.format(avg)} unit="개/일" />
        <StatPill label="활동" value={NF.format(activeDays)} unit="일" />
        <StatPill label="총합" value={NF.format(total)} unit="개" />
      </div>

      {/* Sparkline — 캡슐 막대 28일 */}
      <Sparkline days={days} />

      {/* Last activity */}
      {lastActivity && (
        <div className="mt-5 flex items-center justify-between rounded-[14px] bg-[var(--bg2)] px-4 py-3">
          <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-[var(--t2)]">
            마지막 학습
          </span>
          <div className="flex items-center gap-2">
            <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
              {relativeDay(lastActivity.date)}
            </span>
            {lastActivity.modules.length > 0 && (
              <span className="font-body text-[11.5px] text-[var(--t2)]">
                · {lastActivity.modules.map(prettyModule).join(', ')}
              </span>
            )}
          </div>
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
      aria-label="최근 28일 학습량 추세"
      className="flex h-[68px] items-end gap-1"
    >
      {days.map((d, i) => {
        const h = (d.words / max) * 100
        const isToday = i === days.length - 1
        let bg = 'var(--bg3)'
        if (d.words > 0) {
          bg = isToday ? 'var(--p)' : 'var(--p-light)'
        }
        return (
          <div
            key={d.date}
            className="flex flex-1 items-end justify-center"
          >
            <div
              className="w-full rounded-full transition-all duration-[var(--dur-fast)]"
              style={{
                height: `${Math.max(6, h)}%`,
                backgroundColor: bg,
                opacity: d.words === 0 ? 0.5 : 1,
                boxShadow: isToday && d.words > 0 ? '0 2px 8px rgba(88,86,214,0.30)' : 'none',
              }}
              title={`${d.date} · ${d.words} 단어`}
            />
          </div>
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

