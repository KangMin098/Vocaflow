// apps/web/src/components/csat/diagnosis/map/FactoryDcpCard.tsx
//
// 단계 1D — Workspace 팝업 안 「받은 공장 연습 자료」 카드. 창작 자료 카드(AuthoredSupplyCard)와 별개다(그 경로를 덮지 않는다).
//   GET /api/csat/factory?template=… → 이 Workspace 에 납품된 공장 DCP 지도 연습(주제 · 제목 · 요지) 목록.
//   · 새 학습 링크는 DB 가 지금 유효하다고 판정한(state === 'ok') 납품만. 철회 · 닫힘 · 판본 변경은 이유만 보인다.
//   · 같은 원문에서 나온 문항은 지문 1개로 센다(독립 지문 3개라고 말하지 않는다).
//   · 링크는 지도 복귀 문맥(ctx)을 싣는다 — 다 풀면 같은 Workspace 로 돌아온다.
//   · 연습 기록이지 지도 근거가 아니다 — 문구로 그 경계를 말한다.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import p from './popup.module.css'
import u from './unified.module.css'
import { withMapReturn, type MapReturnCtx } from '@/lib/csat/map-return'

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

/** 한 줄 상태 — 링크는 state === 'ok' 일 때만. 모르는 상태는 학습 가능으로 올리지 않는다 */
export function factoryRowState(r: Pick<Row, 'state' | 'attempts' | 'lastCorrect'>): { link: boolean; label: string } {
  if (r.state !== 'ok') return { link: false, label: STATE[r.state] ?? '지금 열 수 있는지 확인하지 못했어요' }
  if (r.attempts === 0) return { link: true, label: '아직 안 풂' }
  return { link: true, label: `연습 ${r.attempts}번 · 최근 ${r.lastCorrect === true ? '맞힘' : r.lastCorrect === false ? '다시 볼 곳 있음' : '결과 확인 안 됨'} · 연습 기록` }
}

export function FactoryDcpCard({ template, ctx }: { template: string; ctx?: MapReturnCtx }) {
  const [listed, setListed] = useState<Listed>({ status: 'loading' })
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const r = await fetch(`/api/csat/factory?template=${encodeURIComponent(template)}`, { cache: 'no-store' })
        const j = await r.json().catch(() => null)
        if (!live) return
        if (!r.ok || !j) return setListed({ status: 'error' })
        if (j.status === 'not_installed') return setListed({ status: 'not_installed' })
        if (j.status === 'installed' && Array.isArray(j.rows)) return setListed({ status: 'installed', rows: j.rows as Row[], sources: Number(j.sources) || 0 })
        setListed({ status: 'error' })
      } catch { if (live) setListed({ status: 'error' }) }
    })()
    return () => { live = false }
  }, [template])

  // 미설치 · 0건이면 자리를 차지하지 않는다(창작 자료 카드가 「받은 자료」 안내를 이미 한다)
  if (listed.status === 'loading' || listed.status === 'not_installed') return null
  if (listed.status === 'installed' && listed.rows.length === 0) return null
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
      {listed.status === 'error' && <p className={p.cardDesc} role="alert">공장 연습 자료를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>}
      {listed.status === 'installed' && (
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
