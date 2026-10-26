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

import { LearningNotesPanel } from './LearningNotesPanel'
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

/** 서버가 확인한 거절 이유(닫힌 코드 · server.ts RejectReason)만 학습자 말로 — 모르는 코드는 「확인하지 못했어요」 */
const REJECT: Record<string, string> = {
  exposure: '이미 본 자료라 다시 드리지 않아요',
  human_decision: '권리·정답 검수 결정을 확인하지 못해 드릴 수 없어요',
  approval: '출시 승인이 없어 드릴 수 없어요',
  quantity: '이번 계획 수량을 이미 채웠어요',
}

/** 받은 자료 한 줄 — 새 학습 링크는 지금 유효함이 확인된 자료(current === true)만 · 이미 푼 자료는 지난 결과 보기 · 확인 못 함은 학습 가능으로 올리지 않는다(T0067-P1-2) */
export function rowState(r: Pick<Row, 'current' | 'attempted' | 'evidence'>): { link: boolean; label: string; unknown: boolean } {
  if (r.current === false) return { link: r.attempted, label: r.attempted ? '승인 철회 · 지난 결과만 남음' : '승인 철회 · 지금은 열 수 없음', unknown: false }
  if (r.current !== true && !r.attempted) return { link: false, label: '지금 열 수 있는지 확인하지 못했어요', unknown: true }
  if (!r.attempted) return { link: true, label: '아직 안 풂', unknown: false }
  return { link: true, label: r.evidence === true ? '풀었어요 · 지도 근거' : r.evidence === false ? '풀었어요 · 연습 기록' : '풀었어요', unknown: false }
}

export interface SupplyOutcome { lines: { role: Role; text: string; kind: 'full' | 'partial' | 'none' }[]; retry: boolean; unknown: boolean }

/**
 * T-0067 — 공급 응답을 사실대로: 역할마다 받은 수 / 요청 수 · 모자란 이유(서버가 확인한 코드만) · 제작 주문은 orderOpened === true 일 때만 「접수」(완료 · 일정은 말하지 않는다).
 * orderOpened false · 누락 · 모양이 다른 응답은 「접수됐는지 확인하지 못했어요」 — 성공으로 뭉개지 않는다. 다시 확인이 필요하면 retry.
 */
export function supplyOutcome(raw: unknown): SupplyOutcome {
  const lines = (raw && typeof raw === 'object' && Array.isArray((raw as { lines?: unknown }).lines) ? (raw as { lines: unknown[] }).lines : null)
  if (!lines) return { lines: [], retry: true, unknown: true }
  const out: SupplyOutcome['lines'] = []
  let retry = false
  for (const x of lines as Partial<LineOut>[]) {
    const role = (ORDER as string[]).includes(x?.role as string) ? (x.role as Role) : null
    const requested = Number.isInteger(x?.requested) ? (x.requested as number) : null
    const got = Array.isArray(x?.delivered) ? x.delivered.length : null
    if (!role || requested === null || got === null) { retry = true; out.push({ role: role ?? 'independent_check', kind: 'none', text: '이 단계의 결과를 확인하지 못했어요 — 다시 확인해 주세요.' }); continue }
    const label = ROLE[role]
    if (got >= requested) { out.push({ role, kind: 'full', text: `${label} ${got}개를 받았어요.` }); continue }
    const reasons = [...new Set((Array.isArray(x.rejected) ? x.rejected : []).map((r) => REJECT[r?.reason as string] ?? null))]
    const known = reasons.filter((r): r is string => !!r)
    const why = known.length ? known.join(' · ') : reasons.length ? '일부 자료를 드리지 못한 이유를 확인하지 못했어요' : '지금 승인된 자료가 모자라요'
    const order = x.orderOpened === true ? '모자란 만큼 제작 요청을 접수했어요(완료 시각은 정해지지 않았어요).' : '모자란 만큼 제작 요청이 접수됐는지 확인하지 못했어요.'
    if (x.orderOpened !== true) retry = true
    out.push({ role, kind: got > 0 ? 'partial' : 'none', text: `${label} ${got} / ${requested}개 — ${why}. ${order}` })
  }
  return { lines: out, retry, unknown: false }
}

