'use client'

import { Check, X, AlertCircle } from 'lucide-react'
import type { SeedPreviewItem, SeedPreviewSpec } from '@/lib/vcb/server/seed'

interface Props {
  selected: SeedPreviewItem | null
  spec: SeedPreviewSpec
  isRejected: boolean
  onToggleReject: () => void
}

const CEFR_DOT_COLOR: Record<string, string> = {
  A1: 'var(--cefr-a1)',
  A2: 'var(--cefr-a2)',
  B1: 'var(--cefr-b1)',
  B2: 'var(--cefr-b2)',
  C1: 'var(--cefr-c1)',
  C2: 'var(--cefr-c2)',
}

function confLabel(c: number): { color: string; label: string } {
  if (c >= 0.85) return { color: 'var(--success)', label: '높음' }
  if (c >= 0.70) return { color: 'var(--warning)', label: '보통' }
  return { color: 'var(--error)', label: '낮음' }
}

interface MatchRow {
  label: string
  status: 'pass' | 'warn' | 'na'
  detail: string
}

function specMatch(item: SeedPreviewItem, spec: SeedPreviewSpec): MatchRow[] {
  const rows: MatchRow[] = []
  rows.push({
    label: 'target_segment',
    status: spec.target_segment ? 'pass' : 'na',
    detail: spec.target_segment ?? '미설정',
  })
  const inCefr =
    spec.target_cefr_range.length === 0 ||
    spec.target_cefr_range.includes(item.cefr_estimate)
  rows.push({
    label: 'target_cefr',
    status: spec.target_cefr_range.length === 0 ? 'na' : inCefr ? 'pass' : 'warn',
    detail: inCefr ? item.cefr_estimate : `${item.cefr_estimate} (spec: ${spec.target_cefr_range.join(', ')})`,
  })
  const lemmaLower = item.lemma.toLowerCase()
  const mustIncludeMatch =
    spec.must_include_keywords.length === 0
      ? null
      : spec.must_include_keywords.some((k) =>
          lemmaLower.includes(k.toLowerCase()) ||
          item.rationale_short.toLowerCase().includes(k.toLowerCase()),
        )
  rows.push({
    label: 'must_include',
    status:
      spec.must_include_keywords.length === 0
        ? 'na'
        : mustIncludeMatch
          ? 'pass'
          : 'na',
    detail:
      spec.must_include_keywords.length === 0
        ? '없음'
        : mustIncludeMatch
          ? '매칭'
          : '미매칭',
  })
  const mustExcludeHit =
    spec.must_exclude_keywords.length > 0 &&
    spec.must_exclude_keywords.some((k) => lemmaLower.includes(k.toLowerCase()))
  rows.push({
    label: 'must_exclude',
    status: spec.must_exclude_keywords.length === 0 ? 'na' : mustExcludeHit ? 'warn' : 'pass',
    detail: mustExcludeHit ? '⚠ spec 위반' : spec.must_exclude_keywords.length === 0 ? '없음' : '미해당',
  })
  return rows
}

