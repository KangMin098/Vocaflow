// apps/web/src/components/csat/diagnosis/map/LearnerMap.tsx
//
// 학습 지도 첫 화면(?tab=map) — 학생 · 학부모가 설명을 읽지 않고 5초 안에 알게 한다(2026-10-07 사용자 지시):
//   ① 수능 영어 실력이 만들어지는 순서(읽기 길 7단계 + 듣기 보조 트랙)  ② 지금 먼저 확인할 것 하나(+ 다음 후보 하나)
//   ③ 그 이유  ④ 누르면 하는 일(확인 시작 → 그 단계의 「확인하기」 활동).
// 내부 용어(observation · FIND · 라인 코드 · 0.6/0.8 · 54라인 호환)는 이 화면에 쓰지 않는다 — 단계 시트의 「상세 근거」 · 기출 상세 분석에만.
// 원인 확인(verified_diagnosis) 전에는 약점 · 처방을 확정하지 않는다(learner-path · core · prescription 의 게이트 그대로).

'use client'

import { ArrowRight, ChevronRight, GitCompareArrows, ClipboardList, FileBarChart2, Headphones, Pencil, PlayCircle, Route, Target } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import type { DistinguishActivity } from '@/lib/csat/map/distinguish'
import { EVIDENCE_LABEL, JOURNEY, learnerPath, stepByKey, type StepKey, type StepView } from '@/lib/csat/map/learner-path'
import type { MapPageData } from '@/lib/csat/map/load'

import { GoalPopover, scoreLine, useGoal } from './GoalBar'
import { STEP_ICON } from './icons'
import l from './learner.module.css'
import { StepSheet } from './StepSheet'
import { useTaskDone } from './useTaskDone'

