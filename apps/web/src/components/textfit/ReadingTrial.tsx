// apps/web/src/components/textfit/ReadingTrial.tsx
//
// `/fit` 고정 예시 읽기 체험 — 기존 DcpPlayer(MeaningEvidence 포함)에 로컬 채점 한 문항만 준다.
//   진단(PublicFitClient)과 형제 자리라 열고 닫아도 붙여 넣은 글 · 분석 상태가 그대로다.
//   기본 꺼짐(READING_TRIAL_ENABLED). analytics 없음 — 기존 닫힌 이벤트에 맞는 값이 없고, 새 이벤트는 DB allowlist 마이그레이션이 필요하다.
'use client'

import { useId, useRef, useState } from 'react'
import { BookOpenCheck, X } from 'lucide-react'

import { DcpPlayer } from '@/components/practice/DcpPlayer'
import { BTN, CARD } from '@/components/ui/tines-kit'
import { TRIAL_ITEM, TRIAL_WORD_HELP, gradeTrial, inertCause, trialDoneCopy } from '@/lib/textfit/reading-trial'

const ITEMS = [TRIAL_ITEM]

export function ReadingTrial() {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const openerRef = useRef<HTMLButtonElement | null>(null)
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
          <button ref={openerRef} type="button" onClick={() => setOpen(true)} className={BTN.soft} aria-controls={panelId} aria-expanded={false} data-testid="fit-trial-open">
            <BookOpenCheck size={15} strokeWidth={2} aria-hidden />
            예시로 해 보기
          </button>
        )}
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
          />
        </div>
      )}
    </div>
  )
}
