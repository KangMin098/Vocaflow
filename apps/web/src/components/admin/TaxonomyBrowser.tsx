// apps/web/src/components/admin/TaxonomyBrowser.tsx
//
// 유형·시리즈 브라우저 (Admin) — **969호를 사람이 읽을 수 있는 형태로.**
//
// 왜 필요한가: 단계 카운트(대기 954 · 검수 15 …)는 **진행**을 말하지만 카탈로그가 무엇인지는
// 말하지 않는다. 운영자가 실제로 하는 판단은 "다음에 어느 묶음을 완성할까" 이고, 그러려면
// 유형별로 몇 시리즈·몇 호가 있고 어디까지 갔는지를 한 화면에서 봐야 한다.
// 학습자 서가가 유형별로 묶여 나가므로(/comics/restored), **유형 하나를 끝내야 묶음이 도착한다** —
// 여러 유형을 조금씩 올리면 어느 칸도 채워지지 않는다.
//
// 진행 막대는 발행 비율이다. 색만으로 구분하지 않고 숫자를 함께 둔다(색맹 대응).

'use client'

import { useMemo, useState } from 'react'

import type { PdComicAdminRow } from '@/lib/pd-comic/model'

const ACCENT = '#8B5CF6'

/** 학습자에게 도달한 상태 = published. 그 앞은 전부 "아직" 이다. */
const DONE = 'published'

interface SeriesAgg {
  key: string
  total: number
  published: number
  panels: number
  years: number[]
  statuses: Map<string, number>
}
interface KindAgg {
  kind: string
  total: number
  published: number
  panels: number
  series: SeriesAgg[]
}

export function TaxonomyBrowser({ rows }: { rows: PdComicAdminRow[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const [onlyUnfinished, setOnlyUnfinished] = useState(false)

  const kinds = useMemo(() => {
    const byKind = new Map<string, KindAgg>()
    const bySeries = new Map<string, SeriesAgg>()

    for (const r of rows) {
      const k = r.kind ?? 'other'
      const sk = r.seriesKey ?? '(미분류)'
      let ka = byKind.get(k)
      if (!ka) { ka = { kind: k, total: 0, published: 0, panels: 0, series: [] }; byKind.set(k, ka) }
      let sa = bySeries.get(`${k}::${sk}`)
      if (!sa) {
        sa = { key: sk, total: 0, published: 0, panels: 0, years: [], statuses: new Map() }
        bySeries.set(`${k}::${sk}`, sa)
        ka.series.push(sa)
      }
      const done = r.status === DONE ? 1 : 0
      ka.total += 1; ka.published += done; ka.panels += r.panelsTotal
      sa.total += 1; sa.published += done; sa.panels += r.panelsTotal
      if (r.publishedYear) sa.years.push(r.publishedYear)
      sa.statuses.set(r.status, (sa.statuses.get(r.status) ?? 0) + 1)
    }
    const out = [...byKind.values()]
    out.forEach((k) => k.series.sort((a, b) => b.total - a.total))
    return out.sort((a, b) => b.total - a.total)
  }, [rows])

  const shown = onlyUnfinished ? kinds.filter((k) => k.published < k.total) : kinds
  const totals = kinds.reduce(
    (a, k) => ({ total: a.total + k.total, published: a.published + k.published, series: a.series + k.series.length }),
    { total: 0, published: 0, series: 0 },
  )

  if (!kinds.length) return null

  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)]">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--bd)] px-4 py-3">
        <h3 className="font-display text-[13px] font-[800] text-[var(--t1)]">유형 · 시리즈</h3>
        <span className="font-mono text-[11.5px] tabular-nums text-[var(--t2)]">
          {kinds.length}유형 · {totals.series}시리즈 · {totals.total}호
        </span>
        <span className="font-mono text-[11.5px] tabular-nums" style={{ color: ACCENT }}>
          발행 {totals.published}/{totals.total}
        </span>
        <label className="ml-auto flex items-center gap-2 font-body text-[12px] text-[var(--t2)]">
          <input
            type="checkbox"
            checked={onlyUnfinished}
            onChange={(e) => setOnlyUnfinished(e.target.checked)}
          />
          미완성 유형만
        </label>
      </header>

      <ul className="divide-y divide-[var(--bd)]">
        {shown.map((k) => {
          const expanded = open === k.kind
          const pct = k.total ? Math.round((k.published / k.total) * 100) : 0
          return (
            <li key={k.kind}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : k.kind)}
                aria-expanded={expanded}
                className="flex min-h-[48px] w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-left transition-colors hover:bg-[var(--bg2)]"
              >
                <span className="w-36 shrink-0 font-display text-[13px] font-[700] text-[var(--t1)]">
                  {k.kind}
                </span>
                <span className="font-mono text-[11.5px] tabular-nums text-[var(--t2)]">
                  {k.series.length}시리즈 · {k.total}호 · {k.panels.toLocaleString()}컷
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
                    발행 {k.published}/{k.total}
                  </span>
                  <span className="h-1.5 w-28 overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]">
                    <span
                      className="block h-full rounded-[var(--r-full)] transition-[width] duration-[var(--dur-normal)]"
                      style={{ width: `${pct}%`, background: ACCENT }}
                    />
                  </span>
                  <span className="w-9 text-right font-mono text-[11px] tabular-nums text-[var(--t3)]">{pct}%</span>
                </span>
              </button>

              {expanded && (
                <table className="w-full border-t border-[var(--bd)] text-left">
                  <thead>
                    <tr className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">
                      {['시리즈', '연도', '호', '컷', '단계', '발행'].map((h) => (
                        <th key={h} className="px-4 py-2 font-[700]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-body text-[12px] text-[var(--t2)]">
                    {k.series.map((s) => {
                      const y0 = s.years.length ? Math.min(...s.years) : null
                      const y1 = s.years.length ? Math.max(...s.years) : null
                      return (
                        <tr key={s.key} className="border-t border-[var(--bd)]">
                          <td className="px-4 py-2 font-mono text-[11.5px] text-[var(--t1)]">{s.key}</td>
                          <td className="px-4 py-2 font-mono text-[11px] tabular-nums">
                            {y0 ? (y1 && y1 !== y0 ? `${y0}–${y1}` : y0) : '—'}
                          </td>
                          <td className="px-4 py-2 font-mono tabular-nums">{s.total}</td>
                          <td className="px-4 py-2 font-mono tabular-nums">{s.panels.toLocaleString()}</td>
                          {/* 단계 분포 — 어디서 멈춰 있는지가 다음 할 일을 정한다 */}
                          <td className="px-4 py-2">
                            <span className="flex flex-wrap gap-1">
                              {[...s.statuses.entries()].map(([st, n]) => (
                                <span
                                  key={st}
                                  className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-1 font-mono text-[9.5px] text-[var(--t3)]"
                                >
                                  {st} {n}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-mono tabular-nums">
                            <span style={{ color: s.published ? ACCENT : 'var(--t3)' }}>
                              {s.published}/{s.total}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
