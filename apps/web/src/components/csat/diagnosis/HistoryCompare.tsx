// apps/web/src/components/csat/diagnosis/HistoryCompare.tsx
//
// 진단 이력 목록 + 두 개를 골라 비교(등급 · 능력 · 역량별 증감). 코드는 드러내지 않는다.

'use client'

import { useState } from 'react'

import { track } from '@/lib/analytics/client'
import { ATTRIBUTE_CODES } from '@/lib/csat/diagnosis/engine/types'
import { ATTRIBUTE_NAME, CONFIDENCE_LABEL } from '@/lib/csat/diagnosis/labels'
import type { SnapshotView } from '@/lib/csat/diagnosis/snapshot'

const th = 'border-b border-[var(--bd)] px-2 py-2 text-left font-display text-[13px] font-[700] text-[var(--t2)]'
const td = 'border-b border-[var(--bd)] px-2 py-2 font-body text-[14px] text-[var(--t1)]'
const when = (iso: string) => iso.slice(0, 16).replace('T', ' ')
const TRIGGER: Record<string, string> = { session: '기록 입력', profile: '프로필 변경', admin: '관리자', settings: '기준 변경' }

export function HistoryCompare({ snapshots }: { snapshots: SnapshotView[] }) {
  const [picked, setPicked] = useState<string[]>(snapshots.slice(0, 2).map((s) => s.id))
  const toggle = (id: string) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id].slice(-2)
    setPicked(next)
    if (next.length === 2) track({ name: 'csat_dx_history_compared', props: { snapshots: snapshots.length } })
  }
  const [a, b] = picked.map((id) => snapshots.find((s) => s.id === id)).filter((s): s is SnapshotView => Boolean(s))
    .sort((x, y) => x.computedAt.localeCompare(y.computedAt))

  return (
    <div className="flex flex-col gap-5">
      <table className="w-full border-collapse">
        <caption className="sr-only">진단 이력 — 비교할 두 개를 고르세요</caption>
        <thead><tr><th className={th}>비교</th><th className={th}>계산 시각</th><th className={th}>계기</th><th className={th}>예상 등급</th><th className={th}>신뢰도</th></tr></thead>
        <tbody>
          {snapshots.map((s) => (
            <tr key={s.id}>
              <td className={td}>
                <label className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center">
                  <span className="sr-only">{when(s.computedAt)} 진단 비교에 넣기</span>
                  <input type="checkbox" className="h-5 w-5" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} />
                </label>
              </td>
              <td className={td}>{when(s.computedAt)}</td>
              <td className={td}>{TRIGGER[s.trigger] ?? s.trigger}</td>
              <td className={td}>{s.gradeEst ? `${s.gradeEst}등급` : '—'}</td>
              <td className={td}>{CONFIDENCE_LABEL[s.confidence]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {a && b ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-[16px] font-[800] text-[var(--t1)]">{when(a.computedAt)} → {when(b.computedAt)}</h2>
          <table className="w-full border-collapse">
            <thead><tr><th className={th}>항목</th><th className={th}>이전</th><th className={th}>이후</th><th className={th}>변화</th></tr></thead>
            <tbody>
              <tr><td className={td}>예상 등급</td><td className={td}>{a.gradeEst ?? '—'}</td><td className={td}>{b.gradeEst ?? '—'}</td><td className={td}>{a.gradeEst && b.gradeEst ? (b.gradeEst < a.gradeEst ? '▲ 올랐어요' : b.gradeEst > a.gradeEst ? '▼ 내려갔어요' : '같아요') : '—'}</td></tr>
              {ATTRIBUTE_CODES.map((c) => {
                const x = a.attributeMastery?.[c]?.value
                const y = b.attributeMastery?.[c]?.value
                const d = x != null && y != null ? Math.round((y - x) * 100) : null
                return (
                  <tr key={c}>
                    <td className={td}>{ATTRIBUTE_NAME[c].learner}</td>
                    <td className={td}>{x == null ? '데이터 부족' : Math.round(x * 100)}</td>
                    <td className={td}>{y == null ? '데이터 부족' : Math.round(y * 100)}</td>
                    <td className={td}>{d === null ? '—' : d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : '같아요'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      ) : (
        <p className="font-body text-[13px] text-[var(--t2)]">비교할 진단 두 개를 골라 주세요.</p>
      )}
    </div>
  )
}
