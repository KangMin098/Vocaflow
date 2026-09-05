// apps/web/src/components/wordvault/hub/FlowStripe.tsx
//
// WordVault Section 7 (v06.35 iOS) — 학습 흐름 28일.
//
// iOS Fitness / Stocks "흐름" 감성:
//   · 두꺼운 캡슐 막대 (rounded-full), 그라디언트 색상
//   · 활동일 = brand --p, 오늘 = solid, 비활동 = bg3
//   · Stats 행 = 3개 통계 캡슐 (iOS Health Categories)
//
// 조회는 하지 않는다 — `daily_activity` 는 허브가 **한 번** 읽어 주간 목표와 이 줄을
// 함께 접는다(`lib/wordvault/hub-query.ts`). 예전에는 같은 표를 이 섹션과 히어로가
// 각자 쳐서 한 화면에 2회였다.

import { useMemo } from 'react'

import { Frame, StatPill } from '@/components/ui/ios'
import type { FlowDay } from '@/lib/wordvault/hub-query'

const NF = new Intl.NumberFormat('en-US')

interface FlowStripeProps {
  days: FlowDay[]
  lastActivity: { date: string; modules: string[] } | null
}

export function FlowStripe({ days, lastActivity }: FlowStripeProps) {
  if (days.length === 0) {
    return (
      <Frame title="지난 28일">
        <p className="font-body text-[13px] text-[var(--t2)]">
          학습 기록이 누적되면 추세가 보여요.
        </p>
      </Frame>
    )
  }

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

function Sparkline({ days }: { days: FlowDay[] }) {
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

