// apps/web/src/components/csat/diagnosis/map/FocusStrip.tsx
//
// 학습지도 v6.2 P-M4c 2층 — 「지금 무엇부터」. 목표 · 기록 바로 아래에서 학습자의 세 질문(어떤 TASK 부터 · 왜 · 다음에 무엇을)에 답한다.
// 판정은 하지 않는다 — composeV4 → ranksOf(ActionRank · NeedRank · notActionable) 결과만 그린다(지도 노드의 「우선」 점과 같은 출처).
// 상태별 첫 문장이 다르다: 목표 없음 · 기록 없음(근거 부족 — 약점 확정 아님) · 우선 TASK 있음 · 지금 할 수 있는 행동 없음.
// 순서는 「목표와 관련된 확인 · 학습 순서」이지 실력 점수가 아니다. 지금 할 수 없는 TASK 는 숨기지 않고 이유와 함께(학생의 부족이 아니다).

'use client'

import { ArrowRight, ClipboardList, PlayCircle } from 'lucide-react'
import Link from 'next/link'

import type { MapPageData } from '@/lib/csat/map/load'
import { withMapReturn } from '@/lib/csat/map-return'
import type { V4View } from '@/lib/csat/map/v4/compose'
import { taskOf, type TaskId } from '@/lib/csat/map/v4/definition'
import { domainTaskGraph, taskInspector } from '@/lib/csat/map/v62/graph'
import type { NotActionableReason, Ranks } from '@/lib/csat/map/v62/rank'
import { outgoingCtx } from '@/lib/csat/map/v62/return-ctx'

import f from './focus.module.css'
import { EVIDENCE_V62_LABEL, NEED_V62_LABEL, homeWsOf } from './TaskInspector'

const WHY_NOT: Record<NotActionableReason, string> = {
  content_gap: '확인 자료 준비 중',
  stage_locked: '앞 단계 뒤에 열림',
  canon_hold: '측정 방법 정하는 중',
  relevance_unknown: '목표 시험과의 연결 확인 전',
  no_next_activity: '지금 이어 할 활동 없음',
}

export function FocusStrip({ view, ranks, data, goalSet, past, recordHref, selected, onSelect }: {
  view: V4View
  ranks: Ranks | null
  data: MapPageData
  goalSet: boolean
  past: boolean
  recordHref: string
  selected: TaskId
  onSelect: (id: TaskId) => void
}) {
  const graph = domainTaskGraph()
  const label = (id: TaskId) => { const g = graph.tasks.find((x) => x.id === id); return { code: g?.display ?? id, name: (g?.name ?? taskOf(id).name).replace(/\(통합 관찰\)$/, '') } }
  const sessions = view.asIs.sessions.length
  const top = ranks?.actionRank.slice(0, 3) ?? []
  const needOf = new Map(ranks?.needRank.map((e) => [e.task, e]) ?? [])
  const blocked = ranks?.notActionable ?? []
  const state: 'no_goal' | 'no_record' | 'ready' | 'none' = !goalSet ? 'no_goal' : sessions === 0 ? 'no_record' : top.length ? 'ready' : 'none'

  const lead: Record<typeof state, { h: string; p: string }> = {
    no_goal: { h: '목표를 정하면 먼저 볼 TASK 가 정해져요', p: '위 「목표 정하기」에서 목표 점수를 정해요. 그 전에도 지도를 둘러보거나 오른쪽 확인부터 해도 돼요 — 확인 결과는 목표를 정한 뒤에도 그대로 쓰여요.' },
    no_record: { h: '아직 무엇이 부족한지 정하지 않았어요', p: '기출 기록이 없어 근거가 부족해요 — 약점으로 정한 것은 없어요. 기출 한 회를 기록하거나, 오른쪽 확인 문항부터 풀어 근거를 만들어요.' },
    ready: { h: '목표까지 이 순서로 확인 · 학습해요', p: '목표와 관련된 확인 · 학습 순서예요. 실력 점수나 약점 확정이 아니에요 — 확인 결과에 따라 바뀌어요.' },
    none: { h: '지금 이어서 할 활동이 없어요', p: '필요한 TASK 는 있지만 확인 자료가 준비 중이거나 앞 단계 뒤에 열려요. 아래 이유를 보고 지도에서 다른 TASK 를 골라도 돼요.' },
  }

  return (
    <section className={f.strip} aria-labelledby="focus-h" data-testid="focus-strip" data-state={state} data-cards={top.length}>
      <div className={f.lead}>
        <p className={f.eyebrow}>지금 무엇부터</p>
        <h2 id="focus-h" className={f.h}>{lead[state].h}</h2>
        <p className={f.p}>{lead[state].p}</p>
        {state === 'no_record' && !past && (
          <Link href={recordHref} className={f.primary} data-testid="focus-record">
            <ClipboardList size={16} strokeWidth={1.9} aria-hidden="true" />
            기출 한 회 기록하기
          </Link>
        )}
      </div>

      {top.length > 0 && (
        <ol className={f.cards} aria-label="먼저 볼 TASK">
          {top.map((e, i) => {
            const t = label(e.task)
            const need = needOf.get(e.task)
            const evidence = EVIDENCE_V62_LABEL[taskInspector(e.task, view, ranks!, null).now.evidence]
            const home = homeWsOf(e.task, view, null)
            const on = selected === e.task
            return (
              <li key={e.task} className={f.card} data-task={e.task} data-selected={on} data-testid="focus-card">
                <div className={f.cardHead}>
                  <span className={f.order} aria-label={`${i + 1}번째`}>{i + 1}</span>
                  <button type="button" className={f.taskBtn} onClick={() => onSelect(e.task)} aria-pressed={on} data-testid="focus-select">
                    <span className={f.code}>{t.code}</span>
                    <span className={f.name}>{t.name}</span>
                  </button>
                </div>
                <dl className={f.kv}>
                  <dt>왜</dt>
                  <dd>{need ? `${NEED_V62_LABEL[need.need]}${need.confirmed ? '' : ' · 확정 아님'}` : '목표와 관련된 확인'}</dd>
                  <dt>지금</dt>
                  <dd>{evidence}</dd>
                </dl>
                {past ? (
                  <p className={f.note}>과거 기준 보기에서는 학습을 시작하지 않아요.</p>
                ) : (
                  <Link href={withMapReturn(e.href, outgoingCtx(data.v4?.saved, e.task, home))} className={i === 0 && state === 'ready' ? f.primary : f.secondary} data-testid="focus-next">
                    <PlayCircle size={15} strokeWidth={1.9} aria-hidden="true" />
                    <span className={f.ctaText}>{e.label}</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {blocked.length > 0 && state !== 'no_goal' && (
        <details className={f.blocked} data-testid="focus-blocked">
          <summary>필요하지만 지금은 할 수 없는 TASK {blocked.length}개 — 학생의 부족이 아니라 준비 상태예요</summary>
          <ul>
            {blocked.map((b) => (
              <li key={b.task}>
                <button type="button" className={f.chip} onClick={() => onSelect(b.task)} data-reason={b.reason}>
                  <span className={f.code}>{label(b.task).code}</span> {label(b.task).name} · {WHY_NOT[b.reason]}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
