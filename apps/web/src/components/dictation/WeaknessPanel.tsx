// apps/web/src/components/dictation/WeaknessPanel.tsx
//
// "요즘 자주 놓치는 것" — 성장을 실감하게 만드는 유일한 장치.
//
// 정확도 82% 는 잘하고 있는지 알려주지 않는다. 반면 "2주간 관사를 11번 놓쳤고,
// 그게 지난 2주보다 줄었다"는 다음에 무엇을 들을지 알려준다. 약점은 줄어드는 것이
// 보일 때만 동기가 되므로 **숫자가 아니라 처방**을 앞에 둔다(§철학3 Empathetic Feedback).
//
// 데이터가 없으면 렌더하지 않는다 — 빈 상태를 위한 자리 표시는 화면만 무겁게 한다
// (§철학2 Progressive Disclosure).

'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Target } from 'lucide-react'

import { tagCoach, tagLabel } from '@/lib/dictation/error-tags'
import type { WeaknessRow } from '@/lib/dictation/persist'

export function WeaknessPanel({ rows, days = 14 }: { rows: WeaknessRow[]; days?: number }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  if (rows.length === 0) return null

  const top = rows.slice(0, 3)
  const max = Math.max(...top.map((r) => r.hits), 1)

  return (
    <section className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
      <header className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-[15px] font-[700] text-[var(--t1)]">
          <Target size={14} className="text-[var(--t2)]" strokeWidth={2.2} />
          요즘 자주 놓치는 것
        </h2>
        <span className="font-body text-[11px] text-[var(--t2)]">최근 {days}일</span>
      </header>

      <ul className="flex flex-col gap-2">
        {top.map((r) => {
          const isOpen = expanded === r.tag
          return (
            <li key={r.tag}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : r.tag)}
                aria-expanded={isOpen}
                className="flex w-full flex-col gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2.5 text-left transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] hover:bg-[var(--bg3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
                    {tagLabel(r.tag)}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
                    {r.hits}회
                  </span>
                  <span className="ml-auto text-[var(--t2)]">
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </div>
                {/* 막대는 상대 비교용 — 절대 점수가 아니므로 눈금을 붙이지 않는다 */}
                <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--bg3)]">
                  <div
                    className="h-full rounded-full bg-[var(--t3)] transition-[width] duration-[var(--dur-normal)]"
                    style={{ width: `${Math.round((r.hits / max) * 100)}%` }}
                  />
                </div>
              </button>

              {isOpen && (
                <div className="mt-1.5 flex flex-col gap-2 rounded-[var(--r-md)] bg-[var(--bg2)] px-3 py-2.5">
                  <p className="font-body text-[12px] italic leading-relaxed text-[var(--t2)]">
                    {tagCoach(r.tag)}
                  </p>
                  {r.sampleExpected && (
                    <div className="flex flex-col gap-1 rounded-[var(--r-sm)] bg-[var(--bg)] px-2.5 py-2">
                      <p className="font-english text-[12px] leading-relaxed text-[var(--t1)]">
                        {r.sampleExpected}
                      </p>
                      {r.sampleActual ? (
                        <p className="font-english text-[12px] leading-relaxed text-[var(--t3)] line-through">
                          {r.sampleActual}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
