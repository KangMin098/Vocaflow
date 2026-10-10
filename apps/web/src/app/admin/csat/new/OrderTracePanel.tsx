// apps/web/src/app/admin/csat/new/OrderTracePanel.tsx
'use client'

import { useRef, useState } from 'react'
import type { OrderProductionTrace, OrderTraceEntry } from '@/lib/csat/order-trace'

type Trace = { order_id: string | null; order_revision: number | null; entries: OrderTraceEntry[];
  blocker: string | null; production?: OrderProductionTrace }

const stageNames: Record<OrderTraceEntry['stage'], string> = {
  candidate: '후보', adaptation: '각색', benchmark: '비교 기준', gold_s: 'Gold-S',
  seed: '적재 적격', queued: '대기', ready: '생산 준비', item: '문항',
  explanation: '해설', editorial: '편집 검수', unit: '단원', volume: '권',
  rendered: '조판', published: '게시',
}
const stateNames: Record<OrderTraceEntry['state'], string> = {
  observed: '기록 확인', hold: '보류', stale: '증거 만료', blocked: '차단', unmeasured: '미측정',
}

export function OrderTracePanel() {
  const generation = useRef(0)
  const [orderId, setOrderId] = useState('')
  const [trace, setTrace] = useState<Trace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function load() {
    const id = orderId.trim()
    if (!id) return
    const request = ++generation.current
    setPending(true)
    setTrace(null)
    setError(null)
    try {
      const response = await fetch(`/api/admin/csat/order-trace?order_id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      if (!response.ok) throw Error('order trace unavailable')
      const next = await response.json() as Trace
      if (request === generation.current) setTrace(next)
    } catch { if (request === generation.current) setError('주문 상태를 조회하지 못했습니다. 측정 실패를 0건으로 취급하지 않습니다.') }
    finally { if (request === generation.current) setPending(false) }
  }

  return <section aria-labelledby="order-trace-title" className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
    <h2 id="order-trace-title" className="font-display text-[16px] font-[800] text-[var(--t1)]">주문별 생산 상태</h2>
    <p className="mt-2 break-keep text-[13px] text-[var(--t2)]">등록된 Product Order ID로 현재 읽을 수 있는 증거를 확인합니다. 승격 당시 기록은 현재 인증을 대신하지 않으며, 아직 조회 경로가 없는 공정은 미측정으로 표시합니다.</p>
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void load() }}>
      <label className="min-w-[240px] flex-1 text-[13px] font-[700] text-[var(--t1)]">Product Order ID
        <input value={orderId} onChange={event => { generation.current += 1; setOrderId(event.target.value); setTrace(null); setError(null); setPending(false) }} maxLength={128}
          className="mt-1 block min-h-[44px] w-full rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-mono text-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]" />
      </label>
      <button type="submit" disabled={pending || !orderId.trim()}
        className="min-h-[44px] rounded-[var(--r-sm)] border border-[var(--p)] px-4 text-[13px] font-[700] text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] disabled:opacity-50">
        {pending ? '조회 중' : '현재 상태 확인'}
      </button>
    </form>
    {error ? <p role="alert" className="mt-3 break-keep text-[13px] text-[var(--memory-risk)]">{error}</p> : null}
    {trace ? <div className="mt-4">
      <p role="status" className="break-keep text-[13px] text-[var(--t1)]">{trace.order_id
        ? `주문 ${trace.order_id} · revision ${trace.order_revision} · 현재 차단/보류: ${trace.blocker ?? '없음'}`
        : trace.blocker}</p>
      {trace.production?.group_id ? <p className="mt-2 break-keep text-[12px] text-[var(--t2)]">
        생산 그룹 {trace.production.group_id} · revision {trace.production.group_revision} · {trace.production.status}
      </p> : null}
      {trace.production?.status === 'published_current' && trace.production.snapshot_id ?
        <a href={`/api/admin/csat/production/${encodeURIComponent(trace.production.snapshot_id)}`}
          className="mt-2 inline-block min-h-[44px] rounded-[var(--r-sm)] border border-[var(--bd)] px-3 py-3 text-[12px] font-[700] text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">
          현재 증거로 확인된 조판물 받기
        </a> : null}
      <ol className="mt-3 grid gap-2 lg:grid-cols-2">{trace.entries.map(entry =>
        <li key={entry.stage} className="rounded-[var(--r-sm)] border border-[var(--bd)] p-3 text-[12px]">
          <div className="flex items-center justify-between gap-2"><strong className="text-[var(--t1)]">{stageNames[entry.stage]}</strong>
            <span className={entry.state === 'blocked' || entry.state === 'stale' ? 'text-[var(--memory-risk)]' : 'text-[var(--t2)]'}>{stateNames[entry.state]}</span></div>
          <p className="mt-1 break-keep text-[var(--t2)]">{entry.reason}</p>
        </li>)}</ol>
    </div> : null}
  </section>
}
