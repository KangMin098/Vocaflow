// apps/web/src/app/admin/db/AlertTriage.tsx
//
// 경보 분류표 — 열린 발견을 **한 줄씩** 본다.
//
// 왜 카드가 아니라 표인가: 실측(2026-09-06) 열린 발견 16건의 `detail` 평균이 372자였다.
// 카드로 펼치면 한 화면에 두 건이 들어가고, 나머지 열넷은 스크롤 아래에 있다. 그러면
// 「지금 몇 건이 열려 있고 그중 무엇이 급한가」에 답하는 데 스크롤이 필요해진다 —
// 그건 모니터링 화면이 아니라 문서다.
//
// 설명을 버리지는 않는다. 줄을 펼치면 그대로 다 있고, 접힌 상태에서도 제목은 온전하다.
// 급할 때 필요한 것은 문장이 아니라 **줄 수와 순서**다.
//
// 정렬은 치명 → 주의 → 참고, 같은 등급 안에서는 오래 열려 있던 것이 위다(최신순이 아니다 —
// 최신순은 오래된 미해결을 아래로 밀어 영영 안 보이게 만든다).

'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { AlertOctagon, AlertTriangle, ChevronRight, Copy, Info } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { formatAge, hoursSince, sortFindings, suggestActions } from '@/lib/admin/db-health/derive'
import { AXIS_LABEL, SEVERITY_LABEL, STATUS_LABEL } from '@/lib/admin/db-health/types'
import type { FindingRow, FindingSeverity } from '@/lib/admin/db-health/types'

import { ActionButton } from './ActionButton'

const SEV_STYLE: Record<FindingSeverity, { Icon: typeof AlertOctagon; bg: string; ink: string }> = {
  critical: { Icon: AlertOctagon, bg: 'var(--error-light)', ink: 'var(--error-ink)' },
  warning: { Icon: AlertTriangle, bg: 'var(--warning-light)', ink: 'var(--warning-ink)' },
  info: { Icon: Info, bg: 'var(--info-light)', ink: 'var(--info-ink)' },
}

const FILTERS: { key: 'all' | FindingSeverity; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'critical', label: '치명' },
  { key: 'warning', label: '주의' },
  { key: 'info', label: '참고' },
]

function StatusButtons({ id, status }: { id: number; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const set = async (next: 'ack' | 'resolved') => {
    if (busy) return
    setBusy(next)
    setFailed(false)
    try {
      const client = createClient() as unknown as SupabaseClient
      const { error } = await client.rpc('admin_set_db_health_finding_status', {
        p_id: id,
        p_status: next,
      })
      if (error) throw error
      router.refresh()
    } catch {
      setFailed(true)
    } finally {
      setBusy(null)
    }
  }

  const btn =
    'inline-flex min-h-[44px] items-center rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-2.5 py-1 font-display text-[11px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg3)] hover:text-[var(--t1)] active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]'

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {status !== 'ack' && (
        <button
          type="button"
          className={`min-h-[44px] ${btn}`}
          disabled={busy !== null}
          onClick={() => void set('ack')}
        >
          {busy === 'ack' ? '표시 중…' : '확인함'}
        </button>
      )}
      <button
        type="button"
        className={`min-h-[44px] ${btn}`}
        disabled={busy !== null}
        onClick={() => void set('resolved')}
      >
        {busy === 'resolved' ? '표시 중…' : '해결했음'}
      </button>
      {failed && (
        <span role="alert" className="font-body text-[10px] text-[var(--error-ink)]">
          바꾸지 못했어요 — admin 세션인지 확인해 주세요
        </span>
      )}
    </span>
  )
}

function CopySql({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(sql)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1600)
        } catch {
          window.alert('클립보드를 쓸 수 없어요 — 아래 SQL 을 직접 선택해 복사해 주세요')
        }
      }}
      aria-live="polite"
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-2.5 py-1 font-display text-[11px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg3)] hover:text-[var(--t1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
    >
      <Copy size={11} strokeWidth={2} aria-hidden="true" />
      {copied ? '복사함' : 'SQL 복사'}
    </button>
  )
}

