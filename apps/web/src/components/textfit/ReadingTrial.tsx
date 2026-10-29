// apps/web/src/components/textfit/ReadingTrial.tsx
//
// `/fit` 고정 예시 읽기 체험 — 기존 DcpPlayer(MeaningEvidence 포함)에 로컬 채점 한 문항만 준다.
//   진단(PublicFitClient)과 형제 자리라 열고 닫아도 붙여 넣은 글 · 분석 상태가 그대로다.
//   기본 꺼짐(READING_TRIAL_ENABLED). 계측은 두 건뿐 — 직접 열기(fit_trial_opened) · 채점 성공(fit_trial_answered), 속성 {}.
//   DB 허용 목록은 20261028015035_fit_trial_telemetry_events 로 이미 적용됐다. 목표 토글 · 닫기 · 다시 보기 · 채점 실패는 보내지 않는다.
'use client'

import { useId, useRef, useState } from 'react'
import { BookOpenCheck, X } from 'lucide-react'

import { DcpPlayer } from '@/components/practice/DcpPlayer'
import { track } from '@/lib/analytics/client'
import { BTN, CARD } from '@/components/ui/tines-kit'
import { TRIAL_ITEM, TRIAL_WORD_HELP, gradeTrial, inertCause, trialDoneCopy } from '@/lib/textfit/reading-trial'

const ITEMS = [TRIAL_ITEM]

/** 이번 체험의 잠정 목표(D2 §9 무강제 첫 목표) — 브라우저 메모리에만. profile · 저장소 · cookie · DB 에 쓰지 않는다. */
export const TRIAL_GOAL_LABEL = '짧은 영어 글을 읽고 핵심 내용을 확인해 보기'
export const TRIAL_GOAL_REASON = '핵심 내용을 확인하는 목표라서, 짧은 글의 중심 내용을 고르고 본문 문장 근거와 해설을 비교하는 안내 연습을 먼저 권해요.'
export const TRIAL_GOAL_NOTES = ['이번 체험에서만 선택하며 저장하지 않아요', '독해 실력을 측정한 추천이 아니에요'] as const

export function ReadingTrial() {
  const [open, setOpen] = useState(false)
  // 잠정 목표 — 토글해도 아래 DcpPlayer 의 자리 · key · items · grade 는 그대로다(답 · 근거 · 제출 수 보존)
  const [goal, setGoal] = useState(false)
  const panelId = useId()
  const openerRef = useRef<HTMLButtonElement | null>(null)
  /** 닫힌 → 열린 사용자 동작에서만 센다 */
  const openByUser = () => {
    setOpen(true)
    track({ name: 'fit_trial_opened', props: {} })
  }
  /** 로컬 채점 성공에서만(DcpPlayer onGraded 는 실패 때 부르지 않는다) — 결과는 싣지 않는다 */
  const onGraded = () => track({ name: 'fit_trial_answered', props: {} })
  const close = () => {
    setOpen(false)
    requestAnimationFrame(() => openerRef.current?.focus())
  }
  return (
    <div id="fit-reading-trial" className={`${CARD.line} flex flex-col gap-3 p-4 md:p-6`} data-testid="fit-reading-trial">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 break-keep font-display text-[15px] font-[700] text-[var(--t1)]">짧은 글 하나로 의미 골라 보기</p>
          <p className="m-0 mt-1 break-keep font-body text-[12.5px] text-[var(--t2)]" data-testid="fit-trial-notice">
            예시 안내 연습 · 학습 기록에 포함되지 않음
          </p>
        </div>
        {open ? (
          <button type="button" onClick={close} className={BTN.secondary} aria-controls={panelId} aria-expanded data-testid="fit-trial-close">
            <X size={15} strokeWidth={2} aria-hidden />
            닫기
          </button>
        ) : (
          <button ref={openerRef} type="button" onClick={openByUser} className={BTN.soft} aria-controls={panelId} aria-expanded={false} data-testid="fit-trial-open">
            <BookOpenCheck size={15} strokeWidth={2} aria-hidden />
            {goal ? '이 목표로 첫 연습 열기' : '예시로 해 보기'}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2" data-testid="fit-trial-goal">
        <button
          type="button"
          aria-pressed={goal}
          onClick={() => setGoal((g) => !g)}
          className={`${goal ? BTN.soft : BTN.secondary} self-start`}
          data-testid="fit-trial-goal-toggle"
        >
          {TRIAL_GOAL_LABEL}
        </button>
        {goal && (
          <p className="m-0 break-keep font-body text-[12.5px] text-[var(--t1)]" data-testid="fit-trial-goal-reason">
            {TRIAL_GOAL_REASON}
          </p>
        )}
        <p className="m-0 break-keep font-body text-[12px] text-[var(--t2)]" data-testid="fit-trial-goal-notes">
          {TRIAL_GOAL_NOTES.join(' · ')}
        </p>
      </div>
      {open && (
        <div id={panelId} className="flex flex-col gap-3">
          <details className="rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] px-3">
            <summary className="flex min-h-[44px] cursor-pointer items-center break-keep font-display text-[12.5px] font-[700] text-[var(--t2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]">
              낱말 도움(선택)
            </summary>
            <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 pb-3 font-body text-[12.5px] text-[var(--t2)]">
              {TRIAL_WORD_HELP.map((w) => (
                <li key={w.word}>
                  <span className="font-english text-[var(--t1)]">{w.word}</span> {w.ko}
                </li>
              ))}
            </ul>
          </details>
          <DcpPlayer
            items={ITEMS}
            grade={gradeTrial}
            recordCause={inertCause}
            revisit
            causeChips={false}
            doneCopy={trialDoneCopy}
            backHref="#fit-reading-trial"
            backCta="체험 닫기"
            onBack={close}
            onGraded={onGraded}
          />
        </div>
      )}
    </div>
  )
}
