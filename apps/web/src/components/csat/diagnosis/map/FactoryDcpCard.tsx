// apps/web/src/components/csat/diagnosis/map/FactoryDcpCard.tsx
//
// 단계 1D — Workspace 팝업 안 「받은 공장 연습 자료」 카드. 창작 자료 카드(AuthoredSupplyCard)와 별개다(그 경로를 덮지 않는다).
//   GET /api/csat/factory?template=… → 이 Workspace 에 납품된 공장 DCP 지도 연습(주제 · 제목 · 요지) 목록.
//   · 새 학습 링크는 DB 가 지금 유효하다고 판정한(state === 'ok') 납품만. 철회 · 닫힘 · 판본 변경은 이유만 보인다.
//   · 같은 원문에서 나온 문항은 지문 1개로 센다(독립 지문 3개라고 말하지 않는다).
//   · 링크는 지도 복귀 문맥(ctx)을 싣는다 — 다 풀면 같은 Workspace 로 돌아온다.
//   · 연습 기록이지 지도 근거가 아니다 — 문구로 그 경계를 말한다.
//   · 2F — 「공장 연습 자료 요청」 → POST /api/csat/factory/request(본문 template 만). 받음 · 연결 대기 · 승인 대기 · 단계 아님 · 실패를
//     닫힌 응답 파서(readFactoryRequest)로 가르고, 받으면 목록을 다시 읽어 첫 요지 링크를 보인다. 실패는 같은 키로 다시 요청한다.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import p from './popup.module.css'
import u from './unified.module.css'
import { withMapReturn, type MapReturnCtx } from '@/lib/csat/map-return'
import { track } from '@/lib/analytics/client'

type Type = 'topic' | 'title' | 'main_point'
interface Row { deliveryId: string; sourceId: string; type: Type; state: string; attempts: number; lastCorrect: boolean | null }
type Listed = { status: 'loading' } | { status: 'not_installed' } | { status: 'error' } | { status: 'installed'; rows: Row[]; sources: number }

