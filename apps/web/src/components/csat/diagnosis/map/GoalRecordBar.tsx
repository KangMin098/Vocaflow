// apps/web/src/components/csat/diagnosis/map/GoalRecordBar.tsx
//
// 학습지도 v6.2 상단 컴팩트 띠(LM-W1) — 한 줄에 「목표 · 기록 · 지금 상태 · 다음 한 행동」.
// 옛 3칸 카드(목표 · 기록 · 최근 시험) + 「지금 무엇부터」 우선 카드 띠(FocusStrip)를 이 한 줄로 합쳤다 — 지도가 첫 화면의 중심이 되게.
// 판정은 하지 않는다: 상태 문장은 목표 저장 여부 · 기록 수 · ranksOf(ActionRank) 결과 수로만 고르고, 다음 행동은 ActionRank 1번의 링크 그대로다.
// 우선 순서 2 · 3번은 지도 노드의 번호 표지로 보인다(같은 출처). 기록 2 · 활용 0 을 「기록 없음」으로 보이지 않는다.
// PM4-P2-02 — 과거 기준 보기(asof)는 읽기 전용: 목표 편집 · 기록 추가 · 학습 시작 대신 「현재 기준으로 돌아가 …」 링크.

'use client'

import { ArrowRight, ClipboardList, PackageOpen, Pencil, PlayCircle, Target } from 'lucide-react'
import Link from 'next/link'

import { goalSummary, gradeOf } from '@/lib/csat/map/goal-view'
import type { MapPageData } from '@/lib/csat/map/load'
import { withMapReturn } from '@/lib/csat/map-return'
import { TASK_EVIDENCE_LABEL, type AsIsMap } from '@/lib/csat/map/v4/as-is'
import { NEED_LABEL } from '@/lib/csat/map/v4/to-be'
import { nextActionOf, WAIT_LABEL, type NextAction } from '@/lib/csat/map/v62/next-action'
import type { V4View } from '@/lib/csat/map/v4/compose'
import type { TaskId } from '@/lib/csat/map/v4/definition'
import type { Ranks } from '@/lib/csat/map/v62/rank'
import { outgoingCtx } from '@/lib/csat/map/v62/return-ctx'
import { GOAL_EXAM_LABEL, SCOPE_REASON_LABEL, gradeView } from '@/lib/csat/map/v62/target-goal'

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
  // T-0070 — 시험 기록 없음 ≠ TASK 근거 없음. 기록이 0 이어도 직접 확인(direct_check) 근거가 있는 TASK 가 있으면 다음 행동을 숨기지 않는다
  //   (시험 proxy · 연습 · 교수 · 어휘 자기 평가는 direct_check 가 아니다 — As-Is 판정을 그대로 읽고 새 판정을 만들지 않는다)
  const direct = Object.values(asIs.tasks).some((t) => t?.basis === 'direct_check')
  return !goalSet ? 'no_goal' : asIs.sessions.length === 0 && !direct ? 'no_record' : ranks?.actionRank.length ? 'ready' : 'none'
}

const LEAD: Record<MapState, { h: string; p: string }> = {
  no_goal: { h: '목표를 정하면 먼저 볼 TASK 가 정해져요', p: '목표 없이도 지도를 둘러보고 확인부터 할 수 있어요.' },
  no_record: { h: '아직 무엇이 부족한지 정하지 않았어요', p: '기출 기록이 없어 근거가 부족해요 — 약점으로 정한 것은 없어요.' },
  ready: { h: '지도의 1 · 2 · 3 순서로 확인 · 학습해요', p: '목표와 관련된 순서예요. 실력 점수나 약점 확정이 아니에요.' },
  none: { h: '지금 이어서 할 활동이 없어요', p: '자료가 준비 중이거나 앞 단계 뒤에 열려요 — 학생의 부족이 아니에요.' },
}