export function VcbPreviewDetail({ selected, spec, isRejected, onToggleReject }: Props) {
  if (!selected) {
    return (
      <aside
        className="rounded-[var(--r-lg)] border p-6 flex flex-col gap-2"
        style={{
          background: 'var(--bg)',
          borderColor: 'var(--bd)',
          minHeight: '320px',
        }}
      >
        <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--t3)' }}>
          상세
        </div>
        <p className="text-sm" style={{ color: 'var(--t2)' }}>
          행을 선택하면 rationale 과 spec match 가 표시돼요.
        </p>
        <p className="text-xs mt-auto" style={{ color: 'var(--t3)' }}>
          키보드: <kbd className="px-1 py-0.5 rounded-[var(--r-sm)] font-mono text-[10px]"
            style={{ background: 'var(--bg2)', color: 'var(--t2)' }}>↑/↓</kbd> 행 이동
          {' · '}
          <kbd className="px-1 py-0.5 rounded-[var(--r-sm)] font-mono text-[10px]"
            style={{ background: 'var(--bg2)', color: 'var(--t2)' }}>r</kbd> 거부 토글
          {' · '}
          <kbd className="px-1 py-0.5 rounded-[var(--r-sm)] font-mono text-[10px]"
            style={{ background: 'var(--bg2)', color: 'var(--t2)' }}>/</kbd> 검색
        </p>
      </aside>
    )
  }

  const matches = specMatch(selected, spec)
  const cefrColor = CEFR_DOT_COLOR[selected.cefr_estimate] ?? 'var(--t4)'
  const conf = confLabel(selected.confidence)

  return (
    <aside
      className="rounded-[var(--r-lg)] border p-5 flex flex-col gap-4"
      style={{
        background: 'var(--bg)',
        borderColor: 'var(--bd)',
        minHeight: '320px',
      }}
    >
      <div>
        <div
          className="font-english leading-tight"
          style={{ fontSize: '28px', fontWeight: 600, color: 'var(--t1)' }}
        >
          {selected.lemma}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span
            className="font-mono px-2 py-0.5 rounded-[var(--r-sm)]"
            style={{ background: 'var(--bg3)', color: 'var(--t2)' }}
          >
            {selected.pos}
          </span>
          <span className="flex items-center gap-1" style={{ color: 'var(--t2)' }}>
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: cefrColor }}
            />
            <span className="font-mono">{selected.cefr_estimate}</span>
          </span>
          <span className="font-mono" style={{ color: 'var(--t3)' }}>
            tier: {selected.frequency_tier}
          </span>
        </div>
      </div>

      <div
        className="flex items-center gap-2 px-3 py-2 rounded-[var(--r-md)]"
        style={{ background: 'var(--bg2)' }}
      >
        <span className="text-[11px] font-display uppercase tracking-wider" style={{ color: 'var(--t3)' }}>
          신뢰도
        </span>
        <span
          className="font-mono font-semibold tabular-nums"
          style={{ color: conf.color }}
        >
          {selected.confidence.toFixed(2)}
        </span>
        <span
          className="text-[11px] px-1.5 py-0.5 rounded-[var(--r-sm)] font-mono"
          style={{ background: 'var(--bg)', color: conf.color }}
        >
          {conf.label}
        </span>
        <div
          className="ml-auto flex-1 h-1.5 rounded-[var(--r-full)] overflow-hidden max-w-[120px]"
          style={{ background: 'var(--bg3)' }}
        >
          <div
            className="h-full"
            style={{
              width: `${selected.confidence * 100}%`,
              background: conf.color,
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--t3)' }}>
          rationale
        </div>
        <p
          className="font-english italic text-sm leading-relaxed"
          style={{ color: 'var(--t2)' }}
        >
          {selected.rationale_short || <span style={{ color: 'var(--t3)' }}>(rationale 없음)</span>}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--t3)' }}>
          spec match
        </div>
        <dl className="flex flex-col gap-1.5">
          {matches.map((m) => (
            <div key={m.label} className="flex items-center gap-2 text-xs">
              {m.status === 'pass' ? (
                <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--success)' }} />
              ) : m.status === 'warn' ? (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--warning)' }} />
              ) : (
                <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center" style={{ color: 'var(--t4)' }}>
                  —
                </span>
              )}
              <dt className="font-mono w-28" style={{ color: 'var(--t3)' }}>
                {m.label}
              </dt>
              <dd
                className="flex-1 truncate"
                style={{ color: m.status === 'warn' ? 'var(--warning)' : 'var(--t2)' }}
                title={m.detail}
              >
                {m.detail}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleReject}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-[var(--r-md)] text-sm font-display font-semibold border"
          style={{
            background: isRejected ? 'var(--success-light)' : 'var(--error-light)',
            color: isRejected ? 'var(--success)' : 'var(--error)',
            borderColor: isRejected ? 'var(--success)' : 'var(--error)',
          }}
        >
          {isRejected ? (
            <>
              <Check className="w-4 h-4" />
              복귀
            </>
          ) : (
            <>
              <X className="w-4 h-4" />
              거부
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
