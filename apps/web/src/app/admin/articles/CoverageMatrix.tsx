// apps/web/src/app/admin/articles/CoverageMatrix.tsx
// ACP §18 P1 — register × CEFR 커버리지 매트릭스 (① 뷰).
//
// 큐레이션을 "소스 더 넣기"가 아니라 "빈 칸 채우기"로 — register × CEFR 균형 관리.
// 빈 칸(gap) = 큐레이션 우선 채움. 셀 클릭 → 소스GET stage 로 이동.
//
// ⚠️ 이 표는 **글 목록을 세지 않는다**. 2026-09-05 이전에는 상위 컴포넌트가 넘긴
//    `articles` 를 훑어 발행분을 셌는데, 그 배열은 PostgREST 1,000행 절단에 걸려
//    발행 293건이 한 건도 안 들어 있었다 → 30칸 전부 GAP → 그 GAP 이 소스 추천의
//    근거로 흘러갔다. 이제 칸마다 서버 카운트(admin-queries.getPublishedCoverage)를 받는다.
//
// 축(register 5 · CEFR 6)은 source-guide 의 정본을 그대로 쓴다 — 여기서 다시 정의하면
// 카운트를 만든 쪽과 그리는 쪽의 칸이 어긋나 조용히 0 이 뜬다.

import type { CoverageCounts } from '@/lib/articles/types'
import { CEFR_ORDER, REGISTERS, coverageKey } from '@/lib/articles/source-guide'

export interface CoverageCell {
  register: string
  cefr: string
}

interface Props {
  coverage: CoverageCounts
  /** 셀 클릭 → 소스GET 프리필 (P3 연동). register·CEFR 전달. */
  onCellClick?: (cell: CoverageCell) => void
}

export function CoverageMatrix({ coverage, onCellClick }: Props) {
  const unclassified = coverage.unclassified

  return (
    <section
      aria-label="레지스터 × CEFR 분포"
      className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
    >
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[13px] font-[700] text-[var(--t1)]">
          레지스터 × CEFR 발행 커버리지
        </h2>
        <span className="font-mono text-[10px] text-[var(--t2)]">
          발행 {coverage.publishedTotal.toLocaleString()} · GAP(빗금) = 발행 0 · 셀 클릭 → 소스 GET
          {unclassified > 0 ? ` · 미분류 ${unclassified.toLocaleString()}` : ''}
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[var(--t2)]">
              <th className="px-2 py-1 text-left font-[600]">register \ CEFR</th>
              {CEFR_ORDER.map((c) => (
                <th key={c} className="px-2 py-1 font-mono font-[700]">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REGISTERS.map((r) => (
              <tr key={r.key} className="border-t border-[var(--bd)]">
                <td className="px-2 py-1 text-left font-display text-[12px] font-[600] text-[var(--t2)]">
                  {r.label}
                </td>
                {CEFR_ORDER.map((c) => {
                  const n = coverage.cells[coverageKey(r.key, c)] ?? 0
                  const isGap = n === 0
                  // gap = 발행 0 (빗금 + GAP, risk색) / filled = 좌측 stable 바 + 발행건수.
                  const cellStyle = isGap
                    ? {
                        backgroundImage:
                          'repeating-linear-gradient(45deg, var(--learn-error-light) 0, var(--learn-error-light) 4px, transparent 4px, transparent 8px)',
                      }
                    : { backgroundColor: 'var(--learn-known-light)' }
                  const inner = (
                    <span className="relative flex min-h-[36px] items-center justify-center px-2 py-1">
                      {isGap ? (
                        <span className="font-mono text-[9px] font-[700] uppercase tracking-wide text-[var(--learn-error)]">
                          GAP
                        </span>
                      ) : (
                        <>
                          <span
                            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-[var(--r-full)] bg-[var(--learn-known)]"
                            aria-hidden
                          />
                          <span className="font-mono text-[13px] font-[700] tabular-nums text-[var(--t1)]">
                            {n}
                          </span>
                        </>
                      )}
                    </span>
                  )
                  return (
                    <td key={c} className="p-0" style={cellStyle}>
                      {onCellClick ? (
                        <button
                          type="button"
                          onClick={() => onCellClick({ register: r.key, cefr: c })}
                          aria-label={`${r.label} · ${c}${isGap ? ' — 빈 칸(소스 GET 으로 채우기)' : ` 발행 ${n}건`}`}
                          className="block w-full transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--p)]"
                        >
                          {inner}
                        </button>
                      ) : (
                        inner
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
