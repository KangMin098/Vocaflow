// apps/web/src/components/csat/diagnosis/ResultParts.tsx
//
// 시험 한 회의 결과 조각 — 영역 막대(듣기 · 독해 · 장문)와 45칸 결과판(틀린 칸만 영역 색).
// 새 기록 팝업의 저장 결과와 기록 상세 팝업의 [요약] 탭이 같은 조각을 쓴다.

import s from './board.module.css'
import { areaTint } from './tints'

const AREAS = [
  { label: '듣기', from: 1, to: 17 },
  { label: '독해', from: 18, to: 40 },
  { label: '장문', from: 41, to: 45 },
] as const

export function areaStats(wrong: number[]) {
  return AREAS.map((a) => {
    const total = a.to - a.from + 1
    const miss = wrong.filter((n) => n >= a.from && n <= a.to).length
    return { ...a, total, miss, rate: (total - miss) / total }
  })
}

export function AreaBars({ wrong }: { wrong: number[] }) {
  return (
    <div className={s.areaBars}>
      {areaStats(wrong).map((a) => (
        <div key={a.label} className={s.areaBar} style={{ '--tint': areaTint(a.from) } as React.CSSProperties}>
          <span className={s.areaChip} style={{ width: 'fit-content' }}>{a.label} {a.from}–{a.to}</span>
          <span className={s.areaTrack}><span className={s.areaFill} style={{ width: `${Math.round(a.rate * 100)}%` }} /></span>
          <span className={s.num} style={{ textAlign: 'right' }}>{Math.round(a.rate * 100)}%</span>
        </div>
      ))}
    </div>
  )
}

export function ResultGridSection({ wrong }: { wrong: number[] }) {
  const set = new Set(wrong)
  return (
    <section className={s.section}>
      <div className={s.sectionRow}>
        <div>
          <div className={s.sectionTitle}>문항별 결과</div>
          <div className={s.sectionDesc}>색이 칠해진 칸이 틀린 문항이에요.</div>
        </div>
        <span className={s.areaChips}>
          {areaStats(wrong).map((a) => (
            <span key={a.label} className={s.areaChip} style={{ '--tint': areaTint(a.from) } as React.CSSProperties}>{a.label} {a.miss}</span>
          ))}
        </span>
      </div>
      <div className={s.resultGrid} role="list" aria-label="문항별 결과">
        {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => (
          <span
            key={n}
            role="listitem"
            className={s.cellTile}
            data-wrong={set.has(n)}
            style={{ '--tint': areaTint(n) } as React.CSSProperties}
            aria-label={`${n}번 ${set.has(n) ? '틀림' : '맞음'}`}
          >
            {n}
          </span>
        ))}
      </div>
    </section>
  )
}
