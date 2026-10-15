// apps/web/src/components/csat/diagnosis/map/GoalRecordBar.tsx
//
// 학습지도 v6.2 상단 컴팩트 띠(LM-W1) — 한 줄에 「목표 · 기록 · 지금 상태 · 다음 한 행동」.
// 옛 3칸 카드(목표 · 기록 · 최근 시험) + 「지금 무엇부터」 우선 카드 띠(FocusStrip)를 이 한 줄로 합쳤다 — 지도가 첫 화면의 중심이 되게.
// 판정은 하지 않는다: 상태 문장은 목표 저장 여부 · 기록 수 · ranksOf(ActionRank) 결과 수로만 고르고, 다음 행동은 ActionRank 1번의 링크 그대로다.
// 우선 순서 2 · 3번은 지도 노드의 번호 표지로 보인다(같은 출처). 기록 2 · 활용 0 을 「기록 없음」으로 보이지 않는다.
// PM4-P2-02 — 과거 기준 보기(asof)는 읽기 전용: 목표 편집 · 기록 추가 · 학습 시작 대신 「현재 기준으로 돌아가 …」 링크.

'use client'

import { ArrowRight, ClipboardList, Pencil, PlayCircle, Target } from 'lucide-react'
import Link from 'next/link'

import { goalSummary } from '@/lib/csat/map/goal-view'
import type { MapPageData } from '@/lib/csat/map/load'
import { withMapReturn } from '@/lib/csat/map-return'
import type { AsIsMap } from '@/lib/csat/map/v4/as-is'
import type { V4View } from '@/lib/csat/map/v4/compose'
import type { TaskId } from '@/lib/csat/map/v4/definition'
import type { Ranks } from '@/lib/csat/map/v62/rank'
import { outgoingCtx } from '@/lib/csat/map/v62/return-ctx'

import { GoalPopover, type useGoal } from './GoalBar'
import { homeWsOf } from './TaskInspector'
import u from './unified.module.css'

const EXCLUDED_LABEL: Record<'after_as_of' | 'not_diagnosable' | 'exam_not_ready', string> = {
  after_as_of: '기준일 뒤',
  not_diagnosable: '입력 확인 필요',
  exam_not_ready: '분석 준비 중인 시험',
}

export type MapState = 'no_goal' | 'no_record' | 'ready' | 'none'

/** 지금 상태 — 목표 저장 여부 · 기록 수 · 지금 할 수 있는 행동 수만으로(새 판정 없음) */
export function mapStateOf(goalSet: boolean, asIs: AsIsMap, ranks: Ranks | null): MapState {
  return !goalSet ? 'no_goal' : asIs.sessions.length === 0 ? 'no_record' : ranks?.actionRank.length ? 'ready' : 'none'
}

const LEAD: Record<MapState, { h: string; p: string }> = {
  no_goal: { h: '목표를 정하면 먼저 볼 TASK 가 정해져요', p: '목표 없이도 지도를 둘러보고 확인부터 할 수 있어요.' },
  no_record: { h: '아직 무엇이 부족한지 정하지 않았어요', p: '기출 기록이 없어 근거가 부족해요 — 약점으로 정한 것은 없어요.' },
  ready: { h: '지도의 1 · 2 · 3 순서로 확인 · 학습해요', p: '목표와 관련된 순서예요. 실력 점수나 약점 확정이 아니에요.' },
  none: { h: '지금 이어서 할 활동이 없어요', p: '자료가 준비 중이거나 앞 단계 뒤에 열려요 — 학생의 부족이 아니에요.' },
}

