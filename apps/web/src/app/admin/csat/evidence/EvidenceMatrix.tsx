// apps/web/src/app/admin/csat/evidence/EvidenceMatrix.tsx
'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  axisDef,
  pivot,
  type AxisContext,
  type AxisId,
  type EvidenceItem,
  type Measure,
} from '@/lib/csat/evidence-fold'
const ACCENT = 'var(--admin)'
const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)]'
const LINKNUM = `min-h-[44px] min-w-[44px] inline-flex items-center justify-end rounded tabular-nums hover:text-[var(--admin)] active:opacity-70 disabled:opacity-40 transition-opacity duration-[var(--dur-normal)] ${FOCUS}`
const nf = new Intl.NumberFormat('ko-KR')
function fmt(value: number, measure: Measure) {
  return measure === 'time' ? `${Math.floor(value / 60)}분` : nf.format(value)
}
function heat(v: number, max: number): string {
  if (v <= 0 || max <= 0) return 'transparent'
  const t = Math.min(1, v / max)
  return `color-mix(in srgb, ${ACCENT} ${Math.round(8 + t * 30)}%, transparent)`
}

export function EvidenceMatrix({
  items,
  rowAxis,
  colAxis,
  measure,
  ctx,
  onCell,
  onRow,
  onCol,
}: {
  items: EvidenceItem[]
  rowAxis: AxisId
  colAxis: AxisId
  measure: Measure
  ctx: AxisContext
  onCell: (r: string, c: string) => void
  onRow: (r: string) => void
  onCol: (c: string) => void
}) {
  const p = useMemo(
    () => pivot(items, rowAxis, colAxis, measure, ctx),
    [items, rowAxis, colAxis, measure, ctx]
  )
  const max = useMemo(() => {
    let m = 0
    for (const line of p.cells.values()) for (const c of line.values()) if (c.value > m) m = c.value
    return m
  }, [p])

  // **로빙 탭 인덱스** — 칸이 최대 30×27 = 810개다. 전부 탭 정지점으로 두면 키보드 사용자가
  // 표 하나를 지나가는 데 810번 탭을 눌러야 한다. 표 전체가 한 정지점이고 안에서는 방향키로 돈다.
  const [cur, setCur] = useState<[number, number]>([0, 0])
  const gridRef = useRef<HTMLTableSectionElement | null>(null)

  const move = useCallback(
    (dr: number, dc: number) => {
      setCur(([r, c]) => {
        const nr = Math.max(0, Math.min(p.rows.length - 1, r + dr))
        const nc = Math.max(0, Math.min(p.cols.length - 1, c + dc))
        return [nr, nc]
      })
    },
    [p.rows.length, p.cols.length]
  )

  useEffect(() => {
    const el = gridRef.current?.querySelector<HTMLElement>('[data-cur="1"]')
    if (el && document.activeElement && gridRef.current?.contains(document.activeElement))
      el.focus()
  }, [cur])

  const onKey = (e: React.KeyboardEvent) => {
    const map: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      // 축이 서른 칸이면 방향키만으로는 끝까지 가는 데 서른 번이 든다.
      Home: [0, -9999],
      End: [0, 9999],
      PageUp: [-9999, 0],
      PageDown: [9999, 0],
    }
    const d = map[e.key]
    if (d) {
      e.preventDefault()
      move(d[0], d[1])
    }
  }

  const rowAxisLabel = axisDef(rowAxis).label
  const colAxisLabel = axisDef(colAxis).label

  return (
    <>
      {/* **키보드 안내를 눈에 보이게 적는다.** 칸이 최대 810개라 표 전체를 한 정지점으로 두고
          안에서 방향키로 도는데(로빙 탭인덱스), 그 규칙은 화면에 쓰여 있지 않으면 아무도
          모른다 — `<caption class="sr-only">` 은 스크린리더에만 들린다. */}
      <p className="mb-1.5 text-xs text-[var(--t3)]">
        {axisDef(rowAxis).label} × {axisDef(colAxis).label} — 표 안에서 <kbd>방향키</kbd>로 칸을
        옮기고 <kbd>Enter</kbd> 로 그 칸만 남긴다 (<kbd>Home</kbd>/<kbd>End</kbd> 는 행의 끝)
      </p>
      {/* **세로도 가둔다.** 함정 축은 계열이 280개라(라벨 513을 접은 것) 가두지 않으면 표 하나가
          페이지를 수백 줄로 늘려 아래 문항 목록이 화면 밖으로 밀린다. 행을 **버리지는 않는다**
          (B3 누락 0) — 머리행·머리열·합계열이 붙박여 있어 스크롤해도 좌표를 잃지 않는다. */}
      <div className="max-h-[62vh] overflow-auto">
        <table className="w-full border-collapse text-[13px]" onKeyDown={onKey}>
          <caption className="sr-only">
            {rowAxisLabel} × {colAxisLabel} 교차표. 방향키로 칸을 옮기고 Enter 로 그 칸의 문항만
            남긴다.
          </caption>
          <thead className="sticky top-0 z-20 bg-[var(--bg)]">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-30 bg-[var(--bg)] px-2 py-1.5 text-left text-xs font-medium text-[var(--t3)]"
              >
                {rowAxisLabel} ＼ {colAxisLabel}
              </th>
              {p.cols.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className="px-1 py-1.5 text-right align-bottom text-xs font-medium text-[var(--t3)]"
                >
                  <button
                    type="button"
                    onClick={() => onCol(c.key)}
                    title={c.label}
                    className={`max-w-[92px] truncate ${LINKNUM} block w-full text-right`}
                  >
                    {c.short ?? c.label}
                  </button>
                </th>
              ))}
              {/* **총합 열은 오른쪽에 붙박는다.** 이 화면의 약속(「어느 조합에서도 총합 = 모집단」)이
                걸린 칸인데, 열이 서른이면 가로 스크롤 밖으로 밀려 **증명이 안 보인다** —
                실측 2026-09-16 의 첫 캡처가 정확히 그랬다. */}
              <th
                scope="col"
                className="sticky right-0 z-10 border-l border-[var(--bd)] bg-[var(--bg)] px-2 py-1.5 text-right text-xs font-medium text-[var(--t2)]"
              >
                합계
              </th>
            </tr>
          </thead>
          <tbody ref={gridRef}>
            {p.rows.map((r, ri) => {
              const line = p.cells.get(r.key)
              const total = p.rowTotal.get(r.key) ?? 0
              return (
                <tr key={r.key} className="border-t border-[var(--bd)]">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-[200px] truncate bg-[var(--bg)] px-2 py-1 text-left font-normal"
                  >
                    <button
                      type="button"
                      onClick={() => onRow(r.key)}
                      title={r.label}
                      className={LINKNUM}
                    >
                      {r.label}
                    </button>
                  </th>
                  {p.cols.map((c, ci) => {
                    const cell = line?.get(c.key)
                    const v = cell?.value ?? 0
                    const isCur = cur[0] === ri && cur[1] === ci
                    return (
                      <td
                        key={c.key}
                        className="p-0 text-right"
                        style={{ background: heat(v, max) }}
                      >
                        <button
                          type="button"
                          data-cur={isCur ? '1' : '0'}
                          tabIndex={isCur ? 0 : -1}
                          onFocus={() => setCur([ri, ci])}
                          onClick={() => {
                            if (v > 0) onCell(r.key, c.key)
                          }}
                          aria-disabled={v === 0}
                          aria-label={`${r.label} × ${c.label} — ${fmt(v, measure)}`}
                          className={`block min-h-[44px] w-full min-w-[44px] px-1.5 py-1 text-right tabular-nums transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] active:bg-[var(--bd)] aria-disabled:cursor-default ${FOCUS} ${
                            v === 0 ? 'text-[var(--t3)]' : 'text-[var(--t1)]'
                          }`}
                        >
                          {v === 0 ? '·' : fmt(v, measure)}
                        </button>
                      </td>
                    )
                  })}
                  <td className="sticky right-0 z-10 border-l border-[var(--bd)] bg-[var(--bg)] px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => onRow(r.key)}
                      className={`${LINKNUM} text-[var(--t2)]`}
                    >
                      {fmt(total, measure)}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="sticky bottom-0 z-20 bg-[var(--bg)]">
            <tr className="border-t-2 border-[var(--bd)]">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-[var(--bg)] px-2 py-1.5 text-left text-xs text-[var(--t2)]"
              >
                합계
              </th>
              {p.cols.map((c) => (
                <td key={c.key} className="px-1.5 py-1.5 text-right tabular-nums text-[var(--t2)]">
                  {fmt(p.colTotal.get(c.key) ?? 0, measure)}
                </td>
              ))}
              <td className="sticky right-0 z-10 border-l border-[var(--bd)] bg-[var(--bg)] px-2 py-1.5 text-right">
                <span
                  className="font-semibold tabular-nums text-[var(--t1)]"
                  title={
                    p.multi
                      ? '한 문항이 여러 칸에 들어가는 축이라 칸 합이 총합보다 크다 — 총합은 서로 다른 문항 수다'
                      : '어느 축 조합에서도 이 수는 모집단과 같아야 한다'
                  }
                >
                  {fmt(p.grand, measure)}
                </span>
                {p.multi && p.cellSum !== p.grand ? (
                  <span className="ml-1 whitespace-nowrap text-[11px] text-[var(--t3)]">
                    칸 합 {fmt(p.cellSum, measure)}
                  </span>
                ) : null}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  )
}