export function LearnerMap({ data, detailHref, recordHref, recordsHref }: { data: MapPageData; detailHref: string; recordHref: string; recordsHref: string }) {
  const path = learnerPath(data.model, data.settings)
  const g = useGoal(data)
  const tasks = useTaskDone(data.doneTaskIds)
  const [open, setOpen] = useState<{ key: StepKey; startAt?: 'check' } | null>(null)
  const all = [...path.read, ...path.listen]
  const viewOf = (k: StepKey) => all.find((s) => s.key === k) as StepView
  const focus = path.focus

  return (
    <div className={l.wrap} data-testid="learner-map" data-journey={path.journey}>
      {/* 목표 — 목표 점수는 여기서 정한다 */}
      <section className={l.goal} aria-label="최종 목표">
        <span className={l.goalIcon} aria-hidden="true">
          <Target size={18} strokeWidth={1.9} />
        </span>
        <span className={l.goalText}>
          <span className={l.goalLabel}>최종 목표</span>
          <span className={l.goalValue}>
            수능 영어 <strong>{g.goal}점</strong>
          </span>
        </span>
        <span className={l.goalSub} data-testid="map-score">{scoreLine(data)}</span>
        <GoalPopover
          data={data}
          g={g}
          align="end"
          trigger={({ open: on, toggle, id }) => (
            <button type="button" className={l.ghostBtn} onClick={toggle} aria-expanded={on} aria-controls={id} data-testid="map-goal-edit">
              <Pencil size={13} strokeWidth={1.9} aria-hidden="true" />
              목표 바꾸기
            </button>
          )}
        />
      </section>

      {/* ① 수능 영어 실력이 만들어지는 길 */}
      <section className={l.pathCard} aria-labelledby="path-h">
        <h2 id="path-h" className={l.h}>
          <Route size={16} strokeWidth={1.9} aria-hidden="true" />
          수능 영어 독해 실력이 만들어지는 길
        </h2>
        <ol className={l.path} data-testid="read-path">
          {path.read.map((s, i) => (
            <StepNode key={s.key} s={s} i={i} last={i === path.read.length - 1} onOpen={() => setOpen({ key: s.key })} />
          ))}
        </ol>
        <div className={l.listen} data-testid="listen-path">
          <span className={l.listenLabel}>
            <Headphones size={14} strokeWidth={1.9} aria-hidden="true" />
            듣기
          </span>
          <ol className={l.listenPath}>
            {path.listen.map((s, i) => (
              <li key={s.key} className={l.listenStep}>
                <button type="button" className={l.listenBtn} data-step={s.key} data-e={s.evidence} onClick={() => setOpen({ key: s.key })}>
                  {s.name}
                  <span className={l.listenBadge}>{EVIDENCE_LABEL[s.evidence]}</span>
                </button>
                {i < path.listen.length - 1 && <ChevronRight size={14} className={l.listenArrow} aria-hidden="true" />}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ② 지금 먼저 확인할 것 — 하나만 */}
      <div className={l.row}>
        <section className={l.focus} aria-labelledby="focus-h" data-testid="focus-card" data-focus={focus.kind}>
          <h2 id="focus-h" className={l.focusEyebrow}>지금 먼저 확인할 것</h2>
          {focus.kind === 'step' ? (
            <FocusStep s={viewOf(focus.step)} unobserved={focus.provisional?.unobserved.map((k) => stepByKey(k).name) ?? null} onStart={() => setOpen({ key: focus.step, startAt: 'check' })} />
          ) : focus.kind === 'distinguish' ? (
            <FocusDistinguish title={focus.title} activity={focus.activity} why={DISTINGUISH_WHY} />
          ) : focus.kind === 'direct' ? (
            <FocusDistinguish title={focus.title} activity={focus.activity} why={DIRECT_WHY} />
          ) : focus.kind === 'record' ? (
            <>
              <p className={l.focusTitle}>
                <ClipboardList size={20} strokeWidth={1.9} aria-hidden="true" />
                기출 시험 기록하기
              </p>
              <p className={l.focusWhy}>시험 한 회를 기록하면 어느 단계를 먼저 확인할지 보여요.</p>
              <Link href={recordHref} className={l.cta} data-testid="focus-cta">
                <PlayCircle size={16} strokeWidth={1.9} aria-hidden="true" />
                시험 기록 시작
              </Link>
            </>
          ) : focus.kind === 'pending' ? (
            <>
              <p className={l.focusTitle}>
                <ClipboardList size={20} strokeWidth={1.9} aria-hidden="true" />
                기록은 잘 저장됐어요
              </p>
              <p className={l.focusWhy}>기록한 시험의 단계별 분석이 아직 준비 중이에요. 준비되면 여기서 먼저 확인할 단계를 바로 보여 드려요. 점수 흐름은 지금도 시험 기록에서 볼 수 있어요.</p>
              <Link href={recordsHref} className={l.cta} data-testid="focus-cta">
                <PlayCircle size={16} strokeWidth={1.9} aria-hidden="true" />
                시험 기록 보기
              </Link>
            </>
          ) : focus.kind === 'more' ? (
            <>
              <p className={l.focusTitle}>
                <ClipboardList size={20} strokeWidth={1.9} aria-hidden="true" />
                {stepByKey(focus.step).name} — 기록이 더 필요해요
              </p>
              <p className={l.focusWhy}>아직 먼저 확인할 단계를 고를 만큼 기록이 쌓이지 않았어요. 시험을 한 회 더 기록해 주세요.</p>
              <Link href={recordHref} className={l.cta} data-testid="focus-cta">
                <PlayCircle size={16} strokeWidth={1.9} aria-hidden="true" />
                시험 더 기록하기
              </Link>
            </>
          ) : (
            <>
              <p className={l.focusTitle}>지금 먼저 확인할 단계가 없어요</p>
              <p className={l.focusWhy}>최근 기록에서 따로 먼저 확인할 단계가 보이지 않아요. 기록을 이어 가 주세요.</p>
              <Link href={recordHref} className={l.cta} data-testid="focus-cta">
                <PlayCircle size={16} strokeWidth={1.9} aria-hidden="true" />
                시험 기록하기
              </Link>
            </>
          )}
          {focus.kind === 'step' && focus.next && (
            <button type="button" className={l.nextCand} onClick={() => setOpen({ key: focus.next as StepKey })}>
              다음 후보 <strong>{stepByKey(focus.next).name}</strong>
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          )}
        </section>

        {/* 학생 여정 — 내부 판정 순서를 학생 말로 */}
        <section className={l.journey} aria-label="진단 진행">
          <ol className={l.journeyList}>
            {JOURNEY.map((j) => {
              const idx = JOURNEY.findIndex((x) => x.phase === path.journey)
              const me = JOURNEY.findIndex((x) => x.phase === j.phase)
              return (
                <li key={j.phase} className={l.journeyStep} data-state={me < idx ? 'done' : me === idx ? 'now' : 'later'} aria-current={me === idx ? 'step' : undefined}>
                  <span className={l.journeyDot} aria-hidden="true" />
                  {j.label}
                </li>
              )
            })}
          </ol>
          <Link href={detailHref} className={l.detailLink} data-testid="map-full-link">
            <FileBarChart2 size={14} strokeWidth={1.9} aria-hidden="true" />
            기출 상세 분석
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </section>
      </div>

      {open && <StepSheet data={data} step={viewOf(open.key)} tasks={tasks} startAt={open.startAt} onClose={() => setOpen(null)} />}
    </div>
  )
}

function StepNode({ s, i, last, onOpen }: { s: StepView; i: number; last: boolean; onOpen: () => void }) {
  const Icon = STEP_ICON[s.key]
  return (
    // data-observed · data-estimate — 관리자 · 디버그 추적용(관찰값 vs 순위 추정 RANKING_SHRINK). 화면에는 내지 않는다
    <li className={l.step} data-e={s.evidence} data-observed={s.axisView.observed?.toFixed(3)} data-estimate={s.axisView.rankingEstimate?.toFixed(3)}>
      <button type="button" className={l.stepBtn} data-step={s.key} onClick={onOpen} aria-label={`${i + 1}단계 ${s.name} — ${EVIDENCE_LABEL[s.evidence]}`}>
        <span className={l.stepNum} aria-hidden="true">{i + 1}</span>
        <span className={l.stepIcon} aria-hidden="true">
          <Icon size={20} strokeWidth={1.8} aria-hidden={true} />
        </span>
        <span className={l.stepName}>{s.name}</span>
        <span className={l.stepBadge}>{EVIDENCE_LABEL[s.evidence]}</span>
      </button>
      {!last && <span className={l.connector} aria-hidden="true" />}
    </li>
  )
}

function FocusStep({ s, unobserved, onStart }: { s: StepView; unobserved: string[] | null; onStart: () => void }) {
  const Icon = STEP_ICON[s.key]
  return (
    <>
      <p className={l.focusTitle}>
        <span className={l.focusIcon} aria-hidden="true">
          <Icon size={18} strokeWidth={1.9} aria-hidden={true} />
        </span>
        {s.name}
      </p>
      {unobserved ? (
        // 현재 근거상 단독 우선 후보 — 비교할 단계가 근거 부족으로 빠져 1위가 된 경우(확신을 낮춘 문구 · 행동은 같다)
        <p className={l.focusWhy} data-testid="focus-provisional">
          현재 기록에서는 {josa(s.name, '을', '를')} 먼저 확인해 볼게요. {josa(unobserved.join(' · '), '은', '는')} 아직 판단할 기록이 부족해요. <strong>약점으로 확정된 것은 아니에요.</strong>
        </p>
      ) : (
        <p className={l.focusWhy}>
          최근 기출 기록에서 {s.name} 단계를 확인할 필요가 보였어요. <strong>아직 약점으로 확정된 것은 아니에요.</strong>
        </p>
      )}
      <button type="button" className={l.cta} onClick={onStart} data-testid="focus-cta">
        <PlayCircle size={16} strokeWidth={1.9} aria-hidden="true" />
        확인 시작
      </button>
    </>
  )
}

/** 1위를 믿을 수 없을 때 — 두 후보를 가르는 확인 하나(행동 하나 원칙 그대로). 약점을 정하지 않는다 */
const DISTINGUISH_WHY = (
  <>
    최근 기출 기록만으로는 어느 쪽이 먼저인지 가르기 어려웠어요. <strong>한 번 가려 보고 정할게요.</strong>
  </>
)
const DIRECT_WHY = (
  <>
    기출 오답만으로는 이 단계를 따로 볼 수 없어요. <strong>약점으로 정한 것이 아니라, 직접 확인해서 알아보려는 거예요.</strong>
  </>
)

function FocusDistinguish({ title, activity, why }: { title: string; activity: DistinguishActivity; why: React.ReactNode }) {
  const [started, setStarted] = useState(false)
  return (
    <>
      <p className={l.focusTitle}>
        <span className={l.focusIcon} aria-hidden="true">
          <GitCompareArrows size={18} strokeWidth={1.9} aria-hidden={true} />
        </span>
        {title}
      </p>
      <p className={l.focusWhy}>{why}</p>
      {started ? (
        <div className={l.distBox} data-testid="distinguish-activity">
          <ol className={l.distList}>
            {activity.how.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ol>
          <p className={l.distRead}>{activity.read}</p>
          <p className={l.distTime}>{activity.time}</p>
        </div>
      ) : (
        <button type="button" className={l.cta} onClick={() => setStarted(true)} data-testid="focus-cta">
          <PlayCircle size={16} strokeWidth={1.9} aria-hidden="true" />
          확인 시작
        </button>
      )}
    </>
  )
}

/** 받침에 맞는 조사(한글이 아니면 뒤 것) */
function josa(word: string, withFinal: string, without: string) {
  const c = word.charCodeAt(word.length - 1)
  const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0
  return word + (has ? withFinal : without)
}