export function GoalRecordBar({ data, g, goalSet, asIs, view, ranks, recordHref, past = false, currentHref, onSelect, selected = null, onOpenWs }: {
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
  /** 지금 지도에서 고른 TASK — 추천과 다르면 둘을 나눠 보인다 */
  selected?: TaskId | null
  /** 같은 TASK 의 Workspace 를 개요(자료 받기) · 계획 탭으로 연다 */
  onOpenWs?: (ws: string, tab: 'overview' | 'plan') => void
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
  // T-0061 — 추천 TASK 의 이유 · 이번 학습량 · 확인 조건 · 다음 한 행동(같은 순위 · 계획 · 저장 상태에서)
  // T-0073 — 시험 기록 0(no_record)이어도 목표가 있으면 같은 다음 행동(계획 확정 · 자료 받기 · 시작 · 기다림 이유)을 쓴다. 상태 · 안내는 미측정 그대로(부족 · 숙달로 올리지 않음)
  const acting = state === 'ready' || state === 'none' || state === 'no_record'
  const next = acting ? nextActionOf(view, ranks, data.v4?.saved) : null
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
          {/* 점수에서 계산한 등급은 「참고 구간」 — 저장한 목표 등급과 다른 값이다 */}
          <p className={u.topBig} data-testid="goal-value">{goalSet ? <>영어 <strong>{gs.goal}점</strong> <span className={u.topSub}>· 참고 {gs.goalGrade}등급 구간</span></> : '아직 정하지 않았어요'}</p>
          {goalSet && <GoalTargetLine data={data} score={gs.goal} />}
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
            {gs.latest && <span className={u.topSub}> · {past ? '전체 기록의 최근' : '최근'} {gs.latest.raw}점{goalSet && gs.gap !== null && !past ? ` · 목표까지 ${gs.gap}점` : ''}</span>}
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
          {!past && next ? (
            <>
              <h3 className={u.topHead} data-testid="umap-next-task" data-task={next.task} data-kind={next.kind}>추천 · {next.name}</h3>
              <p className={`${u.topSub} break-keep`} data-testid="umap-next-why">{whyText(next)}</p>
              {state === 'no_record' && <p className={`${u.topSub} break-keep`} data-testid="umap-no-record-note">{LEAD.no_record.p} 직접 확인으로 지금 수준부터 봐요.</p>}
            </>
          ) : (
            <>
              <h3 className={u.topHead}>{LEAD[state].h}</h3>
              <p className={u.topSub}>{LEAD[state].p}</p>
            </>
          )}
        </div>
        {past ? (
          <p className={u.topSub}>과거 기준 보기에서는 학습을 시작하지 않아요.</p>
        ) : state === 'no_record' && next ? (
          // 시험 한 회 기록은 직접 확인의 필수 선행이 아니다 — 지금 할 실제 행동이 주 행동, 기록은 보조
          <div className={u.topActs}>
            <NextActionButton next={next} data={data} view={view} onSelect={onSelect} onOpenWs={onOpenWs} />
            <Link href={recordHref} className={u.ghost} data-testid="focus-record">
              <ClipboardList size={14} strokeWidth={1.9} aria-hidden="true" />
              또는 기출 한 회 기록하기
            </Link>
          </div>
        ) : state === 'no_record' ? (
          <Link href={recordHref} className={u.cta} data-testid="focus-record">
            <ClipboardList size={15} strokeWidth={1.9} aria-hidden="true" />
            기출 한 회 기록하기
          </Link>
        ) : state === 'no_goal' ? null : next ? (
          <NextActionButton next={next} data={data} view={view} onSelect={onSelect} onOpenWs={onOpenWs} />
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
      {!past && next && acting && <NextActionFacts next={next} selected={selected} />}
    </section>
  )
}

/** 추천 이유 — 요구 종류 · 관찰 근거 · 목표 시험 관련 문항 수(사실만 · 점수 향상 · 능력 수치로 바꾸지 않는다) */
function whyText(n: NextAction): string {
  const parts: string[] = []
  if (n.why.need) parts.push(`${NEED_LABEL[n.why.need]}이 필요한 TASK`)
  if (n.why.evidence) parts.push(TASK_EVIDENCE_LABEL[n.why.evidence])
  if (n.why.items) parts.push(`목표 시험에서 이 힘을 쓰는 문항 ${n.why.items}개${n.why.pointsPerExam ? `(회당 ${n.why.pointsPerExam}점)` : ''}`)
  // T-0074 — 지금 정책 통과는 도달 조건 전체가 아니다(시간 지나 다시 확인은 아직 근거 없음)
  if (n.why.evidence === 'resolved') parts.push('시간 지나 다시 확인은 아직 근거 없음')
  return parts.length ? parts.join(' · ') : '목표와 관련된 순서의 첫 TASK 예요 — 약점 확정이 아니에요.'
}

/** 다음 한 행동 — 시작 · 계획 확정 · 자료 받기는 실제로 갈 곳이 있을 때만, 기다림은 이유만(재요청 버튼 없음) */
function NextActionButton({ next, data, view, onSelect, onOpenWs }: { next: NextAction; data: MapPageData; view: V4View; onSelect: (id: TaskId) => void; onOpenWs?: (ws: string, tab: 'overview' | 'plan') => void }) {
  if (next.kind === 'start' && next.href) {
    return (
      <Link href={withMapReturn(next.href, outgoingCtx(data.v4?.saved, next.task, next.ws ?? homeWsOf(next.task, view, null)))} className={u.cta} data-testid="umap-top-next" data-task={next.task} title={next.label ?? undefined} onClick={() => onSelect(next.task)}>
        <PlayCircle size={15} strokeWidth={1.9} aria-hidden="true" />
        <span className={u.ctaText}>{next.label}</span>
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    )
  }
  if ((next.kind === 'plan' || next.kind === 'supply') && next.ws && onOpenWs) {
    const tab = next.kind === 'plan' ? 'plan' : 'overview'
    return (
      <button type="button" className={u.cta} data-testid="umap-top-next" data-task={next.task} data-kind={next.kind} onClick={() => { onSelect(next.task); onOpenWs(next.ws!, tab) }}>
        {next.kind === 'plan' ? <ClipboardList size={15} strokeWidth={1.9} aria-hidden="true" /> : <PackageOpen size={15} strokeWidth={1.9} aria-hidden="true" />}
        <span className={u.ctaText}>{next.kind === 'plan' ? (next.replan ? '계획 다시 확정하기' : '학습계획 확정하기') : '자료 받으러 가기'}</span>
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    )
  }
  return null
}

/** 이번 학습량 · 확인 조건 · 기다림 이유 · 고른 TASK 와 추천의 구분(한 줄 목록) */
function NextActionFacts({ next, selected }: { next: NextAction; selected: TaskId | null }) {
  const q = next.quantity
  const amount = q && q.planned !== null ? `${q.done} / ${q.planned}${q.unit} ${q.source === 'saved' ? '(저장한 계획)' : '(제안 — 아직 확정 전)'}` : '계획량 없음 — 쓸 수 있는 자료가 생기면 정해져요'
  return (
    <ul className={`${u.topFacts} ${u.topSub} break-keep`} data-testid="umap-next-facts" aria-label="추천 TASK 의 이번 학습">
      <li data-testid="umap-next-amount">이번 학습량 · {amount}</li>
      {next.criterion && <li data-testid="umap-next-criterion">확인 조건 · {next.criterion}</li>}
      {next.kind === 'plan' && <li data-testid="umap-next-plan-note">{next.replan ? (next.replanWhy === 'goal' ? '목표가 바뀌었어요 — 저장한 계획은 그때 목표 기준이에요. 지금 목표로 다시 확정하면 이 목표의 학습량이 정해져요.' : '저장한 뒤 자료 · 단계가 바뀌었어요 — 계획을 다시 확정하면 새 학습량이 정해져요.') : '계획을 확정하면 자료 · 기록이 이 계획에 묶여요.'}</li>}
      {next.kind === 'supply' && <li>받을 수 있는 자료가 있는지는 자료 받기에서 서버가 확인해요 — 준비 시각은 약속하지 않아요.</li>}
      {next.kind === 'wait' && next.blocked && <li data-testid="umap-next-wait">{WAIT_LABEL[next.blocked]}</li>}
      {selected && selected !== next.task && <li data-testid="umap-next-selected">지금 지도에서 고른 TASK 는 추천과 달라요 — 아래 TASK 정보는 고른 TASK 기준이에요.</li>}
    </ul>
  )
}

/**
 * 목표 통합 단계 — 저장된 목표의 점수 외 값과 기준 시험(짧게). 등급은 셋을 섞지 않는다: 저장한 목표 등급 · 점수에서 계산한 참고 구간(위 줄) · 기록 등급.
 * 목표 시험이 분석 자료를 갖추지 못했으면(미지원) 그 사실을 말하고 다른 시험으로 대신하지 않는다.
 */
function GoalTargetLine({ data, score }: { data: MapPageData; score: number }) {
  const t = data.v4?.target
  if (!t) return null
  const g = t.goal
  const gv = gradeView(score, g?.grade ?? null, gradeOf)
  const unsupported = t.scope.status === 'unsupported_content'
  const examText = t.scope.exam ? GOAL_EXAM_LABEL[t.scope.exam] : '평가원 최근'
  const reason = unsupported && t.scope.reason ? SCOPE_REASON_LABEL[t.scope.reason] : null
  return (
    <p className={u.topSub} data-testid="goal-target" data-exam={t.scope.exam ?? ''} data-scope={t.scope.status} data-exams={t.scope.exams.map((e) => e.id).join(",")} data-grade={g?.grade ?? ''} data-date={g?.date ?? ''} data-version={g?.id ?? ''}>
      <span title={reason ?? `기준 시험 ${t.scope.exams.length}회`} aria-label={reason ? `${examText} — ${reason}` : undefined}>
        {examText} 기준 {unsupported ? '· 분석 자료 준비 중' : `${t.scope.exams.length}회`}
      </span>
      {g?.grade ? <> · 목표 {g.grade}등급{gv.mismatch ? ' (점수 구간과 달라요 — 바꾸지 않았어요)' : ''}</> : null}
      {g?.date ? <> · ~{g.date}</> : null}
    </p>
  )
}