export function AlertTriage({
  findings,
  actionable = true,
  noteInline = false,
}: {
  findings: FindingRow[]
  /** 면제 목록은 상태 버튼을 주지 않는다 — 눌러도 다음 판정이 되돌린다. */
  actionable?: boolean
  /**
   * 메모를 접힌 줄에서도 보여 준다. 면제 목록에서만 켠다 —
   * 거기서는 「왜 안 뜨는가」가 항목의 존재 이유라서, 펼쳐야 보이면 근거 없는 면제와 구별되지 않는다.
   */
  noteInline?: boolean
}) {
  const [filter, setFilter] = useState<'all' | FindingSeverity>('all')
  const [axis, setAxis] = useState<string>('all')
  const [open, setOpen] = useState<number | null>(null)
  const now = new Date()

  const axes = useMemo(
    () => Array.from(new Set(findings.map((f) => f.axis))).sort(),
    [findings],
  )
  const rows = useMemo(() => {
    const sorted = sortFindings(findings)
    return sorted.filter(
      (f) => (filter === 'all' || f.severity === filter) && (axis === 'all' || f.axis === axis),
    )
  }, [findings, filter, axis])

  const counts = useMemo(
    () => ({
      all: findings.length,
      critical: findings.filter((f) => f.severity === 'critical').length,
      warning: findings.filter((f) => f.severity === 'warning').length,
      info: findings.filter((f) => f.severity === 'info').length,
    }),
    [findings],
  )

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-full)] border px-3 py-1 font-display text-[11px] font-[600] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] ${
              filter === f.key
                ? 'border-[#6D28D9] bg-[#8B5CF6]/10 text-[#6D28D9]'
                : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]'
            }`}
          >
            {f.label}
            <span className="font-mono text-[10px]">{counts[f.key]}</span>
          </button>
        ))}
        {axes.length > 1 && (
          <>
            <label className="sr-only" htmlFor="axis-filter">
              축으로 거르기
            </label>
            <select
              id="axis-filter"
              value={axis}
              onChange={(e) => setAxis(e.target.value)}
              className="min-h-[44px] rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-2 font-display text-[11px] font-[600] text-[var(--t2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
            >
              <option value="all">모든 축</option>
              {axes.map((a) => (
                <option key={a} value={a}>
                  {AXIS_LABEL[a as keyof typeof AXIS_LABEL] ?? a}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-4 font-body text-[13px] text-[var(--t2)]">
          {findings.length === 0
            ? '열린 항목이 없어요.'
            : '이 조건에 맞는 항목이 없어요 — 필터를 「전체」로 돌려 보세요.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--bd)] text-left">
                {['', '등급', '축', '내용', '열린 지', '관측', '조치'].map((h, i) => (
                  <th
                    key={h || `c${i}`}
                    className="py-1.5 font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const { Icon, bg, ink } = SEV_STYLE[f.severity]
                const age = hoursSince(f.first_seen_at, now)
                const isOpen = open === f.id
                const actions = suggestActions(f)
                return (
                  <tr key={f.id} className="border-b border-[var(--bd)] align-top last:border-0">
                    <td className="py-2 pr-1">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={`${f.title} 자세히`}
                        onClick={() => setOpen(isOpen ? null : f.id)}
                        className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-[var(--r-sm)] text-[var(--t2)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] hover:bg-[var(--bg3)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
                      >
                        <ChevronRight
                          size={14}
                          strokeWidth={2.5}
                          aria-hidden="true"
                          className="transition-transform duration-[var(--dur-fast)] ease-[var(--ease)]"
                          style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
                        />
                      </button>
                    </td>
                    <td className="py-2 pr-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-[var(--r-sm)] px-1.5 py-0.5 font-display text-[10px] font-[700] whitespace-nowrap"
                        style={{ background: bg, color: ink }}
                      >
                        <Icon size={10} strokeWidth={2.5} aria-hidden="true" />
                        {SEVERITY_LABEL[f.severity]}
                      </span>
                    </td>
                    <td className="py-2 pr-2 font-mono text-[10px] text-[var(--t2)] whitespace-nowrap">
                      {AXIS_LABEL[f.axis] ?? f.axis}
                    </td>
                    <td className="max-w-[420px] py-2 pr-2">
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : f.id)}
                        className="flex min-h-[44px] w-full items-center break-keep text-left font-display text-[12px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] hover:text-[#6D28D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
                      >
                        {f.title}
                      </button>
                      {f.status === 'ack' && (
                        <span className="mt-0.5 mr-1 inline-block rounded-[var(--r-sm)] bg-[var(--bg3)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--t2)]">
                          {STATUS_LABEL.ack}
                        </span>
                      )}
                      {/* 접힌 줄에서도 "조치 SQL 이 준비돼 있다" 를 알 수 있어야 훑을 수 있다. */}
                      {f.suggested_sql && (
                        <span className="mt-0.5 inline-block rounded-[var(--r-sm)] bg-[var(--bg3)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--t2)]">
                          SQL
                        </span>
                      )}
                      {noteInline && f.note && (
                        <span className="mt-1 block break-keep font-editorial text-[11px] italic leading-[1.6] text-[var(--t2)]">
                          {f.note}
                        </span>
                      )}
                      {isOpen && (
                        <div className="mt-2 space-y-2 border-t border-[var(--bd)] pt-2">
                          <p className="break-keep font-body text-[12px] leading-[1.65] text-[var(--t2)]">
                            {f.detail}
                          </p>
                          {f.evidence && Object.keys(f.evidence).length > 0 && (
                            <dl className="flex flex-wrap gap-x-3 gap-y-1">
                              {Object.entries(f.evidence).map(([k, v]) => (
                                <div key={k} className="flex items-baseline gap-1">
                                  <dt className="font-mono text-[10px] text-[var(--t2)]">{k}</dt>
                                  <dd className="font-mono text-[10px] font-[600] text-[var(--t2)]">
                                    {typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          )}
                          {f.note && !noteInline && (
                            <p className="break-keep font-editorial text-[11px] italic leading-[1.7] text-[var(--t2)]">
                              {f.note}
                            </p>
                          )}
                          {f.suggested_sql && (
                            <div>
                              <pre className="overflow-x-auto rounded-[var(--r-sm)] bg-[var(--bg3)] p-2 font-mono text-[10px] leading-[1.6] text-[var(--t1)]">
                                {f.suggested_sql}
                              </pre>
                              <p className="mt-1.5 flex flex-wrap items-center gap-2">
                                <CopySql sql={f.suggested_sql} />
                                <span className="font-body text-[10px] text-[var(--t2)]">
                                  이 SQL 은 화면이 실행하지 않는다 — 되돌릴 수 없는 것이 섞여 있다
                                </span>
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-2 font-mono text-[10px] text-[var(--t2)] whitespace-nowrap">
                      {age === null ? '—' : formatAge(age)}
                    </td>
                    <td className="py-2 pr-2 font-mono text-[10px] text-[var(--t2)]">
                      {f.occurrences}
                    </td>
                    <td className="py-2">
                      <span className="flex flex-wrap gap-1.5">
                        {actions.map((a) => (
                          <ActionButton
                            key={`${a.action}-${a.target ?? ''}`}
                            action={a.action}
                            target={a.target}
                            findingId={f.id}
                          />
                        ))}
                        {actionable && <StatusButtons id={f.id} status={f.status} />}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
