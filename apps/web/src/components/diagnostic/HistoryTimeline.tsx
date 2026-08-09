// apps/web/src/components/diagnostic/HistoryTimeline.tsx
//
// V-Level 변천사 timeline 컴포넌트 — user_level_snapshots audit chain 시각화
//
// 시각 정합 (CLAUDE.md):
//   - taken_reason별 아이콘 + 색
//   - delta 표시 (+1 / -1 / 0)
//   - 시간 순 vertical timeline (좌측 dot + connector + 우측 카드)

import { Activity, Brain, Compass, Settings as SettingsIcon, Sparkles, Target, type LucideIcon } from 'lucide-react'

interface Snapshot {
  id: string
  v_level: number
  previous_v_level: number | null
  v_level_delta: number | null
  taken_reason: string
  taken_at: string
  snapshot_type: string
  triggered_by: string
  v_level_meta: Record<string, unknown> | null
  snapshot_meta?: Record<string, unknown> | null
}

interface ReasonStyle {
  icon: LucideIcon
  label: string
  color: string
}

const REASON_STYLES: Record<string, ReasonStyle> = {
  diagnostic_completed:       { icon: Compass,      label: '진단 완료',     color: 'var(--p)' },
  track_diagnostic_completed: { icon: Target,       label: 'track 진단',    color: 'var(--p-dark)' },
  auto_promotion:             { icon: Sparkles,     label: '자동 상향',     color: 'var(--active)' },
  self_declared:              { icon: SettingsIcon, label: '직접 설정',     color: 'var(--info)' },
  learning_data:              { icon: Brain,        label: '학습 누적',     color: 'var(--success)' },
  manual_override:            { icon: Activity,     label: '수동 조정',     color: 'var(--warning)' },
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function HistoryTimeline({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length === 0) {
    return (
      <div className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-8 text-center">
        <p className="font-body text-[14px] text-[var(--t2)]">
          아직 V-Level 기록이 없어요.
        </p>
        <p className="mt-1 font-body text-[12px] text-[var(--t2)]">
          /diagnostic 진단을 완료하면 첫 snapshot이 생성돼요.
        </p>
      </div>
    )
  }

  return (
    <ol className="relative flex flex-col gap-4 border-l-2 border-[var(--bd)] pl-6">
      {snapshots.map((s) => {
        const style = REASON_STYLES[s.taken_reason] ?? {
          icon: Activity, label: s.taken_reason, color: 'var(--t3)',
        }
        const Icon = style.icon
        const deltaSign = s.v_level_delta == null ? '' : s.v_level_delta > 0 ? '+' : ''
        const confidence = (s.v_level_meta as { confidence?: number } | null)?.confidence

        return (
          <li key={s.id} className="relative">
            {/* timeline dot */}
            <span
              className="absolute -left-[34px] top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg)] ring-2"
              style={{ color: style.color, '--tw-ring-color': style.color } as React.CSSProperties}
              aria-hidden
            >
              <Icon size={12} strokeWidth={2.25} />
            </span>

            {/* card */}
            <article className="rounded-ios-xl bg-[var(--bg)] p-4 shadow-ios-2">
              <header className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10px] font-[700] uppercase tracking-wider"
                    style={{ backgroundColor: style.color, color: 'var(--ti)' }}
                  >
                    {style.label}
                  </span>
                  <span className="font-body text-[11px] text-[var(--t2)]">
                    {formatDate(s.taken_at)}
                  </span>
                </div>
                {s.v_level_delta != null && s.v_level_delta !== 0 && (
                  <span
                    className="font-display text-[12px] font-[700] tabular-nums"
                    style={{ color: s.v_level_delta > 0 ? 'var(--active)' : 'var(--error)' }}
                  >
                    {deltaSign}{s.v_level_delta}
                  </span>
                )}
              </header>

              {s.taken_reason === 'track_diagnostic_completed' ? (
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[11px] font-[600] uppercase tracking-wide text-[var(--t2)]">
                    {String((s.snapshot_meta as { track_id?: string } | null | undefined)?.track_id ?? 'track')}
                  </span>
                  {(s.snapshot_meta as { previous_track_level?: number } | null | undefined)?.previous_track_level != null && (
                    <>
                      <span className="font-display text-[13px] font-[600] text-[var(--t2)]">
                        L{(s.snapshot_meta as { previous_track_level?: number }).previous_track_level}
                      </span>
                      <span className="font-body text-[10px] text-[var(--t2)]">→</span>
                    </>
                  )}
                  <span className="font-display text-[22px] font-[700] tabular-nums text-[var(--t1)]">
                    L{String((s.snapshot_meta as { estimated_track_level?: number } | null | undefined)?.estimated_track_level ?? '-')}
                  </span>
                </div>
              ) : (
                <div className="flex items-baseline gap-2">
                  {s.previous_v_level != null && (
                    <>
                      <span className="font-display text-[13px] font-[600] text-[var(--t2)]">
                        V{s.previous_v_level}
                      </span>
                      <span className="font-body text-[10px] text-[var(--t2)]">→</span>
                    </>
                  )}
                  <span className="font-display text-[22px] font-[700] tabular-nums text-[var(--t1)]">
                    V{s.v_level}
                  </span>
                </div>
              )}

              {confidence !== undefined && (
                <p className="mt-1 font-body text-[11px] text-[var(--t2)]">
                  신뢰도 {Math.round((confidence ?? 0) * 100)}%
                </p>
              )}
            </article>
          </li>
        )
      })}
    </ol>
  )
}
