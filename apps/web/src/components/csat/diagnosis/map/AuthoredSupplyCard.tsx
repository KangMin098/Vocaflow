// apps/web/src/components/csat/diagnosis/map/AuthoredSupplyCard.tsx
//
// Workspace 팝업 안 「받은 자료」 카드 — FINAL §7 · §8. 지도와 Workspace 가 같은 TASK · 같은 PLAN 버전을 쓴다:
//   「자료 받기」 → 서버가 지금 계획으로 수요를 다시 만들어 공급 요청(DB 가 자격 · 승인 · 사람 결정 · 노출 판정) →
//   받은 자료 목록(역할 · 풀었나 · 근거로 셌나) → 자료 열기(/csat/learn/[id]) → 풀고 지도로 돌아와 변화 확인.
// 상태: 준비 중(창작 공급 SQL 미적용) · 계획 확정 전 · 받은 자료 0 · 받을 수 있는 자료 없음(승인 대기) · 오류 — 각각 다른 문구.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PackageOpen } from 'lucide-react'

import p from './popup.module.css'
import u from './unified.module.css'
import { withMapReturn, type MapReturnCtx } from '@/lib/csat/map-return'

type Role = 'model_explanation' | 'guided_practice' | 'independent_check' | 'transfer' | 'delayed_check'
interface Row { ref: string; deliveryId: string; role: Role; deliveredAt: string; attempted: boolean; evidence: boolean | null; current?: boolean | null }
type Listed = { status: 'loading' } | { status: 'not_installed' } | { status: 'error' } | { status: 'installed'; rows: Row[] }
interface LineOut { role: Role; requested: number; delivered: string[]; rejected: { ref: string; reason: string }[]; orderOpened: boolean }

const ROLE: Record<Role, string> = {
  model_explanation: '출제 원리 배우기',
  guided_practice: '안내 연습',
  independent_check: '혼자 확인',
  transfer: '다른 글에 적용',
  delayed_check: '다른 날 다시 확인',
}
const ORDER: Role[] = ['model_explanation', 'guided_practice', 'independent_check', 'transfer', 'delayed_check']

export function AuthoredSupplyCard({ task, template, planSaved, past, ctx }: { task: string; template: string; planSaved: boolean; past: boolean; ctx?: MapReturnCtx }) {
  const [listed, setListed] = useState<Listed>({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/csat/authored?task=${encodeURIComponent(task)}`, { cache: 'no-store' })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j) { setListed({ status: 'error' }); return }
      setListed(j.status === 'not_installed' ? { status: 'not_installed' } : { status: 'installed', rows: j.rows as Row[] })
    } catch { setListed({ status: 'error' }) }
  }, [task])
  useEffect(() => { void load() }, [load])

  async function request() {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/csat/authored/supply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task, template }) })
      const j = await r.json().catch(() => ({}))
      if (r.status === 409) setMsg('학습계획을 먼저 확정하면 자료를 받을 수 있어요.')
      else if (r.status === 503) setMsg('검수 · 승인이 끝난 자료가 아직 없어요.')
      else if (!r.ok) setMsg(typeof j.error === 'string' ? j.error : '자료를 받지 못했어요 — 잠시 뒤 다시 눌러 주세요.')
      else if (j.status === 'no_lines') setMsg('지금 단계에서 새로 받을 자료가 없어요.')
      else {
        const lines = (j.lines ?? []) as LineOut[]
        const got = lines.reduce((n, l) => n + l.delivered.length, 0)
        const short = lines.filter((l) => l.delivered.length < l.requested)
        setMsg(got > 0
          ? `자료 ${got}개가 준비됐어요.${short.length ? ' 일부 단계는 승인된 자료가 모자라 제작을 요청해 두었어요.' : ''}`
          : '승인된 자료가 아직 없어 제작을 요청해 두었어요. 준비되면 여기서 받을 수 있어요.')
      }
      await load()
    } catch { setMsg('연결이 끊겼어요 — 다시 눌러도 같은 자료가 두 번 오지 않아요.') }
    finally { setBusy(false) }
  }

  const rows = listed.status === 'installed' ? [...listed.rows].sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role)) : []
  return (
    <section className={p.card} aria-labelledby="ws-authored" data-testid="ws-authored">
      <div className={p.cardHead}>
        <div>
          <h3 id="ws-authored" className={p.cardTitle}>받은 자료</h3>
          <p className={p.cardDesc}>지금 계획에 맞춰 검수 · 승인된 자료만 받아요. 혼자 확인 · 다른 글 적용 자료는 처음 보는 글이에요.</p>
        </div>
        {listed.status === 'installed' && !past && (
          <button type="button" className={p.whitePill} onClick={request} disabled={busy || !planSaved} data-testid="ws-authored-request"
            title={planSaved ? undefined : '학습계획을 먼저 확정해 주세요'}>
            <PackageOpen size={14} strokeWidth={1.9} aria-hidden="true" />
            {busy ? '받는 중…' : '자료 받기'}
          </button>
        )}
      </div>
      {listed.status === 'loading' && <p className={p.cardDesc}>불러오는 중…</p>}
      {listed.status === 'not_installed' && <p className={p.cardDesc} data-testid="ws-authored-preparing">자료 공급을 준비하고 있어요 — 승인된 자료가 생기면 여기서 받을 수 있어요.</p>}
      {listed.status === 'error' && <p className={p.cardDesc} role="alert">받은 자료를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>}
      {listed.status === 'installed' && rows.length === 0 && <p className={p.cardDesc} data-testid="ws-authored-empty">아직 받은 자료가 없어요.{!planSaved && ' 학습계획을 먼저 확정해 주세요.'}</p>}
      {rows.length > 0 && (
        <ul className={u.needList} data-testid="ws-authored-list">
          {rows.map((r) => (
            <li key={r.deliveryId} data-role={r.role}>
              {/* 지도 복귀 문맥(TASK · Workspace · 목표 · PLAN)을 싣는다 — PLAN CTA 와 같은 outgoingCtx(Codex C7 P2) */}
                <Link href={ctx ? withMapReturn(`/csat/learn/${r.ref.slice('authored:'.length)}?d=${r.deliveryId}`, ctx) : `/csat/learn/${r.ref.slice('authored:'.length)}?d=${r.deliveryId}`}>{ROLE[r.role]}</Link>
              <span className={u.ledgerVal}>
                {r.current === false ? (r.attempted ? '승인 철회 · 지난 결과만 남음' : '승인 철회 · 지금은 열 수 없음') : !r.attempted ? '아직 안 풂' : r.evidence === true ? '풀었어요 · 지도 근거' : r.evidence === false ? '풀었어요 · 연습 기록' : '풀었어요'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className={p.cardDesc} aria-live="polite" data-testid="ws-authored-msg">{msg}</p>}
    </section>
  )
}
