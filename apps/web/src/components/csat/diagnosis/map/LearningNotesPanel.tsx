// apps/web/src/components/csat/diagnosis/map/LearningNotesPanel.tsx
//
// T-0071 — 받은 자료 카드 안의 접힌 「내 원리 노트」. 펼칠 때만 서버 사본(GET /api/csat/state)을 읽는다 — PUT · 기기 병합(loadSyncedDissectionRecord) ·
// 새 캐시 · 새 저장소 없음. TASK · 보는 사람이 바뀌면 지난 응답을 버린다(늦게 온 응답이 섞이지 않게 요청 순번으로 거른다).
// 노트 본문 · 문항 · 학습자 식별자는 이벤트 · 로그로 보내지 않는다.

'use client'

import { NotebookPen } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { withMapReturn, type MapReturnCtx } from '@/lib/csat/map-return'
import { notesForTask, notesFromStateResponse, type DeliveredRow, type NotesState } from '@/lib/csat/map/v62/learning-notes'

import p from './popup.module.css'

const ROLE_LABEL = { model_explanation: '원리 설명', guided_practice: '안내 연습' } as const
const UNKNOWN_LABEL = {
  unauthenticated: '로그인이 풀려 노트를 확인하지 못했어요 — 다시 로그인해 주세요.',
  held: '검토 중인 문항이 있어 노트를 지금 확인하지 못했어요.',
  error: '노트를 불러오지 못했어요 — 노트가 없다는 뜻이 아니에요. 잠시 뒤 다시 열어 주세요.',
  not_installed: '자료 공급을 준비하고 있어 노트를 연결해 볼 수 없어요.',
} as const

export function LearningNotesPanel({ task, rows, listed, past, ctx, testPrefix = 'ws-notes' }: {
  task: string
  /** 그 TASK 의 본인 납품(카드가 이미 받은 것) */
  rows: readonly DeliveredRow[]
  /** 납품 목록 상태 — installed 가 아니면 노트를 잇지 않는다 */
  listed: 'loading' | 'installed' | 'not_installed' | 'error'
  past: boolean
  ctx?: MapReturnCtx
  testPrefix?: string
}) {
  const [state, setState] = useState<NotesState>({ status: 'idle' })
  const seq = useRef(0)

  // TASK 가 바뀌면 지난 결과를 지운다(늦은 응답도 순번으로 버린다 · 부모는 key={task} 로 새로 그린다)
  useEffect(() => { seq.current++; setState({ status: 'idle' }) }, [task])

  const load = useCallback(async () => {
    if (listed === 'not_installed') { setState({ status: 'unknown', reason: 'not_installed' }); return }
    if (listed !== 'installed') { setState({ status: 'unknown', reason: 'error' }); return }
    const my = ++seq.current
    setState({ status: 'loading' })
    try {
      const r = await fetch('/api/csat/state', { cache: 'no-store' })
      const body = await r.json().catch(() => null)
      if (my !== seq.current) return
      const got = notesFromStateResponse(r.status, body)
      setState(got.ok ? { status: 'ok', groups: notesForTask(got.notes, rows) } : { status: 'unknown', reason: got.reason })
    } catch {
      if (my === seq.current) setState({ status: 'unknown', reason: 'error' })
    }
  }, [listed, rows])

  return (
    <details className={p.notes} data-testid={testPrefix} data-task={task}
      onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open && state.status === 'idle') void load() }}>
      <summary className={p.notesSum}>
        <NotebookPen size={14} strokeWidth={1.9} aria-hidden="true" />
        내 원리 노트 — 설명을 보고 쓴 내 설명 · 고쳐 쓴 설명 다시 보기
      </summary>
      <NotesBody state={state} past={past} ctx={ctx} testPrefix={testPrefix} onRetry={() => void load()} />
    </details>
  )
}

/** 펼친 패널 내용(상태별) — 조회 없이 그리기만 한다 */
export function NotesBody({ state, past, ctx, testPrefix = 'ws-notes', onRetry }: { state: NotesState; past: boolean; ctx?: MapReturnCtx; testPrefix?: string; onRetry?: () => void }) {
  return (
    <>
        <p className={p.cardDesc}>설명을 본 뒤 쓴 학습 기록이에요. 실력 판정이나 계획 진전으로 세지 않아요.</p>
        {state.status === 'loading' && <p className={p.cardDesc}>불러오는 중…</p>}
        {state.status === 'unknown' && (
          <p className={p.cardDesc} role="alert" data-testid={`${testPrefix}-unknown`} data-reason={state.reason}>
            {UNKNOWN_LABEL[state.reason]}{' '}
            {state.reason !== 'not_installed' && <button type="button" className={p.whitePill} onClick={onRetry} data-testid={`${testPrefix}-retry`}>다시 확인하기</button>}
          </p>
        )}
        {state.status === 'ok' && state.groups.length === 0 && (
          <p className={p.cardDesc} data-testid={`${testPrefix}-empty`}>이 TASK 의 원리 설명 · 안내 연습에서 쓴 노트가 아직 없어요.</p>
        )}
        {state.status === 'ok' && state.groups.length > 0 && (
          <ul className={p.notesList} data-testid={`${testPrefix}-list`}>
            {state.groups.map((g) => (
              <li key={g.deliveryId} data-role={g.role} data-current={String(g.current ?? 'unknown')}>
                <div className={p.notesHead}>
                  <strong>{ROLE_LABEL[g.role]}</strong>
                  {!past && g.current === true ? (
                    <Link className={p.whitePill} href={ctx ? withMapReturn(`/csat/learn/${g.ref.slice('authored:'.length)}?d=${g.deliveryId}`, { ...ctx, mapItem: null, mapAttempt: null }) : `/csat/learn/${g.ref.slice('authored:'.length)}?d=${g.deliveryId}`} data-testid={`${testPrefix}-open`}>
                      이어서 보기 · 대조하기
                    </Link>
                  ) : (
                    <span className={p.cardDesc} data-testid={`${testPrefix}-readonly`}>{past ? '지난 기준 — 보기만' : g.current === false ? '이 자료는 지금 열 수 없어요 — 내 노트만 보여요' : '이 자료를 지금 열 수 있는지 확인하지 못했어요 — 내 노트만 보여요'}</span>
                  )}
                </div>
                {g.chains.map((chain) => (
                  <ol key={chain[0].id} className={p.notesChain} data-testid={`${testPrefix}-chain`} data-count={chain.length}>
                    {chain.map((n, i) => (
                      <li key={n.id} data-revision={n.revision}>
                        <span className={p.notesTag}>{n.revision ? `고쳐 쓴 설명 ${i}` : '처음 쓴 설명'}</span>
                        <p className={p.notesText}>{n.statement}</p>
                        {n.grounds && <p className={p.cardDesc}>근거 · {n.grounds}</p>}
                        {n.applicability && <p className={p.cardDesc}>쓸 수 있는 조건 · {n.applicability}</p>}
                        {n.limit && <p className={p.cardDesc}>한계 · {n.limit}</p>}
                      </li>
                    ))}
                  </ol>
                ))}
                <p className={p.cardDesc}>지금 설명판과의 대조는 학습 화면에서 확인해요 — 여기서는 대조했다고 보지 않아요.</p>
              </li>
            ))}
          </ul>
        )}
    </>
  )
}