/** kind=support — 이 Workspace 의 보조 TASK 자료(T-0056). 시험 id · 제목이 중심 카드와 겹치지 않게 접미사 · TASK 이름을 붙인다 */
export function AuthoredSupplyCard({ task, template, planSaved, past, ctx, kind = 'core', taskName, viewer = null }: { task: string; template: string; planSaved: boolean; past: boolean; ctx?: MapReturnCtx; kind?: 'core' | 'support' | 'instructional'; taskName?: string; viewer?: string | null }) {
  // T-0083 — instructional = 학습 전용 보조 진입(원리 설명 · 안내 연습만 · 서버가 교수 2역할만 수요로 만든다)
  const tid = (x: string) => (kind === 'support' ? x.replace('ws-authored', 'ws-authored-support') : kind === 'instructional' ? x.replace('ws-authored', 'ws-authored-learn') : x)
  const hid = kind === 'core' ? 'ws-authored' : `ws-authored-${kind === 'instructional' ? 'learn-' : ''}` + task.replace(/[^a-z0-9]/gi, '-')
  const [listed, setListed] = useState<Listed>({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<SupplyOutcome | null>(null)

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
    setBusy(true); setMsg(null); setOutcome(null)
    try {
      const r = await fetch('/api/csat/authored/supply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task, template }) })
      const j = await r.json().catch(() => ({}))
      if (r.status === 409) setMsg('학습계획을 먼저 확정하면 자료를 받을 수 있어요.')
      // T-0078 — 수행 기록 조회 실패는 공급 미준비 · 자료 0 · 권리 대기가 아니다(같은 503 이라도 닫힌 코드로 가른다)
      else if (r.status === 503 && j.code === 'evidence_unavailable') setMsg('수행 기록을 지금 읽지 못해 자료를 받지 않았어요 — 기록은 그대로예요. 잠시 뒤 다시 확인해 주세요.')
      else if (r.status === 503) setMsg('자료 공급을 아직 준비하고 있어요 — 잠시 뒤 다시 확인해 주세요.')
      else if (!r.ok) setMsg(typeof j.error === 'string' ? j.error : '자료를 받지 못했어요 — 잠시 뒤 다시 눌러 주세요.')
      else if (j.status === 'no_lines') setMsg('지금 단계에서 새로 받을 자료가 없어요.')
      else if (j.status === 'ok') setOutcome(supplyOutcome(j))
      else setOutcome({ lines: [], retry: true, unknown: true })
      await load()
    } catch { setMsg('연결이 끊겼어요 — 다시 눌러도 같은 자료가 두 번 오지 않아요.') }
    finally { setBusy(false) }
  }

  // T-0083(P1-1) — 학습 전용 진입은 교수 2역할만 보인다(목록은 TASK 단위라 같은 TASK 의 평가 · 미지 역할 납품도 온다 — 원장은 그대로 두고 이 카드 · 노트 투영에서만 뺀다)
  const shownRow = (r: Row) => kind !== 'instructional' || r.role === 'model_explanation' || r.role === 'guided_practice'
  const rows = listed.status === 'installed' ? [...listed.rows].filter(shownRow).sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role)) : []
  return (
    <section className={p.card} aria-labelledby={hid} data-testid={tid('ws-authored')} data-task={task}>
      <div className={p.cardHead}>
        <div>
          <h3 id={hid} className={p.cardTitle}>{kind === 'support' ? <>받은 자료 · 보조 TASK {taskName ?? task}</> : kind === 'instructional' ? <>학습 자료 · {taskName ?? task}</> : '받은 자료'}</h3>
          {kind === 'instructional'
            ? <p className={p.cardDesc} data-testid={tid('ws-authored-scope')}>원리 설명 · 안내 연습으로 배우는 자료예요. 이 힘의 혼자 확인은 아직 준비 중이라 여기서 받은 풀이는 연습 기록으로만 남고, 이 묶음의 계획 · 확인 결과는 바뀌지 않아요.</p>
            : <p className={p.cardDesc}>지금 계획에 맞춰 검수 · 승인된 자료만 받아요. 혼자 확인 · 다른 글 적용 자료는 처음 보는 글이에요.</p>}
        </div>
        {listed.status === 'installed' && !past && (
          <button type="button" className={p.whitePill} onClick={request} disabled={busy || !planSaved} data-testid={tid('ws-authored-request')}
            title={planSaved ? undefined : '학습계획을 먼저 확정해 주세요'}>
            <PackageOpen size={14} strokeWidth={1.9} aria-hidden="true" />
            {busy ? '받는 중…' : '자료 받기'}
          </button>
        )}
      </div>
      {listed.status === 'loading' && <p className={p.cardDesc}>불러오는 중…</p>}
      {listed.status === 'not_installed' && <p className={p.cardDesc} data-testid={tid('ws-authored-preparing')}>자료 공급을 준비하고 있어요 — 승인된 자료가 생기면 여기서 받을 수 있어요.</p>}
      {listed.status === 'error' && <p className={p.cardDesc} role="alert">받은 자료를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>}
      {listed.status === 'installed' && rows.length === 0 && <p className={p.cardDesc} data-testid={tid('ws-authored-empty')}>아직 받은 자료가 없어요.{!planSaved && ' 학습계획을 먼저 확정해 주세요.'}</p>}
      {rows.length > 0 && (
        <ul className={u.needList} data-testid={tid('ws-authored-list')}>
          {rows.map((r) => (
            <li key={r.deliveryId} data-role={r.role}>
              {/* 지도 복귀 문맥(TASK · Workspace · 목표 · PLAN)을 싣는다 — PLAN CTA 와 같은 outgoingCtx(Codex C7 P2) */}
                {/* 새 학습 링크는 지금 유효함이 확인된(current === true) 자료만 · 이미 푼 자료는 지난 결과 보기(기존 권한 그대로) · 확인 못 함은 학습 가능으로 올리지 않는다(T0067-P1-2) */}
                {!rowState(r).link ? <span data-testid={tid('ws-authored-unverified')} data-current={String(r.current ?? 'unknown')}>{ROLE[r.role]}</span> : <Link href={ctx ? withMapReturn(`/csat/learn/${r.ref.slice('authored:'.length)}?d=${r.deliveryId}`, ctx) : `/csat/learn/${r.ref.slice('authored:'.length)}?d=${r.deliveryId}`}>{ROLE[r.role]}</Link>}
              <span className={u.ledgerVal}>
                {rowState(r).label}
              </span>
            </li>
          ))}
        </ul>
      )}
      {rows.some((r) => rowState(r).unknown) && (
        <p className={`${p.cardDesc} break-keep`} data-testid={tid('ws-authored-recheck-note')}>
          일부 자료는 지금 열 수 있는지 확인하지 못했어요.{' '}
          <button type="button" className={p.whitePill} onClick={() => void load()} data-testid={tid('ws-authored-recheck')}>다시 확인하기</button>
        </p>
      )}
      {/* T-0071 — 이 TASK 에서 쓴 내 원리 노트(펼칠 때만 읽기 · 정확한 납품 결속만) */}
      <LearningNotesPanel key={task} task={task} rows={rows} listed={listed.status} past={past} ctx={ctx} viewer={viewer} testPrefix={tid('ws-authored').replace('ws-authored', 'ws-notes')} />
      {msg && <p className={p.cardDesc} aria-live="polite" data-testid={tid('ws-authored-msg')}>{msg}</p>}
      {outcome && (
        <div aria-live="polite" data-testid={tid('ws-authored-msg')} data-unknown={outcome.unknown} data-retry={outcome.retry}>
          {outcome.unknown ? (
            <p className={`${p.cardDesc} break-keep`}>공급 결과를 확인하지 못했어요 — 받은 자료는 위 목록이 정확해요.</p>
          ) : (
            <ul className={`${u.needList} break-keep`} data-testid={tid('ws-authored-outcome')}>
              {outcome.lines.map((l, i) => <li key={`${l.role}-${i}`} data-role={l.role} data-kind={l.kind}><span>{l.text}</span></li>)}
            </ul>
          )}
          {outcome.retry && !past && (
            <button type="button" className={p.whitePill} onClick={() => void request()} disabled={busy || !planSaved} data-testid={tid('ws-authored-retry')}>
              다시 확인하기
            </button>
          )}
        </div>
      )}
    </section>
  )
}
