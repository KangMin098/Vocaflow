'use client'

// apps/web/src/components/csat/Heatmap.tsx
//
// **① 지형 — 이 화면의 주인공.**
//
// ── 무엇을 보여 주나 ─────────────────────────────────────────────────
// 가로 연도, 세로 유형, 칸에 문항 수. 유형 카드 26장이 못 하던 일 하나를 한다 —
// **시간축**. 2018년에 사라진 유형과 작년에 는 유형이 한눈에 갈린다.
//
// ⚠️ **색 + 숫자 + 기호 셋으로 말한다.** 농도만 쓰면 색약 사용자가 못 읽고, 무엇보다
//   "3 과 4 중 어느 쪽이 진한가" 는 눈으로 판정할 수 없다. 칸 안에 수를 적는다.
//
// ⚠️ **키보드로 조작된다**(브리프 G4). 칸이 `<button>` 이고 화살표로 움직인다 —
//   격자에서 Tab 만 쓰면 26×N 번 눌러야 반대쪽 끝에 닿는다.
//
// ⚠️ **모션 없음.** 선택 표시는 테두리·굵기로 한다. 학습 표면의 화이트리스트 7종에
//   「격자 강조」는 없다(vocaflow-design §5.2).

import { useCallback, useRef, useState } from 'react'

import { AXIS, densityBg, densityFg, densityStep } from '@/lib/csat/axes'
import type { Heatmap as HeatmapData } from '@/lib/csat/heatmap'

export interface HeatmapProps {
  data: HeatmapData
  /** 칸을 고르면 부모가 문항 목록을 연다. */
  onPick?: (typeId: string, year: number) => void
}

interface Focus {
  row: number
  col: number
}

export function Heatmap({ data, onPick }: HeatmapProps) {
  const { years, rows, max } = data
  const [sel, setSel] = useState<Focus | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  /** 화살표 이동 — 격자를 격자처럼 다룬다. */
  const onKey = useCallback(
    (e: React.KeyboardEvent, row: number, col: number) => {
      const d: Record<string, [number, number]> = {
        ArrowRight: [0, 1],
        ArrowLeft: [0, -1],
        ArrowDown: [1, 0],
        ArrowUp: [-1, 0],
      }
      const step = d[e.key]
      if (!step) return
      e.preventDefault()
      const r = Math.min(rows.length - 1, Math.max(0, row + step[0]))
      const c = Math.min(years.length - 1, Math.max(0, col + step[1]))
      gridRef.current
        ?.querySelector<HTMLButtonElement>(`[data-cell="${r}-${c}"]`)
        ?.focus()
    },
    [rows.length, years.length],
  )

  if (!rows.length) return null

  const picked = sel ? rows[sel.row]?.cells[sel.col] : null
  const pickedRow = sel ? rows[sel.row] : null

  return (
    <div className="flex flex-col gap-3">
      {/* 범례 — 두 축이 다른 색·다른 자리라는 것을 말로도 적는다. */}
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--t3)]">
        <li className="flex items-center gap-1">
          <span aria-hidden style={{ color: AXIS.format.fg }}>
            {AXIS.format.mark}
          </span>
          세로 = {AXIS.format.label}
        </li>
        <li className="flex items-center gap-1">
          <span aria-hidden>│</span>가로 = 연도
        </li>
        <li className="flex items-center gap-1">
          <span aria-hidden style={{ color: AXIS.hard.fg }}>
            {AXIS.hard.mark}
          </span>
          {AXIS.hard.label} 포함
        </li>
        <li>칸 안 숫자 = 그 해 문항 수</li>
      </ul>

      {/* ⚠️ 가로 스크롤은 **격자 안에서만**. 페이지 본문은 375px 에서 안 밀린다(G7). */}
      <div className="overflow-x-auto">
        <div ref={gridRef} className="min-w-max">
          {/* 머리 행 */}
          <div className="flex items-end gap-px pl-[112px]">
            {years.map((y) => (
              <div
                key={y}
                className="w-8 shrink-0 text-center text-[10px] tabular-nums text-[var(--t3)]"
              >
                {String(y).slice(2)}
              </div>
            ))}
            <div className="w-12 shrink-0 pl-2 text-right text-[10px] text-[var(--t3)]">합</div>
          </div>

          {rows.map((r, ri) => (
            <div key={r.typeId} className="flex items-center gap-px">
              <div
                className="w-[112px] shrink-0 truncate pr-2 text-right text-[11px]"
                style={{ color: AXIS.format.fg }}
                title={r.name}
              >
                <span aria-hidden className="mr-1 text-[9px]">
                  {AXIS.format.mark}
                </span>
                {r.name}
              </div>
              {r.cells.map((c, ci) => {
                const step = densityStep(c.n, max)
                const on = sel?.row === ri && sel?.col === ci
                return (
                  <button
                    key={c.year}
                    type="button"
                    data-cell={`${ri}-${ci}`}
                    onClick={() => {
                      setSel({ row: ri, col: ci })
                      if (c.n > 0) onPick?.(r.typeId, c.year)
                    }}
                    onKeyDown={(e) => onKey(e, ri, ci)}
                    aria-label={`${r.name} ${c.year}년 ${c.n}문항${c.hard ? `, 3점 ${c.hard}문항` : ''}`}
                    className={[
                      'relative h-8 w-8 shrink-0 text-[11px] tabular-nums',
                      'border transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] motion-reduce:transition-none',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--p)]',
                      on ? 'border-[var(--t1)] font-[800]' : 'border-[var(--bd)] hover:border-[var(--p)]',
                    ].join(' ')}
                    style={{ background: densityBg(step), color: c.n ? densityFg(step) : 'var(--t3)' }}
                  >
                    {c.n || ''}
                    {/* 3점 포함 — 색이 아니라 **모서리 표시**로. */}
                    {c.hard > 0 ? (
                      <span
                        aria-hidden
                        className="absolute right-0 top-0 text-[7px] leading-none"
                        style={{ color: AXIS.hard.fg }}
                      >
                        {AXIS.hard.mark}
                      </span>
                    ) : null}
                  </button>
                )
              })}
              <div className="w-12 shrink-0 pl-2 text-right text-[11px] tabular-nums text-[var(--t2)]">
                {r.total}
                {r.recent === 0 ? (
                  <span
                    className="ml-0.5 text-[9px] text-[var(--t3)]"
                    title="최근 4개년 출제 없음"
                    aria-label="최근 4개년 출제 없음"
                  >
                    ·
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 고른 칸 — 격자 아래 한 줄. 모달을 띄우지 않는다(학습 중 모달 금지). */}
      <div
        aria-live="polite"
        className="min-h-[44px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-[12px] text-[var(--t2)]"
      >
        {picked && pickedRow ? (
          picked.n > 0 ? (
            <>
              <strong className="font-[700] text-[var(--t1)]">{pickedRow.name}</strong> ·{' '}
              {picked.year}년 <strong className="tabular-nums">{picked.n}문항</strong>
              {picked.hard > 0 ? ` (3점 ${picked.hard})` : ''} · 그 유형 전체{' '}
              <span className="tabular-nums">{pickedRow.total}</span>문항 중
            </>
          ) : (
            <>
              <strong className="font-[700] text-[var(--t1)]">{pickedRow.name}</strong> ·{' '}
              {picked.year}년에는 <strong>출제되지 않았어요.</strong>
            </>
          )
        ) : (
          '칸을 고르면 여기에 자세히 나와요. 화살표 키로도 움직일 수 있어요.'
        )}
      </div>
    </div>
  )
}
