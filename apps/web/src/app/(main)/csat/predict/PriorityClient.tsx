'use client'

// apps/web/src/app/(main)/csat/predict/PriorityClient.tsx
//
// **주인공: 등급 슬라이더.** 학습자가 「어디까지 볼 것인가」를 직접 좁힌다.
//
// 브리프의 「카드 스택 넘기기」를 쓰지 않은 이유: 스택은 한 번에 하나만 보여 줘서
// **비교가 안 된다.** 사정권의 쓸모는 "A 가 B 보다 얼마나 많은가" 를 나란히 보는 것이라
// 목록 + 범위 좁히기가 맞다. 넘기기는 모션 예산도 먹는다(vocaflow-design §5).

import { useMemo, useState } from 'react'

import type { Band, PriorityRow } from '@/lib/csat/priority'

interface BandInfo {
  band: Band
  label: string
  says: string
}

const ORDER: Band[] = ['A', 'B', 'C', 'gone']

export function PriorityClient({
  rows,
  bands,
  hardMark,
  hardFg,
  formatFg,
}: {
  rows: PriorityRow[]
  bands: BandInfo[]
  hardMark: string
  hardFg: string
  formatFg: string
}) {
  /** 어디까지 볼 것인가 — 기본은 A·B 까지. 전부 보여 주면 좁히는 의미가 없다. */
  const [depth, setDepth] = useState(1)
  const upTo = ORDER[depth]
  const shown = useMemo(
    () => rows.filter((r) => ORDER.indexOf(r.band) <= depth),
    [rows, depth],
  )
  const maxRecent = useMemo(() => rows.reduce((m, r) => Math.max(m, r.recent), 0), [rows])

  return (
    <div className="flex flex-col gap-4">
      {/* 조작면 — 200ms 안에 목록이 바뀐다(I3). 네트워크 없음. */}
      <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3">
        <label
          htmlFor="csat-depth"
          className="flex flex-wrap items-baseline gap-2 text-[13px] text-[var(--t1)]"
        >
          어디까지 볼까요
          <span className="font-[700]" style={{ color: formatFg }}>
            {bands.find((b) => b.band === upTo)?.label}
          </span>
          <span className="tabular-nums text-xs text-[var(--t3)]">
            까지 · {shown.length}/{rows.length}유형
          </span>
        </label>
        <input
          id="csat-depth"
          type="range"
          min={0}
          max={ORDER.length - 1}
          step={1}
          value={depth}
          onChange={(e) => setDepth(Number(e.target.value))}
          className="mt-2 h-11 w-full accent-[var(--p)]"
          aria-valuetext={bands.find((b) => b.band === upTo)?.label}
        />
        <p className="break-keep text-xs leading-snug text-[var(--t3)]">
          {bands.find((b) => b.band === upTo)?.says}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {shown.map((r) => {
          const w = maxRecent > 0 ? Math.round((r.recent / maxRecent) * 100) : 0
          return (
            <li
              key={r.typeId}
              className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <a
                  href={`/csat/${r.typeId}`}
                  className="font-editorial text-[15px] font-[600] text-[var(--t1)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
                >
                  {r.name}
                </a>
                <span className="flex items-center gap-2 text-xs text-[var(--t3)]">
                  {/* 등급은 글자로도 적는다 — 색·위치만으로 가르지 않는다. */}
                  <span
                    className="rounded-[var(--r-full)] border border-[var(--bd)] px-2 py-0.5 text-[11px] text-[var(--t2)]"
                  >
                    {bands.find((b) => b.band === r.band)?.label}
                  </span>
                  {r.hard > 0 ? (
                    <span className="tabular-nums" title={`3점 ${r.hard}문항`}>
                      <span aria-hidden style={{ color: hardFg }}>
                        {hardMark}
                      </span>{' '}
                      {r.hard}
                    </span>
                  ) : null}
                </span>
              </div>

              {/* 막대 = 최근 문항 수. 값은 늘 분모와 함께 글자로도 적는다(E5). */}
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-[var(--r-full)] bg-[var(--bg2)]">
                  <div
                    className="h-full rounded-[var(--r-full)] bg-[var(--p)]"
                    style={{ width: `${w}%` }}
                    aria-hidden
                  />
                </div>
                <span className="shrink-0 tabular-nums text-xs text-[var(--t2)]">
                  최근 {r.recent} / 전체 {r.total}
                </span>
              </div>

              <p className="mt-1 break-keep text-xs leading-snug text-[var(--t3)]">{r.why}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
