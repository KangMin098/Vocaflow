// apps/web/src/components/csat/diagnosis/map/StepSheet.tsx
//
// 학습 단계 시트 — 학습 지도에서 단계를 누르면 열린다. 학생이 읽는 순서(2026-10-07 사용자 지시):
//   ① 이 힘이 무엇인가 ② 수능에서 왜 중요한가 ③ 내 기출 기록에서 보인 것 ④ 지금 확인할 것(확인하기 과제)
//   ⑤ 원인이 확인되면 이어지는 학습(바로잡기 → 다른 문제에 적용하기 → 다시 확인하기 — 지금은 열지 않음) ⑥ 상세 근거(접힘)
// 라인 코드 · 내부 분류명 · 표시 기준은 ⑥ 「상세 근거」 안에만 둔다. 원인 확인 전에는 처방처럼 보이지 않게 — 확인하기만 지금 할 일.

'use client'

import { BookOpen, ChevronDown, ClipboardCheck, Eye, Lightbulb, Lock, Route, Search, X, Target, HelpCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { CORE_STATUS_LABEL, LEGACY_PROXY_LABEL, THRESHOLD_NOTE } from '@/lib/csat/map/core'
import { EVIDENCE_LABEL, STAGE_WORD, type StepView } from '@/lib/csat/map/learner-path'
import type { MapPageData } from '@/lib/csat/map/load'
import { FIND_STATE_LABEL, findOutcome } from '@/lib/knowledge/find-outcome'
import { decideStep } from '@/lib/knowledge/learning-decision'
import { PRACTICE_SLUG } from '@/lib/knowledge/practice'
import type { PracticeResult } from '@/lib/csat/map/practice-results'
import { STAGE_ORDER, stageOf } from '@/lib/csat/map/prescription'

import { useModalFocus } from '../useModalFocus'

import { STEP_ICON } from './icons'
import p from './popup.module.css'
import { stepGoalLink } from '@/lib/csat/map/goal-view'
import l from './learner.module.css'
import type { useTaskDone } from './useTaskDone'

export function StepSheet({ data, step, tasks, onClose, startAt }: { data: MapPageData; step: StepView; tasks: ReturnType<typeof useTaskDone>; onClose: () => void; startAt?: 'check' }) {
  const ref = useModalFocus<HTMLDivElement>()
  const [more, setMore] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => {
    if (startAt === 'check') document.getElementById('step-check')?.scrollIntoView({ block: 'start' })
  }, [startAt])
  const lineTasks = data.tasks.filter((t) => step.lines.includes(t.line_code))
  const find = lineTasks.filter((t) => stageOf(t.id) === 'FIND')
  // 확인 문항 결과 → 확인된 학습 요구(서로 다른 확인 문항 2개 이상 · 독립 첫 시도). 연결된 확인 문항이 있을 때만
  const findTargets = find.map((t) => data.practiceLinks?.[t.id]).filter((x): x is NonNullable<typeof x> => !!x).flatMap((x) => (x.confirm ?? [x]).map((c) => ({ itemRef: c.target, taskKey: c.taskKey })))
  // 확인 기록을 못 읽었으면(undefined) 판정하지 않는다 — 「아직 확인 안 함」으로 잘못 보이지 않게
  const outcome = findTargets.length && data.findAttempts ? findOutcome(findTargets, data.findAttempts) : null
  // 원리 기반 학습 결정 — 확인된 요구 → 다음 할 일(정책 버전 · 원리 · 방법 id 를 함께 남긴다)
  const decisionTask = find.find((t) => data.practiceLinks?.[t.id]?.chain)
  const decisionLink = decisionTask ? data.practiceLinks?.[decisionTask.id] : undefined
  const decision = decisionTask && decisionLink?.chain && data.findAttempts
    ? decideStep({
        stepKey: step.key,
        findTaskId: decisionTask.id,
        outcome,
        chain: decisionLink.chain,
        confirm: decisionLink.confirm.map((c) => ({ itemRef: c.target, href: c.href, label: c.label })),
        triedItems: [...new Set(data.findAttempts.filter((f) => f.phase === 'practice' && decisionLink.confirm.some((c) => c.target === f.itemRef && c.taskKey === f.taskKey)).map((f) => f.itemRef))],
        practiceHref: decisionLink.taskKey === PRACTICE_SLUG ? `/csat/practice/${PRACTICE_SLUG}` : null,
      })
    : null
  const later = STAGE_ORDER.filter((s) => s !== 'FIND').map((s) => ({ stage: s, tasks: lineTasks.filter((t) => stageOf(t.id) === s) }))
  const nameOf = (code: string) => data.nodes.find((n) => n.code === code)?.name ?? code
  const Icon = STEP_ICON[step.key]
  const link = stepGoalLink(step, data.model)
  // 직접 확인 전에는 원인을 모른다 — 관찰은 결과의 모습일 뿐이다(verified_diagnosis 게이트)
  const unknown =
    step.evidence === 'verified'
      ? '직접 확인한 원인이 있어요. 새 시험이나 다시 확인에서 같은 모습이 이어지는지는 아직 몰라요.'
      : step.evidence === 'none' || step.evidence === 'pending' || step.evidence === 'more'
        ? '이 단계가 지금 어떤지 판단할 기록이 아직 부족해요.'
        : '틀린 이유가 정말 이 단계 때문인지는 아직 몰라요. 확인 활동을 해 봐야 알 수 있어요.'
  const a = step.axisView
  const observed =
    step.evidence === 'none'
      ? '아직 이 단계를 볼 기출 기록이 없어요. 시험을 기록하면 보여요.'
      : step.evidence === 'pending'
        ? '기록은 받았지만, 기록한 시험의 단계별 분석이 아직 준비 중이에요.'
      : step.evidence === 'more'
        ? '기록이 조금 있지만 판단하기엔 모자라요. 시험을 더 기록하면 보여요.'
        : step.evidence === 'focus'
          ? '최근 기출 기록에서 이 단계를 먼저 확인할 필요가 보였어요. 아직 약점으로 확정된 것은 아니에요.'
          : step.evidence === 'verified'
            ? '직접 확인한 결과가 있어요.'
            : '기출 기록에서 이 단계가 관찰됐어요. 원인을 확인하기 전이라 실력으로 판정하지 않아요.'

  return (
    <div className={p.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`${p.modal} ${l.sheet}`} role="dialog" aria-modal="true" aria-labelledby="step-title" data-step-sheet={step.key}>
        <div className={p.head}>
          <span className={l.sheetIcon} aria-hidden="true">
            <Icon size={16} strokeWidth={1.9} aria-hidden={true} />
          </span>
          <h2 id="step-title" className={l.sheetTitle}>{step.name}</h2>
          <span className={l.badge} data-e={step.evidence}>{EVIDENCE_LABEL[step.evidence]}</span>
          <button type="button" className={l.close} onClick={onClose} aria-label="닫기">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className={`${p.body} ${l.sheetBody}`}>
          <section className={l.block}>
            <h3 className={l.blockH}><BookOpen size={14} strokeWidth={1.9} aria-hidden="true" />이 힘은</h3>
            <p className={l.lead}>{step.what}</p>
          </section>
          <section className={l.block}>
            <h3 className={l.blockH}><Lightbulb size={14} strokeWidth={1.9} aria-hidden="true" />수능에서 왜 중요한가</h3>
            <p className={l.text}>{step.why}</p>
          </section>
          <section className={l.block} data-testid="step-goal-link">
            <h3 className={l.blockH}><Target size={14} strokeWidth={1.9} aria-hidden="true" />목표와의 관계</h3>
            <p className={l.text}>
              {link
                ? <>목표 점수를 계산하는 평가원 최근 {link.exams}회에서 이 단계가 쓰이는 문항은 한 회에 평균 <strong>{link.itemsPerExam}문항 · {link.pointsPerExam}점</strong>이에요{data.model.goalSet ? ` · 목표 ${data.model.goal}점은 한 회 100점 중 ${100 - data.model.goal}점까지 놓쳐도 되는 점수예요` : ''}. 이 단계를 연습하면 몇 점이 오른다는 뜻은 아니에요.</>
                : '목표 계산 기준 시험에서 이 단계에 바로 이어진 문항을 아직 정하지 못했어요. 다른 단계의 문항을 풀 때 함께 쓰이는 힘이에요.'}
            </p>
          </section>
          <section className={l.block}>
            <h3 className={l.blockH}><Eye size={14} strokeWidth={1.9} aria-hidden="true" />내 기출 기록에서</h3>
            <p className={l.text}>{observed}</p>
          </section>
          <section className={l.block} data-testid="step-unknown">
            <h3 className={l.blockH}><HelpCircle size={14} strokeWidth={1.9} aria-hidden="true" />아직 모르는 것</h3>
            <p className={l.text}>{unknown}</p>
          </section>
          <section className={`${l.block} ${l.now}`} id="step-check">
            <h3 className={l.blockH}><Search size={14} strokeWidth={1.9} aria-hidden="true" />지금 확인할 것 — {STAGE_WORD.FIND}</h3>
            {outcome && (
              <p className={l.text} data-testid="find-outcome" data-state={outcome.state}>
                <strong>직접 확인 결과 · {FIND_STATE_LABEL[outcome.state]}</strong> — {outcome.message}
              </p>
            )}
            {decision && decision.action !== 'no_principle' && (
              <p
                className={l.text}
                data-testid="learning-decision"
                data-action={decision.action}
                data-policy={decision.trace.policyVersion}
                data-principle={decision.trace.principleId ?? ''}
                data-method={decision.trace.methodId ?? ''}
                data-task-item={decision.trace.taskId ?? ''}
                data-versions={JSON.stringify(decision.trace.versions)}
                data-observation={JSON.stringify(decision.trace.observation)}
                data-reason={decision.reason}
              >
                <strong>다음 할 일</strong> — {decision.message}
                {decision.href && (
                  <>
                    {' '}
                    <a href={decision.href} className={l.taskMeta} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', textDecoration: 'underline' }} data-testid="learning-decision-link">
                      {decision.hrefLabel} →
                    </a>
                  </>
                )}
              </p>
            )}
            {find.length === 0 ? (
              <p className={l.text}>이 단계의 확인 활동은 아직 없어요.</p>
            ) : (
              <ul className={l.tasks}>
                {find.map((t) => {
                  const on = tasks.done.has(t.id)
                  return (
                    <li key={t.id} className={`${l.task} ${on ? l.taskDone : ''}`}>
                      <label className={l.taskCheck}>
                        <input type="checkbox" checked={on} onChange={(e) => tasks.toggle(t.id, e.target.checked)} aria-label={`${t.title} 완료`} />
                      </label>
                      <span className={l.taskMain}>
                        <strong>{t.title}</strong>
                        <span>{t.how}</span>
                        <span className={l.taskMeta}>
                          <ClipboardCheck size={12} strokeWidth={1.9} aria-hidden="true" />
                          {t.done_when} · {t.cadence}
                        </span>
                        {(data.practiceLinks?.[t.id]?.confirm ?? (data.practiceLinks?.[t.id] ? [data.practiceLinks[t.id]] : [])).map((c) => (
                          <a key={c.target} href={c.href} className={l.taskMeta} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', textDecoration: 'underline' }} data-testid="find-practice-link" data-task={t.id} data-item={c.target}>
                            {c.label} →
                          </a>
                        ))}
                        {data.practiceResults?.[t.id] && data.practiceResults[t.id].attempts > 0 && <PracticeResultLine r={data.practiceResults[t.id]} practiceHref={data.practiceNext?.[t.id] ?? null} />}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            {tasks.err && <p className={l.err} role="alert">{tasks.err}</p>}
          </section>
          <section className={l.block}>
            <h3 className={l.blockH}><Route size={14} strokeWidth={1.9} aria-hidden="true" />원인이 확인되면 이어지는 학습</h3>
            <ol className={l.next}>
              {later.map((g) => (
                <li key={g.stage} className={l.nextStep}>
                  <span className={l.nextName}>
                    <Lock size={12} strokeWidth={1.9} aria-hidden="true" />
                    {STAGE_WORD[g.stage]}
                  </span>
                  <span className={l.nextList}>{g.tasks.length ? g.tasks.slice(0, 3).map((t) => t.title).join(' · ') : '—'}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className={l.block}>
            <button type="button" className={l.moreBtn} aria-expanded={more} onClick={() => setMore((v) => !v)}>
              <ChevronDown size={14} className={more ? l.rot : ''} aria-hidden="true" />
              상세 근거 보기
            </button>
            {more && (
              <dl className={l.detail}>
                <dt>관찰 상태(규칙 기반)</dt>
                <dd>{CORE_STATUS_LABEL[a.status]}</dd>
                <dt>{LEGACY_PROXY_LABEL}</dt>
                <dd>{a.lines.join('+')} · 라인별 기여 건수 {a.contributions}(중복 포함)</dd>
                <dt>이 단계 과제를 꺼내 오는 기출 상세 분석 항목</dt>
                <dd>{step.lines.map((c) => `${c} ${nameOf(c)}`).join(' · ')}</dd>
                <dt>표시 기준</dt>
                <dd>{THRESHOLD_NOTE}</dd>
                {a.legacyNote && (
                  <>
                    <dt>계산 메모</dt>
                    <dd>{a.legacyNote}</dd>
                  </>
                )}
              </dl>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

/** 결과 환류 — 연결된 실행 과제를 내가 어떻게 했는지. 실력 판정이 아니라 「이번 확인의 결과」로만 말한다 */
const NEXT_LINK = { minHeight: 44, display: 'inline-flex', alignItems: 'center', textDecoration: 'underline' } as const

function PracticeResultLine({ r, practiceHref }: { r: PracticeResult; practiceHref: string | null }) {
  const word = (v: boolean | null) => (v === null ? '판정 없음' : v ? '맞았어요' : '다시 볼 곳이 있었어요')
  return (
    <span className={l.taskMeta} style={{ display: 'grid', gap: 2 }} data-testid="find-practice-result" data-next={r.next} data-attempts={r.attempts}>
      <span>
        내가 한 확인 {r.attempts}번 · 처음 {word(r.firstCorrect)}
        {r.firstIndependent === false ? '(해설이나 힌트를 본 뒤였어요)' : ''}
        {r.attempts > 1 ? ` · 최근(${kstDay(r.latestAt)}) ${word(r.latestCorrect)}` : ` (${kstDay(r.latestAt)})`}
      </span>
      {r.transfer && <span data-testid="find-practice-transfer">다른 지문에 적용 {r.transfer.attempts}번 · 최근 {word(r.transfer.latestCorrect)}</span>}
      {r.reviewAt && r.next !== 'review' && <span data-testid="find-practice-review">다시 보기 예약 {kstDay(r.reviewAt)}</span>}
      <span>
        {r.next === 'retry'
          ? '다음: 결과 안내에서 짚어 준 문장을 다시 읽고, 같은 과제를 한 번 더 해 보세요.'
          : r.next === 'review'
            ? `다음: 다시 보기로 잡아 둔 때(${kstDay(r.reviewAt)})가 됐어요. 같은 과제를 다시 확인해 보세요.`
            : '다음: 이 확인은 마쳤어요. 위 체크를 표시하고 다음 확인으로 넘어가요.'}
        {' '}이번 확인의 결과일 뿐, 이 힘이 생겼다는 판정은 아니에요.
      </span>
      {/* 학습 순환의 다음 칸 — 이 문항을 마쳤으면 다른 지문에 적용(Practice), 적용도 했으면 새 기출 기록으로 목표 대비 변화를 본다 */}
      {r.next === 'move_on' && practiceHref && !r.transfer && (
        <a href={practiceHref} style={NEXT_LINK} data-testid="find-next-practice">같은 원리를 다른 지문에 적용해 보기 →</a>
      )}
      {r.next === 'move_on' && r.transfer && (
        <a href="/csat/diagnosis?tab=records&modal=new" style={NEXT_LINK} data-testid="find-next-reassess">새 기출을 풀고 기록해 목표 대비 변화 보기 →</a>
      )}
    </span>
  )
}

/** 서버 · 브라우저 시간대와 무관하게 한국 날짜(10월 8일) */
function kstDay(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000)
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`
}
