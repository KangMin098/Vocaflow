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

import { EVIDENCE_GROUP_LABEL, evidenceCounts, goalSummary } from '@/lib/csat/map/goal-view'

import { GoalPopover, useGoal } from './GoalBar'
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

  const gs = goalSummary({ goal: g.goal, goalSet: data.model.goalSet || g.saved }, data.records)
  const counts = evidenceCounts(path.read)

  return (
    <div className={l.wrap} data-testid="learner-map" data-journey={path.journey} data-goal-set={gs.goalSet}>
      {/* ⓪ 내 목표 · 현재 위치 — 화면의 출발점(2026-10-08 목표 중심 재설계). 시험상 · 학습상 · 진단상 위치를 하나로 합치지 않는다 */}
      <section className={l.goalBar} aria-labelledby="goal-h" data-testid="goal-header">
        <div className={l.goalCell}>
          <h2 id="goal-h" className={l.cellLabel}>
            <Target size={13} strokeWidth={1.9} aria-hidden="true" />내 목표
          </h2>
          {gs.goalSet ? (
            <>
              <p className={l.goalBig} data-testid="goal-value">수능 영어 <strong>{gs.goal}점</strong></p>
              <p className={l.cellSub}>{gs.goalGrade}등급 구간({gs.goalBand}) · 절대평가</p>
            </>
          ) : (
            <>
              <p className={l.goalBig} data-testid="goal-value">아직 정하지 않았어요</p>
              <p className={l.cellSub}>목표를 정하면 각 단계가 목표 점수와 어떤 관계인지 함께 보여 드려요.</p>
            </>
          )}
          {gs.goalSet && (
            <GoalPopover
              data={data}
              g={g}
              trigger={({ open: on, toggle, id }) => (
                <button type="button" className={l.ghostBtn} onClick={toggle} aria-expanded={on} aria-controls={id} data-testid="map-goal-edit">
                  <Pencil size={13} strokeWidth={1.9} aria-hidden="true" />
                  목표 바꾸기
                </button>
              )}
            />
          )}
        </div>
        <div className={l.goalCell} data-testid="position-exam">
          <h3 className={l.cellLabel}>시험 기록으로 본 지금</h3>
          {gs.latest ? (
            <>
              <p className={l.goalBig}>최근 <strong>{gs.latest.raw}점</strong> · {gs.latest.grade}등급</p>
              <p className={l.cellSub}>{gs.latest.label} · {gs.latest.takenAt.slice(0, 10)} · 기록 {gs.recordCount}회</p>
              {gs.previous && (
                <p className={l.cellChange} data-testid="position-change">
                  이전 {gs.previous.raw}점({gs.previous.takenAt.slice(5, 10).replace('-', '.')}) → 최근 {gs.latest.raw}점 · {signed(gs.latest.raw - gs.previous.raw)}
                </p>
              )}
            </>
          ) : (
            <>
              <p className={l.goalBig}>기록 없음</p>
              <p className={l.cellSub}>기출 시험을 기록하면 실제 점수로 보여 드려요.</p>
            </>
          )}
        </div>
        <div className={l.goalCell} data-testid="position-gap">
          <h3 className={l.cellLabel}>목표까지</h3>
          {gs.gap === null ? (
            <p className={l.cellSub}>{gs.goalSet ? '시험 기록이 생기면 실제 점수와의 거리를 보여 드려요.' : '목표와 기록이 둘 다 있을 때 보여요.'}</p>
          ) : gs.gap === 0 ? (
            <p className={l.goalBig}>목표 점수에 닿았어요</p>
          ) : (
            <>
              <p className={l.goalBig}><strong>{gs.gap}점</strong> 남음</p>
              <p className={l.cellSub}>최근 기록 원점수 기준이에요.</p>
            </>
          )}
        </div>
        <div className={l.goalCell} data-testid="position-diagnosis">
          <h3 className={l.cellLabel}>읽기 7단계 근거 상태</h3>
          <ul className={l.countList}>
            {/* 「직접 확인됨」은 실제로 있을 때만 — 검증 전 화면에 그 말이 보이지 않게(map-states 회귀 · verified 게이트) */}
            {(['observed', 'check', 'thin', 'verified'] as const).filter((k) => k !== 'verified' || counts.verified > 0).map((k) => (
              <li key={k} data-group={k}>
                {EVIDENCE_GROUP_LABEL[k]} <strong>{counts[k]}</strong>
              </li>
            ))}
          </ul>
        </div>
        <p className={l.goalNote} data-testid="map-score">
          목표 점수의 계산 기준은 평가원 최근 {data.model.reference.exams.length}회의 문항 · 배점이에요(내 기록과 별개). 단계 상태는 실력 점수가 아니에요.
        </p>
      </section>

      <div className={l.main}>
      {/* ① 목표에 가는 영어의 길 */}
      <section className={l.pathCard} aria-labelledby="path-h">
        <h2 id="path-h" className={l.h}>
          <Route size={16} strokeWidth={1.9} aria-hidden="true" />
          {gs.goalSet ? `목표 ${gs.goal}점으로 가는 영어 독해의 길` : '수능 영어 독해 실력이 만들어지는 길'}
        </h2>
        <p className={l.pathHint}>단계를 누르면 이 힘이 무엇인지 · 왜 필요한지 · 목표와 어떤 관계인지 · 내 기록에서 보인 것을 볼 수 있어요.</p>
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

      {/* ② 지금 먼저 할 일 — 하나만(우측). 목표를 정하기 전에는 목표 정하기가 그 하나다 */}
      <div className={l.side}>
        <section className={l.focus} aria-labelledby="focus-h" data-testid="focus-card" data-focus={gs.goalSet ? focus.kind : 'goal'}>
          <h2 id="focus-h" className={l.focusEyebrow}>지금 먼저 할 일</h2>
          {!gs.goalSet ? (
            <>
              <p className={l.focusTitle}>
                <span className={l.focusIcon} aria-hidden="true">
                  <Target size={18} strokeWidth={1.9} aria-hidden={true} />
                </span>
                목표 점수 정하기
              </p>
              <p className={l.focusWhy}>어디까지 갈지 정하면 목표까지의 거리와, 각 단계가 목표 점수와 어떤 관계인지 보여 드려요. 먼저 확인할 것은 목표와 상관없이 내 기록으로 정해요.</p>
              <div className={l.popInk}>
              <GoalPopover
                data={data}
                g={g}
                trigger={({ open: on, toggle, id }) => (
                  <button type="button" className={l.cta} onClick={toggle} aria-expanded={on} aria-controls={id} data-testid="focus-cta">
                    <Target size={16} strokeWidth={1.9} aria-hidden="true" />
                    목표 정하기
                  </button>
                )}
              />
              </div>
            </>
          ) : focus.kind === 'step' ? (
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

/** 변화량 부호 — 실제 두 기록의 차이(추정 아님) */
function signed(n: number) {
  return n > 0 ? `+${n}점` : n < 0 ? `${n}점` : '변화 없음'
}

/** 받침에 맞는 조사(한글이 아니면 뒤 것) */
function josa(word: string, withFinal: string, without: string) {
  const c = word.charCodeAt(word.length - 1)
  const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0
  return word + (has ? withFinal : without)
}
