// apps/web/src/app/admin/articles/CoverageMatrix.tsx
// ACP §18 P1 — register × CEFR 커버리지 매트릭스 (① 뷰).
//
// 큐레이션을 "소스 더 넣기"가 아니라 "빈 칸 채우기"로 — register × CEFR 균형 관리.
// 빈 칸(gap) = 큐레이션 우선 채움. 셀 클릭 → 소스GET stage 로 register·CEFR 프리필.
//
// P2 에서 고도화 예정: gap 빗금 + GAP 라벨, filled 셀 좌측 stable 바, 우측 SourceFeedList.
// 현재(P1)는 기존 register×CEFR 매트릭스를 독립 컴포넌트로 추출 + 셀 클릭(→소스GET) 추가.

import type { ArticleAdminRow } from '@/lib/articles/types'

const MATRIX_REGISTERS: Array<{ key: string; label: string }> = [
  { key: 'expository', label: '설명' },
  { key: 'argumentative', label: '논증' },
  { key: 'news', label: '시사' },
  { key: 'narrative', label: '내러티브' },
  { key: 'reference', label: '참고' },
]
const MATRIX_CEFRS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

export interface CoverageCell {
  register: string
  cefr: string
}

interface Props {
  articles: ArticleAdminRow[]
  /** 셀 클릭 → 소스GET 프리필 (P3 연동). register·CEFR 전달. */
  onCellClick?: (cell: CoverageCell) => void
}

export function CoverageMatrix({ articles, onCellClick }: Props) {
  const counts = new Map<string, number>()
  let unclassified = 0
  for (const a of articles) {
    if (!a.register || !a.cefr_level) {
      unclassified++
      continue
    }
    const key = `${a.register}|${a.cefr_level}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return (
    <section
      aria-label="레지스터 × CEFR 분포"
      className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
    >
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[13px] font-[700] text-[var(--t1)]">레지스터 × CEFR 분포</h2>
        <span className="font-mono text-[10px] text-[var(--t3)]">
          빈 칸(·) = 큐레이션 우선 채움
          {unclassified > 0 ? ` · 미분류 ${unclassified}` : ''}
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[var(--t3)]">
              <th className="px-2 py-1 text-left font-[600]">register \ CEFR</th>
              {MATRIX_CEFRS.map((c) => (
                <th key={c} className="px-2 py-1 font-mono font-[700]">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX_REGISTERS.map((r) => (
              <tr key={r.key} className="border-t border-[var(--bd)]">
                <td className="px-2 py-1 text-left font-display text-[12px] font-[600] text-[var(--t2)]">
                  {r.label}
                </td>
                {MATRIX_CEFRS.map((c) => {
                  const n = counts.get(`${r.key}|${c}`) ?? 0
                  const isGap = n === 0
                  const cellInner = (
                    <span
                      className="font-mono text-[12px] tabular-nums"
                      style={{ color: isGap ? 'var(--t5)' : 'var(--t1)' }}
                    >
                      {isGap ? '·' : n}
                    </span>
                  )
                  return (
                    <td
                      key={c}
                      className="px-0 py-0"
                      style={{ backgroundColor: isGap ? 'transparent' : 'var(--learn-known-light)' }}
                    >
                      {onCellClick ? (
                        <button
                          type="button"
                          onClick={() => onCellClick({ register: r.key, cefr: c })}
                          aria-label={`${r.label} · ${c}${isGap ? ' (빈 칸 — 소스 GET)' : ` ${n}건`}`}
                          className="flex min-h-[32px] w-full items-center justify-center px-2 py-1 transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--p)]"
                        >
                          {cellInner}
                        </button>
                      ) : (
                        <span className="flex min-h-[32px] items-center justify-center px-2 py-1">
                          {cellInner}
                        </span>
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
