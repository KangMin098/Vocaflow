// apps/web/src/app/admin/csat/diagnosis/exams/ExamsTable.tsx
'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

import { btnCls, inputCls, pct, tdCls, thCls } from '@/components/admin/csat-diagnosis/ui'
import type { ExamTagging } from '@/lib/csat/diagnosis/admin'

import { saveExamStatsAction, setExamReadyAction } from '../actions'

function Row({ e }: { e: ExamTagging }) {
  const [ratio, setRatio] = useState(e.grade1Ratio === null ? '' : String(e.grade1Ratio))
  const [source, setSource] = useState(e.statsSource ?? '')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const saveStats = () =>
    start(async () => {
      const v = ratio.trim() === '' ? null : Number(ratio)
      const r = await saveExamStatsAction(e.id, v, source)
      setMsg(r.ok ? '저장했어요' : r.error ?? '실패')
    })
  const toggle = () =>
    start(async () => {
      const r = await setExamReadyAction(e.id, !e.ready)
      setMsg(r.ok ? (e.ready ? '진단 반영을 껐어요' : '진단 반영을 켰어요') : r.error ?? '실패')
    })

  return (
    <tr>
      <td className={tdCls}>
        <Link className="inline-flex min-h-[44px] items-center underline" href={`/admin/csat/diagnosis/exams/${encodeURIComponent(e.id)}`}>{e.label}</Link>
        <div className="text-[12px] text-[var(--t2)]">{e.id} · {e.hasKey ? '정답표 있음' : '정답표 없음 — 채점 불가'}</div>
      </td>
      <td className={tdCls} data-testid={`dx-readiness-${e.id}`}>
        <div>검수 {e.readiness.reviewed}/{e.readiness.required} ({pct(e.readiness.reviewed, e.readiness.required)})</div>
        <div className="text-[12px] text-[var(--t2)]">남음 {e.readiness.remaining} · 구조 문제 {e.readiness.structural.length}</div>
      </td>
      <td className={tdCls}>{e.errorRates}/{e.items}</td>
      <td className={tdCls}>
        <div className="flex flex-wrap items-center gap-1">
          <label className="sr-only" htmlFor={`r-${e.id}`}>1등급 비율</label>
          <input id={`r-${e.id}`} className={`min-h-[44px] ${inputCls} w-[90px]`} inputMode="decimal" placeholder="0.0612" value={ratio} onChange={(x) => setRatio(x.target.value)} />
          <label className="sr-only" htmlFor={`s-${e.id}`}>출처</label>
          <input id={`s-${e.id}`} className={`min-h-[44px] ${inputCls} w-[140px]`} placeholder="출처(채점결과 발표)" value={source} onChange={(x) => setSource(x.target.value)} />
          <button type="button" className={`min-h-[44px] ${btnCls}`} disabled={pending} onClick={saveStats}>저장</button>
        </div>
      </td>
      <td className={tdCls}>
        {/* 켜기는 판정이 통과할 때만 · 끄기는 언제나 */}
        <button type="button" className={`min-h-[44px] ${btnCls}`} disabled={pending || (!e.ready && !e.readiness.canEnable)} onClick={toggle} aria-pressed={e.ready}>
          {e.ready ? '켜짐 · 끄기' : '꺼짐 · 켜기'}
        </button>
        <div className="mt-1 break-keep text-[12px] text-[var(--t2)]">{e.ready ? '진단 반영 중' : e.readiness.reason}</div>
        {msg && <div role="status" className="mt-1 break-keep text-[12px] text-[var(--t2)]">{msg}</div>}
      </td>
    </tr>
  )
}

export function ExamsTable({ exams }: { exams: ExamTagging[] }) {
  const [onlyScorable, setOnlyScorable] = useState(true)
  const rows = onlyScorable ? exams.filter((e) => e.hasKey) : exams
  return (
    <div className="flex flex-col gap-2">
      <label className="flex min-h-[44px] items-center gap-2 font-body text-[13px] text-[var(--t1)]">
        <input type="checkbox" className="h-5 w-5" checked={onlyScorable} onChange={(x) => setOnlyScorable(x.target.checked)} />
        채점 가능한 시험만 보기
      </label>
      <table className="w-full border-collapse">
        <thead>
          <tr><th className={thCls}>시험</th><th className={thCls}>검수</th><th className={thCls}>공식 오답률</th><th className={thCls}>공식 1등급 비율 · 출처</th><th className={thCls}>진단 반영</th></tr>
        </thead>
        <tbody>{rows.map((e) => <Row key={e.id} e={e} />)}</tbody>
      </table>
    </div>
  )
}
