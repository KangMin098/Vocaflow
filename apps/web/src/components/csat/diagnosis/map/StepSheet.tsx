// apps/web/src/components/csat/diagnosis/map/StepSheet.tsx
//
// 학습 단계 시트 — 학습 지도에서 단계를 누르면 열린다. 학생이 읽는 순서(2026-10-07 사용자 지시):
//   ① 이 힘이 무엇인가 ② 수능에서 왜 중요한가 ③ 내 기출 기록에서 보인 것 ④ 지금 확인할 것(확인하기 과제)
//   ⑤ 원인이 확인되면 이어지는 학습(바로잡기 → 다른 문제에 적용하기 → 다시 확인하기 — 지금은 열지 않음) ⑥ 상세 근거(접힘)
// 라인 코드 · 내부 분류명 · 표시 기준은 ⑥ 「상세 근거」 안에만 둔다. 원인 확인 전에는 처방처럼 보이지 않게 — 확인하기만 지금 할 일.

'use client'

import { BookOpen, ChevronDown, ClipboardCheck, Eye, Lightbulb, Lock, Route, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { CORE_STATUS_LABEL, LEGACY_PROXY_LABEL, THRESHOLD_NOTE } from '@/lib/csat/map/core'
import { EVIDENCE_LABEL, STAGE_WORD, type StepView } from '@/lib/csat/map/learner-path'
import type { MapPageData } from '@/lib/csat/map/load'
import { STAGE_ORDER, stageOf } from '@/lib/csat/map/prescription'

import { useModalFocus } from '../useModalFocus'

import { STEP_ICON } from './icons'
import p from './popup.module.css'
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
  const later = STAGE_ORDER.filter((s) => s !== 'FIND').map((s) => ({ stage: s, tasks: lineTasks.filter((t) => stageOf(t.id) === s) }))
  const nameOf = (code: string) => data.nodes.find((n) => n.code === code)?.name ?? code
  const Icon = STEP_ICON[step.key]
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
          <section className={l.block}>
            <h3 className={l.blockH}><Eye size={14} strokeWidth={1.9} aria-hidden="true" />내 기출 기록에서</h3>
            <p className={l.text}>{observed}</p>
          </section>
          <section className={`${l.block} ${l.now}`} id="step-check">
            <h3 className={l.blockH}><Search size={14} strokeWidth={1.9} aria-hidden="true" />지금 확인할 것 — {STAGE_WORD.FIND}</h3>
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
                        {data.practiceLinks?.[t.id] && (
                          <a href={data.practiceLinks[t.id].href} className={l.taskMeta} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', textDecoration: 'underline' }} data-testid="find-practice-link" data-task={t.id}>
                            {data.practiceLinks[t.id].label} →
                          </a>
                        )}
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