const TYPE: Record<Type, string> = { topic: '주제 고르기', title: '제목 고르기', main_point: '요지 고르기' }
const STATE: Record<string, string> = {
  not_current: '승인 철회 · 지금은 열 수 없음',
  workspace_closed: '닫힌 Workspace',
  stale_revision: '자료가 바뀜 · 예전 판본',
  lineage_not_current: '계획이 바뀌어 지금 계획 밖',
  product_link_mismatch: '제작 주문 연결 확인 안 됨',
  product_not_current: '제작 주문이 바뀜',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
/** 목록 응답의 닫힌 모양 — 한 줄이라도 모르면 전체를 오류로 본다(미상을 0 · 학습 가능으로 바꾸지 않는다) */
export function readFactoryList(j: unknown): { rows: Row[]; sources: number } | null {
  if (!j || typeof j !== 'object') return null
  const { rows, sources } = j as { rows?: unknown; sources?: unknown }
  if (!Array.isArray(rows) || typeof sources !== 'number' || !Number.isInteger(sources) || sources < 0) return null
  const out: Row[] = []
  for (const x of rows) {
    const r = x as Record<string, unknown>
    if (!r || typeof r !== 'object' || typeof r.deliveryId !== 'string' || !UUID.test(r.deliveryId) || typeof r.sourceId !== 'string' || !UUID.test(r.sourceId)
        || !(r.type === 'topic' || r.type === 'title' || r.type === 'main_point') || typeof r.state !== 'string'
        || typeof r.attempts !== 'number' || !Number.isInteger(r.attempts) || r.attempts < 0 || !(r.lastCorrect === null || typeof r.lastCorrect === 'boolean')) return null
    out.push({ deliveryId: r.deliveryId, sourceId: r.sourceId, type: r.type, state: r.state, attempts: r.attempts, lastCorrect: r.lastCorrect })
  }
  if (new Set(out.map((r) => r.sourceId)).size !== sources) return null
  return { rows: out, sources }
}

/** 한 줄 상태 — 링크는 state === 'ok' 일 때만. 모르는 상태는 학습 가능으로 올리지 않는다 */
export function factoryRowState(r: Pick<Row, 'state' | 'attempts' | 'lastCorrect'>): { link: boolean; label: string } {
  if (r.state !== 'ok') return { link: false, label: STATE[r.state] ?? '지금 열 수 있는지 확인하지 못했어요' }
  if (r.attempts === 0) return { link: true, label: '아직 안 풂' }
  return { link: true, label: `연습 ${r.attempts}번 · 최근 ${r.lastCorrect === true ? '맞힘' : r.lastCorrect === false ? '다시 볼 곳 있음' : '결과 확인 안 됨'} · 연습 기록` }
}

type Outcome = 'delivered' | 'waiting_link' | 'waiting_approval' | 'not_in_stage' | 'failed'
type Requested = { status: 'idle' } | { status: 'sending' } | { status: Exclude<Outcome, 'delivered'> } | { status: 'delivered'; first: string } | { status: 'plan_required' } | { status: 'not_installed' }
const REQUEST: Record<string, string> = {
  waiting_link: '요청을 남겼어요. 제작 연결 대기 중이에요 — 연결되면 다시 요청해 받으세요.',
  waiting_approval: '제작 연결은 됐지만 승인된 연습 세트가 아직 없어요. 승인 뒤 다시 요청해 주세요.',
  not_in_stage: '지금 계획 단계에서는 안내 연습이 필요하지 않아요. 바로잡기 단계에서 요청할 수 있어요.',
  plan_required: '학습계획을 먼저 확정해 주세요.',
  not_installed: '자료 공급이 아직 준비되지 않았어요.',
  failed: '요청 결과를 확인하지 못했어요. 같은 요청으로 다시 시도해도 중복되지 않아요.',
}

/** 요청 응답의 닫힌 모양 — 모르는 상태 · 잘못된 200 은 실패로 본다(완료 · 0건으로 바꾸지 않는다) */
export function readFactoryRequest(httpOk: boolean, j: unknown): Exclude<Requested, { status: 'idle' | 'sending' }> {
  const o = (j && typeof j === 'object' ? j : {}) as Record<string, unknown>
  if (!httpOk) return o.code === 'plan_required' ? { status: 'plan_required' } : o.code === 'not_installed' ? { status: 'not_installed' } : { status: 'failed' }
  if (o.status === 'delivered') {
    return typeof o.first === 'string' && UUID.test(o.first) && o.delivered === 3 && typeof o.replayed === 'boolean' ? { status: 'delivered', first: o.first } : { status: 'failed' }
  }
  if ((o.status === 'waiting_link' || o.status === 'waiting_approval' || o.status === 'not_in_stage') && Object.keys(o).length === 1) return { status: o.status }
  return { status: 'failed' }
}

export function FactoryDcpCard({ template, ctx }: { template: string; ctx?: MapReturnCtx }) {
  const [listed, setListed] = useState<Listed>({ status: 'loading' })
  const [requested, setRequested] = useState<Requested>({ status: 'idle' })
  const [reload, setReload] = useState(0)
  const request = async () => {
    setRequested({ status: 'sending' })
    let next: Exclude<Requested, { status: 'idle' | 'sending' }>
    try {
      const r = await fetch('/api/csat/factory/request', { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ template }) })
      next = readFactoryRequest(r.ok, await r.json().catch(() => null))
    } catch { next = { status: 'failed' } }
    setRequested(next)
    const outcome: Outcome = next.status === 'plan_required' || next.status === 'not_installed' ? 'failed' : next.status
    track({ name: 'csat_factory_dcp_requested', props: { outcome } })
    if (next.status === 'delivered') setReload((x) => x + 1)
  }
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const r = await fetch(`/api/csat/factory?template=${encodeURIComponent(template)}`, { cache: 'no-store' })
        const j = await r.json().catch(() => null)
        if (!live) return
        if (!r.ok || !j) return setListed({ status: 'error' })
        if (j.status === 'not_installed') return setListed({ status: 'not_installed' })
        const list = j.status === 'installed' ? readFactoryList(j) : null
        if (list) return setListed({ status: 'installed', ...list })
        setListed({ status: 'error' })
      } catch { if (live) setListed({ status: 'error' }) }
    })()
    return () => { live = false }
  }, [template, reload])

  // 미설치면 자리를 차지하지 않는다. 0건이면 요청 단추만 보인다
  if (listed.status === 'loading' || listed.status === 'not_installed') return null
  const firstHref = requested.status === 'delivered' ? `/csat/factory/${requested.first}` : null
  return (
    <section className={p.card} aria-labelledby="ws-factory-dcp" data-testid="ws-factory-dcp">
      <div className={p.cardHead}>
        <div>
          <h3 id="ws-factory-dcp" className={p.cardTitle}>받은 공장 연습 자료</h3>
          <p className={`${p.cardDesc} break-keep`}>
            {listed.status === 'installed' ? `지문 ${listed.sources}개 · 문항 ${listed.rows.length}개 · ` : ''}
            안내 연습이라 풀이는 연습 기록으로 남아요. 혼자 확인은 처음 보는 글로 따로 해요.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3" data-testid="ws-factory-dcp-request" data-state={requested.status}>
        <button type="button" onClick={() => void request()} disabled={requested.status === 'sending'}
          className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-4 text-sm text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:opacity-60">
          {requested.status === 'sending' ? '요청하는 중…' : requested.status === 'failed' ? '다시 요청' : '공장 연습 자료 요청'}
        </button>
        {firstHref && (
          <Link href={ctx ? withMapReturn(firstHref, ctx) : firstHref} data-testid="ws-factory-dcp-first"
            className="inline-flex min-h-[44px] items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]">
            요지 고르기부터 시작
          </Link>
        )}
        {REQUEST[requested.status] && <p className={`${p.cardDesc} break-keep`} role={requested.status === 'failed' ? 'alert' : 'status'}>{REQUEST[requested.status]}</p>}
      </div>
      {listed.status === 'error' && <p className={p.cardDesc} role="alert">공장 연습 자료를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>}
      {listed.status === 'installed' && listed.rows.length > 0 && (
        <ul className={u.needList} data-testid="ws-factory-dcp-list">
          {listed.rows.map((r) => {
            const s = factoryRowState(r)
            const href = `/csat/factory/${r.deliveryId}`
            return (
              <li key={r.deliveryId} data-state={r.state}>
                {s.link
                  ? <Link href={ctx ? withMapReturn(href, ctx) : href} className="inline-flex min-h-[44px] items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]">{TYPE[r.type] ?? r.type}</Link>
                  : <span data-testid="ws-factory-dcp-closed">{TYPE[r.type] ?? r.type}</span>}
                <span className={`${u.ledgerVal} break-keep`}>{s.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
