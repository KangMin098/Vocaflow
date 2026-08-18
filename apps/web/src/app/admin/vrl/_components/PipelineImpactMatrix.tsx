// apps/web/src/app/admin/vrl/_components/PipelineImpactMatrix.tsx
//
// Section 5 — Pipeline Impact Matrix.
//
// 4 책임 × 15 결함 매트릭스:
//   rows  = 15 defects (priority + id + title)
//   cols  = R1 / R2 / R3 / R4 (헤더에 readiness score)
//   cell  = severity dot (영향 시) 또는 빈 공간
//
// R3 컬럼 시각적 부각 (가장 많은 결함 영향 — 본질 페인).

import { Grid3x3 } from 'lucide-react'
import type {
  CriticalDefect,
  DictHealthSnapshot,
  ResponsibilityId,
} from '@/lib/admin/dict/types'

interface PipelineImpactMatrixProps {
  snapshot: DictHealthSnapshot
}

const RESP_COLOR: Record<ResponsibilityId, string> = {
  R1: 'var(--p)',
  R2: 'var(--success)',
  R3: 'var(--error)',
  R4: 'var(--active)',
}

const SEVERITY_DOT: Record<CriticalDefect['severity'], { bg: string; ring: string }> = {
  critical: { bg: 'var(--error)', ring: 'var(--error)' },
  warning: { bg: 'var(--active)', ring: 'var(--active)' },
  info: { bg: 'var(--info)', ring: 'var(--info)' },
}

const PRIORITY_COLOR: Record<CriticalDefect['priority'], string> = {
  P0: 'var(--error)',
  P1: 'var(--active)',
  P2: 'var(--info)',
  P3: 'var(--t3)',
}

export function PipelineImpactMatrix({ snapshot }: PipelineImpactMatrixProps) {
  const { defects, responsibilities } = snapshot
  const responsibilityIds: ResponsibilityId[] = ['R1', 'R2', 'R3', 'R4']

  // 각 책임이 영향받는 결함 카운트
  const impactCounts: Record<ResponsibilityId, number> = {
    R1: 0,
    R2: 0,
    R3: 0,
    R4: 0,
  }
  for (const d of defects) {
    for (const r of d.impactsOn) impactCounts[r] += 1
  }

  const maxImpact = Math.max(...Object.values(impactCounts))
  const maxImpactedR =
    responsibilityIds.find((r) => impactCounts[r] === maxImpact) ?? null

  if (defects.length === 0) return null

  return (
    <section aria-label="pipeline impact matrix" className="flex flex-col gap-4">
      {/* ── 섹션 헤더 ── */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)]"
            style={{ backgroundColor: '#8B5CF61A', color: '#8B5CF6' }}
            aria-hidden
          >
            <Grid3x3 size={17} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="font-display text-[18px] font-[800] leading-tight text-[var(--t1)]">
              Pipeline Impact Matrix
            </h2>
            <p className="font-body text-[12px] text-[var(--t2)]">
              4 책임 × {defects.length} 결함 — 가장 많이 영향받는 책임 = 본질 페인
            </p>
          </div>
        </div>
        {maxImpactedR && (
          <div
            className="rounded-[var(--r-md)] border border-[var(--bd)] px-3 py-2"
            style={{ backgroundColor: 'var(--error-light)' }}
          >
            <p className="font-mono text-[9px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
              본질 페인
            </p>
            <p
              className="font-display text-[16px] font-[800] leading-none"
              style={{ color: RESP_COLOR[maxImpactedR] }}
            >
              {maxImpactedR}
              <span className="ml-1 font-body text-[11px] font-[500] text-[var(--t2)]">
                {maxImpact} defects
              </span>
            </p>
          </div>
        )}
      </header>

      {/* ── 매트릭스 ── */}
      <div className="overflow-x-auto rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
        <table className="w-full min-w-[640px] border-collapse">
          {/* 컬럼 헤더 — 책임 + readiness score */}
          <thead>
            <tr className="border-b border-[var(--bd)] bg-[var(--bg2)]">
              <th className="px-3 py-2 text-left align-top">
                <p className="font-mono text-[9px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
                  Defect
                </p>
              </th>
              {responsibilityIds.map((r) => {
                const readiness = responsibilities.find((x) => x.id === r)
                const isMax = r === maxImpactedR
                const accent = RESP_COLOR[r]
                return (
                  <th
                    key={r}
                    className={`px-2 py-2 text-center align-top ${
                      isMax ? 'bg-[var(--error)]/8' : ''
                    }`}
                    style={
                      isMax
                        ? { borderLeftWidth: 2, borderLeftColor: 'var(--error)', borderRightWidth: 2, borderRightColor: 'var(--error)' }
                        : undefined
                    }
                  >
                    <p
                      className="font-display text-[11px] font-[800]"
                      style={{ color: accent }}
                    >
                      {r}
                    </p>
                    <p
                      className="font-display text-[18px] font-[800] leading-none"
                      style={{ color: accent }}
                    >
                      {readiness?.score ?? '—'}
                    </p>
                    <p className="font-mono text-[8px] text-[var(--t2)]">
                      {impactCounts[r]} hit
                    </p>
                  </th>
                )
              })}
            </tr>
          </thead>

          {/* 결함 행 (priority 순서 — 이미 정렬됨) */}
          <tbody>
            {defects.map((d) => (
              <tr
                key={d.id}
                className="border-b border-[var(--bd)] hover:bg-[var(--bg2)]"
              >
                <td className="px-3 py-2 align-top">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-flex rounded-full px-1.5 py-0.5 font-display text-[9px] font-[800] text-white"
                      style={{ backgroundColor: PRIORITY_COLOR[d.priority] }}
                    >
                      {d.priority}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--t2)]">
                      {d.id}
                    </span>
                  </div>
                  <p
                    className="mt-0.5 font-display text-[11px] font-[600] leading-snug text-[var(--t1)]"
                    title={d.title}
                  >
                    {d.title}
                  </p>
                </td>
                {responsibilityIds.map((r) => {
                  const isImpacted = d.impactsOn.includes(r)
                  const isR3Col = r === maxImpactedR
                  const sev = SEVERITY_DOT[d.severity]
                  return (
                    <td
                      key={r}
                      className="px-2 py-2 text-center align-middle"
                      style={
                        isR3Col
                          ? { borderLeftWidth: 2, borderLeftColor: 'var(--error)', borderRightWidth: 2, borderRightColor: 'var(--error)' }
                          : undefined
                      }
                    >
                      {isImpacted ? (
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: sev.bg,
                            boxShadow: `0 0 0 2px ${sev.ring}33`,
                          }}
                          aria-label={`${d.id} impacts ${r}`}
                          title={`${d.severity}`}
                        />
                      ) : (
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--bg3)]"
                          aria-hidden
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 범례 ── */}
      <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-[var(--t2)]">
        <span>범례:</span>
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: 'var(--error)',
              boxShadow: '0 0 0 2px var(--error)33',
            }}
          />
          critical
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: 'var(--active)',
              boxShadow: '0 0 0 2px var(--active)33',
            }}
          />
          warning
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: 'var(--info)',
              boxShadow: '0 0 0 2px var(--info)33',
            }}
          />
          info
        </span>
        <span className="ml-2">· R3 컬럼 부각 = 본질 페인 (가장 많은 결함 영향)</span>
      </div>
    </section>
  )
}