export function GoalRecordBar({ data, g, goalSet, asIs, view, ranks, recordHref, past = false, currentHref, onSelect }: {
  data: MapPageData
  g: ReturnType<typeof useGoal>
  goalSet: boolean
  asIs: AsIsMap
  view: V4View
  ranks: Ranks | null
  recordHref: string
  past?: boolean
  currentHref?: string
  onSelect: (id: TaskId) => void
}) {
  const gs = goalSummary({ goal: g.goal, goalSet }, data.records)
  const total = asIs.sessions.length
  const used = asIs.sessions.filter((s) => s.used).length
  const excluded = (['after_as_of', 'not_diagnosable', 'exam_not_ready'] as const)
    .map((k) => ({ k, n: asIs.sessions.filter((s) => s.excluded === k).length }))
    .filter((x) => x.n > 0)
  const asOf = asIs.asOf.slice(0, 10)
  const now = currentHref ?? '/csat/diagnosis?tab=map'
  const state = mapStateOf(goalSet, asIs, ranks)
  const first = state === 'ready' ? ranks!.actionRank[0] : null
  return (
    <section className={u.top} aria-label="목표 · 기록 · 지금 상태" data-testid="umap-top" data-past={past} data-state={state}>
      {past && (
        <p className={u.pastBar} role="status" data-testid="umap-past-bar">
          <strong>{asOf} 기준으로 다시 분석한 보기 · 읽기 전용</strong> — 이 기준일까지의 기록 {used}개로 만든 지도예요.{' '}
          <Link href={now} className={u.ghost} data-testid="umap-past-to-current">현재 기준으로 돌아가기</Link>
        </p>
      )}
      <div className={u.topCell}>
        <span className={u.topIcon} aria-hidden="true"><Target size={15} strokeWidth={1.9} /></span>
        <div className={u.topText}>
          <h2 className={u.topLabel}>내 목표</h2>
          <p className={u.topBig} data-testid="goal-value">{goalSet ? <>수능 영어 <strong>{gs.goal}점</strong> · {gs.goalGrade}등급</> : '아직 정하지 않았어요'}</p>
        </div>
        {past ? (
          <Link href={now} className={u.ghost} data-testid="map-goal-to-current">
            <Pencil size={13} strokeWidth={1.9} aria-hidden="true" />
            현재 기준에서 목표 바꾸기
          </Link>
        ) : (
          <GoalPopover
            data={data}
            g={g}
            trigger={({ open, toggle, id }) => (
              <button type="button" className={u.ghost} onClick={toggle} aria-expanded={open} aria-controls={id} data-testid="map-goal-edit">
                <Pencil size={13} strokeWidth={1.9} aria-hidden="true" />
                {goalSet ? '목표 바꾸기' : '목표 정하기'}
              </button>
            )}
          />
        )}
      </div>
      <div className={u.topCell} data-testid="umap-records" data-total={total} data-used={used}>
        <span className={u.topIcon} aria-hidden="true"><ClipboardList size={15} strokeWidth={1.9} /></span>
        <div className={u.topText}>
          <h3 className={u.topLabel}>시험 기록{past ? ` · ${asOf} 기준` : ''}</h3>
          <p className={u.topBig} title={excluded.length > 0 ? `빠진 기록: ${excluded.map((x) => `${EXCLUDED_LABEL[x.k]} ${x.n}`).join(' · ')}` : undefined}>
            전체 <strong>{total}</strong> · 진단에 씀 <strong>{used}</strong>
            {gs.latest && <span className={u.topSub}> · 최근 {gs.latest.raw}점{goalSet && gs.gap !== null && !past ? ` · 목표까지 ${gs.gap}점` : ''}</span>}
          </p>
        </div>
        {past ? (
          <Link href={now} className={u.ghost} data-testid="umap-record-to-current">현재 기준에서 기록하기</Link>
        ) : (
          <Link href={recordHref} className={u.ghost} data-testid="umap-record-add">기록하기</Link>
        )}
      </div>
      <div className={u.topState} data-testid="umap-state" data-state={state}>
        <div className={u.topText}>
          <h3 className={u.topHead}>{LEAD[state].h}</h3>
          <p className={u.topSub}>{LEAD[state].p}</p>
        </div>
        {past ? (
          <p className={u.topSub}>과거 기준 보기에서는 학습을 시작하지 않아요.</p>
        ) : state === 'no_record' ? (
          <Link href={recordHref} className={u.cta} data-testid="focus-record">
            <ClipboardList size={15} strokeWidth={1.9} aria-hidden="true" />
            기출 한 회 기록하기
          </Link>
        ) : first ? (
          <Link
            href={withMapReturn(first.href, outgoingCtx(data.v4?.saved, first.task, homeWsOf(first.task, view, null)))}
            className={u.cta}
            data-testid="umap-top-next"
            data-task={first.task}
            title={first.label}
            onClick={() => onSelect(first.task)}
          >
            <PlayCircle size={15} strokeWidth={1.9} aria-hidden="true" />
            <span className={u.ctaText}>{first.label}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </section>
  )
}
